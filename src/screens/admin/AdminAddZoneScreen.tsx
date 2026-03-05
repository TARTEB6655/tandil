import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { getAddressFromCoordinates } from '../../utils/addressFromLocation';
import { adminService, type AdminSupervisor } from '../../services/adminService';

const DEFAULT_DELTA = 0.05;
const MIN_DELTA = 0.002;
const MAX_DELTA = 1;
const UAE_CENTER = { lat: 24.4539, lng: 54.3773 };

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

const AdminAddZoneScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView>(null);

  const [zoneName, setZoneName] = useState('');
  const [zoneLat, setZoneLat] = useState(UAE_CENTER.lat);
  const [zoneLng, setZoneLng] = useState(UAE_CENTER.lng);
  const [zoneAddress, setZoneAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [supervisors, setSupervisors] = useState<AdminSupervisor[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(true);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);

  const updateAddressFromCoords = async (lat: number, lng: number) => {
    setGeocoding(true);
    const res = await getAddressFromCoordinates(lat, lng);
    setGeocoding(false);
    if (res.ok) {
      const a = res.address;
      const parts = [a.city, a.state, a.country].filter(Boolean);
      const addressStr = parts.length > 0 ? parts.join(', ') : a.street_address || 'Selected location';
      setZoneAddress(addressStr);
      setZoneName(a.city?.trim() || a.state?.trim() || addressStr);
    } else {
      setZoneAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setZoneName('');
    }
  };

  useEffect(() => {
    updateAddressFromCoords(zoneLat, zoneLng);
  }, []);

  const loadSupervisors = useCallback(async () => {
    setLoadingSupervisors(true);
    try {
      const res = await adminService.getSupervisors({ per_page: 50 });
      setSupervisors(res.data ?? []);
    } catch {
      setSupervisors([]);
    } finally {
      setLoadingSupervisors(false);
    }
  }, []);

  useEffect(() => {
    loadSupervisors();
  }, [loadSupervisors]);

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
      Alert.alert('Search', 'Location not found. Try e.g. Dubai, Abu Dhabi, Sharjah, UAE.');
    }
  };

  const handleMarkerDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setZoneLat(latitude);
    setZoneLng(longitude);
    updateAddressFromCoords(latitude, longitude);
  };

  const handleSave = async () => {
    const location = zoneName.trim() || zoneAddress.trim() || '';
    if (!location) {
      Alert.alert('Location required', 'Search for a city or drag the pin to set the zone location. Zone name is set from the location.');
      return;
    }
    if (selectedSupervisorId == null) {
      Alert.alert('Supervisor required', 'Please select a supervisor for this zone.');
      return;
    }
    setSaving(true);
    try {
      const res = await adminService.createArea(location, selectedSupervisorId);
      if (res.success) {
        navigation.navigate('AdminZones', { areasRefresh: true });
        Alert.alert('Zone added', `"${location}" has been added and assigned to the supervisor.`);
      } else {
        Alert.alert('Error', res.message ?? 'Failed to add zone.');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to add zone.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const initialRegion: Region = {
    latitude: UAE_CENTER.lat,
    longitude: UAE_CENTER.lng,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Zone</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Location (search or drag pin) – zone name is set from location</Text>
        <Text style={styles.addressText}>{zoneAddress || 'Search for a city in UAE'}{geocoding ? '…' : ''}</Text>
        {zoneName ? <Text style={styles.zoneNameText}>Zone name: {zoneName}</Text> : null}

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
              title={zoneName || 'New zone'}
              description={zoneAddress}
              draggable
              onDragEnd={handleMarkerDragEnd}
            />
          </MapView>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search city (e.g. Dubai, Abu Dhabi)"
              placeholderTextColor={COLORS.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={searching}>
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

        <Text style={styles.sectionLabel}>Assign supervisor to this zone (required)</Text>
        <Text style={styles.sectionHint}>Select a supervisor to manage this area.</Text>
        {loadingSupervisors ? (
          <View style={styles.supervisorsLoading}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.supervisorsLoadingText}>Loading supervisors…</Text>
          </View>
        ) : supervisors.length === 0 ? (
          <Text style={styles.supervisorsEmpty}>No supervisors available.</Text>
        ) : (
          supervisors.map((sup) => {
            const isSelected = selectedSupervisorId === sup.id;
            return (
              <TouchableOpacity
                key={sup.id}
                style={[styles.supervisorCard, isSelected && styles.supervisorCardSelected]}
                onPress={() => setSelectedSupervisorId(isSelected ? null : sup.id)}
              >
                <View style={styles.supervisorAvatar}>
                  <Text style={styles.supervisorAvatarText}>{sup.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.supervisorInfo}>
                  <Text style={styles.supervisorName}>{sup.name}</Text>
                  <Text style={styles.supervisorId}>{sup.employee_id}</Text>
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <Text style={styles.saveButtonText}>Add Zone</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  backButton: { padding: SPACING.sm },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  addressText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  zoneNameText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  mapContainer: {
    height: 260,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  map: { width: '100%', height: '100%' },
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
  searchButton: { padding: SPACING.sm },
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
  sectionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  supervisorsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  supervisorsLoadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  supervisorsEmpty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  supervisorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  supervisorCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
  },
  supervisorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  supervisorAvatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  supervisorInfo: { flex: 1 },
  supervisorName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  supervisorId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
});

export default AdminAddZoneScreen;
