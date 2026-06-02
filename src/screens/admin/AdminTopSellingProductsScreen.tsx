import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BORDER_RADIUS, COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING } from '../../constants';
import { adminService, AdminTopSellingProduct } from '../../services/adminService';

const AdminTopSellingProductsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<AdminTopSellingProduct[]>([]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminService.getTopSellingProducts({ limit: 100, include_unsold: 1 });
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (_) {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts])
  );

  const renderItem = ({ item, index }: { item: AdminTopSellingProduct; index: number }) => {
    const revenue = item.revenue_formatted || item.revenue_display || String(item.revenue ?? 0);
    const sales = item.sales_display || `${item.sales ?? 0} ${t('admin.dashboard.sales')}`;
    return (
      <View style={styles.productCard}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>
        {item.product_image_url ? (
          <Image source={{ uri: item.product_image_url }} style={styles.productImage} contentFit="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={18} color={COLORS.textSecondary} />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.product_name}</Text>
          {item.category_name ? <Text style={styles.categoryText}>{item.category_name}</Text> : null}
          <Text style={styles.productSales}>{sales}</Text>
        </View>
        <Text style={styles.productRevenue}>{revenue}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.dashboard.topSellingProducts')}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderItem}
          keyExtractor={(item, idx) => `${item.product_id}-${idx}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {t('admin.dashboard.noTopSellingProducts', { defaultValue: 'No top selling products found.' })}
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: SPACING.lg },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    minWidth: 34,
    height: 24,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  rankText: { color: COLORS.primary, fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.border,
  },
  imagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  productInfo: { flex: 1, minWidth: 0 },
  productName: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  categoryText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  productSales: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  productRevenue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  emptyWrap: { paddingVertical: SPACING.xl * 2, alignItems: 'center' },
  emptyText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
});

export default AdminTopSellingProductsScreen;
