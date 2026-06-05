import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import { adminService, AdminCategory } from '../../services/adminService';
import { getCategoryShippingCost, getCategoryTaxPercentage } from '../../utils/categoryPricing';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';

const PER_PAGE = 10;

type ReorderCategoryRowProps = {
  item: AdminCategory;
  index: number;
  drag: () => void;
  isActive: boolean;
  reorderSaving: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
};

const ReorderCategoryRow = React.memo(
  ({ item, index, drag, isActive, reorderSaving, t }: ReorderCategoryRowProps) => {
    const imageUri = item.image_url ?? (item.image ? buildFullImageUrl(item.image) : null);
    const shippingCost = getCategoryShippingCost(item);
    const taxPct = getCategoryTaxPercentage(item);

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
              <Ionicons name="pricetag-outline" size={22} color={COLORS.primary} />
            </View>
          )}
        </View>

        <View style={styles.reorderInfo}>
          <Text style={styles.reorderName} numberOfLines={2}>
            {item.name}
          </Text>
          {(shippingCost != null || taxPct != null) && (
            <View style={styles.reorderMetaRow}>
              {shippingCost != null && (
                <Text style={styles.reorderMeta}>
                  {t('admin.categoriesAdmin.shippingList', { amount: shippingCost.toFixed(2) })}
                </Text>
              )}
              {taxPct != null && (
                <Text style={styles.reorderMeta}>
                  {t('admin.categoriesAdmin.taxList', { amount: taxPct.toFixed(0) })}
                </Text>
              )}
            </View>
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

const AdminCategoriesScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [reorderMode, setReorderMode] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [reorderCategories, setReorderCategories] = useState<AdminCategory[]>([]);

  const fetchCategories = useCallback(async (page = 1, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const response = await adminService.getCategories({
        page,
        per_page: PER_PAGE,
      });
      // API returns either: { data: Category[], pagination: { current_page, last_page, ... } } or legacy { data: { data, current_page, ... } }
      const isArray = Array.isArray(response.data);
      const list = isArray ? response.data : (response.data as any)?.data ?? [];
      const pagination = response.pagination ?? (!isArray ? (response.data as any) : null);
      const current = pagination?.current_page ?? 1;
      const last = pagination?.last_page ?? 1;
      if (page === 1) {
        setCategories(Array.isArray(list) ? list : []);
      } else {
        setCategories((prev) => [...prev, ...(Array.isArray(list) ? list : [])]);
      }
      setCurrentPage(current);
      setLastPage(last);
      setHasMore(current < last);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load categories');
      if (page === 1) setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories(1);
    }, [fetchCategories])
  );

  const fetchAllCategoriesForReorder = useCallback(async () => {
    setReorderLoading(true);
    try {
      // For sorting we need the full list (pagination breaks drag-and-drop).
      const response = await adminService.getCategories({ page: 1, per_page: 200 });
      const isArray = Array.isArray(response.data);
      const list = isArray ? response.data : (response.data as any)?.data ?? [];
      const sorted = [...(Array.isArray(list) ? list : [])].sort((a: AdminCategory, b: AdminCategory) => {
        if (a.sort_order == null && b.sort_order == null) return 0;
        if (a.sort_order == null) return 1;
        if (b.sort_order == null) return -1;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
      setReorderCategories(sorted);
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        err?.response?.data?.message || err.message || 'Failed to load categories'
      );
      setReorderCategories([]);
    } finally {
      setReorderLoading(false);
    }
  }, [t]);

  const onRefresh = useCallback(() => {
    fetchCategories(1, true);
  }, [fetchCategories]);

  const onEndReached = useCallback(() => {
    if (loadingMore || !hasMore || currentPage >= lastPage) return;
    fetchCategories(currentPage + 1);
  }, [loadingMore, hasMore, currentPage, lastPage, fetchCategories]);

  const handleEditCategory = useCallback(
    (category: AdminCategory) => {
      navigation.navigate('AdminEditCategory', { category });
    },
    [navigation]
  );

  const handleToggleStatus = useCallback(
    async (item: AdminCategory) => {
      if (togglingId != null) return;
      const previousActive = item.is_active !== 0 && item.is_active !== false;
      setTogglingId(item.id);
      setCategories((prev) =>
        prev.map((c) =>
          c.id === item.id ? { ...c, is_active: previousActive ? 0 : 1 } : c
        )
      );
      try {
        const res = await adminService.toggleCategoryStatus(item.id);
        if (res.data) {
          setCategories((prev) =>
            prev.map((c) => (c.id === item.id ? { ...c, ...res.data } : c))
          );
        }
      } catch (err: any) {
        setCategories((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, is_active: previousActive ? 1 : 0 } : c))
        );
        const msg =
          err.response?.data?.message ||
          err.message ||
          t('admin.categoriesAdmin.toggleFailed', 'Failed to update status');
        Alert.alert(t('admin.users.error'), msg, [{ text: t('common.done') }]);
      } finally {
        setTogglingId(null);
      }
    },
    [t, togglingId]
  );

  const renderReorderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<AdminCategory>) => (
      <ReorderCategoryRow
        item={item}
        index={(getIndex?.() ?? 0) + 1}
        drag={drag}
        isActive={isActive}
        reorderSaving={reorderSaving}
        t={t}
      />
    ),
    [reorderSaving, t]
  );

  const handleDeleteCategory = useCallback(
    (category: AdminCategory) => {
      Alert.alert(
        t('admin.categoriesAdmin.deleteTitle', 'Delete category'),
        t(
          'admin.categoriesAdmin.deleteMessage',
          { name: category.name, defaultValue: `Are you sure you want to delete "${category.name}"? This action cannot be undone.` }
        ),
        [
          { text: t('admin.settings.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('admin.users.delete', 'Delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await adminService.deleteCategory(category.id);
                fetchCategories(1, true);
              } catch (err: any) {
                const apiMessage = (err.response?.data?.message || err.message || '') as string;
                const isHasProductsError =
                  /existing products|cannot delete category|has products|products first/i.test(apiMessage);
                const msg = isHasProductsError
                  ? t('admin.categoriesAdmin.cannotDeleteHasProducts')
                  : apiMessage || t('admin.categoriesAdmin.deleteFailed');
                Alert.alert(t('admin.users.error'), msg, [{ text: t('common.done') }]);
              }
            },
          },
        ]
      );
    },
    [fetchCategories, t]
  );

  const renderItem = ({ item }: { item: AdminCategory }) => {
    const imageUri = item.image_url ?? (item.image ? buildFullImageUrl(item.image) : null);
    const shippingCost = getCategoryShippingCost(item);
    const taxPct = getCategoryTaxPercentage(item);
    return (
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.categoryThumb} contentFit="cover" />
          ) : (
            <Ionicons name="pricetag-outline" size={24} color={COLORS.primary} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          {item.slug ? (
            <Text style={styles.slug} numberOfLines={1}>{item.slug}</Text>
          ) : null}
          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            {shippingCost != null && (
              <Text style={styles.meta}>
                {t('admin.categoriesAdmin.shippingList', {
                  amount: shippingCost.toFixed(2),
                })}
              </Text>
            )}
            {taxPct != null && (
              <Text style={styles.meta}>
                {t('admin.categoriesAdmin.taxList', { amount: taxPct.toFixed(0) })}
              </Text>
            )}
            {item.products_count != null && (
              <Text style={styles.meta}>{item.products_count} products</Text>
            )}
            {(item.is_active === 0 || item.is_active === false) && (
              <Text style={styles.inactiveBadge}>
                {t('admin.categoriesAdmin.inactive', 'Inactive')}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.rowRight}>
          <View style={styles.toggleWrap}>
            <Switch
              value={item.is_active !== 0 && item.is_active !== false}
              onValueChange={() => handleToggleStatus(item)}
              disabled={togglingId === item.id}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={COLORS.background}
            />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => handleEditCategory(item)}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => handleDeleteCategory(item)}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {reorderMode
            ? t('admin.categoriesAdmin.reorderTitle', 'Reorder Categories')
            : t('admin.categoriesAdmin.listTitle', 'Categories')}
        </Text>
        <View style={styles.headerRight}>
          {!reorderMode && (
            <>
              <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AdminAddCategory')}>
                <Ionicons name="add" size={26} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reorderToggleBtn}
                disabled={reorderSaving || reorderLoading}
                onPress={async () => {
                  setReorderMode(true);
                  await fetchAllCategoriesForReorder();
                }}
              >
                <Ionicons name="swap-vertical-outline" size={16} color={COLORS.primary} />
                <Text style={styles.reorderToggleText}>
                  {t('admin.categoriesAdmin.reorder', 'Reorder')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {reorderMode ? (
        reorderLoading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {t('admin.categoriesAdmin.loading', 'Loading categories…')}
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
                  'admin.categoriesAdmin.reorderHint',
                  'Long press a category, then drag to reorder'
                )}
              </Text>
            </View>

            <View style={styles.reorderListHost}>
              <DraggableFlatList
                data={reorderCategories}
                keyExtractor={(item) => String(item.id)}
                onDragEnd={({ data }) => setReorderCategories(data)}
                renderItem={renderReorderItem}
                containerStyle={styles.reorderList}
                contentContainerStyle={styles.reorderListContent}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>
                      {t('admin.categoriesAdmin.empty', 'No categories found')}
                    </Text>
                  </View>
                }
              />
            </View>

            <View
              style={[
                styles.reorderFooter,
                { paddingBottom: insets.bottom + SPACING.md },
              ]}
            >
              <TouchableOpacity
                style={styles.reorderCancelBtn}
                onPress={() => {
                  if (reorderSaving) return;
                  setReorderMode(false);
                }}
                disabled={reorderSaving}
              >
                <Text style={styles.reorderCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reorderSaveBtn, reorderSaving && styles.saveButtonDisabled]}
                onPress={async () => {
                  if (reorderSaving) return;
                  setReorderSaving(true);
                  try {
                    for (let i = 0; i < reorderCategories.length; i++) {
                      const c = reorderCategories[i];
                      const activeNum = c.is_active === 0 || c.is_active === false ? 0 : 1;
                      await adminService.updateCategory(c.id, {
                        name: c.name,
                        slug: c.slug ?? undefined,
                        description: c.description ?? undefined,
                        is_active: activeNum,
                        sort_order: i + 1,
                      });
                    }
                    setReorderMode(false);
                    setReorderCategories([]);
                    fetchCategories(1, true);
                  } catch (err: any) {
                    Alert.alert(
                      t('admin.users.error', 'Error'),
                      err?.response?.data?.message || err.message || 'Failed to save category order'
                    );
                  } finally {
                    setReorderSaving(false);
                  }
                }}
                disabled={reorderSaving || reorderCategories.length === 0}
              >
                <Text style={styles.reorderSaveText}>
                  {reorderSaving
                    ? t('common.loading', 'Saving…')
                    : t('admin.categoriesAdmin.saveOrder', 'Save Order')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('admin.categoriesAdmin.loading', 'Loading categories…')}
          </Text>
        </View>
      ) : error && categories.length === 0 ? (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchCategories(1)}>
            <Text style={styles.retryBtnText}>{t('admin.users.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={categories}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: SPACING.xl * 2 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('admin.categoriesAdmin.empty', 'No categories found')}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
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
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: { flex: 1, fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text, marginHorizontal: SPACING.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexShrink: 0 },
  addBtn: { padding: SPACING.xs, width: 40, alignItems: 'flex-end' },
  reorderToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '12',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  reorderToggleText: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.sm },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
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
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryThumb: { width: '100%', height: '100%' },
  info: { marginLeft: SPACING.md, flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  inactiveBadge: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  rowRight: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  toggleWrap: {},
  actions: { flexDirection: 'row', gap: 8 },
  smallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  name: { color: COLORS.text, fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.md, marginBottom: 2 },
  slug: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, marginBottom: 2 },
  description: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginBottom: 2 },
  meta: { fontSize: FONT_SIZES.xs, color: COLORS.primary },
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
  reorderMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
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
  footer: { paddingVertical: SPACING.md, alignItems: 'center' },
});

export default AdminCategoriesScreen;
