import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Keyboard,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { getAddressFromCoordinates } from '../../utils/addressFromLocation';
import { adminService } from '../../services/adminService';
import type { AdminSupervisor } from '../../services/adminService';
import { type ZoneDummy } from './AdminZonesScreen';

const DEFAULT_DELTA = 0.05;
const MIN_DELTA = 0.002;
const MAX_DELTA = 1;

async function searchPlace(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!query.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'TandilAdmin/1.0' },
    });
    const data = await res.json();
    const first = data?.[0];
    if (first?.lat != null && first?.lon != null) {
      return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
    }
  } catch (_) {}
  return null;
}

const AdminZoneAssignScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const zone = route.params?.zone as ZoneDummy | undefined;
  const mapRef = useRef<MapView>(null);

  const [supervisors, setSupervisors] = useState<AdminSupervisor[]>([]);
  const [supervisorsLoading, setSupervisorsLoading] = useState(true);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(
    zone?.supervisorId ?? null
  );
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [zoneLat, setZoneLat] = useState(zone?.lat ?? 0);
  const [zoneLng, setZoneLng] = useState(zone?.lng ?? 0);
  const [zoneAddress, setZoneAddress] = useState(zone?.address ?? '');
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminService.getSupervisors({ per_page: 100 });
        if (!cancelled) setSupervisors(res.data ?? []);
      } catch {
        if (!cancelled) setSupervisors([]);
      } finally {
        if (!cancelled) setSupervisorsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (zone?.supervisorId) setSelectedSupervisorId(zone.supervisorId);
  }, [zone?.supervisorId]);

  useEffect(() => {
    if (zone) {
      setZoneLat(zone.lat);
      setZoneLng(zone.lng);
      setZoneAddress(zone.address || zone.name || '');
    }
  }, [zone?.id]);

  // When API gives no coordinates, geocode zone location so map shows the right place
  useEffect(() => {
    if (!zone || (zone.lat !== 0 || zone.lng !== 0)) return;
    const locationText = (zone.address || zone.name || '').trim();
    if (!locationText) return;
    let cancelled = false;
    (async () => {
      const result = await searchPlace(locationText);
      if (cancelled || !result) return;
      setZoneLat(result.lat);
      setZoneLng(result.lng);
      mapRef.current?.animateToRegion({
        latitude: result.lat,
        longitude: result.lng,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      }, 400);
    })();
    return () => { cancelled = true; };
  }, [zone?.id, zone?.lat, zone?.lng, zone?.address, zone?.name]);

  if (!zone) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.errorText}>No zone selected.</Text>
      </View>
    );
  }

  const initialRegion: Region = {
    latitude: zone.lat,
    longitude: zone.lng,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  };

  const handleZoomIn = () => {
    const r = currentRegion ?? initialRegion;
    const newDelta = Math.max(MIN_DELTA, r.latitudeDelta / 1.5);
    mapRef.current?.animateToRegion({
      latitude: r.latitude,
      longitude: r.longitude,
      latitudeDelta: newDelta,
      longitudeDelta: newDelta,
    }, 300);
  };

  const handleZoomOut = () => {
    const r = currentRegion ?? initialRegion;
    const newDelta = Math.min(MAX_DELTA, r.latitudeDelta * 1.5);
    mapRef.current?.animateToRegion({
      latitude: r.latitude,
      longitude: r.longitude,
      latitudeDelta: newDelta,
      longitudeDelta: newDelta,
    }, 300);
  };

  const updateAddressFromCoords = async (lat: number, lng: number) => {
    setGeocoding(true);
    const res = await getAddressFromCoordinates(lat, lng);
    setGeocoding(false);
    if (res.ok) {
      const a = res.address;
      const parts = [a.city, a.state, a.country].filter(Boolean);
      setZoneAddress(parts.length > 0 ? parts.join(', ') : a.street_address || 'Selected location');
    } else {
      setZoneAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const handleSearch = async () => {
    Keyboard.dismiss();
    if (!searchQuery.trim()) return;
    setSearching(true);
    const result = await searchPlace(searchQuery);
    setSearching(false);
    if (result) {
      setZoneLat(result.lat);
      setZoneLng(result.lng);
      updateAddressFromCoords(result.lat, result.lng);
      mapRef.current?.animateToRegion({
        latitude: result.lat,
        longitude: result.lng,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      }, 400);
    } else {
      Alert.alert('Search', 'Location not found. Try a different search (e.g. Dubai, Abu Dhabi, Sharjah).');
    }
  };

  const handleMarkerDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setZoneLat(latitude);
    setZoneLng(longitude);
    updateAddressFromCoords(latitude, longitude);
  };

  const handleSave = async () => {
    const locationText = (zoneAddress || zone.name || zone.address || '').trim();
    if (!locationText) {
      Alert.alert('Missing location', 'Please enter or select a location for the zone.');
      return;
    }
    const parsed = selectedSupervisorId ? parseInt(selectedSupervisorId, 10) : NaN;
    const supervisorIdNum = Number.isFinite(parsed) ? parsed : null;
    setSaving(true);
    try {
      await adminService.updateArea(Number(zone.id), locationText, supervisorIdNum);
      navigation.navigate('AdminZones', { areasRefresh: true });
      Alert.alert('Updated', `Zone "${locationText}" has been updated.`);
    } catch (e: any) {
      Alert.alert(
        'Update failed',
        e?.response?.data?.message ?? e?.message ?? 'Could not update zone. Try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assign Supervisor</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.zoneLabel}>{zone.name || zone.address || `Zone #${zone.id}`}</Text>
      <Text style={styles.zoneAddress}>{zoneAddress || zone.address || zone.name || '—'}{geocoding ? '…' : ''}</Text>
      <Text style={styles.zoneHint}>Drag the pin or search to change zone location (e.g. city in UAE)</Text>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          scrollEnabled
          zoomEnabled
          pitchEnabled={false}
          onRegionChangeComplete={setCurrentRegion}
        >
          <Marker
            coordinate={{ latitude: zoneLat, longitude: zoneLng }}
            title={zone.name}
            description={zoneAddress}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        </MapView>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location (e.g. Abu Dhabi, Dubai)"
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="arrow-forward" size={22} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
            <Ionicons name="add" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
            <Ionicons name="remove" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.pickerLabel}>Select supervisor for this zone</Text>
      <ScrollView style={styles.supervisorList} contentContainerStyle={styles.supervisorListContent}>
        {supervisorsLoading ? (
          <View style={styles.supervisorLoading}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.supervisorLoadingText}>Loading supervisors…</Text>
          </View>
        ) : supervisors.length === 0 ? (
          <Text style={styles.supervisorEmpty}>No supervisors found.</Text>
        ) : (
          supervisors.map((sup) => {
            const supIdStr = String(sup.id);
            const isSelected = selectedSupervisorId === supIdStr;
            return (
              <TouchableOpacity
                key={sup.id}
                style={[styles.supervisorRow, isSelected && styles.supervisorRowSelected]}
                onPress={() => setSelectedSupervisorId(supIdStr)}
              >
                <View style={styles.supervisorInfo}>
                  <Text style={styles.supervisorName}>{sup.name}</Text>
                  <Text style={styles.supervisorId}>{sup.employee_id || `ID ${sup.id}`}</Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={COLORS.background} />
        ) : (
          <Text style={styles.saveButtonText}>Update Zone</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  errorText: {
    padding: SPACING.lg,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  zoneLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
  },
  zoneAddress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
  },
  zoneHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  mapContainer: {
    height: 280,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  searchBar: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  searchButton: {
    padding: SPACING.sm,
  },
  zoomControls: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    flexDirection: 'column',
    gap: 4,
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  supervisorList: {
    maxHeight: 220,
  },
  supervisorListContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  supervisorLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  supervisorLoadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  supervisorEmpty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingVertical: SPACING.md,
  },
  supervisorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  supervisorRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  supervisorInfo: {},
  supervisorName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  supervisorId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 2,
  },
  saveButton: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
});

export default AdminZoneAssignScreen;
