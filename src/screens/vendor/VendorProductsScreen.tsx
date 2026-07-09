import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { vendorService, VendorCatalogProduct } from '../../services/vendorService';
import { VendorPageHeader, VENDOR_SCREEN_BG } from '../../components/vendor/VendorUi';
import ModelViewer3D from '../../components/common/ModelViewer3D';

const { width } = Dimensions.get('window');

const VendorProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState<VendorCatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [show3DViewer, setShow3DViewer] = useState(false);
  const [selectedModelUrl, setSelectedModelUrl] = useState<string | null>(null);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  const loadProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const result = await vendorService.getProductsPage({ page: 1, per_page: 50 });
      setProducts(result.items);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('vendorProducts.loadFailed', { defaultValue: 'Failed to load products.' });
      setLoadError(message);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadProducts(false);
    }, [loadProducts])
  );

  const getFallbackImageUrl = (product: VendorCatalogProduct): string => {
    switch (product.category) {
      case 'Plants':
        return 'https://images.unsplash.com/photo-1466781783364-36c667e55134?w=400';
      case 'Irrigation':
        return 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400';
      default:
        return 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400';
    }
  };

  const categories = [
    { id: 'all', name: t('vendorProducts.all'), icon: 'grid-outline' },
    ...Array.from(new Set(products.map((p) => p.category))).map((cat) => ({
      id: cat,
      name: cat,
      icon: 'leaf-outline' as const,
    })),
  ];

  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products.filter((product) => product.category === selectedCategory);

  const handleAddProduct = () => {
    navigation.navigate('AddProduct');
  };

  const handleEditProduct = (productId: string) => {
    navigation.navigate('EditProduct', { productId });
  };

  // Vendor flow does not need a product detail page

  const handleToggleAvailability = (productId: string, current: boolean) => {
    Alert.alert(
      t('vendorProducts.toggleTitle'),
      t('vendorProducts.toggleMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm', { defaultValue: 'Confirm' }),
          onPress: async () => {
            await vendorService.toggleProductAvailability(productId, !current);
            await loadProducts(true);
          },
        },
      ]
    );
  };

  const handleDeleteProduct = (product: VendorCatalogProduct) => {
    Alert.alert(
      t('vendorProducts.deleteTitle', { defaultValue: 'Delete product' }),
      t('vendorProducts.deleteMessage', {
        defaultValue: 'Delete "{{name}}"? This cannot be undone.',
        name: product.name,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(product.id);
            try {
              const res = await vendorService.deleteProduct(product.id);
              await loadProducts(true);
              Alert.alert(
                t('common.success'),
                res.message ||
                  t('vendorProducts.deleteSuccess', { defaultValue: 'Product deleted successfully.' })
              );
            } catch (err: unknown) {
              const message =
                (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
                  ?.message ||
                (err as { message?: string })?.message ||
                t('vendorProducts.deleteFailed', { defaultValue: 'Failed to delete product.' });
              Alert.alert(t('common.error'), message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleOpen3DViewer = (_product: VendorCatalogProduct) => {
    Alert.alert(t('vendorProducts.no3d'), t('vendorProducts.no3dMessage'));
  };

  const handleClose3DViewer = () => {
    setShow3DViewer(false);
    setSelectedModelUrl(null);
  };

  const getApprovalBadgeStyle = (status?: string) => {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return { bg: COLORS.success + '22', color: COLORS.success, label: t('vendorProducts.approved', { defaultValue: 'Approved' }) };
      case 'rejected':
        return { bg: COLORS.error + '22', color: COLORS.error, label: t('vendorProducts.rejected', { defaultValue: 'Rejected' }) };
      default:
        return { bg: COLORS.warning + '22', color: COLORS.warning, label: t('vendorProducts.pending', { defaultValue: 'Pending' }) };
    }
  };

  const renderProductCard = ({ item }: { item: VendorCatalogProduct }) => {
    const approval = getApprovalBadgeStyle(item.approval_status);
    return (
    <View style={styles.productCard}>
      <View style={styles.productImageContainer}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => handleOpen3DViewer(item)} style={{ flex: 1 }}>
          <Image
            defaultSource={require('../../../assets/splash-icon.png')}
            source={
              imageErrorMap[item.id] || !item.images[0]
                ? { uri: getFallbackImageUrl(item) }
                : { uri: item.images[0] }
            }
            style={styles.productImage}
            resizeMode="cover"
            onError={() => setImageErrorMap((prev) => ({ ...prev, [item.id]: true }))}
          />
        </TouchableOpacity>
        <View style={[styles.approvalBadge, { backgroundColor: approval.bg }]}>
          <Text style={[styles.approvalBadgeText, { color: approval.color }]}>{approval.label}</Text>
        </View>
        <View style={[styles.availabilityBadge, {
          backgroundColor: item.is_available ? COLORS.success : COLORS.textSecondary,
        }]}>
          <Text style={styles.availabilityText}>
            {item.is_available
              ? t('vendorProducts.active', { defaultValue: 'Active' })
              : t('vendorProducts.inactive', { defaultValue: 'Inactive' })}
          </Text>
        </View>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productDescription} numberOfLines={2}>{item.description}</Text>
        <Text style={styles.productCategory}>
          {t('vendorProducts.category')}: {item.category}
        </Text>
        <Text style={styles.productPrice}>AED {item.price.toFixed(2)} · {t('vendorProducts.stock')}: {item.stock_quantity}</Text>
      </View>

      <View style={styles.productActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleEditProduct(item.id)}>
          <Ionicons name="create-outline" size={20} color={COLORS.warning} />
          <Text style={styles.actionText}>{t('common.edit', { defaultValue: 'Edit' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleAvailability(item.id, item.is_available)}
        >
          <Ionicons
            name={item.is_available ? 'close-circle-outline' : 'checkmark-circle-outline'}
            size={20}
            color={item.is_available ? COLORS.error : COLORS.success}
          />
          <Text style={styles.actionText}>
            {item.is_available ? t('vendorProducts.disable') : t('vendorProducts.enable')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteProduct(item)}
          disabled={deletingId === item.id}
        >
          {deletingId === item.id ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
          )}
          <Text style={[styles.actionText, styles.deleteActionText]}>
            {t('common.delete', { defaultValue: 'Delete' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <VendorPageHeader
        title={t('vendorTabs.products')}
        subtitle={t('vendorDashboard.manageProducts')}
        actionLabel={t('vendorDashboard.add')}
        actionIcon="add"
        onAction={handleAddProduct}
      />

      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory === category.id && styles.categoryButtonActive
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Ionicons 
                name={category.icon as any} 
                size={20} 
                color={selectedCategory === category.id ? COLORS.background : COLORS.primary} 
              />
              <Text style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Products List */}
      <View style={styles.productsContainer}>
        <View style={styles.productsHeader}>
          <Text style={styles.productsTitle}>
            {selectedCategory === 'all' ? 'All Products' : `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}`}
          </Text>
          <Text style={styles.productsCount}>{filteredProducts.length} products</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
        ) : loadError ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
            <Text style={styles.emptyStateTitle}>{t('vendorProducts.loadFailed', { defaultValue: 'Failed to load products.' })}</Text>
            <Text style={styles.emptyStateText}>{loadError}</Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={() => loadProducts(true)}>
              <Text style={styles.emptyStateButtonText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
            </TouchableOpacity>
          </View>
        ) : filteredProducts.length > 0 ? (
          <FlatList
            data={filteredProducts}
            renderItem={renderProductCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProducts(true)} />}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyStateTitle}>No Products Found</Text>
            <Text style={styles.emptyStateText}>
              {selectedCategory === 'all' 
                ? 'You haven\'t added any products yet.' 
                : `No products found in ${selectedCategory} category.`
              }
            </Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={handleAddProduct}>
              <Text style={styles.emptyStateButtonText}>Add Your First Product</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {/* 3D Model Viewer Modal */}
      <Modal visible={show3DViewer} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose3DViewer}>
        {selectedModelUrl && (
          <ModelViewer3D modelUrl={selectedModelUrl} onClose={handleClose3DViewer} title="Product 3D Preview" />
        )}
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VENDOR_SCREEN_BG,
  },
  categoryContainer: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  categoryTextActive: {
    color: COLORS.background,
  },
  productsContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  productsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  productsCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  productsList: {
    paddingBottom: SPACING.xl,
  },
  productCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  productImageContainer: {
    position: 'relative',
    height: 200,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  threeSixtyBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    gap: SPACING.xs,
  },
  threeSixtyText: {
    color: '#fff',
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
  },
  imageCountBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.background + 'CC',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  imageCountText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  availabilityBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  approvalBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  approvalBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  availabilityText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.background,
  },
  productInfo: {
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
    marginBottom: SPACING.xs,
    lineHeight: 18,
  },
  modelButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  modelButtonText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  productCategory: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginBottom: SPACING.xs,
  },
  productPrice: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  productActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  actionText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    marginLeft: SPACING.xs,
  },
  deleteActionText: {
    color: COLORS.error,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  emptyStateButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  emptyStateButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default VendorProductsScreen;
