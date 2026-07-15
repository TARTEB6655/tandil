import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  FlatList,
  Keyboard,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../constants';
import { getAddressFromCoordinates } from '../utils/addressFromLocation';
import type { AddressFromLocation } from '../utils/addressFromLocation';

const DEFAULT_REGION: Region = {
  latitude: 25.2048,
  longitude: 55.2708,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type SearchHit = {
  id: string;
  label: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
};

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: AddressFromLocation, coords?: { latitude: number; longitude: number }) => void;
  loadingMessage?: string;
  confirmMessage?: string;
}

async function searchPlaces(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  // Prefer OpenStreetMap Nominatim for named place results (Dubai, areas, buildings)
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6` +
      `&countrycodes=ae&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TandilVendorApp/1.0 (location-picker)',
      },
    });
    if (res.ok) {
      const rows = (await res.json()) as Array<{
        place_id?: number | string;
        display_name?: string;
        lat?: string;
        lon?: string;
        name?: string;
        type?: string;
      }>;
      const hits = rows
        .map((row, index) => {
          const latitude = Number(row.lat);
          const longitude = Number(row.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
          const label = row.name || row.display_name?.split(',')[0] || q;
          const subtitle = row.display_name;
          return {
            id: String(row.place_id ?? `${latitude},${longitude},${index}`),
            label,
            subtitle,
            latitude,
            longitude,
          } as SearchHit;
        })
        .filter(Boolean) as SearchHit[];
      if (hits.length) return hits;
    }
  } catch {
    // fall through to device geocoder
  }

  // Fallback: Expo geocoder (returns coords; reverse for labels)
  const searchQuery = /uae|dubai|abu dhabi|sharjah|ajman/i.test(q) ? q : `${q}, UAE`;
  const coords = await Location.geocodeAsync(searchQuery);
  const limited = coords.slice(0, 5);
  const hits: SearchHit[] = [];
  for (let i = 0; i < limited.length; i++) {
    const c = limited[i];
    let label = searchQuery;
    let subtitle: string | undefined;
    try {
      const rev = await Location.reverseGeocodeAsync({
        latitude: c.latitude,
        longitude: c.longitude,
      });
      const place = rev[0];
      if (place) {
        label = [place.name, place.street].filter(Boolean).join(', ') || label;
        subtitle = [place.city, place.region, place.country].filter(Boolean).join(', ');
      }
    } catch {
      // keep query as label
    }
    hits.push({
      id: `${c.latitude},${c.longitude},${i}`,
      label,
      subtitle,
      latitude: c.latitude,
      longitude: c.longitude,
    });
  }
  return hits;
}

export default function MapPickerModal({
  visible,
  onClose,
  onSelect,
  loadingMessage = 'Loading map…',
  confirmMessage = 'Use this location',
}: MapPickerModalProps) {
  const mapRef = useRef<MapView>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setResults([]);
      setShowResults(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setRegion(DEFAULT_REGION);
          setLoading(false);
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(next);
      } catch {
        if (!cancelled) setRegion(DEFAULT_REGION);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const runSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const hits = await searchPlaces(query);
      setResults(hits);
      setShowResults(true);
    } catch {
      setResults([]);
      setShowResults(true);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      void runSearch(text);
    }, 450);
  };

  const goToCoordinate = (latitude: number, longitude: number) => {
    const next: Region = {
      latitude,
      longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 450);
  };

  const handleSelectResult = (hit: SearchHit) => {
    Keyboard.dismiss();
    setSearchQuery(hit.label);
    setShowResults(false);
    setResults([]);
    goToCoordinate(hit.latitude, hit.longitude);
  };

  const handleSubmitSearch = () => {
    Keyboard.dismiss();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    void (async () => {
      const hits = await searchPlaces(searchQuery);
      setResults(hits);
      setShowResults(true);
      setSearching(false);
      if (hits.length === 1) {
        handleSelectResult(hits[0]);
      }
    })();
  };

  const handleRegionChangeComplete = (r: Region) => {
    setRegion(r);
  };

  const handleUseThisLocation = async () => {
    setConfirming(true);
    try {
      const result = await getAddressFromCoordinates(region.latitude, region.longitude);
      if (result.ok) {
        onSelect(result.address, {
          latitude: region.latitude,
          longitude: region.longitude,
        });
        onClose();
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not get address for this location');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Pick location from map</Text>
            <View style={styles.closeBtn} />
          </View>

          <View style={styles.searchWrap}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Search area, street, landmark…"
                placeholderTextColor={COLORS.textSecondary}
                returnKeyType="search"
                onSubmitEditing={handleSubmitSearch}
                autoCorrect={false}
                autoCapitalize="words"
                clearButtonMode="while-editing"
              />
              {searching ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : searchQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setResults([]);
                    setShowResults(false);
                  }}
                  hitSlop={10}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {showResults ? (
              <View style={styles.resultsCard}>
                {results.length === 0 && !searching ? (
                  <Text style={styles.noResults}>No places found. Try another search.</Text>
                ) : (
                  <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    style={styles.resultsList}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.resultRow}
                        onPress={() => handleSelectResult(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                        <View style={styles.resultTextWrap}>
                          <Text style={styles.resultLabel} numberOfLines={1}>
                            {item.label}
                          </Text>
                          {item.subtitle ? (
                            <Text style={styles.resultSubtitle} numberOfLines={2}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            ) : null}
          </View>

          <View style={styles.mapWrap}>
            {loading ? (
              <View style={styles.loadingMap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>{loadingMessage}</Text>
              </View>
            ) : (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={region}
                onRegionChangeComplete={handleRegionChangeComplete}
                showsUserLocation
                showsMyLocationButton={Platform.OS !== 'web'}
              />
            )}
            {!loading && (
              <View style={styles.markerFixed} pointerEvents="none">
                <Ionicons name="location" size={40} color={COLORS.primary} />
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.hint}>Search above or move the map to choose an address</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, confirming && styles.confirmBtnDisabled]}
              onPress={handleUseThisLocation}
              disabled={confirming}
            >
              {confirming ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.confirmBtnText}>{confirmMessage}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: { width: 40, alignItems: 'center' },
  title: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  searchWrap: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    zIndex: 20,
    elevation: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.md,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  resultsCard: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    maxHeight: 200,
    overflow: 'hidden',
  },
  resultsList: { maxHeight: 200 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  resultTextWrap: { flex: 1 },
  resultLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  resultSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  noResults: {
    padding: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  mapWrap: {
    height: 300,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingMap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  loadingText: { marginTop: SPACING.sm, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  markerFixed: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl + (Platform.OS === 'ios' ? 20 : 0),
  },
  hint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.md },
});
