import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  adminService,
  AdminWalletClientDetailData,
  AdminWalletClientOrderRow,
  AdminUser,
} from '../../services/adminService';

function parseMoney(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const ORDERS_PER_PAGE = 20;
const currency = 'AED';

const AdminWalletClientDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const userId = Number(route.params?.userId);
  const fallbackName = route.params?.clientName as string | undefined;
  const fallbackEmail = route.params?.clientEmail as string | undefined;

  const [detail, setDetail] = useState<AdminWalletClientDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);

  const formatMoney = (n: number) => `${currency} ${n.toFixed(2)}`;

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(iso);
    }
  };

  const fetchDetail = useCallback(
    async (pageNum: number, isRefresh = false) => {
      if (!Number.isFinite(userId) || userId <= 0) {
        setError(t('admin.walletClientDetail.invalidUser', { defaultValue: 'Invalid client.' }));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await adminService.getAdminWalletUserDetail(userId, {
          orders_page: pageNum,
          orders_per_page: ORDERS_PER_PAGE,
        });
        const d = res?.data;
        if (d?.user) {
          setDetail(d);
          const p = d.orders_pagination;
          if (typeof p?.current_page === 'number' && p.current_page > 0) {
            setOrdersPage(p.current_page);
          } else {
            setOrdersPage(pageNum);
          }
        } else {
          setDetail(null);
          setError(
            res?.message ||
              t('admin.walletClientDetail.loadFailed', { defaultValue: 'Could not load client wallet.' })
          );
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (e as Error)?.message ||
          t('admin.walletClientDetail.loadFailed', { defaultValue: 'Could not load client wallet.' });
        setError(msg);
        setDetail(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, t]
  );

  useFocusEffect(
    useCallback(() => {
      void fetchDetail(1);
    }, [userId, fetchDetail])
  );

  const onRefresh = () => void fetchDetail(ordersPage, true);

  const ordersPagination = detail?.orders_pagination;
  const lastPage =
    typeof ordersPagination?.last_page === 'number' && ordersPagination.last_page > 0
      ? ordersPagination.last_page
      : 1;
  const currentPage =
    typeof ordersPagination?.current_page === 'number' && ordersPagination.current_page > 0
      ? ordersPagination.current_page
      : ordersPage;

  const goEditUser = () => {
    const u = detail?.user;
    if (!u) return;
    const stub: AdminUser = {
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      phone: '',
      role: 'client',
      status: 'active',
      email_verified_at: null,
      created_at: '',
      updated_at: '',
      wallet_balance: u.wallet_balance,
    };
    navigation.navigate('EditUser', { user: stub, lockRole: true });
  };

  const paymentTone = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('paid')) return COLORS.success;
    if (s.includes('refund')) return COLORS.warning;
    if (s.includes('fail') || s.includes('unpaid')) return COLORS.error;
    return COLORS.textSecondary;
  };

  const orderTone = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('cancel')) return COLORS.error;
    if (s.includes('confirm') || s.includes('complete') || s.includes('deliver')) return COLORS.success;
    return COLORS.primary;
  };

  const renderOrder = (o: AdminWalletClientOrderRow) => (
    <View key={o.id} style={styles.orderCard}>
      <View style={styles.orderTop}>
        <Text style={styles.orderId}>
          {t('admin.walletClientDetail.orderHash', { defaultValue: 'Order #{{id}}', id: o.id })}
        </Text>
        <Text style={styles.orderTotal}>{formatMoney(parseMoney(o.total_amount))}</Text>
      </View>
      <View style={styles.orderBadges}>
        <View style={[styles.badge, { backgroundColor: orderTone(o.order_status) + '22' }]}>
          <Text style={[styles.badgeText, { color: orderTone(o.order_status) }]} numberOfLines={1}>
            {o.order_status_label || o.order_status}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: paymentTone(o.payment_status) + '22' }]}>
          <Text style={[styles.badgeText, { color: paymentTone(o.payment_status) }]} numberOfLines={1}>
            {o.payment_status_label || o.payment_status}
          </Text>
        </View>
      </View>
      <Text style={styles.orderDate}>
        {t('admin.walletClientDetail.placedAt', { defaultValue: 'Placed' })}: {formatDateTime(o.placed_at)}
      </Text>
    </View>
  );

  const displayName = detail?.user?.name || fallbackName || '—';
  const displayEmail = detail?.user?.email || fallbackEmail || '—';
  const stats = detail?.order_stats;

  if (loading && !refreshing && !detail) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {t('admin.walletClientDetail.title', { defaultValue: 'Client wallet' })}
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>
            {t('admin.walletClientDetail.title', { defaultValue: 'Client wallet' })}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={goEditUser} disabled={!detail?.user}>
          <Text style={[styles.editBtnText, !detail?.user && styles.editBtnTextDisabled]} numberOfLines={2}>
            {t('admin.walletClientDetail.editUser', { defaultValue: 'Edit user' })}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <Text style={styles.emailLine} numberOfLines={2}>
          {displayEmail}
        </Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {detail ? (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>
                {t('admin.walletClientDetail.walletBalance', { defaultValue: 'Wallet balance' })}
              </Text>
              <Text style={styles.balanceValue}>{formatMoney(parseMoney(detail.user.wallet_balance))}</Text>
            </View>

            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>
                  {t('admin.walletClientDetail.validityMonths', { defaultValue: 'Credit validity (months)' })}
                </Text>
                <Text style={styles.metaValue}>
                  {detail.wallet_validity_months != null ? String(detail.wallet_validity_months) : '—'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>
                  {t('admin.walletClientDetail.creditRowsCount', { defaultValue: 'Ledger entries' })}
                </Text>
                <Text style={styles.metaValue}>
                  {detail.wallet_credit_rows != null ? String(detail.wallet_credit_rows) : '—'}
                </Text>
              </View>
              <View style={[styles.metaItem, styles.metaItemWide]}>
                <Text style={styles.metaLabel}>
                  {t('admin.walletClientDetail.firstCreditAt', { defaultValue: 'First wallet credit' })}
                </Text>
                <Text style={styles.metaValueSmall}>{formatDateTime(detail.first_wallet_credit_at)}</Text>
              </View>
              <View style={[styles.metaItem, styles.metaItemWide]}>
                <Text style={styles.metaLabel}>
                  {t('admin.walletClientDetail.nextExpiry', { defaultValue: 'Next active credit expiry' })}
                </Text>
                <Text style={styles.metaValueSmall}>{formatDateTime(detail.next_active_credit_expires_at)}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              {t('admin.walletClientDetail.orderStatsTitle', { defaultValue: 'Order totals' })}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>
                  {t('admin.walletClientDetail.paidOrders', { defaultValue: 'Paid orders' })}
                </Text>
                <Text style={styles.statValue}>{stats?.paid_orders_count ?? 0}</Text>
                <Text style={styles.statSub}>{formatMoney(parseMoney(stats?.paid_orders_total_aed))}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>
                  {t('admin.walletClientDetail.cancelledOrders', { defaultValue: 'Cancelled orders' })}
                </Text>
                <Text style={styles.statValue}>{stats?.cancelled_orders_count ?? 0}</Text>
                <Text style={styles.statSub}>{formatMoney(parseMoney(stats?.cancelled_orders_total_aed))}</Text>
              </View>
            </View>

            <View style={styles.ordersHead}>
              <Text style={styles.sectionTitle}>
                {t('admin.walletClientDetail.ordersTitle', { defaultValue: 'Shop orders' })}
              </Text>
              {ordersPagination?.total != null ? (
                <Text style={styles.ordersMeta}>
                  {t('admin.walletClientDetail.ordersCount', {
                    defaultValue: '{{count}} orders',
                    count: ordersPagination.total,
                  })}
                </Text>
              ) : null}
            </View>

            {(detail.orders?.length ?? 0) === 0 ? (
              <View style={styles.emptyOrders}>
                <Ionicons name="receipt-outline" size={36} color={COLORS.textSecondary} />
                <Text style={styles.emptyOrdersText}>
                  {t('admin.walletClientDetail.emptyOrders', { defaultValue: 'No orders in this list.' })}
                </Text>
              </View>
            ) : (
              detail.orders!.map(renderOrder)
            )}

            {lastPage > 1 ? (
              <View style={styles.pager}>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
                  disabled={currentPage <= 1}
                  onPress={() => {
                    const next = Math.max(1, currentPage - 1);
                    void fetchDetail(next);
                  }}
                >
                  <Text style={styles.pageBtnText}>{t('admin.walletClientDetail.prev', 'Previous')}</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {t('admin.walletClientDetail.pageOf', {
                    defaultValue: 'Page {{page}} / {{last}}',
                    page: currentPage,
                    last: lastPage,
                  })}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage >= lastPage && styles.pageBtnDisabled]}
                  disabled={currentPage >= lastPage}
                  onPress={() => {
                    const next = Math.min(lastPage, currentPage + 1);
                    void fetchDetail(next);
                  }}
                >
                  <Text style={styles.pageBtnText}>{t('admin.walletClientDetail.next', 'Next')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : null}
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
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    width: 72,
  },
  editBtn: {
    maxWidth: 88,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    textAlign: 'center',
  },
  editBtnTextDisabled: {
    color: COLORS.textSecondary,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  emailLine: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  errorBanner: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.error + '12',
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
  },
  balanceCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  balanceLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  balanceValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  metaItem: {
    flex: 1,
    minWidth: '42%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaItemWide: {
    minWidth: '100%',
  },
  metaLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  metaValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  metaValueSmall: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  statSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: FONT_WEIGHTS.medium,
  },
  ordersHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACING.xs,
  },
  ordersMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  orderCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderId: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  orderTotal: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  orderBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    maxWidth: '100%',
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  orderDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  emptyOrders: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyOrdersText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  pageBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  pageInfo: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
});

export default AdminWalletClientDetailScreen;
