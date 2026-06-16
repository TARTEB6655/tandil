import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, AdminProduct } from '../../services/adminService';
import { getProductImageUri } from '../../utils/productImage';

type RouteParams = {
  categoryId: number;
  categoryName?: string;
};

type ReorderProductRowProps = {
  item: AdminProduct;
  index: number;
  drag: () => void;
  isActive: boolean;
  reorderSaving: boolean;
  formatPrice: (price: string | number) => string;
};

const ReorderProductRow = React.memo(
  ({ item, index, drag, isActive, reorderSaving, formatPrice }: ReorderProductRowProps) => {
    const imageUri = getProductImageUri(item);

    return (
      <TouchableOpacity
        onLongPress={drag}
        disabled={reorderSaving}
        activeOpacity={0.92}
        style={[styles.reorderRow, isActive && styles.reorderRowActive]}
      >
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>{index}</Text>
        </View>

        <View style={styles.reorderThumbWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.reorderThumb} contentFit="cover" />
          ) : (
            <View style={styles.reorderThumbPlaceholder}>
              <Ionicons name="leaf-outline" size={22} color={COLORS.primary} />
            </View>
          )}
        </View>

        <View style={styles.reorderInfo}>
          <Text style={styles.reorderName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.reorderMeta}>{formatPrice(item.price)}</Text>
          {item.stock != null && (
            <Text style={styles.reorderMeta}>Stock {item.stock}</Text>
          )}
        </View>

        <View style={[styles.dragHandlePill, isActive && styles.dragHandlePillActive]}>
          <Ionicons
            name="reorder-three-outline"
            size={22}
            color={isActive ? COLORS.background : COLORS.primary}
          />
        </View>
      </TouchableOpacity>
    );
  }
);

const AdminReorderCategoryProductsScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { categoryId, categoryName } = (route.params ?? {}) as RouteParams;

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const formatPrice = useCallback((price: string | number) => {
    const num = typeof price === 'number' ? price : parseFloat(String(price));
    if (Number.isNaN(num)) return String(price);
    return `AED ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!categoryId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await adminService.getAllProductsByCategory(categoryId);
      setProducts(list);
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        err?.response?.data?.message ||
          err.message ||
          t('admin.productReorder.loadFailed', 'Failed to load products for this category.')
      );
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId, t]);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts])
  );

  const renderReorderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<AdminProduct>) => (
      <ReorderProductRow
        item={item}
        index={(getIndex?.() ?? 0) + 1}
        drag={drag}
        isActive={isActive}
        reorderSaving={saving}
        formatPrice={formatPrice}
      />
    ),
    [formatPrice, saving]
  );

  const handleSaveOrder = async () => {
    if (saving || products.length === 0 || !categoryId) return;
    setSaving(true);
    try {
      await adminService.reorderProducts(
        Number(categoryId),
        products.map((product, index) => ({
          id: product.id,
          sort_order: index + 1,
        }))
      );
      Alert.alert(
        t('admin.productReorder.savedTitle', 'Order saved'),
        t(
          'admin.productReorder.savedMessage',
          'Product order updated for this category. Clients will see products in this sequence.'
        ),
        [{ text: t('common.done', 'Done'), onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      const data = err?.response?.data;
      const validationErrors = data?.errors;
      let message =
        data?.message ||
        err.message ||
        t('admin.productReorder.saveFailed', 'Failed to save product order.');
      if (validationErrors && typeof validationErrors === 'object') {
        const lines = Object.values(validationErrors)
          .flat()
          .filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
        if (lines.length > 0) message = lines.join('\n');
      }
      Alert.alert(t('admin.users.error', 'Error'), message);
    } finally {
      setSaving(false);
    }
  };

  const title = categoryName
    ? t('admin.productReorder.titleWithCategory', {
        name: categoryName,
        defaultValue: 'Reorder: {{name}}',
      })
    : t('admin.productReorder.title', 'Reorder Products');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('admin.productReorder.loading', 'Loading products…')}
          </Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centerWrap}>
          <Ionicons name="cube-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>
            {t('admin.productReorder.empty', 'No products in this category yet.')}
          </Text>
        </View>
      ) : (
        <View style={styles.reorderWrap}>
          <View style={styles.reorderHintBanner}>
            <View style={styles.reorderHintIconWrap}>
              <Ionicons name="hand-left-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.reorderHintText}>
              {t(
                'admin.productReorder.hint',
                'Long press a product, then drag to set the order shown in the client store.'
              )}
            </Text>
          </View>

          <View style={styles.reorderListHost}>
            <DraggableFlatList
              data={products}
              keyExtractor={(item) => String(item.id)}
              onDragEnd={({ data }) => setProducts(data)}
              renderItem={renderReorderItem}
              containerStyle={styles.reorderList}
              contentContainerStyle={styles.reorderListContent}
            />
          </View>

          <View style={[styles.reorderFooter, { paddingBottom: insets.bottom + SPACING.md }]}>
            <TouchableOpacity
              style={styles.reorderCancelBtn}
              onPress={() => navigation.goBack()}
              disabled={saving}
            >
              <Text style={styles.reorderCancelText}>{t('common.cancel', 'Cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reorderSaveBtn, saving && styles.saveButtonDisabled]}
              onPress={handleSaveOrder}
              disabled={saving}
            >
              <Text style={styles.reorderSaveText}>
                {saving
                  ? t('admin.productReorder.saving', 'Saving…')
                  : t('admin.productReorder.saveOrder', 'Save Order')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.xs, marginRight: SPACING.xs },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  headerRight: { width: 40 },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
  reorderWrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.background,
  },
  reorderHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1,
    borderColor: COLORS.primary + '25',
  },
  reorderHintIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  reorderHintText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 20,
  },
  reorderListHost: {
    flex: 1,
    minHeight: 0,
  },
  reorderList: {
    flex: 1,
  },
  reorderListContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  reorderRowActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primary + '08',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  orderBadgeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  reorderThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.primary + '12',
    marginRight: SPACING.sm,
  },
  reorderThumb: { width: '100%', height: '100%' },
  reorderThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderInfo: { flex: 1, minWidth: 0, marginRight: SPACING.sm },
  reorderName: {
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.md,
    marginBottom: 2,
  },
  reorderMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  dragHandlePill: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandlePillActive: {
    backgroundColor: COLORS.primary,
  },
  reorderFooter: {
    width: '100%',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  reorderCancelBtn: {
    flex: 1,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderCancelText: { color: COLORS.text, fontWeight: FONT_WEIGHTS.semiBold },
  reorderSaveBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderSaveText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
  saveButtonDisabled: { opacity: 0.7 },
});

export default AdminReorderCategoryProductsScreen;
