import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  vendorService,
  VendorProductOffer,
  VendorCompareSortBy,
} from '../../services/vendorService';

const SCREEN_BG = COLORS.surfaceLight;

const SORT_META: { key: VendorCompareSortBy; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'price', icon: 'pricetag-outline' },
  { key: 'rating', icon: 'star-outline' },
  { key: 'delivery', icon: 'flash-outline' },
];

const VendorCompareScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const productId = String(route.params?.productId ?? '').trim();
  const productName = route.params?.productName ?? t('vendorCompare.product');

  const [offers, setOffers] = useState<VendorProductOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<VendorCompareSortBy>('price');

  const load = useCallback(
    async (sort: VendorCompareSortBy, isRefresh = false) => {
      if (!productId) {
        setOffers([]);
        setError(t('vendorCompare.empty'));
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await vendorService.getVendorOffersForProduct(
          productId,
          productName,
          sort
        );
        setOffers(list);
      } catch (err: unknown) {
        setOffers([]);
        setError(
          err instanceof Error
            ? err.message
            : t('vendorCompare.loadFailed', {
                defaultValue: 'Failed to load vendor offers.',
              })
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [productId, productName, t]
  );

  useFocusEffect(
    useCallback(() => {
      load(sortBy, false);
    }, [load, sortBy])
  );

  const handleSortChange = (key: VendorCompareSortBy) => {
    if (key === sortBy) return;
    setSortBy(key);
  };

  const bestPrice =
    offers.length > 0
      ? Math.min(...offers.map((o) => o.price).filter((p) => p > 0))
      : 0;

  const renderItem = ({ item, index }: { item: VendorProductOffer; index: number }) => {
    const isBest =
      item.is_best_price === true ||
      (bestPrice > 0 && item.price === bestPrice && offers.length > 1);
    const discount =
      item.discount_percent && item.discount_percent > 0
        ? item.discount_percent
        : item.compare_at_price && item.compare_at_price > item.price
          ? Math.round(
              ((item.compare_at_price - item.price) / item.compare_at_price) * 100
            )
          : 0;
    const currency = item.currency || 'AED';
    const hasRating = item.vendor_rating > 0;
    const deliveryText =
      item.delivery_label ||
      (item.delivery_days > 0
        ? t('vendorCompare.deliveryDays', { days: item.delivery_days })
        : null);
    const showStock = item.stock_quantity > 0 || item.stock_quantity === 0;

    return (
      <View style={[styles.card, isBest && styles.cardBest]}>
        {isBest ? (
          <View style={styles.bestBadge}>
            <Ionicons name="trophy" size={13} color="#fff" />
            <Text style={styles.bestText}>{t('vendorCompare.bestPrice')}</Text>
          </View>
        ) : (
          <View style={styles.rankPill}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
        )}

        <View style={styles.vendorRow}>
          {item.vendor_logo ? (
            <Image source={{ uri: item.vendor_logo }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoInitial}>
                {(item.vendor_name || 'V').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.vendorInfo}>
            <Text style={styles.vendorName} numberOfLines={2}>
              {item.vendor_name}
            </Text>
            {hasRating ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#D4A017" />
                <Text style={styles.rating}>{item.vendor_rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.price}>
              {currency} {item.price.toFixed(2)}
            </Text>
            {item.compare_at_price && item.compare_at_price > item.price ? (
              <Text style={styles.compare}>
                {currency} {item.compare_at_price.toFixed(2)}
              </Text>
            ) : null}
            {discount > 0 ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discount}>-{discount}%</Text>
              </View>
            ) : null}
          </View>
        </View>

        {(showStock || deliveryText) ? (
          <View style={styles.metaRow}>
            {showStock ? (
              <View style={styles.metaChip}>
                <Ionicons
                  name="cube-outline"
                  size={14}
                  color={item.stock_quantity > 0 ? COLORS.primary : COLORS.textSecondary}
                />
                <Text style={styles.metaText}>
                  {item.stock_quantity > 0
                    ? t('vendorCompare.inStock', { count: item.stock_quantity })
                    : t('vendorCompare.outOfStock')}
                </Text>
              </View>
            ) : null}
            {deliveryText ? (
              <View style={styles.metaChip}>
                <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                <Text style={styles.metaText}>{deliveryText}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.selectBtn, !item.is_available && styles.selectBtnDisabled]}
          disabled={!item.is_available}
          activeOpacity={0.88}
          onPress={() => {
            navigation.navigate('ShopVendorStore', {
              vendorId: item.vendor_id,
              vendorName: item.vendor_name,
              vendorLogo: item.vendor_logo,
              vendorRating: item.vendor_rating > 0 ? item.vendor_rating : undefined,
            });
          }}
        >
          <Text style={styles.selectBtnText}>
            {item.is_available
              ? t('vendorCompare.selectVendor')
              : t('vendorCompare.unavailable')}
          </Text>
          {item.is_available ? (
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          ) : null}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={styles.hero}>
        <View style={styles.heroDecor} />
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>{t('vendorCompare.title')}</Text>
        <Text style={styles.heroProduct} numberOfLines={2}>
          {productName}
        </Text>
        {offers.length > 0 ? (
          <Text style={styles.heroCount}>
            {t('vendorCompare.offerCount', {
              defaultValue: '{{count}} vendor offers',
              count: offers.length,
            })}
          </Text>
        ) : null}
      </View>

      <View style={styles.sortWrap}>
        <View style={styles.sortRow}>
          {SORT_META.map(({ key, icon }) => {
            const active = sortBy === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => handleSortChange(key)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={icon}
                  size={14}
                  color={active ? '#fff' : COLORS.primary}
                />
                <Text style={[styles.sortText, active && styles.sortTextActive]}>
                  {t(`vendorCompare.sort.${key}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item, index) => `${item.vendor_id}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(sortBy, true)}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="storefront-outline" size={36} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {t('vendorCompare.emptyTitle', {
                  defaultValue: 'No vendors to compare',
                })}
              </Text>
              <Text style={styles.empty}>
                {error || t('vendorCompare.empty')}
              </Text>
              {error ? (
                <TouchableOpacity style={styles.retryBtn} onPress={() => load(sortBy, true)}>
                  <Text style={styles.retryText}>
                    {t('common.retry', { defaultValue: 'Retry' })}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BG },
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  heroProduct: {
    marginTop: 6,
    fontSize: FONT_SIZES.md,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  heroCount: {
    marginTop: 8,
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  sortWrap: {
    marginTop: -16,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sortRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  sortChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '10',
  },
  sortChipActive: { backgroundColor: COLORS.primary },
  sortText: {
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  sortTextActive: { color: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardBest: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    backgroundColor: '#F7FBF7',
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    gap: 4,
    marginBottom: SPACING.md,
  },
  bestText: {
    color: '#fff',
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
  },
  rankPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.sm,
  },
  rankText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    marginRight: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  logoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  logoInitial: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  vendorInfo: { flex: 1, paddingRight: SPACING.sm },
  vendorName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  rating: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  priceBlock: { alignItems: 'flex-end' },
  price: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  compare: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  discountBadge: {
    marginTop: 4,
    backgroundColor: COLORS.success + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  discount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.bold,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
  },
  metaText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  selectBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  selectBtnDisabled: { backgroundColor: COLORS.textSecondary },
  selectBtnText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  retryBtn: { marginTop: SPACING.md, padding: SPACING.sm },
  retryText: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default VendorCompareScreen;
