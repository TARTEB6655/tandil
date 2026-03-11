import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  getAreaManagerRegionMap,
  AreaManagerRegionMapData,
} from '../../services/areaManagerService';

const UAE_CENTER = { lat: 24.0, lng: 54.0 };
const UAE_REGION: Region = {
  latitude: UAE_CENTER.lat,
  longitude: UAE_CENTER.lng,
  latitudeDelta: 4.5,
  longitudeDelta: 4.5,
};

const UAE_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'abu dhabi': { lat: 24.4539, lng: 54.3773 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'sharjah': { lat: 25.3573, lng: 55.4033 },
  'fujairah': { lat: 25.1288, lng: 56.3265 },
  'ajman': { lat: 25.4052, lng: 55.5136 },
  'ras al khaimah': { lat: 25.7891, lng: 55.9432 },
  'umm al quwain': { lat: 25.5647, lng: 55.5553 },
};

async function geocodeLocation(
  location: string,
  cache: Map<string, { lat: number; lng: number }>
): Promise<{ lat: number; lng: number } | null> {
  const key = location.trim().toLowerCase();
  if (!key) return null;
  const cached = cache.get(key);
  if (cached) return cached;
  const normalized = key.replace(/, united arab emirates$/i, '').trim();
  const cityKey = normalized.split(',')[0]?.trim().toLowerCase() ?? key;
  if (UAE_CITY_COORDS[cityKey]) {
    const coords = UAE_CITY_COORDS[cityKey];
    cache.set(key, coords);
    return coords;
  }
  try {
    const query = `${location.trim()}, UAE`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'TandilApp/1.0' },
    });
    const data = await res.json();
    const first = data?.[0];
    if (first?.lat != null && first?.lon != null) {
      const coords = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
      cache.set(key, coords);
      return coords;
    }
  } catch (_) {}
  if (UAE_CITY_COORDS[cityKey]) {
    const coords = UAE_CITY_COORDS[cityKey];
    cache.set(key, coords);
    return coords;
  }
  return null;
}

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
}

const RegionMapScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions();
  const mapHeight = Math.max(280, height * 0.5);
  const [data, setData] = useState<AreaManagerRegionMapData | null>(null);
  const [markers, setMarkers] = useState<MapMarkerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const cache = new Map<string, { lat: number; lng: number }>();
      setLoading(true);
      setError(null);
      setMarkers([]);
      getAreaManagerRegionMap()
        .then((regionData) => {
          if (cancelled || !regionData) {
            if (!cancelled) setError(regionData ? null : t('admin.areaManagerRegionMap.failedToLoad'));
            return;
          }
          setData(regionData);
          const locationToLabels: Record<string, { areas: string[]; leaders: string[] }> = {};
          const addLocation = (loc: string | null, areaName?: string, leaderName?: string) => {
            const key = (loc || areaName || '').trim();
            if (!key) return;
            if (!locationToLabels[key]) locationToLabels[key] = { areas: [], leaders: [] };
            if (areaName) locationToLabels[key].areas.push(areaName);
            if (leaderName) locationToLabels[key].leaders.push(leaderName);
          };
          regionData.areas.forEach((a) => addLocation(a.location ?? a.name, a.name));
          regionData.team_leaders.forEach((tl) => addLocation(tl.location, undefined, `${tl.name} (${tl.employee_id})`));
          setGeocoding(true);
          const uniqueLocs = Object.keys(locationToLabels);
          Promise.all(
            uniqueLocs.map((loc) => geocodeLocation(loc, cache))
          )
            .then((results) => {
              if (cancelled) return;
              const nextMarkers: MapMarkerItem[] = [];
              uniqueLocs.forEach((loc, i) => {
                const coords = results[i];
                if (!coords) return;
                const { areas, leaders } = locationToLabels[loc];
                const title = loc;
                const desc = [...areas, ...leaders].filter(Boolean).join(' • ') || undefined;
                nextMarkers.push({
                  id: `loc-${i}-${loc}`,
                  latitude: coords.lat,
                  longitude: coords.lng,
                  title,
                  description: desc,
                });
              });
              setMarkers(nextMarkers);
            })
            .finally(() => {
              if (!cancelled) setGeocoding(false);
            });
        })
        .catch(() => {
          if (!cancelled) setError(t('admin.areaManagerRegionMap.failedToLoad'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [t])
  );

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.areaManagerRegionMap.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.areaManagerRegionMap.loadingMap')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.areaManagerRegionMap.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.areaManagerRegionMap.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={[styles.mapWrap, { height: mapHeight }]}>
        <MapView
          style={[styles.map, { width, height: mapHeight }]}
          initialRegion={UAE_REGION}
          scrollEnabled
          zoomEnabled
        >
          {markers.map((m) => (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              title={m.title}
              description={m.description}
              pinColor={COLORS.primary}
            />
          ))}
        </MapView>
        {(geocoding || (data && markers.length === 0 && (data.areas.length > 0 || data.team_leaders.length > 0))) && (
          <View style={styles.overlay}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.overlayText}>{geocoding ? t('admin.areaManagerRegionMap.findingLocations') : t('admin.areaManagerRegionMap.noCoordinates')}</Text>
          </View>
        )}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>{t('admin.areaManagerRegionMap.locations')}</Text>
        {data?.areas?.length ? (
          <Text style={styles.legendText}>{t('admin.areaManagerRegionMap.areas', { list: data.areas.map((a) => a.location || a.name).filter(Boolean).join(', ') || '—' })}</Text>
        ) : null}
        {data?.team_leaders?.length ? (
          <Text style={styles.legendText}>
            {t('admin.areaManagerRegionMap.teamLeaders', { list: data.team_leaders.map((tl) => `${tl.name} (${tl.location})`).join(', ') })}
          </Text>
        ) : null}
        {(!data?.areas?.length && !data?.team_leaders?.length) && (
          <Text style={styles.legendEmpty}>{t('admin.areaManagerRegionMap.noAreasOrLeaders')}</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  mapWrap: { position: 'relative', backgroundColor: COLORS.surface, width: '100%' },
  map: { backgroundColor: COLORS.surface },
  overlay: {
    position: 'absolute',
    bottom: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: SPACING.sm,
    borderRadius: 8,
  },
  overlayText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: 'center' },
  legend: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  legendTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  legendText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: 4 },
  legendEmpty: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
});

export default RegionMapScreen;
