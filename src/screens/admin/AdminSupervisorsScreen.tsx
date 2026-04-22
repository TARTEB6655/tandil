import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, type AdminSupervisor } from '../../services/adminService';

const PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

const AdminSupervisorsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [supervisors, setSupervisors] = useState<AdminSupervisor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingUserId, setOpeningUserId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSupervisors = useCallback(async (search: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await adminService.getSupervisors({
        per_page: PER_PAGE,
        page: 1,
        search: search.trim() || undefined,
      });
      setSupervisors(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? t('admin.supervisorsTeams.failedToLoad'));
      setSupervisors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      fetchSupervisors(searchQuery);
    }, [fetchSupervisors, searchQuery])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const onRefresh = useCallback(() => {
    fetchSupervisors(searchQuery, true);
  }, [fetchSupervisors, searchQuery]);

  const zoneDisplay = (sup: AdminSupervisor) => {
    if (sup.zone?.name) return sup.zone.name;
    if (sup.assigned_zones?.length) return sup.assigned_zones.map((z) => z.name).join(', ');
    return t('admin.supervisorsTeams.noZoneAssigned');
  };

  const handleAddSupervisor = useCallback(() => {
    navigation.navigate('AddUser', { preselectedRole: 'supervisor', lockRole: true });
  }, [navigation]);

  const handleEditSupervisor = useCallback(async (supervisorId: number) => {
    setOpeningUserId(supervisorId);
    try {
      const response = await adminService.getUserById(supervisorId);
      const user = response?.data;
      if (!user) {
        Alert.alert(t('admin.users.error'), t('admin.editUser.userNotFound'));
        return;
      }
      navigation.navigate('EditUser', { user, lockRole: true, forcedRole: 'supervisor' });
    } catch (e: any) {
      const message = e?.response?.data?.message ?? e?.message ?? t('admin.users.loadFailed');
      Alert.alert(t('admin.users.error'), message);
    } finally {
      setOpeningUserId(null);
    }
  }, [navigation, t]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.supervisorsTeams.title')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddSupervisor}>
          <Ionicons name="person-add-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>{t('admin.supervisorsTeams.hint')}</Text>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin.supervisorsTeams.searchPlaceholder')}
          placeholderTextColor={COLORS.textSecondary}
          value={searchInput}
          onChangeText={setSearchInput}
        />
        {searchInput.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchInput(''); setSearchQuery(''); }} style={styles.searchClear}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={24} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchSupervisors(searchQuery)}>
            <Text style={styles.retryButtonText}>{t('admin.supervisorsTeams.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && supervisors.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.supervisorsTeams.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          {supervisors.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {searchQuery ? t('admin.supervisorsTeams.noSupervisorsSearch') : t('admin.supervisorsTeams.noSupervisorsYet')}
              </Text>
            </View>
          ) : (
            supervisors.map((sup) => {
              const isOpening = openingUserId === sup.id;
              return (
                <TouchableOpacity
                  key={sup.id}
                  style={styles.supervisorCard}
                  onPress={() => navigation.navigate('AdminSupervisorTeam', { supervisor: sup })}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{sup.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.supervisorContent}>
                    <Text style={styles.supervisorName}>{sup.name}</Text>
                    <Text style={styles.supervisorId}>{sup.employee_id}</Text>
                    <Text style={styles.supervisorZone}>{zoneDisplay(sup)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEditSupervisor(sup.id);
                    }}
                    disabled={isOpening}
                  >
                    {isOpening ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Ionicons name="create-outline" size={20} color={COLORS.textSecondary} />
                    )}
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
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
  addButton: {
    padding: SPACING.sm,
  },
  hint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  searchClear: {
    padding: SPACING.xs,
  },
  errorBox: {
    marginHorizontal: SPACING.lg,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptyBox: {
    paddingVertical: SPACING.xl * 2,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  supervisorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  supervisorContent: {
    flex: 1,
  },
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
  supervisorZone: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  editButton: {
    padding: SPACING.xs,
    marginRight: SPACING.xs,
  },
});

export default AdminSupervisorsScreen;
