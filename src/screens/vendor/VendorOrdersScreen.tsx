import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  vendorOrderService,
  VendorOrderListItem,
  VendorOrderStatus,
} from '../../services/vendorOrderService';

interface VendorOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  productName: string;
  productImage?: string;
  quantity: number;
  status: VendorOrderStatus;
  orderDate: Date;
  deliveryDate?: Date;
  totalAmount: number;
  customerAddress: string;
  customerPhone: string;
}

function mapApiOrder(item: VendorOrderListItem): VendorOrder {
  const orderDate = item.order_date ? new Date(item.order_date) : new Date();
  const deliveryDate = item.delivery_date ? new Date(item.delivery_date) : undefined;
  return {
    id: item.id,
    orderNumber: item.order_number,
    customerName: item.customer_name,
    productName: item.product_name || 'Product',
    productImage: item.product_image,
    quantity: item.quantity ?? item.items_count ?? 1,
    status: item.status,
    orderDate: Number.isNaN(orderDate.getTime()) ? new Date() : orderDate,
    deliveryDate: deliveryDate && !Number.isNaN(deliveryDate.getTime()) ? deliveryDate : undefined,
    totalAmount: item.total_amount,
    customerAddress: item.customer_address || '—',
    customerPhone: item.customer_phone || '—',
  };
}

const VendorOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [shipModalOrder, setShipModalOrder] = useState<VendorOrder | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipNote, setShipNote] = useState('Dispatched via courier');

  const loadOrders = useCallback(async () => {
    try {
      const result = await vendorOrderService.listOrders({
        status: selectedStatus as VendorOrderStatus | 'all',
        per_page: 15,
      });
      setOrders(result.orders.map(mapApiOrder));
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load orders.');
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadOrders();
    }, [loadOrders])
  );

  const statusFilters = [
    { id: 'all', name: 'All Orders', icon: 'list-outline' },
    { id: 'pending', name: 'Pending', icon: 'time-outline', color: COLORS.warning },
    { id: 'confirmed', name: 'Confirmed', icon: 'checkmark-circle-outline', color: COLORS.info },
    { id: 'shipped', name: 'Shipped', icon: 'car-outline', color: COLORS.primary },
    { id: 'delivered', name: 'Delivered', icon: 'checkmark-done-circle-outline', color: COLORS.success },
    { id: 'cancelled', name: 'Cancelled', icon: 'close-circle-outline', color: COLORS.error },
  ];

  const filteredOrders = orders;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return COLORS.warning;
      case 'confirmed':
      case 'processing':
        return COLORS.info;
      case 'shipped':
        return COLORS.primary;
      case 'delivered':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'confirmed':
      case 'processing':
        return 'checkmark-circle-outline';
      case 'shipped':
        return 'car-outline';
      case 'delivered':
        return 'checkmark-done-circle-outline';
      case 'cancelled':
        return 'close-circle-outline';
      default:
        return 'help-outline';
    }
  };

  const handleConfirm = async (order: VendorOrder) => {
    setUpdatingId(order.id);
    try {
      await vendorOrderService.updateOrderStatus(order.id, {
        status: 'confirmed',
        note: 'Order accepted',
      });
      await loadOrders();
      Alert.alert('Success', 'Order confirmed successfully!');
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to confirm order.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleShip = async () => {
    if (!shipModalOrder) return;
    if (!trackingNumber.trim()) {
      Alert.alert('Tracking required', 'Please enter a tracking number.');
      return;
    }
    setUpdatingId(shipModalOrder.id);
    try {
      await vendorOrderService.updateOrderStatus(shipModalOrder.id, {
        status: 'shipped',
        note: shipNote.trim() || 'Dispatched via courier',
        tracking_number: trackingNumber.trim(),
      });
      setShipModalOrder(null);
      setTrackingNumber('');
      await loadOrders();
      Alert.alert('Success', 'Order marked as shipped!');
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to ship order.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOrderAction = (order: VendorOrder, action: string) => {
    switch (action) {
      case 'confirm':
        Alert.alert('Confirm Order', `Confirm order ${order.orderNumber}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: () => handleConfirm(order) },
        ]);
        break;
      case 'ship':
        setShipModalOrder(order);
        setTrackingNumber('');
        setShipNote('Dispatched via courier');
        break;
      case 'view':
        navigation.navigate('OrderDetail', { orderId: order.id });
        break;
    }
  };

  const renderOrderCard = ({ item }: { item: VendorOrder }) => {
    const busy = updatingId === item.id;
    const statusLabel =
      item.status === 'processing'
        ? 'Processing'
        : item.status.charAt(0).toUpperCase() + item.status.slice(1);

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <Text style={styles.orderDate}>{item.orderDate.toLocaleDateString()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons
              name={getStatusIcon(item.status) as any}
              size={16}
              color={getStatusColor(item.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.orderContent}>
          <View style={styles.productInfo}>
            <View style={styles.productImageContainer}>
              <Ionicons name="cube-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.productName}
              </Text>
              <Text style={styles.quantity}>Quantity: {item.quantity}</Text>
              {item.totalAmount <= 0 ? (
                <Text style={styles.freeProduct}>FREE PRODUCT</Text>
              ) : (
                <Text style={styles.priceTag}>AED {item.totalAmount.toFixed(2)}</Text>
              )}
            </View>
          </View>

          <View style={styles.customerInfo}>
            <View style={styles.customerHeader}>
              <Ionicons name="person-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.customerName}>{item.customerName}</Text>
            </View>
            <View style={styles.customerDetails}>
              <Text style={styles.customerAddress} numberOfLines={1}>
                📍 {item.customerAddress}
              </Text>
              <Text style={styles.customerPhone}>📞 {item.customerPhone}</Text>
            </View>
          </View>

          {item.deliveryDate && item.status === 'delivered' && (
            <View style={styles.deliveryInfo}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.success} />
              <Text style={styles.deliveryText}>
                Delivered on {item.deliveryDate.toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.orderActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleOrderAction(item, 'view')}
          >
            <Ionicons name="eye-outline" size={20} color={COLORS.info} />
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>

          {item.status === 'pending' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOrderAction(item, 'confirm')}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={COLORS.success} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                  <Text style={styles.actionText}>Confirm</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {(item.status === 'confirmed' || item.status === 'processing') && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOrderAction(item, 'ship')}
              disabled={busy}
            >
              <Ionicons name="car-outline" size={20} color={COLORS.primary} />
              <Text style={styles.actionText}>Ship</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.title}>Product Orders</Text>
        <Text style={styles.subtitle}>Manage your product distribution orders</Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {statusFilters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterButton,
                selectedStatus === filter.id && styles.filterButtonActive,
              ]}
              onPress={() => {
                setSelectedStatus(filter.id);
                setLoading(true);
              }}
            >
              <Ionicons
                name={filter.icon as any}
                size={20}
                color={
                  selectedStatus === filter.id
                    ? COLORS.background
                    : filter.color || COLORS.primary
                }
              />
              <Text
                style={[
                  styles.filterText,
                  selectedStatus === filter.id && styles.filterTextActive,
                ]}
              >
                {filter.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{filteredOrders.length}</Text>
            <Text style={styles.summaryLabel}>Total Orders</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>
              {filteredOrders.filter((order) => order.status === 'delivered').length}
            </Text>
            <Text style={styles.summaryLabel}>Delivered</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>
              {filteredOrders.filter((order) => order.status === 'pending').length}
            </Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
        </View>
      </View>

      <View style={styles.ordersContainer}>
        <View style={styles.ordersHeader}>
          <Text style={styles.ordersTitle}>
            {selectedStatus === 'all'
              ? 'All Orders'
              : `${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Orders`}
          </Text>
          <Text style={styles.ordersCount}>{filteredOrders.length} orders</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : filteredOrders.length > 0 ? (
          <FlatList
            data={filteredOrders}
            renderItem={renderOrderCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.ordersList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadOrders();
                }}
              />
            }
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="list-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyStateTitle}>No Orders Found</Text>
            <Text style={styles.emptyStateText}>
              {selectedStatus === 'all'
                ? "You don't have any orders yet."
                : `No ${selectedStatus} orders found.`}
            </Text>
          </View>
        )}
      </View>

      <Modal visible={shipModalOrder != null} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ship Order</Text>
            <Text style={styles.modalSubtitle}>{shipModalOrder?.orderNumber}</Text>
            <Text style={styles.fieldLabel}>Tracking number *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="TRK-2026-0001"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCapitalize="characters"
            />
            <Text style={styles.fieldLabel}>Note</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Dispatched via courier"
              value={shipNote}
              onChangeText={setShipNote}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShipModalOrder(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleShip}>
                <Text style={styles.modalConfirmText}>Ship</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.primary + '10',
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  filterContainer: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
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
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  filterTextActive: {
    color: COLORS.background,
  },
  summaryContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  ordersContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  ordersTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  ordersCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  ordersList: {
    paddingBottom: SPACING.xl,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  orderDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    marginLeft: SPACING.xs,
  },
  orderContent: {
    padding: SPACING.md,
  },
  productInfo: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  productImageContainer: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  quantity: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  freeProduct: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.success,
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
    alignSelf: 'flex-start',
  },
  priceTag: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  customerInfo: {
    marginBottom: SPACING.md,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  customerName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  customerDetails: {
    marginLeft: SPACING.lg,
  },
  customerAddress: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  customerPhone: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '10',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  deliveryText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.medium,
    marginLeft: SPACING.xs,
  },
  orderActions: {
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
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semibold,
  },
});

export default VendorOrdersScreen;
