import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, ShopOrder } from '../../services/adminService';

const PER_PAGE = 15;

const AdminOrdersScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (isRefresh) setRefreshing(true);
    else if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const res = await adminService.getOrders({ page: pageNum, per_page: PER_PAGE });
      const list = Array.isArray(res?.data) ? res.data : [];
      const meta = res?.meta;
      const totalCount = meta?.total ?? res?.total ?? list.length;
      const last = meta?.last_page ?? res?.last_page ?? 1;
      if (pageNum === 1 || isRefresh) {
        setOrders(list);
        setPage(1);
      } else {
        setOrders((prev) => [...prev, ...list]);
      }
      setTotal(totalCount);
      setLastPage(last);
      setPage(pageNum);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.message || err.message || t('admin.orders.errorLoad'));
      if (pageNum === 1) setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [t]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders(1);
    }, [fetchOrders])
  );

  const onRefresh = () => fetchOrders(1, true);

  const loadMore = () => {
    if (page >= lastPage || loadingMore || loading) return;
    fetchOrders(page + 1);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  };

  const formatTotal = (value?: number | string) => {
    if (value == null) return '—';
    const n = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(n)) return String(value);
    return `AED ${n.toFixed(2)}`;
  };

  const getCustomerName = (order: ShopOrder) => {
    return order?.user?.name ?? order?.customer?.name ?? order?.user?.email ?? order?.customer?.email ?? '—';
  };

  const renderOrderItem = ({ item }: { item: ShopOrder }) => (
    <TouchableOpacity
      style={styles.orderCard}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('AdminOrderDetail', { orderId: item.id })}
    >
      <View style={styles.orderRow}>
        <Text style={styles.orderId}>#{item.order_number ?? item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: (item.status ? getStatusColor(item.status) : COLORS.textSecondary) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status ?? '—'}</Text>
        </View>
      </View>
      <Text style={styles.orderCustomer}>{getCustomerName(item)}</Text>
      <View style={styles.orderFooter}>
        <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
        <Text style={styles.orderTotal}>{formatTotal(item.total)}</Text>
      </View>
    </TouchableOpacity>
  );

  function getStatusColor(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('pending') || s.includes('new')) return COLORS.warning;
    if (s.includes('completed') || s.includes('delivered') || s.includes('shipped')) return COLORS.success;
    if (s.includes('cancelled') || s.includes('failed')) return COLORS.error;
    return COLORS.primary;
  }

  const listEmpty = !loading && orders.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.orders.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && orders.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : listEmpty ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>{t('admin.orders.noOrders')}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={COLORS.primary} /> : null}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  headerRight: {
    width: 40,
  },
  errorBanner: {
    backgroundColor: COLORS.error + '15',
    padding: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  orderId: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  orderCustomer: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  orderDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  orderTotal: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  footerLoader: {
    paddingVertical: SPACING.md,
  },
});

export default AdminOrdersScreen;
