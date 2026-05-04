import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, type AdminBroadcastLogItem } from '../../services/adminService';

dayjs.extend(relativeTime);

type BroadcastScopeFilter = 'all' | 'role' | 'users';

type StatCardConfig = {
  value: number;
  labelKey: string;
  variant: 'blue' | 'red' | 'green';
};

const AdminBroadcastLogScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [list, setList] = useState<AdminBroadcastLogItem[]>([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<BroadcastScopeFilter>('all');

  const fetchBroadcasts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await adminService.getBroadcasts({ page: 1, per_page: 20 });
      if (!res.success) throw new Error(res.message || 'Failed to load broadcasts.');
      setList(res.broadcasts);
      setPagination(res.pagination);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
          : e instanceof Error
            ? e.message
            : '';
      setError(msg || 'Failed to load broadcasts.');
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBroadcasts();
    }, [fetchBroadcasts])
  );

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return list.filter((b) => {
      const st = String(b.scope_type || '').toLowerCase();
      if (scopeFilter === 'role' && st !== 'role') return false;
      if (scopeFilter === 'users' && st !== 'users') return false;
      if (q) {
        const blob = `${b.title} ${b.message} ${b.sent_by?.name ?? ''} ${b.scope_role ?? ''} ${st}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [list, scopeFilter, searchQuery]);

  const statCards = useMemo<StatCardConfig[]>(() => {
    const reach = filteredList.reduce((s, b) => s + (b.recipient_counts?.total ?? 0), 0);
    return [
      { value: pagination.total, labelKey: 'admin.notificationStats.broadcastStatTotal', variant: 'blue' },
      { value: reach, labelKey: 'admin.notificationStats.broadcastStatReach', variant: 'red' },
      { value: filteredList.length, labelKey: 'admin.notificationStats.broadcastStatRows', variant: 'green' },
    ];
  }, [pagination.total, filteredList]);

  const statIcon = (variant: StatCardConfig['variant']) => {
    if (variant === 'blue') return { name: 'notifications-outline' as const, color: COLORS.primary };
    if (variant === 'red') return { name: 'people-outline' as const, color: COLORS.error };
    return { name: 'checkmark-circle-outline' as const, color: '#16a34a' };
  };

  const renderItem = useCallback(
    ({ item }: { item: AdminBroadcastLogItem }) => {
      const scopeLabel = item.scope_role
        ? `${item.scope_type} · ${item.scope_role}`
        : String(item.scope_type ?? '—');
      return (
        <View style={styles.broadcastCard}>
          <View style={styles.broadcastRow}>
            <View style={styles.broadcastBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title || '—'}
              </Text>
              <Text style={styles.cardMessage} numberOfLines={4}>
                {item.message || '—'}
              </Text>
              <Text style={styles.broadcastMeta}>
                {t('admin.notificationStats.broadcastSentBy', { name: item.sent_by?.name ?? '—' })}
              </Text>
              <Text style={styles.broadcastMeta}>
                {t('admin.notificationStats.broadcastRecipients', { count: item.recipient_counts?.total ?? 0 })}
              </Text>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{t('admin.notificationStats.broadcastScope', { scope: scopeLabel })}</Text>
              </View>
            </View>
            <Text style={styles.broadcastTime}>
              {item.created_at ? dayjs(item.created_at).fromNow() : '—'}
            </Text>
          </View>
        </View>
      );
    },
    [t]
  );

  const listHeader = (
    <View style={styles.headerPad}>
      <View style={styles.topRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.pageTitle}>{t('admin.notificationStats.actionBroadcastLog')}</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={COLORS.text} />
          <Text style={styles.backBtnText}>{t('admin.sendNotification.backToStats')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterCard}>
        <Text style={styles.filterLabel}>{t('admin.notificationStats.filtersLabel')}</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.notificationStats.searchPlaceholder')}
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {(['all', 'role', 'users'] as BroadcastScopeFilter[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.chip, scopeFilter === key && styles.chipActive]}
              onPress={() => setScopeFilter(key)}
            >
              <Text style={[styles.chipText, scopeFilter === key && styles.chipTextActive]}>
                {key === 'all'
                  ? t('admin.notificationStats.filterScopeAll')
                  : key === 'role'
                    ? t('admin.notificationStats.filterScopeRole')
                    : t('admin.notificationStats.filterScopeUsers')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.applyBtn} onPress={() => {}} activeOpacity={0.85}>
          <Text style={styles.applyBtnText}>{t('admin.notificationStats.applyFilters')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {statCards.map((card, idx) => {
          const ic = statIcon(card.variant);
          const cardStyle =
            card.variant === 'blue'
              ? styles.statCardBlue
              : card.variant === 'red'
                ? styles.statCardRed
                : styles.statCardGreen;
          const valStyle =
            card.variant === 'blue'
              ? styles.statValue
              : card.variant === 'red'
                ? [styles.statValue, styles.statValueRed]
                : [styles.statValue, styles.statValueGreen];
          const iconBg =
            card.variant === 'blue'
              ? styles.statIconBlue
              : card.variant === 'red'
                ? styles.statIconRed
                : styles.statIconGreen;
          return (
            <View key={`${card.labelKey}-${idx}`} style={[styles.statCard, cardStyle]}>
              <Text style={valStyle}>{card.value}</Text>
              <Text style={styles.statLabel}>{t(card.labelKey)}</Text>
              <View style={[styles.statIconBadge, iconBg]}>
                <Ionicons name={ic.name} size={22} color={ic.color} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  if (loading && list.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && list.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchBroadcasts()}>
            <Text style={styles.retryBtnText}>{t('admin.notificationStats.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={filteredList}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchBroadcasts(true)} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="radio-outline" size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>{t('admin.notificationStats.emptyBroadcastList')}</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: {
    color: COLORS.surface,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  headerPad: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  pageTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtnText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    maxWidth: 120,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  filterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  filterLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.sm,
  },
  searchIcon: {
    marginLeft: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'nowrap',
    marginBottom: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxWidth: 160,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  chipTextActive: {
    color: COLORS.surface,
  },
  applyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  applyBtnText: {
    color: COLORS.surface,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    paddingRight: SPACING.xl + 8,
    position: 'relative',
    backgroundColor: COLORS.surface,
  },
  statCardBlue: {
    borderColor: COLORS.primary + '44',
  },
  statCardRed: {
    borderColor: COLORS.error + '44',
  },
  statCardGreen: {
    borderColor: '#16a34a' + '44',
  },
  statValue: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  statValueRed: {
    color: COLORS.error,
  },
  statValueGreen: {
    color: '#16a34a',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statIconBadge: {
    position: 'absolute',
    right: SPACING.sm,
    top: SPACING.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBlue: {
    backgroundColor: COLORS.primary + '18',
  },
  statIconRed: {
    backgroundColor: COLORS.error + '18',
  },
  statIconGreen: {
    backgroundColor: '#16a34a' + '18',
  },
  broadcastCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.lg,
  },
  broadcastRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  broadcastBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  broadcastMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  broadcastTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  pill: {
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default AdminBroadcastLogScreen;
