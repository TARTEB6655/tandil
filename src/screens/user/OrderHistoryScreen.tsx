import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { OrderCard } from '../../components/cards/OrderCard';
import { useAppStore } from '../../store';
import type { Order } from '../../types';
import { getClientOrders, mapShopOrdersToOrders } from '../../services/orderService';

const OrderHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const loadOrders = useCallback(
    async (isRefresh: boolean) => {
      if (!isAuthenticated) {
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        setLoadError(null);
        return;
      }
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const { orders: rows, message } = await getClientOrders();
        setOrders(mapShopOrdersToOrders(rows));
        if (!rows?.length && message) {
          setLoadError(null);
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (e as Error)?.message ||
          t('orders.loadFailed', 'Could not load orders.');
        setLoadError(msg);
        setOrders([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated, t]
  );

  useFocusEffect(
    useCallback(() => {
      loadOrders(false);
    }, [loadOrders])
  );

  const filteredOrders = orders.filter((order) => {
    if (selectedFilter === 'all') return true;
    return order.status === selectedFilter;
  });

  const renderOrderItem = ({ item }: { item: Order }) => (
    <OrderCard
      order={item}
      onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
      variant="default"
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="time-outline" size={40} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyStateTitle}>
        {t('orders.emptyHistoryTitle', 'No order history')}
      </Text>
      {!isAuthenticated ? (
        <Text style={styles.emptyStateDescription}>
          {t('orders.loginToSee', 'Sign in to view your orders.')}
        </Text>
      ) : loadError ? (
        <Text style={styles.errorText}>{loadError}</Text>
      ) : (
        <Text style={styles.emptyStateDescription}>
          {t('orders.emptyShop', 'No orders yet. Browse the shop to place an order.')}
        </Text>
      )}
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() =>
          navigation.navigate('Main' as never, { screen: isAuthenticated ? 'Store' : 'Home' } as never)
        }
        activeOpacity={0.88}
      >
        <Text style={styles.browseButtonText}>
          {isAuthenticated ? t('tabs.store', 'Store') : t('tabs.home', 'Home')}
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing && orders.length === 0) {
    return (
      <View style={styles.container}>
        <Header title={t('home.orderHistory')} showBack={true} />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={t('home.orderHistory')}
        showBack={true}
      />

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { id: 'all', label: t('orders.filters.all') },
            { id: 'pending', label: t('orders.filters.pending') },
            { id: 'in_progress', label: t('orders.filters.in_progress') },
            { id: 'completed', label: t('orders.filters.completed') },
            { id: 'cancelled', label: t('orders.filters.cancelled') },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterTab, selectedFilter === filter.id && styles.filterTabActive]}
              onPress={() => setSelectedFilter(filter.id)}
              activeOpacity={0.88}
            >
              <Text
                style={[
                  styles.filterTabText,
                  selectedFilter === filter.id && styles.filterTabTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loadError && orders.length > 0 ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{loadError}</Text>
        </View>
      ) : null}

      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          filteredOrders.length === 0 ? styles.emptyListContent : styles.ordersList
        }
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadOrders(true)}
            tintColor={COLORS.primary}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  filterTabTextActive: {
    color: COLORS.background,
  },
  ordersList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  emptyListContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  banner: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.warning + '18',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
  },
  bannerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    minHeight: 320,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyStateDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.round,
  },
  browseButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default OrderHistoryScreen;
