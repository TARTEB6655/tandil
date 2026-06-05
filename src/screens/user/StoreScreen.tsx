import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useIsAuthenticated } from '../../store';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { shopService, ShopProduct } from '../../services/shopService';
import { addCartItem } from '../../services/cartService';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';
import { navigateToClientAuth } from '../../navigation/clientAuthNavigation';
import { buildFullImageUrl } from '../../config/api';

type CategoryItem = { id: string; name: string; imageUri: string | null };

const StoreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const isAuthenticated = useIsAuthenticated();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const { count: cartItemCount, refresh: refreshCartBadge } = useCartBadgeCount();

  const getProductImage = useCallback((p: ShopProduct) => {
    return p.image_url ?? (p.main_image as any)?.image_url ?? p.image ?? null;
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
    description: p.description,
    features: [],
    estimatedArrival: p.estimated_arrival ?? undefined,
    jobDuration: p.job_duration ?? undefined,
  }), [getProductImage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await shopService.getProductCategories();
        if (cancelled) return;
        const allItem: CategoryItem = { id: 'all', name: t('store.categories.all', { defaultValue: 'All' }), imageUri: null };
        const sorted = [...list].sort((a, b) => {
          // Keep original ordering when sort_order is missing.
          if (a.sort_order == null && b.sort_order == null) return 0;
          if (a.sort_order == null) return 1;
          if (b.sort_order == null) return -1;
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        });
        const fromApi: CategoryItem[] = sorted.map((c) => {
          const raw = c.image_url ?? c.image ?? null;
          let uri: string | null = null;
          if (typeof raw === 'string' && raw.trim()) {
            uri = raw.startsWith('http') ? raw.trim() : buildFullImageUrl(raw.trim());
          }
          return { id: String(c.id), name: c.name, imageUri: uri };
        });
        setCategories([allItem, ...fromApi]);
      } catch (_) {
        if (!cancelled) setCategories([{ id: 'all', name: t('store.categories.all', { defaultValue: 'All' }), imageUri: null }]);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  // Debounced search term for API (used when "All" is selected)
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (selectedCategoryId === 'all') {
          const res = await shopService.getProducts({
            per_page: 12,
            page: 1,
            search: debouncedSearch || undefined,
          });
          if (!cancelled) setProducts(Array.isArray(res?.data) ? res.data : []);
        } else {
          const data = await shopService.getProductsByCategory(selectedCategoryId, { page: 1 });
          if (!cancelled) setProducts(data?.products ?? []);
        }
      } catch (_) {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCategoryId, debouncedSearch]);

  // When a category is selected, filter its products by search client-side
  const filteredProducts =
    selectedCategoryId === 'all'
      ? products
      : products.filter(p => {
          const q = searchQuery.trim().toLowerCase();
          if (!q) return true;
          const name = (p.name ?? '').toLowerCase();
          const desc = (p.description ?? '').toLowerCase();
          return name.includes(q) || desc.includes(q);
        });

  const handleAddToCart = async (product: ShopProduct) => {
    if (!isAuthenticated) {
      Alert.alert(
        t('product.loginRequired', { defaultValue: 'Login required' }),
        t('product.loginToAddToCart', { defaultValue: 'Please log in to add items to your cart.' }),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('auth.login', 'Log in'), onPress: () => navigateToClientAuth(navigation) }
        ]
      );
      return;
    }
    const productId = product.id;
    if ((product.stock ?? 0) <= 0) {
      Alert.alert(t('category.outOfStock'), t('category.outOfStock'));
      return;
    }
    setAddingProductId(String(productId));
    try {
      await addCartItem(productId, 1);
      setAddedToCart(String(productId));
      refreshCartBadge();
      setTimeout(() => setAddedToCart(null), 1000);
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || t('product.addToCartFailed', { defaultValue: 'Failed to add to cart. Please try again.' });
      if (status === 401) {
        Alert.alert(
          t('product.loginRequired', { defaultValue: 'Login required' }),
          t('product.loginToAddToCart', { defaultValue: 'Please log in to add items to your cart.' }),
          [{ text: t('common.ok', 'OK') }]
        );
      } else {
        Alert.alert(t('common.error', 'Error'), message);
      }
    } finally {
      setAddingProductId(null);
    }
  };

  const renderCategoryItem = ({ item }: { item: CategoryItem }) => {
    const selected = selectedCategoryId === item.id;
    return (
      <TouchableOpacity
        style={styles.categoryChip}
        onPress={() => setSelectedCategoryId(item.id)}
        activeOpacity={0.75}
      >
        <View style={[styles.categoryImageRing, selected && styles.categoryImageRingSelected]}>
          {item.imageUri ? (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.categoryImage}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
            />
          ) : (
            <View style={[styles.categoryIconFallback, selected && styles.categoryIconFallbackSelected]}>
              <Ionicons name="grid-outline" size={26} color={selected ? COLORS.primary : COLORS.textSecondary} />
            </View>
          )}
        </View>
        <Text
          style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderProductItem = ({ item }: { item: ShopProduct }) => {
    const detail = toDetailProduct(item);
    const imageUri = getProductImage(item);
    const priceNum = typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price;
    const originalNum = typeof item.compare_at_price === 'string' ? parseFloat(item.compare_at_price) || 0 : (item.compare_at_price ?? 0);
    const showDiscount = originalNum > priceNum;
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetail', { product: detail })}
      >
        <View style={styles.productImageContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.productImage} contentFit="cover" transition={200} cachePolicy="disk" />
          ) : (
            <View style={styles.productImageEmpty}>
              <Ionicons name="image-outline" size={22} color={COLORS.textSecondary} />
              <Text style={styles.productImageEmptyText}>{t('home.noImage', { defaultValue: 'No image' })}</Text>
            </View>
          )}
          {showDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>
                {Math.round(((originalNum - priceNum) / originalNum) * 100)}% {t('product.off')}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.productContent}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productDescription} numberOfLines={1}>{item.description ?? ''}</Text>
          {(item.estimated_arrival || item.job_duration) ? (
            <View style={styles.productMetaBox}>
              {item.job_duration ? (
                <View style={styles.productMetaRow}>
                  <Ionicons name="hourglass-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.productMetaText} numberOfLines={1}>
                    {t('product.jobDuration', { defaultValue: 'Duration' })}: {item.job_duration}
                  </Text>
                </View>
              ) : null}
              {item.estimated_arrival ? (
                <View style={styles.productMetaRow}>
                  <Ionicons name="navigate-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.productMetaText} numberOfLines={1}>
                    {t('product.estimatedArrival', { defaultValue: 'Arrival' })}: {item.estimated_arrival}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.productFooter}>
            <View style={styles.priceContainer}>
              <Text style={styles.productPrice}>{t('orders.currency', { defaultValue: 'AED' })} {priceNum}</Text>
              {showDiscount && <Text style={styles.originalPrice}>{t('orders.currency', { defaultValue: 'AED' })} {originalNum}</Text>}
            </View>
            <View style={styles.productRating}>
              <Ionicons name="star" size={14} color={COLORS.warning} />
              <Text style={styles.ratingText}>4.5</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.addToCartButton,
              addedToCart === String(item.id) && styles.addToCartButtonAdded,
              addingProductId === String(item.id) && styles.addToCartButtonDisabled,
            ]}
            onPress={() => handleAddToCart(item)}
            disabled={addingProductId !== null}
          >
            {addingProductId === String(item.id) ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Ionicons name={addedToCart === String(item.id) ? 'checkmark' : 'add'} size={20} color={COLORS.background} />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header 
        title={t('tabs.store')} 
        showBack={false}
        showCart={true}
        cartItemCount={cartItemCount}
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchTextInput}
            placeholder={t('store.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Products Grid */}
      <View style={styles.productsContainer}>
        <View style={styles.productsHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategoryId === 'all' ? t('category.allProducts') : `${categories.find(c => c.id === selectedCategoryId)?.name ?? ''} ${t('category.products')}`}
          </Text>
          <Text style={styles.productsCount}>{t('store.productsCount', { count: filteredProducts.length })}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('store.noProducts', { defaultValue: 'No products found' })}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
            columnWrapperStyle={styles.productRow}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  searchTextInput: {
    flex: 1,
    marginLeft: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  categoriesContainer: {
    marginBottom: SPACING.md,
  },
  categoriesList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xs,
    alignItems: 'flex-start',
  },
  /** Circular image + label below (matches reference store UX). */
  categoryChip: {
    alignItems: 'center',
    width: 78,
    marginRight: SPACING.md,
  },
  categoryImageRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryImageRingSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  categoryImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary + '12',
  },
  categoryIconFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIconFallbackSelected: {
    backgroundColor: COLORS.primary + '22',
  },
  categoryLabel: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    textAlign: 'center',
    width: '100%',
  },
  categoryLabelSelected: {
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  productsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  productsCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  productsList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  productRow: {
    justifyContent: 'space-between',
  },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    width: '48%',
  },
  productImageContainer: {
    height: 120,
    backgroundColor: COLORS.primary + '10',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImageEmpty: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  productImageEmptyText: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  discountBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  discountText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
  },
  productContent: {
    padding: SPACING.md,
  },
  productName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  productDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  productMetaBox: {
    marginBottom: SPACING.sm,
    gap: 2,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  productMetaText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    paddingRight: SPACING.sm,
  },
  productPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
    marginLeft: SPACING.xs,
    flexShrink: 1,
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  addToCartButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  addToCartButtonAdded: {
    backgroundColor: COLORS.success,
  },
  addToCartButtonDisabled: {
    opacity: 0.7,
  },
});

export default StoreScreen;
