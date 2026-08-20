/**
 * Client Memberships hub.
 * List: GET /subscriptions (Postman List My Memberships).
 * Active/renew meta: GET /client/memberships/screen when available.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS, BORDER_RADIUS } from '../../constants';
import {
  getMembershipScreen,
  ClientMembership,
  MembershipHistoryItem,
  MembershipCurrentSummary,
  formatMembershipPlan,
  formatMembershipDate,
  isMembershipActive,
  isMembershipExpired,
  daysUntilExpiry,
  membershipToClientMembership,
  resolveMembershipPictureUrl,
} from '../../services/clientMembershipService';

const MembershipsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [memberships, setMemberships] = useState<ClientMembership[]>([]);
  const [current, setCurrent] = useState<MembershipCurrentSummary | null>(null);
  const [renewPrice, setRenewPrice] = useState<number | null>(null);
  const [history, setHistory] = useState<MembershipHistoryItem[]>([]);
  const [currency, setCurrency] = useState('AED');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScreen = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      setError(null);
      const data = await getMembershipScreen();
      const active = data.active_membership;
      const list = Array.isArray(data.memberships) ? data.memberships : [];
      setMemberships(list);
      setCurrent(active?.current_membership ?? null);
      setRenewPrice(
        active?.renew_price != null && !Number.isNaN(Number(active.renew_price))
          ? Number(active.renew_price)
          : null
      );
      setHistory(active?.history ?? []);
      setCurrency(active?.currency || 'AED');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        ax.response?.data?.message ||
          ax.message ||
          t('memberships.loadFailed', { defaultValue: 'Could not load memberships.' })
      );
      setMemberships([]);
      setCurrent(null);
      setRenewPrice(null);
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void fetchScreen(false);
    }, [fetchScreen])
  );

  const activeAsMembership = useMemo(
    () => membershipToClientMembership(current),
    [current]
  );

  const activeFromList = useMemo(() => {
    if (!current?.subscription_id) return null;
    return memberships.find((m) => m.id === current.subscription_id) || null;
  }, [memberships, current]);

  const active = activeAsMembership;
  const daysLeft = active ? daysUntilExpiry(active) : null;
  const displayName = formatMembershipPlan(
    current?.plan || '',
    current?.plan_name || activeFromList?.plan_name
  );
  const pictureUri = resolveMembershipPictureUrl(
    activeFromList?.picture_url,
    activeFromList?.picture
  );
  const features = Array.isArray(activeFromList?.features)
    ? activeFromList!.features!.filter(Boolean)
    : [];

  const historyRows = useMemo(() => {
    if (history.length) return history;
    // Fallback: other memberships that are not the current one
    return memberships
      .filter((m) => !current || m.id !== current.subscription_id)
      .map((m) => ({
        id: m.id,
        subscription_id: m.id,
        plan: m.plan,
        plan_name: m.plan_name,
        amount: m.amount,
        start_date: m.start_date,
        end_date: m.end_date,
        payment_status: m.payment_status,
        status: m.status,
      }));
  }, [history, memberships, current]);

  const goCheckout = (params: {
    mode: 'purchase' | 'renew' | 'upgrade';
    planKey: string;
    planTitle: string;
    amount: number;
    planId?: string | number;
    membershipId?: number;
  }) => {
    navigation.navigate('MembershipCheckout', {
      mode: params.mode,
      planKey: params.planKey,
      planTitle: params.planTitle,
      amount: params.amount,
      currency,
      planId: params.planId,
      membershipId: params.membershipId,
    });
  };

  const handleRenew = () => {
    if (!current) return;
    const amount =
      renewPrice != null && renewPrice > 0
        ? renewPrice
        : Number(current.amount) || 0;
    goCheckout({
      mode: 'renew',
      planKey: current.plan,
      planTitle: displayName,
      amount,
      planId: current.subscription_id,
      membershipId: current.subscription_id,
    });
  };

  const handlePurchase = (m: ClientMembership) => {
    const isCurrent = current?.subscription_id === m.id;
    goCheckout({
      mode: isCurrent ? 'renew' : current ? 'upgrade' : 'purchase',
      planKey: m.plan,
      planTitle: formatMembershipPlan(m.plan, m.plan_name),
      amount: Number(m.amount) || 0,
      planId: m.id,
      membershipId: current?.subscription_id ?? m.id,
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('memberships.title', { defaultValue: 'Membership' })}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('HelpCenter')} hitSlop={12}>
          <Ionicons name="help-circle-outline" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchScreen(true)}
            colors={[COLORS.primary]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
        ) : error && memberships.length === 0 && !current ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={36} color={COLORS.error} />
            <Text style={styles.errorTitle}>
              {t('memberships.loadFailedTitle', { defaultValue: 'Unable to load' })}
            </Text>
            <Text style={styles.errorBody}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void fetchScreen(false)}>
              <Text style={styles.retryBtnText}>
                {t('common.retry', { defaultValue: 'Retry' })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Active membership */}
            <View style={styles.statusCard}>
              <View style={styles.statusDecor} />
              {current ? (
                <>
                  {pictureUri ? (
                    <Image source={{ uri: pictureUri }} style={styles.statusImage} contentFit="cover" />
                  ) : null}
                  <View style={styles.statusBadgeRow}>
                    <View style={styles.activeBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#fff" />
                      <Text style={styles.activeBadgeText}>
                        {t('memberships.active', { defaultValue: 'Active' })}
                      </Text>
                    </View>
                    {daysLeft != null && daysLeft <= 14 ? (
                      <Text style={styles.expiryWarn}>
                        {daysLeft <= 0
                          ? t('memberships.expiresToday', { defaultValue: 'Expires today' })
                          : t('memberships.daysLeft', {
                              defaultValue: '{{count}} days left',
                              count: daysLeft,
                            })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.statusPlan}>{displayName}</Text>
                  {activeFromList?.subtitle ? (
                    <Text style={styles.statusSubtitle}>{activeFromList.subtitle}</Text>
                  ) : null}
                  <Text style={styles.statusMeta}>
                    {t('memberships.validUntil', {
                      defaultValue: 'Valid until {{date}}',
                      date: formatMembershipDate(current.end_date),
                    })}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaChip}>
                      <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.metaChipText}>
                        {formatMembershipDate(current.start_date)} →{' '}
                        {formatMembershipDate(current.end_date)}
                      </Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Ionicons name="cash-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.metaChipText}>
                        {currency} {current.amount}
                      </Text>
                    </View>
                  </View>

                  {features.length > 0 ? (
                    <View style={styles.featureBlock}>
                      {features.slice(0, 4).map((f) => (
                        <View key={f} style={styles.featureRowLight}>
                          <Ionicons name="checkmark-circle" size={15} color="#fff" />
                          <Text style={styles.featureTextLight}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.primaryAction}
                      onPress={handleRenew}
                      activeOpacity={0.88}
                    >
                      <Ionicons name="refresh-outline" size={18} color="#fff" />
                      <Text style={styles.primaryActionText}>
                        {t('memberships.renew', { defaultValue: 'Renew' })}
                        {renewPrice != null ? ` · ${currency} ${renewPrice}` : ''}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="ribbon-outline" size={28} color={COLORS.primary} />
                  </View>
                  <Text style={styles.statusPlan}>
                    {t('memberships.noActiveTitle', { defaultValue: 'No active membership' })}
                  </Text>
                  <Text style={styles.statusMeta}>
                    {t('memberships.noActiveHint', {
                      defaultValue: 'Choose a plan below to get regular garden care visits.',
                    })}
                  </Text>
                </>
              )}
            </View>

            {/* Full membership list — GET /subscriptions */}
            {memberships.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>
                  {t('memberships.yourMemberships', { defaultValue: 'Your memberships' })}
                </Text>
                <Text style={styles.sectionHint}>
                  {t('memberships.payHint', {
                    defaultValue: 'Pay with Apple Pay or card (Stripe), same as wallet top-up.',
                  })}
                </Text>
                {memberships.map((m) => {
                  const uri = resolveMembershipPictureUrl(m.picture_url, m.picture);
                  const feats = Array.isArray(m.features) ? m.features.filter(Boolean) : [];
                  const on = isMembershipActive(m);
                  const isCurrent = current?.subscription_id === m.id;
                  const ctaLabel = isCurrent
                    ? t('memberships.renew', { defaultValue: 'Renew' })
                    : current
                      ? t('memberships.upgradeTo', {
                          defaultValue: 'Upgrade to {{plan}}',
                          plan: formatMembershipPlan(m.plan, m.plan_name),
                        })
                      : t('memberships.purchase', { defaultValue: 'Purchase' });

                  return (
                    <View key={m.id} style={styles.planCard}>
                      {uri ? (
                        <Image source={{ uri }} style={styles.planImage} contentFit="cover" />
                      ) : null}
                      <View style={styles.planHeader}>
                        <View style={styles.planIcon}>
                          <Ionicons name="leaf" size={22} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.planTitle}>
                            {formatMembershipPlan(m.plan, m.plan_name)}
                          </Text>
                          {m.subtitle ? (
                            <Text style={styles.planSubtitle}>{m.subtitle}</Text>
                          ) : null}
                          <Text style={styles.planDates}>
                            {formatMembershipDate(m.start_date)} – {formatMembershipDate(m.end_date)}
                          </Text>
                        </View>
                        <View style={styles.planPriceCol}>
                          <Text style={styles.planPrice}>
                            {currency} {m.amount}
                          </Text>
                          <View
                            style={[
                              styles.historyBadge,
                              on ? styles.historyActive : styles.historyIdle,
                            ]}
                          >
                            <Text
                              style={[styles.historyBadgeText, on && { color: COLORS.success }]}
                            >
                              {on
                                ? t('memberships.active', { defaultValue: 'Active' })
                                : isMembershipExpired(m)
                                  ? t('memberships.expired', { defaultValue: 'Expired' })
                                  : m.status || m.payment_status}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {feats.length > 0 ? (
                        <View style={styles.features}>
                          {feats.map((f) => (
                            <View key={`${m.id}-${f}`} style={styles.featureRow}>
                              <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                              <Text style={styles.featureText}>{f}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={styles.planCta}
                        onPress={() => handlePurchase(m)}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.planCtaText}>{ctaLabel}</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            ) : null}

            {/* History */}
            {historyRows.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>
                  {t('memberships.history', { defaultValue: 'History' })}
                </Text>
                {historyRows.map((row, index) => {
                  const id = row.id ?? row.subscription_id ?? index;
                  const title = formatMembershipPlan(
                    String(row.plan || ''),
                    row.plan_name as string | null
                  );
                  const status = String(row.status || row.payment_status || '');
                  return (
                    <View key={`hist-${id}-${index}`} style={styles.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyTitle}>{title || 'Membership'}</Text>
                        <Text style={styles.historyMeta}>
                          {formatMembershipDate(row.start_date as string)} –{' '}
                          {formatMembershipDate(row.end_date as string)}
                        </Text>
                      </View>
                      <View style={styles.historyBadge}>
                        <Text style={styles.historyBadgeText}>{status || '—'}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  header: {
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  content: { padding: SPACING.lg, gap: SPACING.md },
  errorBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  errorTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  errorBody: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.lg,
  },
  retryBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
  statusCard: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  statusDecor: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -30,
  },
  statusImage: {
    width: '100%',
    height: 120,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeBadgeText: { color: '#fff', fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  expiryWarn: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statusPlan: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  statusMeta: { fontSize: FONT_SIZES.sm, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  metaChipText: { fontSize: FONT_SIZES.xs, color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  featureBlock: { marginTop: SPACING.md, gap: 6 },
  featureRowLight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureTextLight: { flex: 1, fontSize: FONT_SIZES.sm, color: 'rgba(255,255,255,0.92)' },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.text,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: BORDER_RADIUS.lg,
  },
  primaryActionText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.sm },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.lg,
  },
  secondaryActionText: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  sectionHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: -4,
  },
  planCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  planImage: {
    width: '100%',
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  planSubtitle: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  planDates: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4 },
  planPriceCol: { alignItems: 'flex-end', gap: 6 },
  planPrice: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  features: { gap: 6, marginTop: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  planCta: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  planCtaText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.sm },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
  },
  listThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  historyMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  historyAmount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginTop: 2,
  },
  historyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
  },
  historyActive: { backgroundColor: COLORS.success + '18' },
  historyIdle: {},
  historyBadgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
    textTransform: 'capitalize',
  },
});

export default MembershipsScreen;
