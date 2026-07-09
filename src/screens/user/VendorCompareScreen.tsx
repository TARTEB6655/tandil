import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { vendorService, VendorProductOffer } from '../../services/vendorService';

type SortKey = 'price' | 'rating' | 'delivery';

const VendorCompareScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const productId = route.params?.productId ?? '';
  const productName = route.params?.productName ?? t('vendorCompare.product');

  const [offers, setOffers] = useState<VendorProductOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('price');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await vendorService.getVendorOffersForProduct(productId, productName);
      setOffers(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productId, productName, t]);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const sortedOffers = [...offers].sort((a, b) => {
    if (sortBy === 'price') return a.price - b.price;
    if (sortBy === 'rating') return b.vendor_rating - a.vendor_rating;
    return a.delivery_days - b.delivery_days;
  });

  const bestPrice = sortedOffers.length > 0 ? Math.min(...offers.map((o) => o.price)) : 0;

  const renderItem = ({ item }: { item: VendorProductOffer }) => {
    const isBest = item.price === bestPrice && offers.length > 1;
    const discount =
      item.compare_at_price && item.compare_at_price > item.price
        ? Math.round(((item.compare_at_price - item.price) / item.compare_at_price) * 100)
        : 0;

    return (
      <View style={[styles.card, isBest && styles.cardBest]}>
        {isBest ? (
          <View style={styles.bestBadge}>
            <Ionicons name="trophy" size={14} color={COLORS.background} />
            <Text style={styles.bestText}>{t('vendorCompare.bestPrice')}</Text>
          </View>
        ) : null}

        <View style={styles.vendorRow}>
          {item.vendor_logo ? (
            <Image source={{ uri: item.vendor_logo }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="storefront" size={22} color={COLORS.primary} />
            </View>
          )}
          <View style={styles.vendorInfo}>
            <Text style={styles.vendorName}>{item.vendor_name}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={COLORS.warning} />
              <Text style={styles.rating}>{item.vendor_rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>AED {item.price.toFixed(2)}</Text>
          {item.compare_at_price ? (
            <Text style={styles.compare}>AED {item.compare_at_price.toFixed(2)}</Text>
          ) : null}
          {discount > 0 ? <Text style={styles.discount}>-{discount}%</Text> : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Ionicons name="cube-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>
              {item.stock_quantity > 0
                ? t('vendorCompare.inStock', { count: item.stock_quantity })
                : t('vendorCompare.outOfStock')}
            </Text>
          </View>
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>
              {t('vendorCompare.deliveryDays', { days: item.delivery_days })}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.selectBtn, !item.is_available && styles.selectBtnDisabled]}
          disabled={!item.is_available}
        >
          <Text style={styles.selectBtnText}>
            {item.is_available ? t('vendorCompare.selectVendor') : t('vendorCompare.unavailable')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title={t('vendorCompare.title')} onBackPress={() => navigation.goBack()} />
      <Text style={styles.productTitle}>{productName}</Text>

      <View style={styles.sortRow}>
        {(['price', 'rating', 'delivery'] as SortKey[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.sortChip, sortBy === key && styles.sortChipActive]}
            onPress={() => setSortBy(key)}
          >
            <Text style={[styles.sortText, sortBy === key && styles.sortTextActive]}>
              {t(`vendorCompare.sort.${key}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={COLORS.primary} />
      ) : (
        <FlatList
          data={sortedOffers}
          keyExtractor={(item) => item.vendor_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('vendorCompare.empty')}</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  productTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sortChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  sortChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sortText: { fontSize: FONT_SIZES.sm, color: COLORS.text },
  sortTextActive: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
  loader: { marginTop: SPACING.xxl },
  list: { padding: SPACING.lg, paddingTop: 0 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardBest: { borderColor: COLORS.primary, borderWidth: 2 },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    gap: 4,
    marginBottom: SPACING.sm,
  },
  bestText: { color: COLORS.background, fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.bold },
  vendorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  logo: { width: 44, height: 44, borderRadius: 22, marginRight: SPACING.md },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  vendorInfo: { flex: 1 },
  vendorName: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rating: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  price: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  compare: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  discount: { fontSize: FONT_SIZES.sm, color: COLORS.success, fontWeight: FONT_WEIGHTS.bold },
  metaRow: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  selectBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  selectBtnDisabled: { backgroundColor: COLORS.textSecondary },
  selectBtnText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xxl },
});

export default VendorCompareScreen;
