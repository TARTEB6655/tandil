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
import { adminService, type AdminTechnician } from '../../services/adminService';

const PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

const AdminTechniciansScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [technicians, setTechnicians] = useState<AdminTechnician[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingUserId, setOpeningUserId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTechnicians = useCallback(async (search: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await adminService.getTechnicians({
        per_page: PER_PAGE,
        page: 1,
        search: search.trim() || undefined,
      });
      setTechnicians(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? t('admin.allTechnicians.failedToLoad'));
      setTechnicians([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      fetchTechnicians(searchQuery);
    }, [fetchTechnicians, searchQuery])
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
    fetchTechnicians(searchQuery, true);
  }, [fetchTechnicians, searchQuery]);

  const handleAddTechnician = useCallback(() => {
    navigation.navigate('AddUser', { preselectedRole: 'technician', lockRole: true });
  }, [navigation]);

  const handleEditTechnician = useCallback(async (technicianId: number) => {
    setOpeningUserId(technicianId);
    try {
      const response = await adminService.getUserById(technicianId);
      const user = response?.data;
      if (!user) {
        Alert.alert(t('admin.users.error'), t('admin.editUser.userNotFound'));
        return;
      }
      navigation.navigate('EditUser', { user, lockRole: true, forcedRole: 'technician' });
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
        <Text style={styles.headerTitle}>{t('admin.allTechnicians.title')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddTechnician}>
          <Ionicons name="person-add-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        {t('admin.allTechnicians.hint')}
      </Text>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin.allTechnicians.searchPlaceholder')}
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
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchTechnicians(searchQuery)}>
            <Text style={styles.retryButtonText}>{t('admin.allTechnicians.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && technicians.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.allTechnicians.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          {technicians.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {searchQuery ? t('admin.allTechnicians.noTechniciansSearch') : t('admin.allTechnicians.noTechniciansYet')}
              </Text>
            </View>
          ) : (
            technicians.map((tech) => {
              const zoneName = tech.zone?.name ?? '—';
              const supervisorName = tech.supervisor?.name ?? '—';
              const isOpening = openingUserId === tech.id;
              return (
                <TouchableOpacity
                  key={tech.id}
                  style={styles.techCard}
                  activeOpacity={0.85}
                  onPress={() => handleEditTechnician(tech.id)}
                  disabled={isOpening}
                >
                  <View style={styles.techRow1}>
                    <View style={styles.techAvatar}>
                      <Text style={styles.techAvatarText}>{tech.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.techMain}>
                      <Text style={styles.techName}>{tech.name}</Text>
                      <Text style={styles.techId}>{tech.employee_id}</Text>
                    </View>
                    {isOpening ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Ionicons name="create-outline" size={18} color={COLORS.textSecondary} />
                    )}
                  </View>
                  <View style={styles.techRow2}>
                    <View style={styles.badge}>
                      <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.badgeLabel}>{t('admin.allTechnicians.zone')}</Text>
                      <Text style={styles.badgeValue}>{zoneName}</Text>
                    </View>
                    <View style={styles.badge}>
                      <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.badgeLabel}>{t('admin.allTechnicians.supervisor')}</Text>
                      <Text style={styles.badgeValue}>{supervisorName}</Text>
                    </View>
                  </View>
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
  techCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  techRow1: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  techAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  techAvatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  techMain: {
    flex: 1,
  },
  techName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  techId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 2,
  },
  techRow2: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.lg,
  },
  badge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  badgeLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  badgeValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginLeft: 2,
  },
});

export default AdminTechniciansScreen;
