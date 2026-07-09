import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import VendorSignupRequestDetailModal from '../../components/admin/VendorSignupRequestDetailModal';
import RecentVendorRequestCard from '../../components/admin/RecentVendorRequestCard';
import VendorRequestLogo from '../../components/admin/VendorRequestLogo';
import VendorRejectModal from '../../components/admin/VendorRejectModal';
import type {
  VendorSignupRequest,
  VendorSignupStatusFilter,
} from '../../types/vendorSignup';
import {
  adminVendorService,
  filterToApiStatus,
  mergeVendorPreview,
  resolveVendorId,
  statsToUiCounts,
  type AdminVendorPagination,
} from '../../services/adminVendorService';

const PER_PAGE = 10;
const FILTERS: VendorSignupStatusFilter[] = ['pending', 'approved', 'rejected', 'all'];

function vendorTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    fruits: 'Fruits',
    vegetables: 'Vegetables',
    poultry: 'Poultry',
    seafood: 'Seafood',
    meat: 'Meat',
    honey: 'Honey',
    nuts: 'Nuts',
    rest: 'Restaurant / Other',
  };
  return labels[type.toLowerCase()] ?? type;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusStyle(status: VendorSignupRequest['status']) {
  if (status === 'approved') {
    return { bg: COLORS.success + '18', text: COLORS.success, icon: 'checkmark-circle' as const };
  }
  if (status === 'rejected') {
    return { bg: COLORS.error + '18', text: COLORS.error, icon: 'close-circle' as const };
  }
  return { bg: COLORS.warning + '18', text: COLORS.warning, icon: 'time' as const };
}

const AdminVendorSignupRequestsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [requests, setRequests] = useState<VendorSignupRequest[]>([]);
  const [pagination, setPagination] = useState<AdminVendorPagination | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<VendorSignupStatusFilter>('pending');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actioningId, setActioningId] = useState<number | string | null>(null);
  const [selected, setSelected] = useState<VendorSignupRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<VendorSignupRequest | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const stats = await adminVendorService.getStats();
      setCounts(statsToUiCounts(stats));
    } catch (_) {
      setCounts({ pending: 0, approved: 0, rejected: 0, total: 0 });
    }
  }, []);

  const fetchList = useCallback(
    async (pageNum: number, activeFilter: VendorSignupStatusFilter, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await adminVendorService.getVendors({
          status: filterToApiStatus(activeFilter),
          page: pageNum,
          per_page: PER_PAGE,
          sort: 'newest',
        });
        setRequests(res.items);
        setPagination(res.pagination);
        setPage(res.pagination.current_page);
      } catch (_) {
        if (pageNum === 1) {
          setRequests([]);
          setPagination(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    []
  );

  const reload = useCallback(
    async (pageNum = 1, isRefresh = false) => {
      await Promise.all([fetchStats(), fetchList(pageNum, filter, isRefresh)]);
    },
    [fetchStats, fetchList, filter]
  );

  useEffect(() => {
    reload(1);
  }, [filter, reload]);

  const onRefresh = useCallback(() => {
    reload(1, true);
  }, [reload]);

  const loadApplicationDetail = useCallback(
    async (id: number | string, preview?: VendorSignupRequest) => {
      if (preview) setSelected(preview);
      setDetailLoading(true);
      try {
        const detail = await adminVendorService.getApplicationDetail(id);
        setSelected(mergeVendorPreview(detail, preview));
      } catch (err: unknown) {
        Alert.alert(
          t('common.error'),
          err instanceof Error
            ? err.message
            : t('adminVendorRequests.detailLoadFailed', {
                defaultValue: 'Could not load vendor application details.',
              })
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    const openRequestId = route.params?.openRequestId;
    if (openRequestId == null) return;
    const found = requests.find((r) => String(r.id) === String(openRequestId));
    loadApplicationDetail(openRequestId, found);
    navigation.setParams({ openRequestId: undefined });
  }, [route.params?.openRequestId, requests, navigation, loadApplicationDetail]);

  const openDetail = useCallback(
    (item: VendorSignupRequest) => {
      loadApplicationDetail(item.id, item);
    },
    [loadApplicationDetail]
  );

  const closeDetail = useCallback(() => {
    setSelected(null);
    setDetailLoading(false);
  }, []);

  const runApprove = useCallback(
    async (item: VendorSignupRequest) => {
      const vendorId = resolveVendorId(item);
      setActioningId(vendorId);
      try {
        const res = await adminVendorService.approve(vendorId);
        setSelected(null);
        Alert.alert(
          t('common.success'),
          res.message || t('adminVendorRequests.approvedSuccess')
        );
        await reload(page);
      } catch (err: unknown) {
        Alert.alert(
          t('common.error'),
          err instanceof Error ? err.message : t('adminVendorRequests.approveFailed', { defaultValue: 'Could not approve vendor.' })
        );
      } finally {
        setActioningId(null);
      }
    },
    [page, reload, t]
  );

  const runReject = useCallback(
    async (item: VendorSignupRequest, reason?: string) => {
      const vendorId = resolveVendorId(item);
      setRejectLoading(true);
      setActioningId(vendorId);
      try {
        const res = await adminVendorService.reject(vendorId, reason);
        setSelected(null);
        setRejectTarget(null);
        Alert.alert(
          t('common.success'),
          res.message || t('adminVendorRequests.rejectedSuccess')
        );
        await reload(page);
      } catch (err: unknown) {
        Alert.alert(
          t('common.error'),
          err instanceof Error ? err.message : t('adminVendorRequests.rejectFailed', { defaultValue: 'Could not reject application.' })
        );
      } finally {
        setRejectLoading(false);
        setActioningId(null);
      }
    },
    [page, reload, t]
  );

  const runDelete = useCallback(
    async (item: VendorSignupRequest) => {
      const vendorId = resolveVendorId(item);
      setDeleteLoading(true);
      setActioningId(vendorId);
      try {
        const res = await adminVendorService.remove(vendorId);
        setSelected(null);
        Alert.alert(
          t('common.success'),
          res.message || t('adminVendorRequests.deletedSuccess', { defaultValue: 'Vendor deleted successfully.' })
        );
        await reload(page);
      } catch (err: unknown) {
        Alert.alert(
          t('common.error'),
          err instanceof Error ? err.message : t('adminVendorRequests.deleteFailed', { defaultValue: 'Could not delete vendor.' })
        );
      } finally {
        setDeleteLoading(false);
        setActioningId(null);
      }
    },
    [page, reload, t]
  );

  const onApprove = useCallback(
    (item: VendorSignupRequest) => {
      Alert.alert(
        t('adminVendorRequests.approveTitle'),
        t('adminVendorRequests.approveMessage', { name: item.company_name }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('adminVendorRequests.approve'), onPress: () => runApprove(item) },
        ]
      );
    },
    [runApprove, t]
  );

  const onReject = useCallback((item: VendorSignupRequest) => {
    setRejectTarget(item);
  }, []);

  const onDelete = useCallback(
    (item: VendorSignupRequest) => {
      Alert.alert(
        t('adminVendorRequests.deleteTitle', { defaultValue: 'Delete vendor' }),
        t('adminVendorRequests.deleteMessage', {
          defaultValue: 'Delete {{name}} permanently? This action cannot be undone.',
          name: item.company_name || item.authorized_person_name,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete', { defaultValue: 'Delete' }),
            style: 'destructive',
            onPress: () => runDelete(item),
          },
        ]
      );
    },
    [runDelete, t]
  );

  const confirmReject = useCallback(
    (reason: string) => {
      if (!rejectTarget) return;
      runReject(rejectTarget, reason);
    },
    [rejectTarget, runReject]
  );

  const filterLabel = useCallback(
    (key: VendorSignupStatusFilter) => {
      const map: Record<VendorSignupStatusFilter, string> = {
        pending: t('adminVendorRequests.filterPending'),
        approved: t('adminVendorRequests.filterApproved'),
        rejected: t('adminVendorRequests.filterRejected'),
        all: t('adminVendorRequests.filterAll'),
      };
      return map[key];
    },
    [t]
  );

  const goToPreviousPage = useCallback(() => {
    if (!pagination || page <= 1 || loadingMore) return;
    fetchList(page - 1, filter);
  }, [pagination, page, loadingMore, fetchList, filter]);

  const goToNextPage = useCallback(() => {
    if (!pagination || page >= pagination.last_page || loadingMore) return;
    fetchList(page + 1, filter);
  }, [pagination, page, loadingMore, fetchList, filter]);

  const filterCounts = useMemo(
    () => ({
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      all: counts.total,
    }),
    [counts]
  );

  const renderItem = ({ item }: { item: VendorSignupRequest }) => {
    if (item.status === 'pending') {
      return (
        <RecentVendorRequestCard
          item={item}
          actioningId={actioningId}
          onPress={openDetail}
          onApprove={onApprove}
          onCancel={onReject}
        />
      );
    }

    const st = statusStyle(item.status);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openDetail(item)}>
        <View style={styles.cardTop}>
          <VendorRequestLogo logoUrl={item.logo_url} size={52} />
          <View style={styles.cardHeaderText}>
            <Text style={styles.businessName} numberOfLines={1}>
              {item.company_name}
            </Text>
            <Text style={styles.contact} numberOfLines={1}>
              {item.email}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
              <Ionicons name={st.icon} size={12} color={st.text} />
              <Text style={[styles.statusText, { color: st.text }]}>
                {t(`adminVendorRequests.status.${item.status}`)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </View>
        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="leaf-outline" size={14} color={COLORS.primary} />
            <Text style={styles.metaChipText}>{vendorTypeLabel(item.vendor_type)}</Text>
          </View>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>{t('adminVendorRequests.title')}</Text>
          <Text style={styles.topBarSubtitle}>{t('adminVendorRequests.subtitle')}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.statsRow}>
        {(['pending', 'approved', 'rejected'] as const).map((key) => {
          const st = statusStyle(key);
          return (
            <View key={key} style={[styles.statCard, { borderColor: st.text + '30' }]}>
              <Text style={[styles.statValue, { color: st.text }]}>{counts[key]}</Text>
              <Text style={styles.statLabel}>{t(`adminVendorRequests.status.${key}`)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          {FILTERS.map((key) => {
            const active = filter === key;
            const count = filterCounts[key];
            const st = key !== 'all' ? statusStyle(key) : null;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.filterChip,
                  active && styles.filterChipActive,
                  active && st && { backgroundColor: st.text, borderColor: st.text },
                ]}
                onPress={() => setFilter(key)}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                  numberOfLines={1}
                >
                  {filterLabel(key)}
                </Text>
                <View
                  style={[
                    styles.filterBadge,
                    active && styles.filterBadgeActive,
                    !active && st && { backgroundColor: st.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBadgeText,
                      active && styles.filterBadgeTextActive,
                      !active && st && { color: st.text },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListFooterComponent={
            pagination && pagination.last_page > 1 && requests.length > 0 ? (
              <View style={styles.paginationWrap}>
                <TouchableOpacity
                  style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
                  onPress={goToPreviousPage}
                  disabled={page <= 1 || loadingMore}
                >
                  <Text style={[styles.pageButtonText, page <= 1 && styles.pageButtonTextDisabled]}>
                    {t('common.previous', { defaultValue: 'Previous' })}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.pageText}>
                  {t('common.pageOf', {
                    defaultValue: 'Page {{page}} / {{total}}',
                    page,
                    total: pagination.last_page,
                  })}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pageButton,
                    page >= pagination.last_page && styles.pageButtonDisabled,
                  ]}
                  onPress={goToNextPage}
                  disabled={page >= pagination.last_page || loadingMore}
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      page >= pagination.last_page && styles.pageButtonTextDisabled,
                    ]}
                  >
                    {t('common.next', { defaultValue: 'Next' })}
                  </Text>
                </TouchableOpacity>
                {loadingMore ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={styles.pageSpinner} />
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="storefront-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('adminVendorRequests.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('adminVendorRequests.empty')}</Text>
            </View>
          }
        />
      )}

      <VendorSignupRequestDetailModal
        visible={selected != null}
        request={selected}
        loading={detailLoading}
        actioningId={deleteLoading ? actioningId : actioningId}
        onClose={closeDetail}
        onApprove={selected?.status === 'pending' ? onApprove : undefined}
        onReject={selected?.status === 'pending' ? onReject : undefined}
        onDelete={onDelete}
      />

      <VendorRejectModal
        visible={rejectTarget != null}
        request={rejectTarget}
        loading={rejectLoading}
        onClose={() => setRejectTarget(null)}
        onConfirm={confirmReject}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surfaceLight },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  topBarSubtitle: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  filterSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    lineHeight: 20,
  },
  filterChipTextActive: { color: COLORS.background },
  filterBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    lineHeight: 16,
  },
  filterBadgeTextActive: { color: COLORS.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.lg, paddingBottom: SPACING.xxl * 2 },
  paginationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
    flexWrap: 'wrap',
  },
  pageButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pageButtonDisabled: { opacity: 0.45 },
  pageButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  pageButtonTextDisabled: { color: COLORS.textSecondary },
  pageText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  pageSpinner: { marginLeft: SPACING.xs },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  cardHeaderText: { flex: 1 },
  businessName: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  contact: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
  },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  metaChipText: { fontSize: FONT_SIZES.xs, color: COLORS.text },
  date: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AdminVendorSignupRequestsScreen;
