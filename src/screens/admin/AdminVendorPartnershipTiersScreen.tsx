import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import {
  adminVendorPartnershipService,
  VendorPartnershipTier,
} from '../../services/adminVendorPartnershipService';

const BADGE_COLORS: Record<string, string> = {
  green: '#22C55E',
  silver: '#94A3B8',
  gold: '#EAB308',
  platinum: '#6366F1',
  orange: '#F97316',
  red: '#EF4444',
  blue: '#3B82F6',
};

function badgeColor(color: string): string {
  return BADGE_COLORS[color.toLowerCase()] || COLORS.primary;
}

function MetricPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricPill}>
      <Ionicons name={icon} size={14} color={COLORS.primary} />
      <View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

const AdminVendorPartnershipTiersScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [tiers, setTiers] = useState<VendorPartnershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | string | null>(null);

  const fetchTiers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const list = await adminVendorPartnershipService.listTiers();
      setTiers(list);
    } catch (err: unknown) {
      setTiers([]);
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        'Failed to load partnership tiers.';
      setLoadError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTiers();
    }, [fetchTiers])
  );

  const stats = useMemo(() => {
    const active = tiers.filter((tier) => tier.is_active).length;
    return { total: tiers.length, active };
  }, [tiers]);

  const handleDeactivate = (tier: VendorPartnershipTier) => {
    Alert.alert(
      t('adminVendorPartnership.deactivateTitle', { defaultValue: 'Deactivate tier' }),
      t('adminVendorPartnership.deactivateMessage', {
        defaultValue: 'Deactivate "{{name}}"? Vendors will no longer see this tier.',
        name: tier.name,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('adminVendorPartnership.deactivate', { defaultValue: 'Deactivate' }),
          style: 'destructive',
          onPress: async () => {
            setDeactivatingId(tier.id);
            try {
              const message = await adminVendorPartnershipService.deactivateTier(tier.id);
              setTiers((prev) => prev.filter((item) => String(item.id) !== String(tier.id)));
              Alert.alert(t('admin.users.success', { defaultValue: 'Success' }), message);
            } catch (err: unknown) {
              const message =
                (err as { response?: { data?: { message?: string } }; message?: string })?.response
                  ?.data?.message ||
                (err as { message?: string })?.message ||
                t('adminVendorPartnership.deactivateFailed', {
                  defaultValue: 'Failed to deactivate tier.',
                });
              Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
            } finally {
              setDeactivatingId(null);
            }
          },
        },
      ]
    );
  };

  const renderTier = ({ item, index }: { item: VendorPartnershipTier; index: number }) => {
    const color = badgeColor(item.badge_color);
    const isDeactivating = deactivatingId === item.id;

    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.cardGlow} />

        <View style={styles.cardHeader}>
          <View style={[styles.tierIconWrap, { backgroundColor: color + '18' }]}>
            <Ionicons name="ribbon" size={22} color={color} />
          </View>
          <View style={styles.cardHeaderText}>
            <View style={styles.titleRow}>
              <Text style={styles.tierName}>{item.name}</Text>
              <View style={[styles.statusPill, !item.is_active && styles.statusPillInactive]}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: item.is_active ? COLORS.success : COLORS.textSecondary },
                  ]}
                />
                <Text style={[styles.statusText, !item.is_active && styles.statusTextInactive]}>
                  {item.is_active
                    ? t('adminVendorPartnership.active', { defaultValue: 'Active' })
                    : t('adminVendorPartnership.inactive', { defaultValue: 'Inactive' })}
                </Text>
              </View>
            </View>
            <Text style={styles.slugText}>/{item.slug}</Text>
          </View>
        </View>

        <View style={styles.priceBlock}>
          <Text style={styles.priceAmount}>
            {item.currency} {item.price}
          </Text>
          <Text style={styles.priceDuration}>
            / {item.duration_months}{' '}
            {item.duration_months === 1
              ? t('adminVendorPartnership.month', { defaultValue: 'month' })
              : t('adminVendorPartnership.months', { defaultValue: 'months' })}
          </Text>
        </View>

        <View style={styles.metricsGrid}>
          <MetricPill
            icon="cube-outline"
            label={t('adminVendorPartnership.products', { defaultValue: 'Products' })}
            value={`${item.required_products_min}-${item.required_products_max}`}
          />
          <MetricPill
            icon="list-outline"
            label={t('adminVendorPartnership.listings', { defaultValue: 'Listings' })}
            value={String(item.max_product_listings)}
          />
          <MetricPill
            icon="megaphone-outline"
            label="Exposure"
            value={item.marketing_exposure}
          />
          <MetricPill
            icon="images-outline"
            label="Images"
            value={String(item.max_partner_product_images)}
          />
        </View>

        {item.benefits.length > 0 ? (
          <View style={styles.benefitsWrap}>
            {item.benefits.slice(0, 2).map((benefit) => (
              <View key={benefit} style={styles.benefitChip}>
                <Ionicons name="checkmark-circle" size={12} color={color} />
                <Text style={styles.benefitChipText} numberOfLines={1}>
                  {benefit}
                </Text>
              </View>
            ))}
            {item.benefits.length > 2 ? (
              <Text style={styles.moreBenefits}>+{item.benefits.length - 2} more</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.sortLabel}>#{index + 1} · Sort {item.sort_order}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() =>
                navigation.navigate('AdminVendorPartnershipTierForm', { tierId: item.id })
              }
            >
              <Ionicons name="create-outline" size={18} color={COLORS.background} />
              <Text style={styles.editBtnText}>
                {t('adminVendorPartnership.edit', { defaultValue: 'Edit' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeactivate(item)}
              disabled={isDeactivating}
            >
              {isDeactivating ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const ListHeader = () => (
    <>
      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="ribbon" size={28} color={COLORS.background} />
        </View>
        <Text style={styles.heroTitle}>
          {t('adminVendorPartnership.headerTitle', { defaultValue: 'Partnership Plans' })}
        </Text>
        <Text style={styles.heroSubtitle}>
          {t('adminVendorPartnership.headerSubtitle', {
            defaultValue: 'Design premium vendor tiers with pricing, benefits and marketing exposure.',
          })}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Tiers</Text>
        </View>
        <View style={[styles.statCard, styles.statCardAccent]}>
          <Text style={[styles.statValue, styles.statValueLight]}>{stats.active}</Text>
          <Text style={[styles.statLabel, styles.statLabelLight]}>Active</Text>
        </View>
      </View>

      {tiers.length > 0 ? (
        <Text style={styles.sectionHeading}>
          {tiers.length}{' '}
          {t('adminVendorPartnership.sessions', { defaultValue: 'partnership tiers' })}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={styles.container}>
      <Header
        title={t('adminVendorPartnership.title', { defaultValue: 'Partnership Tiers' })}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading partnership tiers...</Text>
        </View>
      ) : loadError && tiers.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchTiers()}>
            <Text style={styles.retryBtnText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tiers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTier}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTiers(true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="layers-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {t('adminVendorPartnership.emptyTitle', { defaultValue: 'No tiers yet' })}
              </Text>
              <Text style={styles.emptyText}>
                {t('adminVendorPartnership.empty', {
                  defaultValue: 'Create your first partnership tier to get started.',
                })}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('AdminVendorPartnershipTierForm')}
      >
        <Ionicons name="add" size={28} color={COLORS.background} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  listContent: { padding: SPACING.lg, paddingBottom: 100 },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
  },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statCardAccent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  statValueLight: { color: COLORS.background },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  statLabelLight: { color: 'rgba(255,255,255,0.85)' },
  sectionHeading: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 5,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '08',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  tierIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  cardHeaderText: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  tierName: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  slugText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.success + '14',
  },
  statusPillInactive: { backgroundColor: COLORS.textSecondary + '14' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.success },
  statusTextInactive: { color: COLORS.textSecondary },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  priceAmount: {
    fontSize: 28,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  priceDuration: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  metricValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  metricLabel: { fontSize: 10, color: COLORS.textSecondary },
  benefitsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '48%',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  benefitChipText: { flex: 1, fontSize: 11, color: COLORS.text },
  moreBenefits: { fontSize: 11, color: COLORS.textSecondary, alignSelf: 'center' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sortLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  editBtnText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.sm },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.error + '44',
    backgroundColor: COLORS.error + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  loadingText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  retryBtn: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  retryBtnText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});

export default AdminVendorPartnershipTiersScreen;
