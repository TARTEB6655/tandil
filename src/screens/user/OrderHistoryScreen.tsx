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
      <Ionicons name="list-outline" size={64} color={COLORS.textSecondary} />
      <Text style={styles.emptyStateTitle}>{t('tabs.orders')}</Text>
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
      >
        <Text style={styles.browseButtonText}>
          {isAuthenticated ? t('tabs.store', 'Store') : t('tabs.home', 'Home')}
        </Text>
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
        rightComponent={
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              const sequence = ['all', 'pending', 'in_progress', 'completed', 'cancelled'];
              const idx = sequence.indexOf(selectedFilter);
              const next = sequence[(idx + 1) % sequence.length];
              setSelectedFilter(next);
            }}
          >
            <Ionicons name="filter" size={24} color={COLORS.text} />
          </TouchableOpacity>
        }
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
    backgroundColor: COLORS.background,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    padding: SPACING.sm,
  },
  filterContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
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
    padding: SPACING.sm,
    backgroundColor: COLORS.warning + '22',
    borderRadius: BORDER_RADIUS.md,
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
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyStateDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  browseButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  browseButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
  },
});

export default OrderHistoryScreen;
