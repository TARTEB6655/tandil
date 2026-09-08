import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    {
      key: 'total',
      label: t('admin.orderStatistics.cards.totalOrders', { defaultValue: 'Total orders' }),
      value: stats.summary.total_orders,
      icon: 'receipt-outline' as const,
      tint: COLORS.primary,
    },
    {
      key: 'pending',
      label: t('admin.orderStatistics.cards.pending', { defaultValue: 'Pending' }),
      value: stats.summary.pending_orders,
      icon: 'time-outline' as const,
      tint: COLORS.warning,
    },
    {
      key: 'processing',
      label: t('admin.orderStatistics.cards.inProgress', { defaultValue: 'In progress' }),
      value: stats.summary.in_progress_orders,
      icon: 'sync-outline' as const,
      tint: COLORS.info,
    },
    {
      key: 'completed',
      label: t('admin.orderStatistics.cards.completed', { defaultValue: 'Completed' }),
      value: stats.summary.completed_orders,
      icon: 'checkmark-done-outline' as const,
      tint: COLORS.success,
    },
    {
      key: 'cancelled',
      label: t('admin.orderStatistics.cards.cancelled', { defaultValue: 'Cancelled' }),
      value: stats.summary.cancelled_orders,
      icon: 'close-circle-outline' as const,
      tint: COLORS.error,
    },
    {
      key: 'revenue',
      label: `${t('admin.orderStatistics.cards.revenue', { defaultValue: 'Revenue' })} (${stats.financial.currency || 'AED'})`,
      value: stats.financial.gross_revenue.toFixed(2),
      icon: 'cash-outline' as const,
      tint: COLORS.primaryLight,
    },
  ];

  const getStatusColor = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('cancel')) return COLORS.error;
    if (s.includes('complete') || s.includes('deliver')) return COLORS.success;
    if (s.includes('progress') || s.includes('assign') || s.includes('process')) return COLORS.info;
    if (s.includes('ship') || s.includes('confirm')) return COLORS.primary;
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

  const handleDeleteOrder = useCallback(
    (order: AdminDashboardOrderListItem) => {
      const label = `#${order.order_number_short || order.id}`;
      Alert.alert(
        t('admin.orderStatistics.deleteTitle', { defaultValue: 'Delete order' }),
        t('admin.orderStatistics.deleteConfirm', {
          defaultValue: 'Delete order {{order}}? This cannot be undone.',
          order: label,
        }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('common.delete', { defaultValue: 'Delete' }),
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setDeletingId(order.id);
                try {
                  const res = await adminService.bulkDeleteOrders([order.id]);
                  Alert.alert(
                    t('common.success', { defaultValue: 'Success' }),
                    res.message ||
                      t('admin.orderStatistics.deleteSuccess', {
                        defaultValue: 'Order deleted.',
                      })
                  );
                  await fetchData(true);
                } catch (e: unknown) {
                  const msg =
                    (e as { response?: { data?: { message?: string } } })?.response?.data
                      ?.message ||
                    (e as Error)?.message ||
                    t('admin.orderStatistics.deleteFailed', {
                      defaultValue: 'Could not delete order.',
                    });
                  Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
                } finally {
                  setDeletingId(null);
                }
              })();
            },
          },
        ]
      );
    },
    [fetchData, t]
  );

  const renderOrderItem = ({ item }: { item: AdminDashboardOrderListItem }) => {
    const statusColor = getStatusColor(item.order_status);
    const initial = (
      item.customer?.name ||
      t('admin.orderStatistics.guest', { defaultValue: 'Guest' })
    )
      .charAt(0)
      .toUpperCase();
    const busy = deletingId === item.id;
    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.85}
        disabled={busy}
        onPress={() =>
          navigation.navigate('AdminOrderDetail', {
            orderId: item.id,
          })
        }
      >
        <View style={[styles.orderAccent, { backgroundColor: statusColor }]} />
        <View style={styles.orderCardBody}>
          <View style={styles.orderCardTop}>
            <View style={[styles.avatar, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.avatarText, { color: statusColor }]}>{initial}</Text>
            </View>
            <View style={styles.orderCardMeta}>
              <Text style={styles.orderNumber}>#{item.order_number_short || item.id}</Text>
              <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>{item.order_status}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={busy}
              onPress={(e) => {
                e.stopPropagation?.();
                handleDeleteOrder(item);
              }}
            >
              {busy ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.orderCardBottom}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.orderCustomerName} numberOfLines={1}>
                {item.customer?.name || t('admin.orderStatistics.guest', { defaultValue: 'Guest' })}
              </Text>
              <Text style={styles.orderCustomerEmail} numberOfLines={1}>
                {item.customer?.email || '—'}
              </Text>
            </View>
            <View style={styles.orderAmountWrap}>
              <Text style={styles.orderAmount}>{formatAmount(item.total_amount)}</Text>
              <View style={styles.viewRow}>
                <Text style={styles.viewText}>
                  {t('admin.orderStatistics.view', { defaultValue: 'View' })}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
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
        <View style={styles.headerDecor} />
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>
            {t('admin.orderStatistics.eyebrow', { defaultValue: 'Dashboard' })}
          </Text>
          <Text style={styles.headerTitle}>{t('admin.orders.title')}</Text>
        </View>
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
                  <View style={[styles.summaryIconWrap, { backgroundColor: card.tint + '18' }]}>
                    <Ionicons name={card.icon} size={16} color={card.tint} />
                  </View>
                  <Text style={styles.summaryLabel} numberOfLines={2}>
                    {card.label}
                  </Text>
                  <Text style={[styles.summaryValue, card.key === 'revenue' && { color: COLORS.primary }]}>
                    {card.value}
                  </Text>
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
                    <Text
                      style={[
                        styles.tabCountText,
                        selectedTab === tab.key && styles.tabCountTextActive,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.listSectionHeader}>
              <Text style={styles.listSectionTitle}>
                {t('admin.orderStatistics.recent', { defaultValue: 'Orders' })}
              </Text>
              <Text style={styles.listSectionCount}>
                {t('admin.orderStatistics.found', {
                  defaultValue: '{{count}} found',
                  count: currentOrders.length,
                })}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="receipt-outline" size={36} color={COLORS.primary} />
            </View>
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
    backgroundColor: COLORS.surfaceLight,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerEyebrow: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: FONT_WEIGHTS.medium,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    color: '#fff',
    fontWeight: FONT_WEIGHTS.bold,
  },
  headerSpacer: {
    width: 40,
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
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontWeight: FONT_WEIGHTS.medium,
  },
  summaryValue: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.bold,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tabCountText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  tabCountTextActive: {
    color: '#fff',
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  listSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  listSectionCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingBottom: SPACING.xl * 2,
  },
  orderCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
  },
  orderAccent: {
    width: 4,
  },
  orderCardBody: {
    flex: 1,
    padding: SPACING.md,
  },
  orderCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  orderCardMeta: {
    flex: 1,
    minWidth: 0,
  },
  orderNumber: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  orderDate: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  orderCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  orderCustomerName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  orderCustomerEmail: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  orderAmountWrap: {
    alignItems: 'flex-end',
    marginLeft: SPACING.sm,
  },
  orderAmount: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.bold,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  viewText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  statusPill: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  deleteBtn: {
    marginLeft: SPACING.sm,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.error + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
});

export default AdminOrderStatisticsScreen;
