import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BORDER_RADIUS, COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING } from '../../constants';
import { useTranslation } from 'react-i18next';
import {
  adminService,
  AdminDashboardOrderBucketsResponse,
  AdminDashboardOrderListItem,
  AdminDashboardOrderStatsResponse,
} from '../../services/adminService';

type OrderTabKey = 'all' | 'processing' | 'cancelled' | 'completed';

function isTerminalOrderStatus(status: string): boolean {
  const x = String(status || '')
    .toLowerCase()
    .trim();
  return ['cancelled', 'canceled', 'completed', 'refunded', 'delivered'].includes(x);
}

const EMPTY_STATS: AdminDashboardOrderStatsResponse['data'] = {
  summary: {
    total_orders: 0,
    cancelled_orders: 0,
    completed_orders: 0,
    refunded_orders: 0,
    pending_orders: 0,
    assigned_orders: 0,
    in_progress_orders: 0,
  },
  financial: {
    currency: 'AED',
    gross_revenue: 0,
    refunded_amount: 0,
    net_revenue: 0,
  },
  period_counts: {
    today: 0,
    this_week: 0,
    this_month: 0,
  },
  rates: {
    completion_rate: 0,
    cancellation_rate: 0,
    refund_rate: 0,
  },
};

const BUCKET_LIMIT = 20;

/** Buckets may live under `data` or at the top level (legacy / alternate Laravel payloads). */
function getBucketsData(
  bucketsRes: AdminDashboardOrderBucketsResponse | undefined
): AdminDashboardOrderBucketsResponse['data'] | undefined {
  if (!bucketsRes) return undefined;
  if (bucketsRes.data && typeof bucketsRes.data === 'object') {
    return bucketsRes.data;
  }
  const r = bucketsRes as unknown as Record<string, unknown>;
  if (
    r.pending_orders != null ||
    r.cancelled_orders != null ||
    r.completed_orders != null ||
    r.total_orders != null
  ) {
    return r as unknown as AdminDashboardOrderBucketsResponse['data'];
  }
  return undefined;
}

/** Each bucket may be `{ count, orders[] }`, `{ orders }`, or a raw array. */
function ordersFromBucketNode(node: unknown): AdminDashboardOrderListItem[] {
  if (node == null) return [];
  if (Array.isArray(node)) return node as AdminDashboardOrderListItem[];
  if (typeof node === 'object') {
    const n = node as Record<string, unknown>;
    if (Array.isArray(n.orders)) return n.orders as AdminDashboardOrderListItem[];
    if (Array.isArray(n.data)) return n.data as AdminDashboardOrderListItem[];
    if (Array.isArray(n.items)) return n.items as AdminDashboardOrderListItem[];
  }
  return [];
}

function shopOrderToDashboardItem(o: {
  id: number;
  order_number?: string;
  order_number_short?: string;
  status?: string;
  order_status?: string;
  payment_status?: string;
  total?: number | string;
  refund_amount?: number;
  created_at?: string;
  updated_at?: string;
  user?: { id?: number; name?: string; email?: string };
  customer?: { id?: number; name?: string; email?: string };
}): AdminDashboardOrderListItem {
  const rawAmt = (o as { total_amount?: number | string }).total_amount;
  const rawTotal =
    rawAmt != null
      ? typeof rawAmt === 'string'
        ? parseFloat(rawAmt)
        : Number(rawAmt)
      : typeof o.total === 'string'
        ? parseFloat(o.total)
        : Number(o.total ?? 0);
  return {
    id: o.id,
    order_number: String(o.order_number ?? o.id),
    order_number_short: String(o.order_number_short ?? o.order_number ?? o.id),
    order_status: String(o.order_status ?? o.status ?? '—'),
    payment_status: String(o.payment_status ?? '—'),
    total_amount: Number.isFinite(rawTotal) ? rawTotal : 0,
    refund_amount: Number(o.refund_amount ?? 0),
    customer: {
      id: (o.user?.id ?? o.customer?.id ?? null) as number | null,
      name: o.user?.name ?? o.customer?.name ?? null,
      email: o.user?.email ?? o.customer?.email ?? null,
    },
    created_at: o.created_at ?? '',
    updated_at: o.updated_at ?? o.created_at ?? '',
  };
}

const AdminOrderStatisticsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<AdminDashboardOrderStatsResponse['data']>(EMPTY_STATS);
  const [allOrders, setAllOrders] = useState<AdminDashboardOrderListItem[]>([]);
  const [processingOrders, setProcessingOrders] = useState<AdminDashboardOrderListItem[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<AdminDashboardOrderListItem[]>([]);
  const [completedOrders, setCompletedOrders] = useState<AdminDashboardOrderListItem[]>([]);
  const [selectedTab, setSelectedTab] = useState<OrderTabKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [statsRes, bucketsRes] = await Promise.all([
        adminService.getDashboardOrderStatistics(),
        adminService.getDashboardOrderStatisticBuckets({ limit: BUCKET_LIMIT }),
      ]);

      if (statsRes?.data) {
        setStats(statsRes.data);
      } else {
        setStats(EMPTY_STATS);
      }

      const bucketData = getBucketsData(bucketsRes);
      const bucketRecord = bucketData as Record<string, unknown> | undefined;

      let pending = ordersFromBucketNode(bucketData?.pending_orders);
      let assigned = ordersFromBucketNode(bucketData?.assigned_orders);
      let inProgress = ordersFromBucketNode(bucketData?.in_progress_orders);
      const dedupeById = (rows: AdminDashboardOrderListItem[]) => {
        const m = new Map(rows.map((r) => [r.id, r]));
        return Array.from(m.values());
      };

      let cancelled = dedupeById([
        ...ordersFromBucketNode(bucketData?.cancelled_orders),
        ...ordersFromBucketNode(bucketRecord?.canceled_orders),
      ]);
      let completed = ordersFromBucketNode(bucketData?.completed_orders);

      const summary = statsRes?.data?.summary ?? EMPTY_STATS.summary;

      const sortByLatest = (rows: AdminDashboardOrderListItem[]) =>
        [...rows].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      if (cancelled.length === 0 && summary.cancelled_orders > 0) {
        try {
          const res = await adminService.getOrders({
            per_page: Math.max(BUCKET_LIMIT, 50),
            status: 'cancelled',
          });
          const list = Array.isArray(res?.data) ? res.data : [];
          cancelled = list.map((row) => shopOrderToDashboardItem(row));
        } catch {
          /* keep empty */
        }
      }

      if (completed.length === 0 && summary.completed_orders > 0) {
        try {
          const res = await adminService.getOrders({
            per_page: Math.max(BUCKET_LIMIT, 50),
            status: 'completed',
          });
          const list = Array.isArray(res?.data) ? res.data : [];
          completed = list.map((row) => shopOrderToDashboardItem(row));
        } catch {
          /* keep empty */
        }
      }

      const processingStatTotal =
        summary.pending_orders + summary.assigned_orders + summary.in_progress_orders;
      if (pending.length + assigned.length + inProgress.length === 0 && processingStatTotal > 0) {
        try {
          const res = await adminService.getOrders({ per_page: Math.max(BUCKET_LIMIT, 50) });
          const list = Array.isArray(res?.data) ? res.data : [];
          const open = list.filter((row) => {
            const s = String(row?.order_status ?? row?.status ?? '').trim();
            return s.length > 0 && !isTerminalOrderStatus(s);
          });
          if (open.length > 0) {
            const byId = new Map<number, (typeof open)[0]>();
            open.forEach((row) => byId.set(row.id, row));
            const merged = Array.from(byId.values()).map((row) => shopOrderToDashboardItem(row));
            const byStatus = (pred: (s: string) => boolean) =>
              merged.filter((m) => pred(m.order_status.toLowerCase()));
            pending = byStatus((s) => s.includes('pending') || s === 'new' || s === 'placed');
            assigned = byStatus((s) => s.includes('assign'));
            inProgress = byStatus((s) => s.includes('progress') || s.includes('process'));
            if (pending.length + assigned.length + inProgress.length === 0) {
              pending = merged;
            }
          }
        } catch {
          /* keep bucket-derived lists */
        }
      }

      let totalList = dedupeById(ordersFromBucketNode(bucketData?.total_orders));

      const processingMap = new Map<number, AdminDashboardOrderListItem>();
      [...pending, ...assigned, ...inProgress].forEach((item) => {
        processingMap.set(item.id, item);
      });
      totalList.forEach((item) => {
        if (!isTerminalOrderStatus(item.order_status)) {
          processingMap.set(item.id, item);
        }
      });

      if (totalList.length === 0 && summary.total_orders > 0) {
        totalList = dedupeById([
          ...cancelled,
          ...completed,
          ...Array.from(processingMap.values()),
        ]);
      }

      setAllOrders(sortByLatest(totalList));
      setProcessingOrders(sortByLatest(Array.from(processingMap.values())));
      setCancelledOrders(sortByLatest(cancelled));
      setCompletedOrders(sortByLatest(completed));
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          t('admin.orderStatistics.loadFailed', { defaultValue: 'Could not load order statistics.' })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData(false);
    }, [fetchData])
  );

  const tabs = useMemo(
    () => [
      {
        key: 'all' as const,
        label: t('admin.orderStatistics.tabs.all', { defaultValue: 'All' }),
        count: stats.summary.total_orders,
      },
      {
        key: 'processing' as const,
        label: t('admin.orderStatistics.tabs.processing', { defaultValue: 'Processing' }),
        count: processingOrders.length,
      },
      {
        key: 'cancelled' as const,
        label: t('admin.orderStatistics.tabs.cancelled', { defaultValue: 'Cancelled' }),
        count: stats.summary.cancelled_orders,
      },
      {
        key: 'completed' as const,
        label: t('admin.orderStatistics.tabs.completed', { defaultValue: 'Completed' }),
        count: stats.summary.completed_orders,
      },
    ],
    [
      stats.summary.total_orders,
      stats.summary.cancelled_orders,
      stats.summary.completed_orders,
      processingOrders.length,
      t,
    ]
  );

  const currentOrders = useMemo(() => {
    if (selectedTab === 'all') return allOrders;
    if (selectedTab === 'processing') return processingOrders;
    if (selectedTab === 'cancelled') return cancelledOrders;
    return completedOrders;
  }, [selectedTab, allOrders, processingOrders, cancelledOrders, completedOrders]);

  const summaryCards = [
    { key: 'total', label: t('admin.orderStatistics.cards.totalOrders', { defaultValue: 'Total orders' }), value: stats.summary.total_orders },
    { key: 'pending', label: t('admin.orderStatistics.cards.pending', { defaultValue: 'Pending' }), value: stats.summary.pending_orders },
    { key: 'processing', label: t('admin.orderStatistics.cards.inProgress', { defaultValue: 'In progress' }), value: stats.summary.in_progress_orders },
    { key: 'completed', label: t('admin.orderStatistics.cards.completed', { defaultValue: 'Completed' }), value: stats.summary.completed_orders },
    { key: 'cancelled', label: t('admin.orderStatistics.cards.cancelled', { defaultValue: 'Cancelled' }), value: stats.summary.cancelled_orders },
    {
      key: 'revenue',
      label: `${t('admin.orderStatistics.cards.revenue', { defaultValue: 'Revenue' })} (${stats.financial.currency || 'AED'})`,
      value: stats.financial.gross_revenue.toFixed(2),
    },
  ];

  const getStatusColor = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('cancel')) return COLORS.error;
    if (s.includes('complete')) return COLORS.success;
    if (s.includes('progress') || s.includes('assign') || s.includes('process')) return COLORS.info;
    if (s.includes('confirm')) return COLORS.primary;
    return COLORS.warning;
  };

  const formatAmount = (amount: number) => `${stats.financial.currency || 'AED'} ${Number(amount || 0).toFixed(2)}`;

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'ur' ? 'ur-PK' : 'en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderOrderItem = ({ item }: { item: AdminDashboardOrderListItem }) => {
    const statusColor = getStatusColor(item.order_status);
    return (
      <View style={styles.orderRow}>
        <View style={styles.orderPrimary}>
          <Text style={styles.orderNumber}>#{item.order_number_short || item.id}</Text>
          <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.orderCustomerWrap}>
          <Text style={styles.orderCustomerName} numberOfLines={1}>
            {item.customer?.name || t('admin.orderStatistics.guest', { defaultValue: 'Guest' })}
          </Text>
          <Text style={styles.orderCustomerEmail} numberOfLines={1}>
            {item.customer?.email || '—'}
          </Text>
        </View>
        <View style={styles.orderAmountWrap}>
          <Text style={styles.orderAmount}>{formatAmount(item.total_amount)}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '1F' }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{item.order_status}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.orders.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={currentOrders}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderOrderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.summaryGrid}>
              {summaryCards.map((card) => (
                <View key={card.key} style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{card.label}</Text>
                  <Text style={styles.summaryValue}>{card.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.tabRow}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabBtn, selectedTab === tab.key && styles.tabBtnActive]}
                  onPress={() => setSelectedTab(tab.key)}
                >
                  <Text style={[styles.tabText, selectedTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                  <View style={[styles.tabCount, selectedTab === tab.key && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, selectedTab === tab.key && styles.tabCountTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeadText, styles.colOrder]}>
                {t('admin.orderStatistics.columns.order', { defaultValue: 'Order' })}
              </Text>
              <Text style={[styles.tableHeadText, styles.colCustomer]}>
                {t('admin.orderStatistics.columns.customer', { defaultValue: 'Customer' })}
              </Text>
              <Text style={[styles.tableHeadText, styles.colAmount]}>
                {t('admin.orderStatistics.columns.totalStatus', { defaultValue: 'Total / Status' })}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyStateText}>
              {t('admin.orderStatistics.emptyTab', { defaultValue: 'No orders in this tab.' })}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.xl,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.bold,
  },
  headerSpacer: {
    width: 36,
  },
  errorBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.error + '14',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  summaryCard: {
    width: '31%',
    minWidth: 105,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.bold,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary + '12',
    borderColor: COLORS.primary + '55',
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: COLORS.textSecondary + '44',
    alignItems: 'center',
  },
  tabCountActive: {
    backgroundColor: COLORS.primary + '33',
  },
  tabCountText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  tabCountTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  tableHeadText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  colOrder: { flex: 1.15 },
  colCustomer: { flex: 1.3 },
  colAmount: { flex: 1.1, textAlign: 'right' },
  listContent: {
    paddingBottom: SPACING.xl,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderPrimary: { flex: 1.15, paddingRight: 6 },
  orderNumber: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  orderDate: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  orderCustomerWrap: { flex: 1.3, paddingRight: 6 },
  orderCustomerName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  orderCustomerEmail: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  orderAmountWrap: { flex: 1.1, alignItems: 'flex-end' },
  orderAmount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  statusPill: {
    marginTop: 4,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  statusPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
});

export default AdminOrderStatisticsScreen;
