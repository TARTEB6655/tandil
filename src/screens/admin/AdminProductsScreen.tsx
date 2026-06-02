import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, AdminProduct } from '../../services/adminService';
import { getProductImageUri } from '../../utils/productImage';
import { getPendingProductImage } from './pendingProductImage';

const PER_PAGE = 10;

// Prefetch first N image URIs with expo-image (disk cache) so list shows images faster
const PREFETCH_COUNT = 15;
function prefetchProductImages(products: AdminProduct[]) {
  const urls: string[] = [];
  for (const item of products) {
    if (urls.length >= PREFETCH_COUNT) break;
    const uri = getProductImageUri(item);
    if (uri) urls.push(uri);
  }
  if (urls.length > 0) {
    Image.prefetch(urls, { cachePolicy: 'disk' }).catch(() => {});
  }
}

const ProductImage: React.FC<{ uri: string | null; productId: number }> = ({ uri, productId }) => {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.iconCircle, { backgroundColor: COLORS.primary + '15' }]}>
        <Ionicons name="leaf-outline" size={18} color={COLORS.primary} />
      </View>
    );
  }
  return (
    <Image
      key={`img-${productId}-${uri}`}
      source={{ uri }}
      style={styles.productImage}
      contentFit="cover"
      cachePolicy="disk"
      recyclingKey={`product-${productId}`}
      onError={() => setFailed(true)}
    />
  );
};

const AdminProductsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const isSearching = searchQuery.trim().length > 0;

  const fetchProducts = useCallback(async (
    targetPage = 1,
    mode: 'initial' | 'refresh' = 'initial',
    queryOverride?: string
  ) => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const q = (queryOverride ?? searchQuery).trim();
      const response = await adminService.getProducts({
        search: q,
        q,
        category_id: '',
        filter: 'all',
        per_page: PER_PAGE,
        page: targetPage,
      });

      const list = Array.isArray(response.data) ? response.data : [];
      const p = response.pagination ?? {
        current_page: targetPage,
        last_page: targetPage,
        per_page: PER_PAGE,
        total: list.length,
      };

      setProducts(list);
      prefetchProductImages(list);
      setPage(Number(p.current_page || targetPage));
      setLastPage(Number(p.last_page || targetPage));
      setTotal(Number(p.total || 0));
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      fetchProducts(1, 'initial');
    }, [fetchProducts])
  );

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'number' ? price : parseFloat(String(price));
    if (isNaN(num)) return String(price);
    return `AED ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDeleteProduct = useCallback((item: AdminProduct) => {
    Alert.alert(
      t('admin.productsAdmin.deleteTitle', 'Delete product'),
      t(
        'admin.productsAdmin.deleteMessage',
        { name: item.name, defaultValue: `Are you sure you want to delete "${item.name}"? This cannot be undone.` }
      ),
      [
        { text: t('admin.settings.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin.users.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await adminService.deleteProduct(item.id);
              setProducts((prev) => prev.filter((p) => p.id !== item.id));
              setTotal((prev) => Math.max(0, prev - 1));
            } catch (err: any) {
              const msg =
                err.response?.data?.message ??
                err.message ??
                t('admin.productsAdmin.deleteFailed', 'Failed to delete product');
              Alert.alert(t('admin.users.error', 'Error'), msg);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }, [t]);

  const renderProduct = ({ item }: { item: AdminProduct }) => {
    const pendingUri = getPendingProductImage(item.id);
    const imageUri = pendingUri ?? getProductImageUri(item);
    const isDeleting = deletingId === item.id;
    return (
    <View style={styles.row}>
      <View style={styles.left}>
        <ProductImage uri={imageUri} productId={item.id} />
        <View style={styles.productInfo}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.meta}>{item.vendor}</Text>
          <Text style={styles.meta}>{formatPrice(item.price)} • Stock {item.stock}</Text>
          {item.category?.name && (
            <Text style={styles.categoryTag}>{item.category.name}</Text>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.smallBtn}
          onPress={() => navigation.navigate('AdminEditProduct' as never, { product: item } as never)}
        >
          <Ionicons name="create-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.smallBtn}
          onPress={() => handleDeleteProduct(item)}
          disabled={isDeleting}
        >
          {isDeleting
            ? <ActivityIndicator size="small" color={COLORS.error} />
            : <Ionicons name="trash-outline" size={18} color={COLORS.error} />}
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('admin.dashboard.products', 'Products')}</Text>
          <Text style={styles.headerSubTitle}>
            {t('admin.productsAdmin.totalCount', {
              defaultValue: '{{count}} items',
              count: total,
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AdminAddProduct' as never)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color={COLORS.background} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBarWrap}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.productsAdmin.searchPlaceholder', { defaultValue: 'Search product name...' })}
            value={searchDraft}
            onChangeText={(txt) => {
              setSearchDraft(txt);
              if (txt.trim() === '' && searchQuery !== '') {
                setSearchQuery('');
                fetchProducts(1, 'initial', '');
              }
            }}
            returnKeyType="search"
            onSubmitEditing={() => {
              const q = searchDraft.trim();
              setSearchQuery(q);
              fetchProducts(1, 'initial', q);
            }}
            placeholderTextColor={COLORS.textSecondary}
          />
          {searchDraft.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setSearchDraft('');
                setSearchQuery('');
                fetchProducts(1, 'initial', '');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => {
            const q = searchDraft.trim();
            setSearchQuery(q);
            fetchProducts(1, 'initial', q);
          }}
        >
          <Text style={styles.searchBtnText}>{t('common.search', { defaultValue: 'Search' })}</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('admin.productsAdmin.loading', 'Loading products…')}
          </Text>
        </View>
      ) : error && products.length === 0 ? (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchProducts()}>
            <Text style={styles.retryBtnText}>
              {t('admin.users.retry', 'Retry')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchProducts(1, 'refresh')} colors={[COLORS.primary]} />
          }
          ListHeaderComponent={
            <View style={styles.paginationHeader}>
              <Text style={styles.paginationHeaderText}>
                {isSearching
                  ? t('admin.productsAdmin.searchMeta', {
                      defaultValue: 'Search results: {{total}} products',
                      total,
                    })
                  : t('admin.productsAdmin.pageMeta', {
                      defaultValue: 'Page {{page}} of {{lastPage}} • {{total}} products',
                      page,
                      lastPage,
                      total,
                    })}
              </Text>
            </View>
          }
          ListFooterComponent={
            isSearching ? null : (
              <View style={styles.paginationControls}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  onPress={() => page > 1 && fetchProducts(page - 1, 'initial')}
                  disabled={page <= 1 || loading || refreshing}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={page <= 1 ? COLORS.textSecondary : COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.pageBtnText,
                      page <= 1 && styles.pageBtnTextDisabled,
                    ]}
                  >
                    {t('common.previous', { defaultValue: 'Previous' })}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageIndicator}>
                  {page}/{Math.max(1, lastPage)}
                </Text>

                <TouchableOpacity
                  style={[styles.pageBtn, page >= lastPage && styles.pageBtnDisabled]}
                  onPress={() => page < lastPage && fetchProducts(page + 1, 'initial')}
                  disabled={page >= lastPage || loading || refreshing}
                >
                  <Text
                    style={[
                      styles.pageBtnText,
                      page >= lastPage && styles.pageBtnTextDisabled,
                    ]}
                  >
                    {t('common.next', { defaultValue: 'Next' })}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={page >= lastPage ? COLORS.textSecondary : COLORS.primary}
                  />
                </TouchableOpacity>
              </View>
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {t('admin.productsAdmin.empty', 'No products found')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  headerSubTitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    minHeight: 42,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    paddingVertical: 8,
  },
  searchBtn: {
    minHeight: 42,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  paginationHeader: {
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paginationHeaderText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.sm, color: COLORS.error, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.background },
  emptyWrap: { paddingVertical: SPACING.xl * 2, alignItems: 'center' },
  emptyText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: SPACING.sm },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.border,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { marginLeft: SPACING.md, flex: 1 },
  name: {
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.md,
    marginBottom: 4,
    lineHeight: 20,
  },
  meta: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, marginBottom: 1 },
  categoryTag: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginTop: 4,
    backgroundColor: COLORS.primary + '14',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'column', gap: 8 },
  smallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  paginationControls: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    minWidth: 108,
  },
  pageBtnDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pageBtnText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  pageBtnTextDisabled: {
    color: COLORS.textSecondary,
  },
  pageIndicator: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});

export default AdminProductsScreen;
