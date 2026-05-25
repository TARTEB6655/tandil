import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { publicServiceService, PublicService, PublicServiceProduct } from '../../services/publicServiceService';
import { buildFullImageUrl } from '../../config/api';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';
import { isShopProductInStock } from '../../utils/shopProductStock';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1461354464878-ad92f492a5a0?w=800&q=60&auto=format&fit=crop';

/** In-memory cache for "All" products so returning to Services shows list immediately. */
let cachedAllProducts: PublicServiceProduct[] | null = null;

const ServicesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { count: cartItemCount } = useCartBadgeCount();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState<PublicService[]>([]);
  const [products, setProducts] = useState<PublicServiceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      publicServiceService.getServices({ per_page: 100 }).then((list) => {
        if (!cancelled) setServices(list);
      }).finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [])
  );

  useEffect(() => {
    let cancelled = false;
    if (selectedCategory === 'all') {
      const hasCache = cachedAllProducts && cachedAllProducts.length > 0;
      if (hasCache) {
        setProducts(cachedAllProducts!);
        setLoadingProducts(false);
      } else {
        setLoadingProducts(true);
      }
      publicServiceService.getAllServiceProducts({ per_page: 20, search: searchQuery.trim() || undefined })
        .then((list) => {
          if (!cancelled) {
            setProducts(list);
            cachedAllProducts = list;
          }
        })
        .catch(() => { if (!cancelled) setProducts([]); })
        .finally(() => { if (!cancelled) setLoadingProducts(false); });
    } else {
      setLoadingProducts(true);
      const serviceId = parseInt(selectedCategory, 10);
      if (Number.isNaN(serviceId)) {
        setProducts([]);
        setLoadingProducts(false);
      } else {
        publicServiceService.getProductsByServiceId(serviceId)
          .then((list) => { if (!cancelled) setProducts(list); })
          .catch(() => { if (!cancelled) setProducts([]); })
          .finally(() => { if (!cancelled) setLoadingProducts(false); });
      }
    }
    return () => { cancelled = true; };
  }, [selectedCategory]);

  const filteredProducts = searchQuery.trim()
    ? products.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  const getProductImage = (p: PublicServiceProduct) => {
    const raw = p.image_url ?? (p.main_image as any)?.image_url ?? p.image;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.startsWith('http') ? raw : buildFullImageUrl(raw);
    }
    return FALLBACK_IMAGE;
  };

  const toDetailProduct = (p: PublicServiceProduct) => ({
    id: String(p.id),
    name: p.name,
    price: typeof p.price === 'string' ? parseFloat(p.price) || 0 : (p.price ?? 0),
    originalPrice: typeof p.price === 'string' ? parseFloat(p.price) || 0 : (p.price ?? 0),
    rating: 4.5,
    reviews: 0,
    image: getProductImage(p),
    badge: '',
    inStock: isShopProductInStock(p),
    description: p.description ?? undefined,
    features: [] as string[],
  });

  const FallbackImage = ({ uri }: { uri: string }) => {
    const [currentUri, setCurrentUri] = useState(uri);
    return (
      <Image
        source={{ uri: currentUri }}
        style={styles.serviceImage}
        onError={() => setCurrentUri(FALLBACK_IMAGE)}
      />
    );
  };

  const categoryTabs = useMemo(
    () =>
      [
        { id: 'all', name: t('common.all', 'All'), imageUri: null as string | null },
        ...services.map((s) => {
          const raw = s.image_url ?? s.image ?? null;
          let uri: string | null = null;
          if (typeof raw === 'string' && raw.trim()) {
            uri = raw.startsWith('http') ? raw.trim() : buildFullImageUrl(raw.trim());
          }
          return { id: String(s.id), name: s.name, imageUri: uri };
        }),
      ],
    [services, t]
  );

  const renderCategoryItem = ({ item }: { item: { id: string; name: string; imageUri: string | null } }) => {
    const selected = selectedCategory === item.id;
    return (
      <TouchableOpacity
        style={styles.categoryChip}
        onPress={() => setSelectedCategory(item.id)}
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
              <Ionicons
                name={item.id === 'all' ? 'grid-outline' : 'construct-outline'}
                size={26}
                color={selected ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
          )}
        </View>
        <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]} numberOfLines={2}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderProductItem = ({ item }: { item: PublicServiceProduct }) => {
    const imageUri = getProductImage(item);
    const priceNum = typeof item.price === 'string' ? parseFloat(item.price) || 0 : (item.price ?? 0);
    const detail = toDetailProduct(item);
    return (
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={() => navigation.navigate('ProductDetail', { product: detail })}
      >
        <View style={styles.serviceImageContainer}>
          <FallbackImage uri={imageUri} />
        </View>
        <View style={styles.serviceContent}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <Text style={styles.serviceDescription} numberOfLines={2}>{item.description || ''}</Text>
          <View style={styles.serviceFooter}>
            <Text style={styles.servicePrice}>{item.currency || 'AED'} {priceNum}</Text>
            <View style={styles.serviceRating}>
              <Ionicons name="star" size={14} color={COLORS.warning} />
              <Text style={styles.ratingText}>4.8</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const selectedServiceName = selectedCategory === 'all' ? '' : services.find((s) => String(s.id) === selectedCategory)?.name;

  return (
    <View style={styles.container}>
      <Header 
        title={t('tabs.services')} 
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
            placeholder={t('services.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <Text style={styles.sectionTitle}>{t('services.categoriesTitle')}</Text>
        {loading ? (
          <View style={styles.categoriesList}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={categoryTabs}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        )}
      </View>

      {/* Products List (all service products or by service) */}
      <View style={styles.servicesContainer}>
        <View style={styles.servicesHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'all' ? t('tabs.services') : (selectedServiceName || selectedCategory)}
          </Text>
          <Text style={styles.servicesCount}>
            {loadingProducts ? '…' : `${filteredProducts.length} ${t('category.products', 'products')}`}
          </Text>
        </View>

        {loadingProducts ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('serviceProducts.loading', 'Loading products…')}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.servicesList}
            ListEmptyComponent={
              <View style={styles.loadingWrap}>
                <Text style={styles.emptyText}>{t('serviceProducts.comingSoonMessage', 'No products for this selection.')}</Text>
              </View>
            }
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
  cartButton: {
    padding: SPACING.sm,
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
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  categoriesList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xs,
    alignItems: 'flex-start',
  },
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
  servicesContainer: {
    flex: 1,
  },
  servicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  servicesCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  servicesList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  serviceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  serviceImageContainer: {
    height: 120,
    backgroundColor: COLORS.primary + '10',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  serviceContent: {
    padding: SPACING.md,
  },
  serviceName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  serviceDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  servicePrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  serviceRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
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
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default ServicesScreen; 