import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MapView, { Marker, Region } from 'react-native-maps';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, AdminOperationalAreaItem, AdminOperationalAreaSupervisor, AdminOperationalAreasSummary } from '../../services/adminService';
import { useTranslation } from 'react-i18next';

const UAE_REGION: Region = {
  latitude: 24.35,
  longitude: 54.38,
  latitudeDelta: 5.2,
  longitudeDelta: 4.2,
};
const OPERATIONAL_AREAS_PER_PAGE = 108;

const UAE_LOCATION_FALLBACK_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'abu dhabi': { latitude: 24.4539, longitude: 54.3773 },
  dubai: { latitude: 25.2048, longitude: 55.2708 },
  sharjah: { latitude: 25.3463, longitude: 55.4209 },
  ajman: { latitude: 25.4052, longitude: 55.5136 },
  fujairah: { latitude: 25.1288, longitude: 56.3265 },
  'ras al khaimah': { latitude: 25.7895, longitude: 55.9432 },
  'umm al quwain': { latitude: 25.5647, longitude: 55.5552 },
  'al ain': { latitude: 24.2075, longitude: 55.7447 },
};

function normalizePlace(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getAreaCoordinate(area: AdminOperationalAreaItem): { latitude: number; longitude: number } | null {
  if (typeof area.latitude === 'number' && typeof area.longitude === 'number') {
    return { latitude: area.latitude, longitude: area.longitude };
  }
  const locationKey = normalizePlace(area.location);
  if (locationKey && UAE_LOCATION_FALLBACK_COORDS[locationKey]) {
    return UAE_LOCATION_FALLBACK_COORDS[locationKey];
  }
  const nameKey = normalizePlace(area.name);
  const matchedKey = Object.keys(UAE_LOCATION_FALLBACK_COORDS).find((key) => nameKey.includes(key));
  if (matchedKey) return UAE_LOCATION_FALLBACK_COORDS[matchedKey];
  return null;
}

function isAreaActive(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'active';
  }
  return false;
}

const AdminOperationalAreasScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [areas, setAreas] = useState<AdminOperationalAreaItem[]>([]);
  const [summary, setSummary] = useState<AdminOperationalAreasSummary>({
    total_zones: 0,
    operational_zones: 0,
    pinned_on_map: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [togglingAreaIds, setTogglingAreaIds] = useState<Record<number, boolean>>({});
  const supervisorsByAreaIdRef = React.useRef<Map<number, AdminOperationalAreaSupervisor[]>>(new Map());

  const activePinnedAreas = useMemo(
    () =>
      areas
        .filter((area) => isAreaActive((area as unknown as { is_active: unknown }).is_active))
        .map((area) => ({ area, coordinate: getAreaCoordinate(area) }))
        .filter(
          (entry): entry is { area: AdminOperationalAreaItem; coordinate: { latitude: number; longitude: number } } =>
            entry.coordinate != null
        )
        .map((entry, index, arr) => {
          const duplicatesBefore = arr
            .slice(0, index)
            .filter(
              (x) =>
                x.coordinate.latitude === entry.coordinate.latitude &&
                x.coordinate.longitude === entry.coordinate.longitude
            ).length;
          if (duplicatesBefore === 0) return { ...entry, displayCoordinate: entry.coordinate };
          const step = 0.03;
          const angle = duplicatesBefore * 45;
          const radians = (angle * Math.PI) / 180;
          return {
            ...entry,
            displayCoordinate: {
              latitude: entry.coordinate.latitude + Math.sin(radians) * step,
              longitude: entry.coordinate.longitude + Math.cos(radians) * step,
            },
          };
        }),
    [areas]
  );
  const [stablePinnedAreas, setStablePinnedAreas] = useState<typeof activePinnedAreas>([]);
  const hasToggleInFlight = useMemo(
    () => Object.values(togglingAreaIds).some(Boolean),
    [togglingAreaIds]
  );

  useEffect(() => {
    // Avoid mutating native map marker tree while a Switch interaction is in progress.
    if (!hasToggleInFlight) setStablePinnedAreas(activePinnedAreas);
  }, [activePinnedAreas, hasToggleInFlight]);

  const fetchOperationalAreas = useCallback(
    async (page: number = 1, append = false, silent = false) => {
      if (append) setLoadingMore(true);
      else if (!silent) setLoading(true);
    try {
      const [res, areasRes] = await Promise.all([
        adminService.getOperationalAreas({
          country: 'UAE',
          per_page: OPERATIONAL_AREAS_PER_PAGE,
          page,
        }),
        // Areas list includes full supervisors[]; use it to enrich operational rows.
        page === 1 && !append
          ? adminService.getAreas().catch(() => null)
          : Promise.resolve(null),
      ]);
      if (areasRes?.data) {
        const nextMap = new Map<number, AdminOperationalAreaSupervisor[]>();
        areasRes.data.forEach((area) => {
          const list = (area.supervisors ?? [])
            .filter((s) => s && typeof s.id === 'number')
            .map((s) => ({ id: s.id, name: String(s.name || '').trim() || `#${s.id}` }));
          if (list.length) nextMap.set(area.id, list);
        });
        supervisorsByAreaIdRef.current = nextMap;
      }

      const incomingRaw = res?.data?.areas ?? [];
      // Normalize server values to avoid runtime crashes in RN controls like Switch.
      const incoming = incomingRaw.map((area) => {
        const fromOperational = Array.isArray(area.supervisors) ? area.supervisors : [];
        const fromAreas = supervisorsByAreaIdRef.current.get(area.id);
        const supervisors =
          fromAreas && fromAreas.length > 0
            ? fromAreas
            : fromOperational
                .filter((s) => s && typeof s.id === 'number')
                .map((s) => ({ id: s.id, name: String(s.name || '').trim() || `#${s.id}` }));
        return {
          ...area,
          is_active: isAreaActive((area as unknown as { is_active: unknown }).is_active),
          supervisors,
        };
      });
      const incomingSummary = res?.data?.summary;
      setAreas((prev) => (append ? [...prev, ...incoming] : incoming));
      if (incomingSummary) setSummary(incomingSummary);
      setCurrentPage(res?.pagination?.current_page ?? page);
      setLastPage(res?.pagination?.last_page ?? 1);
    } catch {
      if (!append && !silent) {
        setAreas([]);
        setSummary({ total_zones: 0, operational_zones: 0, pinned_on_map: 0 });
      }
    } finally {
      if (!silent) setLoading(false);
      setLoadingMore(false);
    }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      fetchOperationalAreas(1, false);
    }, [fetchOperationalAreas])
  );

  const onToggleArea = async (id: number) => {
    if (togglingAreaIds[id]) return;
    const currentItem = areas.find((x) => x.id === id);
    const currentActive = isAreaActive((currentItem as unknown as { is_active?: unknown })?.is_active);
    setTogglingAreaIds((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await adminService.toggleOperationalAreaActive(id);
      if (!res?.success) {
        Alert.alert('Update failed', res?.message || 'Could not update zone status. Please try again.');
      } else {
        const nextActive =
          res?.data && typeof res.data.is_active !== 'undefined'
            ? isAreaActive(res.data.is_active)
            : !currentActive;
        setAreas((prev) => prev.map((item) => (item.id === id ? { ...item, is_active: nextActive } : item)));
        setSummary((prev) => {
          const operational = prev.operational_zones + (nextActive ? 1 : -1);
          const pinned = prev.pinned_on_map + (nextActive ? 1 : -1);
          return {
            ...prev,
            operational_zones: Math.max(0, operational),
            pinned_on_map: Math.max(0, pinned),
          };
        });
      }
    } catch (e: any) {
      Alert.alert('Update failed', e?.response?.data?.message || e?.message || 'Could not update zone status.');
    } finally {
      setTogglingAreaIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.topHeader}>
          <View>
            <Text style={styles.screenTitle}>
              {t('admin.operationalAreas.screenTitle', { defaultValue: 'UAE Operational Areas' })}
            </Text>
            <Text style={styles.screenSubtitle}>
              {t('admin.operationalAreas.screenSubtitle', {
                defaultValue:
                  'Enable/disable cities and zones from one screen, with live map pins for active operations.',
              })}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButtonSecondary}>
              <Text style={styles.headerButtonSecondaryText}>
                {t('admin.operationalAreas.zoneAssignment', { defaultValue: 'Zone Assignment' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>
              {t('admin.operationalAreas.totalZones', { defaultValue: 'TOTAL ZONES' })}
            </Text>
            <Text style={styles.statValue}>{summary.total_zones}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={styles.statLabel}>
              {t('admin.operationalAreas.operational', { defaultValue: 'OPERATIONAL' })}
            </Text>
            <Text style={styles.statValue}>{summary.operational_zones}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>
              {t('admin.operationalAreas.pinnedOnMap', { defaultValue: 'PINNED ON MAP' })}
            </Text>
            <Text style={styles.statValue}>{summary.pinned_on_map}</Text>
          </View>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.mapCardHeader}>
            <Text style={styles.mapTitle}>
              {t('admin.operationalAreas.mapTitle', { defaultValue: 'UAE Operational Map' })}
            </Text>
            <Text style={styles.mapSubtitle}>
              {t('admin.operationalAreas.mapSubtitle', {
                defaultValue: 'Only active zones with valid coordinates are pinned on map.',
              })}
            </Text>
          </View>
          {hasToggleInFlight ? (
            <View style={[styles.mapView, styles.mapLoadingOverlay]}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.mapLoadingText}>
                {t('admin.operationalAreas.updatingMap', { defaultValue: 'Updating map...' })}
              </Text>
            </View>
          ) : (
            <MapView
              style={styles.mapView}
              initialRegion={UAE_REGION}
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled={false}
            >
              {stablePinnedAreas.map(({ area, displayCoordinate }) => (
                <Marker
                  key={`op-area-pin-${area.id}`}
                  coordinate={displayCoordinate}
                  title={area.name}
                  description={`${area.location}, ${area.country}`}
                  tracksViewChanges={false}
                />
              ))}
            </MapView>
          )}
        </View>

        <View style={styles.tableCard}>
          <Text style={styles.tableTitle}>
            {t('admin.operationalAreas.listTitle', { defaultValue: 'Operational Area List' })}
          </Text>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.cityZoneCell]}>
                  {t('admin.operationalAreas.zone', { defaultValue: 'ZONE' })}
                </Text>
                <Text style={[styles.headerCell, styles.countryCell]}>
                  {t('admin.operationalAreas.countryShort', { defaultValue: 'CTRY' })}
                </Text>
                <Text style={[styles.headerCell, styles.supervisorCell]}>
                  {t('admin.operationalAreas.supervisorShort', { defaultValue: 'SUPV' })}
                </Text>
                <Text style={[styles.headerCell, styles.toggleCell]}>
                  {t('admin.operationalAreas.active', { defaultValue: 'ACTIVE' })}
                </Text>
              </View>

              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loadingText}>
                    {t('admin.operationalAreas.loading', { defaultValue: 'Loading operational areas...' })}
                  </Text>
                </View>
              ) : areas.length === 0 ? (
                <View style={styles.loadingRow}>
                  <Text style={styles.loadingText}>
                    {t('admin.operationalAreas.empty', { defaultValue: 'No operational areas found.' })}
                  </Text>
                </View>
              ) : (
                areas.map((item) => (
                  <View key={item.id} style={styles.tableRow}>
                    <View style={styles.cityZoneCell}>
                      <Text style={styles.cellTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.location &&
                      item.location.trim().toLowerCase() !== item.name.trim().toLowerCase() ? (
                        <Text style={styles.cellSubTitle} numberOfLines={1}>
                          {item.location}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.rowCellText, styles.countryCell]}>{item.country}</Text>
                    <View style={styles.supervisorCell}>
                      {item.supervisors.length === 0 ? (
                        <View style={styles.supervisorTag}>
                          <Text style={styles.supervisorTagText}>
                            {t('admin.operationalAreas.none', { defaultValue: 'None' })}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.supervisorTagsWrap}>
                          {item.supervisors.map((supervisor) => (
                            <View
                              key={`${item.id}-${supervisor.id}`}
                              style={[styles.supervisorTag, styles.supervisorTagAssigned]}
                            >
                              <Text
                                style={[styles.supervisorTagText, styles.supervisorTagTextAssigned]}
                                numberOfLines={1}
                              >
                                {supervisor.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <View style={[styles.toggleCell, styles.toggleCellWrap]}>
                      {togglingAreaIds[item.id] ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <Switch
                          value={isAreaActive((item as unknown as { is_active: unknown }).is_active)}
                          onValueChange={() => onToggleArea(item.id)}
                          disabled={hasToggleInFlight}
                          trackColor={{ false: COLORS.border, true: COLORS.primary + '66' }}
                          thumbColor={
                            isAreaActive((item as unknown as { is_active: unknown }).is_active)
                              ? COLORS.primary
                              : '#f4f4f5'
                          }
                        />
                      )}
                    </View>
                  </View>
                ))
              )}

              {!loading && currentPage < lastPage ? (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={() => fetchOperationalAreas(currentPage + 1, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={COLORS.background} />
                  ) : (
                    <Text style={styles.loadMoreButtonText}>
                      {t('common.loadMore', { defaultValue: 'Load more' })}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  topBar: {
    marginBottom: SPACING.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topHeader: {
    marginBottom: SPACING.md,
  },
  screenTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  screenSubtitle: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  headerActions: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerButtonSecondary: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  headerButtonSecondaryText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  statCardHighlight: {
    borderColor: COLORS.success + '66',
    backgroundColor: COLORS.success + '12',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.bold,
  },
  mapCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  mapCardHeader: {
    marginBottom: SPACING.sm,
  },
  mapTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  mapSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mapView: {
    height: 220,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  mapLoadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.background,
  },
  mapLoadingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  tableCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  headerCell: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    lineHeight: 14,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cityZoneCell: { flex: 1.7, paddingRight: 4, paddingTop: 2 },
  countryCell: { flex: 0.8, paddingRight: 4, paddingTop: 4 },
  supervisorCell: { flex: 1.6, paddingRight: 4 },
  toggleCell: { flex: 0.9, alignItems: 'center', paddingTop: 2 },
  rowCellText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  cellTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  cellSubTitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  supervisorTagsWrap: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  supervisorTag: {
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF8E6',
    maxWidth: '100%',
  },
  supervisorTagAssigned: {
    backgroundColor: COLORS.primary + '14',
  },
  supervisorTagText: {
    fontSize: FONT_SIZES.xs,
    color: '#6b7280',
    maxWidth: 110,
  },
  supervisorTagTextAssigned: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  toggleCellWrap: {
    alignItems: 'center',
  },
  loadingRow: {
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  loadMoreButton: {
    margin: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  loadMoreButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default AdminOperationalAreasScreen;

