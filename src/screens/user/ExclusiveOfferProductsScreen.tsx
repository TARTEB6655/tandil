import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { shopService, ShopProduct } from '../../services/shopService';
import { buildFullImageUrl } from '../../config/api';
import type { PublicExclusiveOffer } from '../../services/exclusiveOffersService';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';

const { width: screenWidth } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=60';

const ExclusiveOfferProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { t } = useTranslation();
  const offer = (route.params as { offer?: PublicExclusiveOffer })?.offer;
  const { count: cartItemCount } = useCartBadgeCount();

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = offer?.product_ids;
    if (!ids?.length) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(ids.map((id) => shopService.getProductById(id)))
      .then((results) => {
        if (cancelled) return;
        setProducts(results.filter((p): p is ShopProduct => p != null));
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setError(t('category.errorLoading', { defaultValue: 'Failed to load products' }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [offer?.product_ids, t]);

  const getProductImage = useCallback((p: ShopProduct) => {
    const raw = p.image_url ?? (p.main_image as any)?.image_url ?? p.image;
    if (typeof raw === 'string' && raw.trim()) return raw.startsWith('http') ? raw : buildFullImageUrl(raw);
    return FALLBACK_IMAGE;
  }, []);

  const toDetailProduct = useCallback((p: ShopProduct) => ({
    id: String(p.id),
    name: p.name,
    price: typeof p.price === 'string' ? parseFloat(p.price) || 0 : p.price,
    originalPrice: typeof p.compare_at_price === 'string' ? parseFloat(p.compare_at_price) || 0 : (p.compare_at_price ?? 0),
    rating: 4.5,
    reviews: 0,
    image: getProductImage(p),
    badge: '',
    inStock: (p.stock ?? 0) > 0,
    description: p.description ?? undefined,
    features: [] as string[],
  }), [getProductImage]);

  const ProductImage = ({ uri }: { uri: string }) => (
    <Image
      source={{ uri: uri || FALLBACK_IMAGE }}
      style={styles.productImage}
      contentFit="cover"
      transition={200}
      cachePolicy="disk"
    />
  );

  const renderProductCard = ({ item }: { item: ShopProduct }) => {
    const detailProduct = toDetailProduct(item);
    const imageUri = getProductImage(item);
    const priceNum = typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price;
    const originalNum = typeof item.compare_at_price === 'string' ? parseFloat(item.compare_at_price) || 0 : (item.compare_at_price ?? 0);
    const inStock = (item.stock ?? 0) > 0;
    const currency = t('orders.currency', { defaultValue: 'AED' });
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetail', { product: detailProduct })}
      >
        <View style={styles.productImageContainer}>
          <ProductImage uri={imageUri} />
          {!inStock && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockText}>{t('product.outOfStock', { defaultValue: 'Out of Stock' })}</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color={COLORS.warning} />
            <Text style={styles.ratingText}>{detailProduct.rating}</Text>
            <Text style={styles.reviewsText}>({detailProduct.reviews} {t('product.reviews', { defaultValue: 'reviews' })})</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>{currency} {priceNum}</Text>
            {originalNum > priceNum && (
              <Text style={styles.originalPrice}>{currency} {originalNum}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const offerTitle = offer?.title?.trim() || t('home.exclusiveOffer', 'Offer');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title={offerTitle}
        showBack
        onBackPress={() => navigation.goBack()}
        showCart
        cartItemCount={cartItemCount}
      />

      {offer?.description ? (
        <View style={styles.offerBanner}>
          <Text style={styles.offerDescription} numberOfLines={2}>{offer.description}</Text>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>{t('category.loading', { defaultValue: 'Loading products…' })}</Text>
            </View>
          ) : error ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Ionicons name="pricetags-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>{t('home.noProductsInOffer', { defaultValue: 'No products in this offer' })}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.productCount}>{products.length} {t('category.products', { defaultValue: 'Products' })}</Text>
              <FlatList
                data={products}
                renderItem={renderProductCard}
                keyExtractor={(item) => String(item.id)}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.productRow}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  offerBanner: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  offerDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  content: {
    padding: SPACING.lg,
  },
  productCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  loadingWrap: {
    paddingVertical: SPACING.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  productCard: {
    width: (screenWidth - SPACING.lg * 2 - SPACING.md) / 2,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImageContainer: {
    position: 'relative',
    height: 150,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  productInfo: {
    padding: SPACING.sm,
  },
  productName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    lineHeight: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  ratingText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginRight: SPACING.xs,
  },
  originalPrice: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
});

export default ExclusiveOfferProductsScreen;
