import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, type AdminAreaItem } from '../../services/adminService';

// Dummy data – replace with API later
export interface ZoneDummy {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  supervisorId: string | null;
  supervisorIds?: string[];
}

export interface SupervisorDummy {
  id: string;
  name: string;
  employeeId: string;
}

export const DUMMY_ZONES: ZoneDummy[] = [
  { id: 'z1', name: 'North Zone', address: 'Abu Dhabi North', lat: 24.4539, lng: 54.3773, supervisorId: 'sup1' },
  { id: 'z2', name: 'South Zone', address: 'Dubai South', lat: 25.0657, lng: 55.2093, supervisorId: 'sup2' },
  { id: 'z3', name: 'Central Zone', address: 'Sharjah Central', lat: 25.3573, lng: 55.4033, supervisorId: null },
];

export const DUMMY_SUPERVISORS: SupervisorDummy[] = [
  { id: 'sup1', name: 'Hassan Ahmed', employeeId: 'SUP-2001' },
  { id: 'sup2', name: 'Sara Ali', employeeId: 'SUP-2002' },
  { id: 'sup3', name: 'Omar Khalid', employeeId: 'SUP-2003' },
];

export interface TechnicianDummy {
  id: string;
  name: string;
  employeeId: string;
}

export const DUMMY_TECHNICIANS: TechnicianDummy[] = [
  { id: 't1', name: 'Ahmed Hassan', employeeId: 'EMP-1001' },
  { id: 't2', name: 'Khalid Ibrahim', employeeId: 'EMP-1002' },
  { id: 't3', name: 'Omar Saeed', employeeId: 'EMP-1003' },
  { id: 't4', name: 'Sara Mohammed', employeeId: 'EMP-1004' },
  { id: 't5', name: 'Yusuf Ali', employeeId: 'EMP-1005' },
];

type AreaItem = AdminAreaItem;

const SEARCH_DEBOUNCE_MS = 400;

function getAreaSupervisorNames(area: AreaItem): string[] {
  const fromList = (area.supervisors ?? [])
    .map((s) => String(s?.name || '').trim())
    .filter(Boolean);
  if (fromList.length > 0) return fromList;
  return [];
}

const AdminZonesScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAreaId, setLoadingAreaId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAreas = useCallback(async (search: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await adminService.getAreas({ search: search.trim() || undefined });
      setAreas(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? t('admin.zones.failedToLoadAreas'));
      setAreas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      const areasRefresh = route.params?.areasRefresh;
      const updatedLocation = route.params?.updatedZoneLocation;
      if (areasRefresh || updatedLocation) {
        if (areasRefresh) navigation.setParams({ areasRefresh: undefined });
        if (updatedLocation) navigation.setParams({ updatedZoneLocation: undefined });
      }
      fetchAreas(searchQuery);
    }, [searchQuery, fetchAreas, route.params?.areasRefresh, route.params?.updatedZoneLocation, navigation])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const openZoneAssign = useCallback(async (area: AreaItem) => {
    setLoadingAreaId(area.id);
    try {
      const res = await adminService.getArea(area.id);
      const d = res.data;
      const supervisorIds =
        (d.supervisor_ids?.length ? d.supervisor_ids : d.supervisors?.map((s) => s.id)) ??
        (d.supervisor_id != null ? [d.supervisor_id] : []);
      const zone: ZoneDummy = {
        id: String(d.id),
        name: d.location ?? `Zone #${d.id}`,
        address: d.location ?? '',
        lat: 0,
        lng: 0,
        supervisorId: d.supervisor_id != null ? String(d.supervisor_id) : null,
        supervisorIds: supervisorIds.map(String),
      };
      navigation.navigate('AdminZoneAssign', { zone });
    } catch (e: any) {
      Alert.alert(t('admin.zones.error'), e?.response?.data?.message ?? e?.message ?? t('admin.zones.failedToLoadZone'));
    } finally {
      setLoadingAreaId(null);
    }
  }, [navigation, t]);

  const areaToZone = (area: AreaItem): ZoneDummy => {
    const supervisorIds =
      (area.supervisor_ids?.length ? area.supervisor_ids : area.supervisors?.map((s) => s.id)) ??
      (area.supervisor_id != null ? [area.supervisor_id] : []);
    return {
      id: String(area.id),
      name: area.location?.trim() || `Zone #${area.id}`,
      address: area.location?.trim() || '',
      lat: 0,
      lng: 0,
      supervisorId: area.supervisor_id != null ? String(area.supervisor_id) : null,
      supervisorIds: supervisorIds.map(String),
    };
  };
  const handleDeleteZone = (area: AreaItem) => {
    const name = area.location || `Zone #${area.id}`;
    Alert.alert(
      t('admin.zones.deleteZoneTitle'),
      t('admin.zones.deleteZoneMessage', { name }),
      [
        { text: t('admin.zones.cancel'), style: 'cancel' },
        {
          text: t('admin.zones.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.deleteArea(area.id);
              setAreas((prev) => prev.filter((a) => a.id !== area.id));
            } catch (e: any) {
              const msg = e?.response?.data?.message ?? e?.message ?? t('admin.zones.failedToDeleteZone');
              Alert.alert(t('admin.zones.error'), msg);
            }
          },
        },
      ]
    );
  };

  const handleRemoveSupervisor = (
    area: AreaItem,
    supervisor: { id: number; name: string }
  ) => {
    const zoneName = area.location || `Zone #${area.id}`;
    const supervisorName = supervisor.name?.trim() || `#${supervisor.id}`;
    Alert.alert(
      t('admin.zones.removeSupervisorTitle', { defaultValue: 'Remove supervisor' }),
      t('admin.zones.removeSupervisorMessage', {
        defaultValue: 'Remove {{supervisor}} from {{zone}}?',
        supervisor: supervisorName,
        zone: zoneName,
      }),
      [
        { text: t('admin.zones.cancel'), style: 'cancel' },
        {
          text: t('admin.zones.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.removeAreaSupervisor(area.id, supervisor.id);
              setAreas((prev) =>
                prev.map((a) => {
                  if (a.id !== area.id) return a;
                  const nextSupervisors = (a.supervisors ?? []).filter((s) => s.id !== supervisor.id);
                  const nextIds = (a.supervisor_ids ?? []).filter((id) => id !== supervisor.id);
                  return {
                    ...a,
                    supervisors: nextSupervisors,
                    supervisor_ids: nextIds,
                    supervisor_id:
                      a.supervisor_id === supervisor.id
                        ? nextIds[0] ?? nextSupervisors[0]?.id ?? null
                        : a.supervisor_id,
                  };
                })
              );
            } catch (e: any) {
              const msg =
                e?.response?.data?.message ??
                e?.message ??
                t('admin.zones.failedToRemoveSupervisor', {
                  defaultValue: 'Failed to remove supervisor from zone.',
                });
              Alert.alert(t('admin.zones.error'), msg);
            }
          },
        },
      ]
    );
  };

  const onRefresh = useCallback(() => fetchAreas(searchQuery, true), [fetchAreas, searchQuery]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.zones.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        <TouchableOpacity
          style={styles.supervisorsCard}
          onPress={() => navigation.navigate('AdminTechnicians')}
          activeOpacity={0.88}
        >
          <View style={styles.navIconWrap}>
            <Ionicons name="construct-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.supervisorsCardText}>
            <Text style={styles.supervisorsCardTitle}>{t('admin.zones.allTechnicians')}</Text>
            <Text style={styles.supervisorsCardSubtitle}>{t('admin.zones.allTechniciansSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.supervisorsCard, styles.supervisorsCardSecondary]}
          onPress={() => navigation.navigate('AdminSupervisors')}
          activeOpacity={0.88}
        >
          <View style={styles.navIconWrap}>
            <Ionicons name="people" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.supervisorsCardText}>
            <Text style={styles.supervisorsCardTitle}>{t('admin.zones.supervisorsAndTeams')}</Text>
            <Text style={styles.supervisorsCardSubtitle}>{t('admin.zones.supervisorsAndTeamsSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('admin.zones.sectionTitle')}</Text>
        <Text style={styles.sectionSubtitle}>{t('admin.zones.sectionSubtitle')}</Text>

        <TouchableOpacity
          style={styles.addZoneCard}
          onPress={() => navigation.navigate('AdminAddZone')}
          activeOpacity={0.85}
        >
          <View style={styles.addZoneIconWrap}>
            <Ionicons name="add" size={22} color={COLORS.background} />
          </View>
          <Text style={styles.addZoneText}>{t('admin.zones.addZone')}</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.zones.searchPlaceholder')}
            placeholderTextColor={COLORS.textSecondary}
            value={searchInput}
            onChangeText={setSearchInput}
          />
          {searchInput.length > 0 ? (
            <TouchableOpacity onPress={() => { setSearchInput(''); setSearchQuery(''); }} style={styles.searchClear}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={24} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchAreas(searchQuery)}>
              <Text style={styles.retryButtonText}>{t('admin.zones.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading && areas.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('admin.zones.loadingZones')}</Text>
          </View>
        ) : areas.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="location-outline" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyText}>
              {searchQuery ? t('admin.zones.noZonesSearch') : t('admin.zones.noZonesYet')}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.listMetaRow}>
              <Text style={styles.listMetaText}>
                {t('admin.zones.zonesCount', {
                  defaultValue: '{{count}} zones',
                  count: areas.length,
                })}
              </Text>
            </View>
            {areas.map((area) => {
              const supervisors =
                (area.supervisors?.length
                  ? area.supervisors
                  : area.supervisor_id != null
                    ? [{ id: area.supervisor_id, name: getAreaSupervisorNames(area)[0] || '' }]
                    : []) as Array<{ id: number; name: string }>;
              const zone = areaToZone(area);
              const isOpening = loadingAreaId === area.id;

              return (
                <View key={area.id} style={styles.zoneGroup}>
                  <View
                    style={[
                      styles.zoneCard,
                      supervisors.length === 0 && styles.zoneCardAlone,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.zoneCardTouchable}
                      onPress={() => openZoneAssign(area)}
                      disabled={isOpening}
                      activeOpacity={0.88}
                    >
                      <View style={styles.zoneIcon}>
                        <Ionicons name="navigate" size={20} color={COLORS.primary} />
                      </View>
                      <View style={styles.zoneContent}>
                        <Text style={styles.zoneName} numberOfLines={1}>
                          {zone.name}
                        </Text>
                        <Text style={styles.zoneMeta}>
                          {supervisors.length > 0
                            ? t('admin.zones.supervisorsAssignedCount', {
                                defaultValue: '{{count}} supervisor(s)',
                                count: supervisors.length,
                              })
                            : t('admin.zones.noSupervisorAssigned')}
                        </Text>
                      </View>
                      {isOpening ? (
                        <ActivityIndicator size="small" color={COLORS.primary} style={styles.zoneChevron} />
                      ) : (
                        <View style={styles.zoneChevron}>
                          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={styles.zoneDivider} />
                    <TouchableOpacity
                      style={styles.zoneDeleteButton}
                      onPress={() => handleDeleteZone(area)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>

                  {supervisors.map((supervisor, index) => (
                    <View
                      key={`${area.id}-${supervisor.id}`}
                      style={[
                        styles.supervisorSubCard,
                        index === supervisors.length - 1 && styles.supervisorSubCardLast,
                      ]}
                    >
                      <View style={styles.supervisorSubRail} />
                      <View style={styles.supervisorSubBody}>
                        <View style={styles.supervisorAvatar}>
                          <Text style={styles.supervisorAvatarText}>
                            {supervisor.name.trim().charAt(0).toUpperCase() || 'S'}
                          </Text>
                        </View>
                        <View style={styles.supervisorTextCol}>
                          <Text style={styles.supervisorRoleLabel}>
                            {t('admin.zones.supervisorRole', { defaultValue: 'Supervisor' })}
                          </Text>
                          <Text style={styles.supervisorName} numberOfLines={1}>
                            {supervisor.name}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.supervisorSubDelete}
                        onPress={() => handleRemoveSupervisor(area, supervisor)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  supervisorsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#1c4b27',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  supervisorsCardSecondary: {
    marginBottom: SPACING.lg,
  },
  navIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supervisorsCardText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  supervisorsCardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  supervisorsCardSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  addZoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '55',
    borderStyle: 'dashed',
  },
  addZoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addZoneText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    marginLeft: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { marginRight: SPACING.sm },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  searchClear: { padding: SPACING.xs },
  listMetaRow: {
    marginBottom: SPACING.sm,
  },
  listMetaText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  errorBox: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.error + '12',
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: '#fff',
  },
  loadingBox: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptyBox: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  zoneGroup: {
    marginBottom: SPACING.md,
  },
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#0f2513',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  zoneCardAlone: {
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  zoneCardTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
  },
  zoneDeleteButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  zoneDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  zoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  zoneContent: {
    flex: 1,
    minWidth: 0,
  },
  zoneName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  zoneMeta: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  supervisorSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm + 2,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
  },
  supervisorSubCardLast: {
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  supervisorSubRail: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: COLORS.primary + '40',
    marginRight: SPACING.md,
    marginLeft: 18,
  },
  supervisorSubBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  supervisorSubDelete: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  supervisorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  supervisorAvatarText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  supervisorTextCol: {
    flex: 1,
    minWidth: 0,
  },
  supervisorRoleLabel: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  supervisorName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    marginTop: 1,
  },
  zoneChevron: {
    marginLeft: SPACING.xs,
  },
});

export default AdminZonesScreen;
