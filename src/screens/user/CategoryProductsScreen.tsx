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
import { shopService, ShopProduct, isShopProductInStock } from '../../services/shopService';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';

const { width: screenWidth } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=60';

interface CategoryProductsScreenProps {
  route: {
    params: {
      category: {
        id: string;
        name: string;
        image: string;
      };
    };
  };
}

const CategoryProductsScreen: React.FC<CategoryProductsScreenProps> = ({ route }) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { category } = route.params;
  const { count: cartItemCount } = useCartBadgeCount();

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [categoryImage, setCategoryImage] = useState<string>(category.image || FALLBACK_IMAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    shopService
      .getProductsByCategory(category.id)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          const list = data.products ?? [];
          setProducts(list);
          setProductCount(data.pagination?.total ?? list.length ?? 0);
          if (data.category?.image_url) setCategoryImage(data.category.image_url);
          const uris = list.map((p) => p.image_url ?? (p.main_image as any)?.image_url ?? p.image).filter(Boolean) as string[];
          if (uris.length > 0) Image.prefetch(uris.slice(0, 12), { cachePolicy: 'disk' }).catch(() => {});
        } else {
          setProducts([]);
          setError(t('category.errorLoading', { defaultValue: 'Failed to load products' }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [category.id, t]);

  const getProductImage = useCallback((p: ShopProduct) => {
    return p.image_url ?? (p.main_image as any)?.image_url ?? p.image ?? FALLBACK_IMAGE;
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
    inStock: isShopProductInStock(p),
    description: p.description,
    features: [],
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
    const inStock = isShopProductInStock(item);
    return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetail', { product: detailProduct })}
    >
      <View style={styles.productImageContainer}>
        <ProductImage uri={imageUri} />
        {!inStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>{t('category.outOfStock')}</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={14} color={COLORS.warning} />
          <Text style={styles.ratingText}>{detailProduct.rating}</Text>
          <Text style={styles.reviewsText}>({detailProduct.reviews} {t('product.reviews')})</Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>{t('orders.currency', { defaultValue: 'AED' })} {priceNum}</Text>
          {originalNum > priceNum && (
            <Text style={styles.originalPrice}>{t('orders.currency', { defaultValue: 'AED' })} {originalNum}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header 
        title={category.name}
        showBack={true}
        showCart={true}
        cartItemCount={cartItemCount}
      />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Category Header */}
        <View style={styles.categoryHeader}>
          <Image
            source={{ uri: categoryImage || FALLBACK_IMAGE }}
            style={styles.categoryImage}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
          />
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            <Text style={styles.productCount}>{productCount} {t('category.products', { defaultValue: 'Products' })}</Text>
          </View>
        </View>

        {/* Products Grid */}
        <View style={styles.productsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('category.allProducts')}</Text>
            <TouchableOpacity>
              <Text style={styles.filterText}>{t('category.filter')}</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>{t('category.loading', { defaultValue: 'Loading products…' })}</Text>
            </View>
          ) : error ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              renderItem={renderProductCard}
              keyExtractor={(item) => String(item.id)}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.productRow}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.loadingWrap}>
                  <Text style={styles.emptyText}>{t('category.noProducts', { defaultValue: 'No products in this category' })}</Text>
                </View>
              }
            />
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
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  categoryImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  productCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  productsContainer: {
    padding: SPACING.md,
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
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  filterText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  productCard: {
    width: (screenWidth - SPACING.md * 3) / 2,
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
  badgeContainer: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
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

export default CategoryProductsScreen;



