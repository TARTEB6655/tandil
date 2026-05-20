import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { adminCouponService } from '../../services/adminCouponService';
import type { AdminCoupon } from '../../types/adminCoupon';
import { formatCouponScopeLabel } from '../../utils/couponScopeLabel';
import { getCouponDiscountBadge } from '../../utils/couponDisplay';
import { adminService } from '../../services/adminService';
import { parseAdminServicesList } from '../../utils/adminServicesList';

const AdminCouponsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [categoryNameById, setCategoryNameById] = useState<Map<number, string>>(new Map());
  const [serviceNameById, setServiceNameById] = useState<Map<number, string>>(new Map());
  const [listMeta, setListMeta] = useState<{ total?: number } | null>(null);
  const [listMessage, setListMessage] = useState<string | null>(null);

  const fetchCoupons = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await adminCouponService.listCoupons({ per_page: 50, page: 1 });
        setCoupons(res.data);
        setListMeta(res.meta ?? null);
        setListMessage(res.message ?? null);
      } catch (err: any) {
        setListMeta(null);
        setListMessage(null);
        setError(
          err.response?.data?.message ||
            err.message ||
            t('admin.coupons.errorLoad', 'Failed to load coupons')
        );
        setCoupons([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  const loadCategoryNames = useCallback(async () => {
    try {
      const res = await adminService.getCategories({ per_page: 100 });
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : (raw as any)?.data ?? [];
      const map = new Map<number, string>();
      (Array.isArray(list) ? list : []).forEach((c: { id: number; name: string }) => {
        map.set(c.id, c.name);
      });
      setCategoryNameById(map);
    } catch {
      setCategoryNameById(new Map());
    }
  }, []);

  const loadServiceNames = useCallback(async () => {
    try {
      const res = await adminService.getServices({ per_page: 100 });
      const map = new Map<number, string>();
      parseAdminServicesList(res.data).forEach((s) => map.set(s.id, s.name));
      setServiceNameById(map);
    } catch {
      setServiceNameById(new Map());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCoupons();
      loadCategoryNames();
      loadServiceNames();
    }, [fetchCoupons, loadCategoryNames, loadServiceNames])
  );

  const stats = useMemo(() => {
    const active = coupons.filter((c) => c.is_active === true || c.is_active === 1).length;
    const total = listMeta?.total ?? coupons.length;
    return { total, active, inactive: coupons.length - active };
  }, [coupons, listMeta]);

  const handleDelete = useCallback(
    (item: AdminCoupon) => {
      Alert.alert(
        t('admin.coupons.deleteTitle', 'Delete coupon?'),
        t('admin.coupons.deleteMessage', 'Delete "{{code}}"? This cannot be undone.').replace(
          '{{code}}',
          item.code
        ),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('common.delete', 'Delete'),
            style: 'destructive',
            onPress: async () => {
              setDeletingId(item.id);
              try {
                const res = await adminCouponService.deleteCoupon(item.id);
                await fetchCoupons(true);
                Alert.alert(
                  t('admin.users.success', 'Success'),
                  res.message || t('admin.coupons.deleted', 'Coupon deleted.')
                );
              } catch (err: any) {
                Alert.alert(
                  t('admin.users.error', 'Error'),
                  err.response?.data?.message ||
                    err.message ||
                    t('admin.coupons.deleteFailed', 'Failed to delete coupon.')
                );
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    [t, fetchCoupons]
  );

  const renderItem = ({ item }: { item: AdminCoupon }) => {
    const isActive = item.is_active === true || item.is_active === 1;
    const isDeleting = deletingId === item.id;
    const badge = getCouponDiscountBadge(item);
    const scope = formatCouponScopeLabel(item, categoryNameById, serviceNameById);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('AdminEditCoupon' as never, { coupon: item } as never)}
      >
        <View style={styles.discountStrip}>
          <Ionicons name={badge.icon} size={20} color={COLORS.background} style={styles.stripIcon} />
          <Text style={styles.discountMain}>{badge.main}</Text>
          <Text style={styles.discountSub}>{badge.sub}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={styles.codeWrap}>
              <Text style={styles.codeLabel}>{t('admin.coupons.codeLabel', 'CODE')}</Text>
              <Text style={styles.code}>{item.code}</Text>
            </View>
            <View style={[styles.statusPill, isActive ? styles.statusActive : styles.statusOff]}>
              <View style={[styles.statusDot, isActive ? styles.dotOn : styles.dotOff]} />
              <Text style={[styles.statusText, isActive ? styles.statusTextOn : undefined]}>
                {isActive ? t('admin.coupons.active', 'Active') : t('admin.coupons.inactive', 'Inactive')}
              </Text>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {item.description ? (
            <Text style={styles.desc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
              <Text style={styles.tagText} numberOfLines={1}>
                {scope}
              </Text>
            </View>
            {item.min_order_amount > 0 ? (
              <View style={styles.tag}>
                <Ionicons name="cart-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.tagTextMuted}>Min {item.min_order_amount} AED</Text>
              </View>
            ) : null}
          </View>

          {(item.starts_at || item.ends_at || item.usage_limit_per_user != null) && (
            <View style={styles.footerMeta}>
              {(item.starts_at || item.ends_at) && (
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {item.starts_at?.slice(0, 10) ?? '—'} → {item.ends_at?.slice(0, 10) ?? '—'}
                  </Text>
                </View>
              )}
              {item.usage_limit_per_user != null ? (
                <View style={styles.metaItem}>
                  <Ionicons name="person-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {item.usage_limit_per_user}x {t('admin.coupons.perUser', 'per user')}
                  </Text>
                </View>
              ) : null}
              {(item.paid_redemptions ?? 0) > 0 ? (
                <View style={styles.metaItem}>
                  <Ionicons name="checkmark-done-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {item.paid_redemptions} {t('admin.coupons.redeemed', 'redeemed')}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AdminEditCoupon' as never, { coupon: item } as never)}
          >
            <Ionicons name="create-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => handleDelete(item)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Ionicons name="trash-outline" size={22} color={COLORS.error} />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.headerBlock}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>{t('admin.coupons.statTotal', 'Total')}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardActive]}>
          <Text style={[styles.statValue, styles.statValueActive]}>{stats.active}</Text>
          <Text style={styles.statLabel}>{t('admin.coupons.statActive', 'Active')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.inactive}</Text>
          <Text style={styles.statLabel}>{t('admin.coupons.statInactive', 'Inactive')}</Text>
        </View>
      </View>
      {listMessage ? (
        <Text style={styles.listMessage}>{listMessage}</Text>
      ) : null}
      <Text style={styles.listHint}>
        {t('admin.coupons.listHint', 'Tap a coupon to edit. Customers apply codes at cart & checkout.')}
      </Text>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="ticket-outline" size={48} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>{t('admin.coupons.emptyTitle', 'No coupons yet')}</Text>
      <Text style={styles.emptyText}>
        {t('admin.coupons.empty', 'Create your first discount code for customers.')}
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => navigation.navigate('AdminAddCoupon' as never)}
      >
        <Ionicons name="add-circle-outline" size={22} color={COLORS.background} />
        <Text style={styles.emptyBtnText}>{t('admin.coupons.createFirst', 'Create coupon')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title={t('admin.coupons.title', 'Coupons')}
        showBack
        showLanguage={false}
        rightComponent={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => navigation.navigate('AdminAddCoupon' as never)}
          >
            <Ionicons name="add-circle" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.coupons.loading', 'Loading coupons…')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchCoupons()}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={coupons}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={coupons.length > 0 ? ListHeader : null}
          contentContainerStyle={[
            styles.list,
            coupons.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCoupons(true)}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={ListEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  list: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  listEmpty: { flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
  },
  retryBtn: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.sm },
  headerAddBtn: { padding: SPACING.xs },
  headerBlock: { marginBottom: SPACING.lg },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statCardActive: {
    backgroundColor: COLORS.primary + '12',
    borderColor: COLORS.primary + '40',
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  statValueActive: { color: COLORS.primary },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4 },
  listMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginTop: SPACING.sm,
  },
  listHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  discountStrip: {
    width: 88,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  stripIcon: { marginBottom: 4, opacity: 0.9 },
  discountMain: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  discountSub: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
    opacity: 0.9,
    marginTop: 2,
  },
  cardBody: { flex: 1, padding: SPACING.md, minWidth: 0 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  codeWrap: { flex: 1 },
  codeLabel: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  code: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  statusActive: { backgroundColor: COLORS.success + '18' },
  statusOff: { backgroundColor: COLORS.textSecondary + '20' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { backgroundColor: COLORS.success },
  dotOff: { backgroundColor: COLORS.textSecondary },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.textSecondary },
  statusTextOn: { color: COLORS.success },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  desc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    maxWidth: '100%',
  },
  tagText: { fontSize: FONT_SIZES.xs, color: COLORS.primary, fontWeight: FONT_WEIGHTS.medium, flexShrink: 1 },
  tagTextMuted: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  footerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  cardActions: {
    justifyContent: 'center',
    paddingRight: SPACING.xs,
    gap: SPACING.xs,
  },
  actionBtn: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
  },
  actionBtnDanger: { backgroundColor: COLORS.error + '10' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl * 2,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  emptyBtnText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default AdminCouponsScreen;
