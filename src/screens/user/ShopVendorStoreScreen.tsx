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
  TextInput,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { ShopProduct, isShopProductInStock } from '../../services/shopService';
import {
  shopVendorStoreService,
  ShopVendorProfile,
  VendorStoreSortBy,
} from '../../services/shopVendorStoreService';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';

const SCREEN_BG = COLORS.surfaceLight;

/** Vendor store catalog — loads GET /shop/vendors/{id} */

const SORT_OPTIONS: Array<{ id: VendorStoreSortBy; labelKey: string; fallback: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'sort_order', labelKey: 'vendorStore.sortDefault', fallback: 'Featured', icon: 'grid-outline' },
  { id: 'price', labelKey: 'vendorStore.sortPrice', fallback: 'Price', icon: 'pricetag-outline' },
  { id: 'name', labelKey: 'vendorStore.sortName', fallback: 'Name', icon: 'text-outline' },
];

const ShopVendorStoreScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { count: cartItemCount } = useCartBadgeCount();

  const vendorId = String(route.params?.vendorId ?? '').trim();
  const initialName = String(route.params?.vendorName ?? '').trim();
  const initialLogo = route.params?.vendorLogo as string | undefined;
  const initialRating =
    route.params?.vendorRating != null ? Number(route.params.vendorRating) : undefined;

  const [vendor, setVendor] = useState<ShopVendorProfile | null>(
    vendorId
      ? {
          id: vendorId,
          business_name: initialName || t('vendorStore.vendor', { defaultValue: 'Vendor' }),
          logo_url: initialLogo,
          rating: initialRating && initialRating > 0 ? initialRating : undefined,
        }
      : null
  );
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<VendorStoreSortBy>('sort_order');

  const load = useCallback(
    async (pageNum = 1, isRefresh = false, searchTerm = query, sort: VendorStoreSortBy = sortBy) => {
      if (!vendorId) {
        setError(
          t('vendorStore.missingVendor', { defaultValue: 'Vendor not found.' })
        );
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        // GET /shop/vendors/{vendor_id}?search=&sort_by=
        const result = await shopVendorStoreService.getVendorStore(vendorId, {
          page: pageNum,
          per_page: 20,
          search: searchTerm,
          sort_by: sort,
        });

        if (result.vendor) {
          setVendor((prev) => ({
            id: result.vendor!.id || prev?.id || vendorId,
            business_name:
              result.vendor!.business_name ||
              prev?.business_name ||
              initialName ||
              'Vendor',
            logo_url: result.vendor!.logo_url || prev?.logo_url || initialLogo,
            rating:
              (result.vendor!.rating && result.vendor!.rating > 0
                ? result.vendor!.rating
                : prev?.rating) || undefined,
            products_count: result.vendor!.products_count ?? result.pagination.total,
            description: result.vendor!.description || prev?.description,
            phone: result.vendor!.phone || prev?.phone,
            email: result.vendor!.email || prev?.email,
            status_label: result.vendor!.status_label || prev?.status_label,
            owner_name: result.vendor!.owner_name || prev?.owner_name,
          }));
        } else if (pageNum === 1) {
          setVendor((prev) =>
            prev ?? {
              id: vendorId,
              business_name: initialName || 'Vendor',
              logo_url: initialLogo,
              rating: initialRating && initialRating > 0 ? initialRating : undefined,
              products_count: result.pagination.total,
            }
          );
        }

        if (pageNum === 1) setProducts(result.products);
        else setProducts((prev) => [...prev, ...result.products]);

        setPage(result.pagination.current_page);
        setHasMore(result.pagination.current_page < result.pagination.last_page);
      } catch (err: unknown) {
        const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message;
        const message =
          axiosMsg ||
          (err instanceof Error ? err.message : null) ||
          t('vendorStore.loadFailed', {
            defaultValue: 'Failed to load vendor store.',
          });
        setError(message);
        if (pageNum === 1) setProducts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [vendorId, query, sortBy, initialName, initialLogo, initialRating, t]
  );

  useFocusEffect(
    useCallback(() => {
      load(1);
    }, [load])
  );

  const submitSearch = () => {
    setQuery(search.trim());
  };

  const getProductImage = (p: ShopProduct): string | null => {
    const raw =
      p.image_url ??
      (p.main_image as { image_url?: string } | null | undefined)?.image_url ??
      p.image ??
      null;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  };

  const openProduct = (p: ShopProduct) => {
    const image = getProductImage(p);
    const price = typeof p.price === 'string' ? parseFloat(p.price) || 0 : Number(p.price) || 0;
    const original =
      typeof p.compare_at_price === 'string'
        ? parseFloat(p.compare_at_price) || 0
        : Number(p.compare_at_price ?? 0);
    // Prefer numeric catalog id (product_id may exist on vendor-store payloads)
    const rawId =
      (p as { product_id?: number | string }).product_id ??
      p.id;
    const catalogId = Number(rawId);
    if (!Number.isFinite(catalogId) || catalogId <= 0) {
      return;
    }
    navigation.navigate('ProductDetail', {
      product: {
        id: String(catalogId),
        name: p.name,
        price,
        originalPrice: original,
        rating: 0,
        reviews: 0,
        image,
        badge: '',
        inStock: isShopProductInStock(p),
        description: p.description,
        features: [],
        estimatedArrival: p.estimated_arrival ?? undefined,
        jobDuration: p.job_duration ?? undefined,
      },
    });
  };

  const renderProduct = ({ item }: { item: ShopProduct }) => {
    const image = getProductImage(item);
    const price =
      typeof item.price === 'string' ? parseFloat(item.price) || 0 : Number(item.price) || 0;
    const inStock = isShopProductInStock(item);

    return (
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.9}
        onPress={() => openProduct(item)}
      >
        {image ? (
          <Image source={{ uri: image }} style={styles.productImage} contentFit="cover" />
        ) : (
          <View style={[styles.productImage, styles.productImageEmpty]} />
        )}
        <View style={styles.productBody}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.productPrice}>AED {price.toFixed(2)}</Text>
          <View
            style={[
              styles.stockPill,
              { backgroundColor: inStock ? COLORS.primary + '14' : COLORS.textSecondary + '14' },
            ]}
          >
            <Text
              style={[
                styles.stockPillText,
                { color: inStock ? COLORS.primary : COLORS.textSecondary },
              ]}
            >
              {inStock
                ? t('vendorStore.inStock', { defaultValue: 'In stock' })
                : t('vendorStore.outOfStock', { defaultValue: 'Out of stock' })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const displayName =
    vendor?.business_name ||
    initialName ||
    t('vendorStore.vendor', { defaultValue: 'Vendor' });
  const displayLogo = vendor?.logo_url || initialLogo;
  const displayRating =
    vendor?.rating && vendor.rating > 0
      ? vendor.rating
      : initialRating && initialRating > 0
        ? initialRating
        : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={styles.hero}>
        <View style={styles.heroDecor} />
        <View style={styles.heroTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.85}
          >
            <Ionicons name="cart-outline" size={20} color="#fff" />
            {cartItemCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartItemCount > 9 ? '9+' : cartItemCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.vendorBanner}>
          {displayLogo ? (
            <Image source={{ uri: displayLogo }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.vendorMeta}>
            <Text style={styles.vendorName} numberOfLines={2}>
              {displayName}
            </Text>
            {displayRating != null ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#F5C542" />
                <Text style={styles.ratingText}>{displayRating.toFixed(1)}</Text>
              </View>
            ) : null}
            {vendor?.products_count != null ? (
              <Text style={styles.productCount}>
                {t('vendorStore.productCount', {
                  defaultValue: '{{count}} products',
                  count: vendor.products_count,
                })}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('vendorStore.searchPlaceholder', {
              defaultValue: "Search this vendor's products…",
            })}
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setQuery('');
              }}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setSortBy(opt.id)}
                activeOpacity={0.88}
              >
                <Ionicons
                  name={opt.icon}
                  size={14}
                  color={active ? '#fff' : COLORS.primary}
                />
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                  {t(opt.labelKey, { defaultValue: opt.fallback })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && products.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(1, true)}>
            <Text style={styles.retryLink}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.column}
          renderItem={renderProduct}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(1, true)}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) load(page + 1);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: SPACING.md }} color={COLORS.primary} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="storefront-outline" size={36} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {query
                  ? t('vendorStore.emptySearchTitle', {
                      defaultValue: 'No matching products',
                    })
                  : t('vendorStore.emptyTitle', {
                      defaultValue: 'No products yet',
                    })}
              </Text>
              <Text style={styles.emptyText}>
                {query
                  ? t('vendorStore.emptySearch', {
                      defaultValue: 'Try a different search term for this vendor.',
                    })
                  : t('vendorStore.empty', {
                      defaultValue: 'This vendor has no products to show right now.',
                    })}
              </Text>
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
    bottom: -40,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHTS.bold },
  vendorBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoInitial: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  vendorMeta: { flex: 1 },
  vendorName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  ratingText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  productCount: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.75)',
    fontSize: FONT_SIZES.xs,
  },
  searchWrap: {
    marginTop: -18,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    padding: 0,
  },
  sortRow: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortChipText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  sortChipTextActive: {
    color: '#fff',
  },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  column: { gap: SPACING.sm, marginBottom: SPACING.sm },
  productCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.surface,
  },
  productImageEmpty: { backgroundColor: COLORS.surface },
  productBody: { padding: SPACING.sm },
  productName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    minHeight: 36,
  },
  productPrice: {
    marginTop: 6,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  stockPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
  },
  stockPillText: { fontSize: 10, fontWeight: FONT_WEIGHTS.semiBold },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: { color: COLORS.textSecondary, textAlign: 'center' },
  retryLink: {
    marginTop: SPACING.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
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
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default ShopVendorStoreScreen;
