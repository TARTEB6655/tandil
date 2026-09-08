import React, { useCallback, useMemo, useState } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  VENDOR_SCREEN_BG,
  VendorHeroBanner,
  VendorCard,
} from '../../components/vendor/VendorUi';
import {
  vendorOrderService,
  VendorOrderListItem,
  VendorOrderStatus,
} from '../../services/vendorOrderService';

interface VendorOrder {
  id: string;
  /** Parent shop order id — confirm-delivery 404 fallback. */
  shopOrderId?: string;
  orderNumber: string;
  customerName: string;
  productName: string;
  productImage?: string;
  quantity: number;
  status: VendorOrderStatus;
  statusLabel?: string;
  orderDate: Date;
  deliveryDate?: Date;
  totalAmount: number;
  customerAddress: string;
  customerPhone: string;
  trackingNumber?: string;
  fulfillmentType?: string;
  canConfirm?: boolean;
  canShip?: boolean;
  canMarkDelivered?: boolean;
  canUpdateStatus?: boolean;
  usesDeliveryOtp?: boolean;
  canConfirmDeliveryOtp?: boolean;
  canResendDeliveryOtp?: boolean;
  confirmDeliveryEndpoint?: string | null;
  resendDeliveryOtpEndpoint?: string | null;
  primaryAction?: string | null;
  primaryActionLabel?: string | null;
}

function isProductFulfillment(order: Pick<VendorOrder, 'fulfillmentType'>): boolean {
  return String(order.fulfillmentType || '').toLowerCase() === 'product';
}

function mapApiOrder(item: VendorOrderListItem, productFallback: string): VendorOrder {
  const orderDate = item.order_date ? new Date(item.order_date) : new Date();
  const deliveryDate = item.delivery_date ? new Date(item.delivery_date) : undefined;
  return {
    id: item.id,
    shopOrderId: item.order_id,
    orderNumber: item.order_number,
    customerName: item.customer_name,
    productName: item.product_name || productFallback,
    productImage: item.product_image,
    quantity: item.quantity ?? item.items_count ?? 1,
    status: item.status,
    statusLabel: item.status_label,
    orderDate: Number.isNaN(orderDate.getTime()) ? new Date() : orderDate,
    deliveryDate: deliveryDate && !Number.isNaN(deliveryDate.getTime()) ? deliveryDate : undefined,
    totalAmount: item.total_amount,
    customerAddress: item.customer_address || '—',
    customerPhone: item.customer_phone || '—',
    trackingNumber: item.tracking_number,
    fulfillmentType: item.fulfillment_type,
    canConfirm: item.can_confirm,
    canShip: item.can_ship,
    canMarkDelivered: item.can_mark_delivered,
    canUpdateStatus: item.can_update_status,
    usesDeliveryOtp: item.uses_delivery_otp,
    canConfirmDeliveryOtp: item.can_confirm_delivery_otp,
    canResendDeliveryOtp: item.can_resend_delivery_otp,
    confirmDeliveryEndpoint: item.confirm_delivery_endpoint,
    resendDeliveryOtpEndpoint: item.resend_delivery_otp_endpoint,
    primaryAction: item.primary_action,
    primaryActionLabel: item.primary_action_label,
  };
}

function statusColor(status: string): string {
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
}

function statusIcon(status: string): string {
  switch (status) {
    case 'pending':
      return 'time';
    case 'confirmed':
      return 'checkmark-circle';
    case 'processing':
      return 'cog';
    case 'shipped':
      return 'car';
    case 'delivered':
      return 'checkmark-done-circle';
    case 'cancelled':
      return 'close-circle';
    default:
      return 'help-circle';
  }
}

const VendorOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // Ship updates status only (no tracking/note modal).
  const [otpModalOrder, setOtpModalOrder] = useState<VendorOrder | null>(null);
  const [deliveryOtp, setDeliveryOtp] = useState('');

  const statusLabel = useCallback(
    (status: string) => t(`vendorOrders.${status}`, { defaultValue: status }),
    [t]
  );

  const loadOrders = useCallback(async () => {
    try {
      const result = await vendorOrderService.listOrders({
        status: selectedStatus as VendorOrderStatus | 'all',
        per_page: 15,
      });
      const productFallback = t('vendorOrders.product');
      setOrders(result.orders.map((item) => mapApiOrder(item, productFallback)));
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.loadFailed')
      );
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadOrders();
    }, [loadOrders])
  );

  const statusFilters = [
    { id: 'all', name: t('vendorOrders.all'), icon: 'grid-outline' },
    { id: 'pending', name: t('vendorOrders.pending'), icon: 'time-outline', color: COLORS.warning },
    { id: 'confirmed', name: t('vendorOrders.confirmed'), icon: 'checkmark-circle-outline', color: COLORS.info },
    { id: 'shipped', name: t('vendorOrders.shipped'), icon: 'car-outline', color: COLORS.primary },
    { id: 'delivered', name: t('vendorOrders.delivered'), icon: 'checkmark-done-circle-outline', color: COLORS.success },
    { id: 'cancelled', name: t('vendorOrders.cancelled'), icon: 'close-circle-outline', color: COLORS.error },
  ];

  const summary = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      shipped: orders.filter((o) => o.status === 'shipped').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
    }),
    [orders]
  );

  const handleConfirm = async (order: VendorOrder) => {
    setUpdatingId(order.id);
    try {
      await vendorOrderService.updateOrderStatus(order.id, {
        status: 'confirmed',
        note: t('vendorOrders.noteAccepted'),
      });
      await loadOrders();
      Alert.alert(t('common.success'), t('vendorOrders.confirmSuccess'));
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.confirmFailed')
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleShip = async (order: VendorOrder) => {
    setUpdatingId(order.id);
    try {
      await vendorOrderService.updateOrderStatus(order.id, {
        status: 'shipped',
      });
      await loadOrders();
      Alert.alert(t('common.success'), t('vendorOrders.shipSuccess'));
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.shipFailed')
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeliver = (order: VendorOrder) => {
    // Product / OTP delivery: always collect customer OTP (in-app), never mark delivered directly.
    if (
      isProductFulfillment(order) ||
      order.usesDeliveryOtp ||
      order.canConfirmDeliveryOtp
    ) {
      setDeliveryOtp('');
      setOtpModalOrder(order);
      return;
    }
    Alert.alert(
      t('vendorOrders.markDeliveredTitle'),
      t('vendorOrders.markDeliveredMessage', { order: order.orderNumber }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vendorOrders.markDelivered'),
          onPress: async () => {
            setUpdatingId(order.id);
            try {
              await vendorOrderService.updateOrderStatus(order.id, {
                status: 'delivered',
                note: t('vendorOrders.noteDelivered'),
              });
              await loadOrders();
              Alert.alert(t('common.success'), t('vendorOrders.deliverSuccess'));
            } catch (error: unknown) {
              Alert.alert(
                t('common.error'),
                error instanceof Error ? error.message : t('vendorOrders.deliverFailed')
              );
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const handleConfirmDeliveryOtp = async () => {
    if (!otpModalOrder) return;
    const code = deliveryOtp.trim().replace(/\s+/g, '');
    if (!code) {
      Alert.alert(
        t('vendorOrders.deliveryOtpTitle', { defaultValue: 'Delivery OTP' }),
        t('vendorOrders.deliveryOtpRequired', {
          defaultValue: 'Enter the OTP shown in the customer’s Tandil app.',
        })
      );
      return;
    }
    setUpdatingId(otpModalOrder.id);
    try {
      await vendorOrderService.confirmDeliveryWithOtp(otpModalOrder.id, code, {
        shopOrderId: otpModalOrder.shopOrderId,
      });
      setOtpModalOrder(null);
      setDeliveryOtp('');
      await loadOrders();
      Alert.alert(t('common.success'), t('vendorOrders.deliverSuccess'));
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : '';
      const isGenericHttp =
        !raw || /^request failed with status code/i.test(raw) || /status code 422/i.test(raw);
      Alert.alert(
        t('common.error'),
        isGenericHttp
          ? t('vendorOrders.deliveryOtpInvalid', { defaultValue: 'Invalid OTP' })
          : raw
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResendDeliveryOtp = async () => {
    if (!otpModalOrder) return;
    setUpdatingId(otpModalOrder.id);
    try {
      const res = await vendorOrderService.resendDeliveryOtp(otpModalOrder.id, {
        shopOrderId: otpModalOrder.shopOrderId,
      });
      Alert.alert(
        t('common.success'),
        res.message ||
          t('vendorOrders.deliveryOtpResent', {
            defaultValue: 'A new delivery OTP was sent to the customer’s app.',
          })
      );
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.deliverFailed')
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const renderOrderCard = ({ item }: { item: VendorOrder }) => {
    const busy = updatingId === item.id;
    const color = statusColor(item.status);

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      >
        <VendorCard style={styles.orderCard}>
          <View style={[styles.statusAccent, { backgroundColor: color }]} />

          <View style={styles.cardTop}>
            <View style={styles.orderIdBlock}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <Text style={styles.orderDate}>
                {item.orderDate.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: color + '18' }]}>
              <Ionicons name={statusIcon(item.status) as any} size={14} color={color} />
              <Text style={[styles.statusText, { color }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </View>

          <View style={styles.productRow}>
            {item.productImage ? (
              <Image source={{ uri: item.productImage }} style={styles.productImage} />
            ) : (
              <View style={[styles.productImage, styles.productImageFallback]}>
                <Ionicons name="cube" size={22} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.productMeta}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.productName}
              </Text>
              <Text style={styles.qtyText}>{t('vendorOrders.qtyValue', { count: item.quantity })}</Text>
              <Text style={styles.amountText}>
                {item.totalAmount > 0
                  ? `AED ${item.totalAmount.toFixed(2)}`
                  : t('vendorOrders.free')}
              </Text>
            </View>
          </View>

          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerInitial}>
                {(item.customerName || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerMeta}>
              <Text style={styles.customerName} numberOfLines={1}>
                {item.customerName}
              </Text>
              <Text style={styles.customerSub} numberOfLines={1}>
                {item.customerPhone !== '—' ? item.customerPhone : item.customerAddress}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </View>

          {(() => {
            const isProduct = isProductFulfillment(item);
            const canUpdate = item.canUpdateStatus !== false && isProduct;
            const showConfirm =
              canUpdate &&
              (item.canConfirm === true ||
                item.primaryAction === 'confirm' ||
                (item.canConfirm !== false && item.status === 'pending'));
            const showShip =
              canUpdate &&
              (item.canShip === true ||
                item.primaryAction === 'ship' ||
                (item.canShip !== false &&
                  (item.status === 'confirmed' || item.status === 'processing')));
            const showDeliver =
              canUpdate &&
              (item.canMarkDelivered === true ||
                item.primaryAction === 'mark_delivered' ||
                (item.canMarkDelivered !== false && item.status === 'shipped'));

            if (!showConfirm && !showShip && !showDeliver) return null;

            return (
              <View style={styles.actionsRow}>
                {showConfirm ? (
                  <TouchableOpacity
                    style={[styles.primaryAction, { backgroundColor: COLORS.success }]}
                    onPress={() =>
                      Alert.alert(
                        t('vendorOrders.confirmOrder'),
                        t('vendorOrders.confirmOrderMessage', { order: item.orderNumber }),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          { text: t('vendorOrders.confirm'), onPress: () => handleConfirm(item) },
                        ]
                      )
                    }
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.primaryActionText}>
                          {item.primaryActionLabel || t('vendorOrders.confirm')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}

                {showShip ? (
                  <TouchableOpacity
                    style={[styles.primaryAction, { backgroundColor: COLORS.primary }]}
                    onPress={() =>
                      Alert.alert(
                        t('vendorOrders.shipOrder'),
                        t('vendorOrders.shipOrderMessage', {
                          defaultValue: 'Mark {{order}} as shipped?',
                          order: item.orderNumber,
                        }),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('vendorOrders.ship'),
                            onPress: () => void handleShip(item),
                          },
                        ]
                      )
                    }
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="car" size={18} color="#fff" />
                        <Text style={styles.primaryActionText}>{t('vendorOrders.shipOrder')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}

                {showDeliver ? (
                  <TouchableOpacity
                    style={[styles.primaryAction, { backgroundColor: COLORS.info }]}
                    onPress={() => handleDeliver(item)}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name={
                            isProductFulfillment(item) ||
                            item.usesDeliveryOtp ||
                            item.canConfirmDeliveryOtp
                              ? 'keypad-outline'
                              : 'checkmark-done-circle'
                          }
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.primaryActionText}>
                          {isProductFulfillment(item) ||
                          item.usesDeliveryOtp ||
                          item.canConfirmDeliveryOtp
                            ? t('vendorOrders.confirmWithOtp', {
                                defaultValue: 'Confirm with OTP',
                              })
                            : t('vendorOrders.markDelivered')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })()}
        </VendorCard>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <>
      <VendorHeroBanner
        badge={t('vendorOrders.badge')}
        title={t('vendorOrders.heroTitle')}
        subtitle={t('vendorOrders.heroSubtitle')}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
        style={styles.filtersScroll}
      >
        {statusFilters.map((filter) => {
          const active = selectedStatus === filter.id;
          const tint = filter.color || COLORS.primary;
          return (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                active && { backgroundColor: tint, borderColor: tint },
              ]}
              onPress={() => {
                setSelectedStatus(filter.id);
                setLoading(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name={filter.icon as any} size={16} color={active ? '#fff' : tint} />
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {filter.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryTile, styles.summaryPrimary]}>
          <Ionicons name="receipt-outline" size={20} color="#fff" />
          <Text style={styles.summaryValueLight}>{summary.total}</Text>
          <Text style={styles.summaryLabelLight}>{t('vendorOrders.total')}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Ionicons name="time-outline" size={20} color={COLORS.warning} />
          <Text style={styles.summaryValue}>{summary.pending}</Text>
          <Text style={styles.summaryLabel}>{t('vendorOrders.pending')}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Ionicons name="car-outline" size={20} color={COLORS.primary} />
          <Text style={styles.summaryValue}>{summary.shipped}</Text>
          <Text style={styles.summaryLabel}>{t('vendorOrders.shipped')}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Ionicons name="checkmark-done-outline" size={20} color={COLORS.success} />
          <Text style={styles.summaryValue}>{summary.delivered}</Text>
          <Text style={styles.summaryLabel}>{t('vendorOrders.done')}</Text>
        </View>
      </View>

      <View style={styles.listHeaderRow}>
        <Text style={styles.listTitle}>
          {selectedStatus === 'all'
            ? t('vendorOrders.allOrders')
            : t('vendorOrders.statusOrders', { status: statusLabel(selectedStatus) })}
        </Text>
        <Text style={styles.listCount}>
          {t('vendorOrders.found', { count: orders.length })}
        </Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {loading && !refreshing ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('vendorOrders.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadOrders();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('vendorOrders.emptyTitle')}</Text>
              <Text style={styles.emptyText}>
                {selectedStatus === 'all'
                  ? t('vendorOrders.empty')
                  : t('vendorOrders.emptyFiltered', {
                      status: statusLabel(selectedStatus),
                    })}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={otpModalOrder != null} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {t('vendorOrders.deliveryOtpTitle', { defaultValue: 'Delivery OTP' })}
            </Text>
            <Text style={styles.modalSubtitle}>{otpModalOrder?.orderNumber}</Text>
            <Text style={styles.otpModalBody}>
              {t('vendorOrders.deliveryOtpBody', {
                defaultValue:
                  'Ask the customer to open Order Tracking in Tandil and read the delivery code. Enter it below to mark this order delivered.',
              })}
            </Text>

            <Text style={styles.fieldLabel}>
              {t('vendorOrders.deliveryOtpLabel', { defaultValue: 'Customer OTP' })}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="••••••"
              placeholderTextColor={COLORS.textSecondary}
              value={deliveryOtp}
              onChangeText={setDeliveryOtp}
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setOtpModalOrder(null);
                  setDeliveryOtp('');
                }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => void handleConfirmDeliveryOtp()}
                disabled={updatingId === otpModalOrder?.id}
              >
                {updatingId === otpModalOrder?.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
                    <Text style={styles.modalConfirmText}>
                      {t('vendorOrders.confirmDelivery', { defaultValue: 'Confirm delivery' })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {otpModalOrder ? (
              <TouchableOpacity
                style={styles.resendOtpBtn}
                onPress={() => void handleResendDeliveryOtp()}
                disabled={updatingId === otpModalOrder.id}
              >
                <Text style={styles.resendOtpText}>
                  {t('vendorOrders.resendDeliveryOtp', {
                    defaultValue: 'Resend OTP to customer app',
                  })}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VENDOR_SCREEN_BG,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  filtersScroll: {
    marginBottom: SPACING.sm,
  },
  filtersContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: 4,
  },
  summaryValueLight: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summaryLabelLight: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  listTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  listCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  orderCard: {
    marginBottom: SPACING.sm,
    padding: 0,
    overflow: 'hidden',
  },
  statusAccent: {
    height: 4,
    width: '100%',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  orderIdBlock: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  orderNumber: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  orderDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  productRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
  },
  productImageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '14',
  },
  productMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  qtyText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  amountText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginTop: 4,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerInitial: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  customerMeta: {
    flex: 1,
  },
  customerName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  customerSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  actionsRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
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
    marginBottom: 6,
    fontWeight: FONT_WEIGHTS.medium,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
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
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  modalConfirm: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  otpModalBody: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  resendOtpBtn: {
    marginTop: SPACING.md,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  resendOtpText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default VendorOrdersScreen;
