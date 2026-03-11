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
import { adminService } from '../../services/adminService';

// Dummy data – replace with API later
export interface ZoneDummy {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  supervisorId: string | null;
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

type AreaItem = { id: number; location: string | null; supervisor_id: number | null };

const SEARCH_DEBOUNCE_MS = 400;

const AdminZonesScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [supervisorNameMap, setSupervisorNameMap] = useState<Record<number, string>>({});
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

  const loadSupervisors = useCallback(async () => {
    try {
      const res = await adminService.getSupervisors({ per_page: 100 });
      const map: Record<number, string> = {};
      (res.data ?? []).forEach((s) => { map[s.id] = s.name; });
      setSupervisorNameMap(map);
    } catch {
      setSupervisorNameMap({});
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const areasRefresh = route.params?.areasRefresh;
      const updatedLocation = route.params?.updatedZoneLocation;
      if (areasRefresh || updatedLocation) {
        if (areasRefresh) navigation.setParams({ areasRefresh: undefined });
        if (updatedLocation) navigation.setParams({ updatedZoneLocation: undefined });
      }
      loadSupervisors();
      fetchAreas(searchQuery);
    }, [searchQuery, fetchAreas, loadSupervisors, route.params?.areasRefresh, route.params?.updatedZoneLocation, navigation])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const getSupervisorName = (supervisorId: number | null) => {
    if (supervisorId == null) return null;
    return supervisorNameMap[supervisorId] ?? null;
  };

  const openZoneAssign = useCallback(async (area: AreaItem) => {
    setLoadingAreaId(area.id);
    try {
      const res = await adminService.getArea(area.id);
      const d = res.data;
      const zone: ZoneDummy = {
        id: String(d.id),
        name: d.location ?? `Zone #${d.id}`,
        address: d.location ?? '',
        lat: 0,
        lng: 0,
        supervisorId: d.supervisor_id != null ? String(d.supervisor_id) : null,
      };
      navigation.navigate('AdminZoneAssign', { zone });
    } catch (e: any) {
      Alert.alert(t('admin.zones.error'), e?.response?.data?.message ?? e?.message ?? t('admin.zones.failedToLoadZone'));
    } finally {
      setLoadingAreaId(null);
    }
  }, [navigation, t]);

  const areaToZone = (area: AreaItem): ZoneDummy => ({
    id: String(area.id),
    name: area.location?.trim() || `Zone #${area.id}`,
    address: area.location?.trim() || '',
    lat: 0,
    lng: 0,
    supervisorId: area.supervisor_id != null ? String(area.supervisor_id) : null,
  });

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
        >
          <Ionicons name="people-outline" size={28} color={COLORS.primary} />
          <View style={styles.supervisorsCardText}>
            <Text style={styles.supervisorsCardTitle}>{t('admin.zones.allTechnicians')}</Text>
            <Text style={styles.supervisorsCardSubtitle}>{t('admin.zones.allTechniciansSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.supervisorsCard, styles.supervisorsCardSecondary]}
          onPress={() => navigation.navigate('AdminSupervisors')}
        >
          <Ionicons name="people" size={28} color={COLORS.primary} />
          <View style={styles.supervisorsCardText}>
            <Text style={styles.supervisorsCardTitle}>{t('admin.zones.supervisorsAndTeams')}</Text>
            <Text style={styles.supervisorsCardSubtitle}>{t('admin.zones.supervisorsAndTeamsSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('admin.zones.sectionTitle')}</Text>
        <Text style={styles.sectionSubtitle}>{t('admin.zones.sectionSubtitle')}</Text>

        <TouchableOpacity
          style={styles.addZoneCard}
          onPress={() => navigation.navigate('AdminAddZone')}
        >
          <Ionicons name="add-circle-outline" size={28} color={COLORS.primary} />
          <Text style={styles.addZoneText}>{t('admin.zones.addZone')}</Text>
          <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
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
            <Ionicons name="location-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? t('admin.zones.noZonesSearch') : t('admin.zones.noZonesYet')}
            </Text>
          </View>
        ) : (
          areas.map((area) => {
            const supervisorName = getSupervisorName(area.supervisor_id);
            const zone = areaToZone(area);
            const isOpening = loadingAreaId === area.id;
            return (
              <View key={area.id} style={styles.zoneCard}>
                <TouchableOpacity
                  style={styles.zoneCardTouchable}
                  onPress={() => openZoneAssign(area)}
                  disabled={isOpening}
                >
                  <View style={styles.zoneIcon}>
                    <Ionicons name="location" size={24} color={COLORS.primary} />
                  </View>
                  <View style={styles.zoneContent}>
                    <Text style={styles.zoneName}>{zone.name}</Text>
                    <Text style={styles.zoneAddress}>{zone.address || '—'}</Text>
                    <Text style={[styles.zoneSupervisor, !supervisorName && styles.zoneSupervisorUnassigned]}>
                      {supervisorName ? t('admin.zones.supervisorLabel', { name: supervisorName }) : t('admin.zones.noSupervisorAssigned')}
                    </Text>
                  </View>
                  {isOpening ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.zoneDeleteButton}
                  onPress={() => handleDeleteZone(area)}
                >
                  <Ionicons name="trash-outline" size={22} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
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
    paddingBottom: SPACING.lg,
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
    paddingBottom: SPACING.xl,
  },
  supervisorsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  supervisorsCardSecondary: {
    marginBottom: SPACING.lg,
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
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  addZoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
  },
  addZoneText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
    marginLeft: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { marginRight: SPACING.sm },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  searchClear: { padding: SPACING.xs },
  errorBox: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.error + '15',
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '40',
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
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xs,
    paddingRight: SPACING.sm,
    marginBottom: SPACING.md,
  },
  zoneCardTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  zoneDeleteButton: {
    padding: SPACING.sm,
  },
  zoneIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  zoneContent: {
    flex: 1,
  },
  zoneName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  zoneAddress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  zoneSupervisor: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginTop: 4,
  },
  zoneSupervisorUnassigned: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});

export default AdminZonesScreen;
