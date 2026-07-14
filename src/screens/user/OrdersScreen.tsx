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
import { OrderCard } from '../../components/cards/OrderCard';
import { useAppStore } from '../../store';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import type { Order } from '../../types';
import {
  getClientOrders,
  getClientCancelledOrders,
  mapShopOrdersToOrders,
} from '../../services/orderService';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { count: cartItemCount } = useCartBadgeCount();
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
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        const [{ orders: rows }, { orders: cancelledRows }] = await Promise.all([
          getClientOrders(),
          getClientCancelledOrders(),
        ]);
        const mergedById = new Map<number, (typeof rows)[number]>();
        rows.forEach((item) => mergedById.set(item.id, item));
        cancelledRows.forEach((item) => mergedById.set(item.id, item));
        setOrders(mapShopOrdersToOrders(Array.from(mergedById.values())));
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

  const filterTabs = [
    { id: 'all', label: t('orders.filters.all'), count: orders.length },
    {
      id: 'pending',
      label: t('orders.filters.pending'),
      count: orders.filter((o) => o.status === 'pending').length,
    },
    {
      id: 'in_progress',
      label: t('orders.filters.in_progress'),
      count: orders.filter((o) => o.status === 'in_progress').length,
    },
    {
      id: 'completed',
      label: t('orders.filters.completed'),
      count: orders.filter((o) => o.status === 'completed').length,
    },
    {
      id: 'cancelled',
      label: t('orders.filters.cancelled'),
      count: orders.filter((o) => o.status === 'cancelled').length,
    },
  ];

  const renderOrderItem = ({ item }: { item: Order }) => (
    <OrderCard
      order={item}
      onPress={() =>
        navigation.navigate('OrderTracking', {
          orderId: item.id,
          useCancelledTrack: item.status === 'cancelled',
        })
      }
      variant="default"
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="receipt-outline" size={40} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyStateTitle}>
        {t('orders.emptyTitle', 'No orders yet')}
      </Text>
      {!isAuthenticated ? (
        <Text style={styles.emptyStateDescription}>
          {t('orders.loginToSee', 'Sign in to view your orders.')}
        </Text>
      ) : loadError ? (
        <Text style={styles.errorText}>{loadError}</Text>
      ) : (
        <Text style={styles.emptyStateDescription}>
          {t('orders.emptyShop', 'Browse the store or book a service to place your first order.')}
        </Text>
      )}
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() =>
          navigation.navigate('Main' as never, { screen: isAuthenticated ? 'Store' : 'Services' } as never)
        }
        activeOpacity={0.88}
      >
        <Text style={styles.browseButtonText}>
          {isAuthenticated ? t('tabs.store', 'Store') : t('tabs.services')}
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderFilterTab = (filter: { id: string; label: string; count: number }) => (
    <TouchableOpacity
      key={filter.id}
      style={[styles.filterTab, selectedFilter === filter.id && styles.filterTabActive]}
      onPress={() => setSelectedFilter(filter.id)}
    >
      <Text
        style={[styles.filterTabText, selectedFilter === filter.id && styles.filterTabTextActive]}
      >
        {filter.label}
      </Text>
      {filter.count > 0 && (
        <View style={[styles.filterCount, selectedFilter === filter.id && styles.filterCountActive]}>
          <Text
            style={[
              styles.filterCountText,
              selectedFilter === filter.id && styles.filterCountTextActive,
            ]}
          >
            {filter.count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading && !refreshing && orders.length === 0) {
    return (
      <View style={styles.container}>
        <Header
          title={t('tabs.orders')}
          showBack={false}
          showCart={true}
          rightComponent={
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => navigation.navigate('OrderHistory')}
              activeOpacity={0.88}
            >
              <Ionicons name="time-outline" size={16} color={COLORS.primary} />
              <Text style={styles.historyButtonText}>{t('home.orderHistory')}</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={t('tabs.orders')}
        showBack={false}
        showCart={true}
        cartItemCount={cartItemCount}
        rightComponent={
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => navigation.navigate('OrderHistory')}
            activeOpacity={0.88}
          >
            <Ionicons name="time-outline" size={16} color={COLORS.primary} />
            <Text style={styles.historyButtonText}>{t('home.orderHistory')}</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filterTabs.map(renderFilterTab)}
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

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.quickAction, styles.quickActionPrimary]}
          onPress={() => navigation.navigate('Main' as never, { screen: 'Store' } as never)}
          activeOpacity={0.88}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: COLORS.primary }]}>
            <Ionicons name="bag-handle" size={20} color="#fff" />
          </View>
          <View style={styles.quickActionTextCol}>
            <Text style={styles.quickActionText}>{t('home.shopProducts', 'Shop')}</Text>
            <Text style={styles.quickActionHint}>{t('orders.shopHint', 'Browse products')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickAction, styles.quickActionHelp]}
          onPress={() => navigation.navigate('HelpCenter')}
          activeOpacity={0.88}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: COLORS.secondary }]}>
            <Ionicons name="help-buoy" size={20} color="#fff" />
          </View>
          <View style={styles.quickActionTextCol}>
            <Text style={styles.quickActionText}>{t('helpCenter.title', 'Help')}</Text>
            <Text style={styles.quickActionHint}>{t('orders.helpHint', 'Get support')}</Text>
          </View>
        </TouchableOpacity>
      </View>
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
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
  },
  historyButtonText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  filterContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
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
  filterCount: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: SPACING.xs,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.bold,
  },
  filterCountTextActive: {
    color: COLORS.background,
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
  ordersList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  emptyListContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
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
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  quickActionPrimary: {
    backgroundColor: '#E8F2EA',
    borderColor: '#C5DBC9',
  },
  quickActionHelp: {
    backgroundColor: '#F3EBE7',
    borderColor: '#DFCEC5',
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionTextCol: {
    flex: 1,
  },
  quickActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  quickActionHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});

export default OrdersScreen;
