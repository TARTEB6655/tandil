import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  VENDOR_SCREEN_BG,
  VendorPageHeader,
  VendorCard,
} from '../../components/vendor/VendorUi';
import {
  vendorOrderService,
  VendorOrderDetail,
  VendorOrderTrackData,
} from '../../services/vendorOrderService';
import { TrackingTimeline } from '../../components/common/TrackingTimeline';
import type { TrackTimelineItem } from '../../services/orderService';

const STATUS_STEP_META = [
  { id: 'pending', icon: 'time', color: COLORS.warning },
  { id: 'confirmed', icon: 'checkmark-circle', color: COLORS.info },
  { id: 'processing', icon: 'cog', color: COLORS.primary },
  { id: 'shipped', icon: 'car', color: COLORS.success },
  { id: 'delivered', icon: 'checkmark-done-circle', color: COLORS.success },
] as const;

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusColor(status: string): string {
  const step = STATUS_STEP_META.find((s) => s.id === status);
  return step?.color ?? COLORS.textSecondary;
}

function isProductFulfillment(
  order: Pick<VendorOrderDetail, 'fulfillment_type'> | null,
  track?: VendorOrderTrackData | null
): boolean {
  const type = String(order?.fulfillment_type || track?.fulfillment_type || '')
    .toLowerCase()
    .trim();
  return type === 'product';
}

const VendorOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { orderId } = route.params || {};

  const [order, setOrder] = useState<VendorOrderDetail | null>(null);
  const [track, setTrack] = useState<VendorOrderTrackData | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [deliveryOtp, setDeliveryOtp] = useState('');

  const statusSteps = STATUS_STEP_META.map((step) => ({
    ...step,
    name: t(`vendorOrders.${step.id}`),
  }));

  const orderStatus = order?.status ?? 'pending';
  const currentIndex = statusSteps.findIndex((s) => s.id === orderStatus);

  const loadTrack = useCallback(async () => {
    if (!orderId) {
      setTrack(null);
      return;
    }
    setTrackLoading(true);
    try {
      const data = await vendorOrderService.getOrderTrack(orderId);
      setTrack(data);
    } catch {
      setTrack(null);
    } finally {
      setTrackLoading(false);
    }
  }, [orderId]);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vendorOrderService.getOrder(orderId);
      setOrder(data);
      void loadTrack();
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.loadFailed')
      );
      setOrder(null);
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, loadTrack, t]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder])
  );

  const notesText = order?.notes?.map((n) => n.note).filter(Boolean).join('\n\n') || '';
  const money = (amount?: number) => {
    if (amount == null || Number.isNaN(amount)) return '—';
    const currency = order?.currency || 'AED';
    return `${currency} ${amount.toFixed(2)}`;
  };

  const handleStatusUpdate = (newStatus: string) => {
    if (!order) return;
    if (newStatus === orderStatus) return;

    if (order.can_update_status === false) {
      Alert.alert(
        t('vendorOrders.updateStatusTitle'),
        order.fulfillment_note ||
          t('vendorOrders.statusUpdateNotAllowed', {
            defaultValue: 'Status updates are not available for this order. You can track progress only.',
          })
      );
      return;
    }

    const allowed = order.available_statuses?.map((s) => String(s.value)) ?? [];
    if (allowed.length > 0 && !allowed.includes(newStatus)) {
      Alert.alert(t('vendorOrders.updateStatusTitle'), t('vendorOrders.statusNotAllowed'));
      return;
    }

    if (
      newStatus === 'confirmed' &&
      String(order.fulfillment_type || track?.fulfillment_type || '').toLowerCase() === 'product' &&
      order.can_update_status !== false &&
      (order.can_confirm === true || orderStatus === 'pending')
    ) {
      Alert.alert(t('vendorOrders.updateStatusTitle'), t('vendorOrders.confirmThisOrder'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vendorOrders.confirm'),
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await vendorOrderService.updateOrderStatus(orderId, {
                status: 'confirmed',
                note: t('vendorOrders.noteAccepted'),
              });
              setOrder(updated);
              await loadTrack();
              Alert.alert(t('common.success'), t('vendorOrders.orderConfirmed'));
            } catch (error: unknown) {
              Alert.alert(
                t('common.error'),
                error instanceof Error ? error.message : t('vendorOrders.deliverFailed')
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
      return;
    }

    if (
      newStatus === 'shipped' &&
      order.can_update_status !== false &&
      (orderStatus === 'confirmed' || orderStatus === 'processing' || order.can_ship)
    ) {
      Alert.alert(
        t('vendorOrders.shipOrder'),
        t('vendorOrders.shipOrderMessage', {
          defaultValue: 'Mark {{order}} as shipped?',
          order: order.order_number,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('vendorOrders.ship'),
            onPress: async () => {
              setActionLoading(true);
              try {
                const updated = await vendorOrderService.updateOrderStatus(orderId, {
                  status: 'shipped',
                });
                setOrder(updated);
                await loadTrack();
                Alert.alert(t('common.success'), t('vendorOrders.orderShipped'));
              } catch (error: unknown) {
                Alert.alert(
                  t('common.error'),
                  error instanceof Error ? error.message : t('vendorOrders.shipFailed')
                );
              } finally {
                setActionLoading(false);
              }
            },
          },
        ]
      );
      return;
    }

    if (
      newStatus === 'delivered' &&
      order.can_update_status !== false &&
      (orderStatus === 'shipped' || order.can_mark_delivered || order.can_confirm_delivery_otp)
    ) {
      if (
        isProductFulfillment(order, track) ||
        order.uses_delivery_otp ||
        order.can_confirm_delivery_otp
      ) {
        setDeliveryOtp('');
        setOtpModalVisible(true);
        return;
      }
      Alert.alert(t('vendorOrders.updateStatusTitle'), t('vendorOrders.markDeliveredConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vendorOrders.update'),
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await vendorOrderService.updateOrderStatus(orderId, {
                status: 'delivered',
                note: t('vendorOrders.noteDelivered'),
              });
              setOrder(updated);
              await loadTrack();
              Alert.alert(t('common.success'), t('vendorOrders.orderDelivered'));
            } catch (error: unknown) {
              Alert.alert(
                t('common.error'),
                error instanceof Error ? error.message : t('vendorOrders.deliverFailed')
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
      return;
    }

    if (newStatus === 'cancelled' || (allowed.includes(newStatus) && newStatus !== orderStatus)) {
      Alert.alert(
        t('vendorOrders.updateStatusTitle'),
        t('vendorOrders.updateStatusConfirm', {
          defaultValue: `Update order status to ${newStatus}?`,
          status: newStatus,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('vendorOrders.update'),
            style: newStatus === 'cancelled' ? 'destructive' : 'default',
            onPress: async () => {
              setActionLoading(true);
              try {
                const updated = await vendorOrderService.updateOrderStatus(orderId, {
                  status: newStatus as any,
                });
                setOrder(updated);
                await loadTrack();
                Alert.alert(t('common.success'), t('vendorOrders.statusUpdated', { defaultValue: 'Status updated.' }));
              } catch (error: unknown) {
                Alert.alert(
                  t('common.error'),
                  error instanceof Error ? error.message : t('vendorOrders.deliverFailed')
                );
              } finally {
                setActionLoading(false);
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(t('vendorOrders.updateStatusTitle'), t('vendorOrders.statusNotAllowed'));
  };

  const handleConfirmDeliveryOtp = async () => {
    if (!order) return;
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
    setActionLoading(true);
    try {
      const updated = await vendorOrderService.confirmDeliveryWithOtp(orderId, code, {
        shopOrderId: order.shop_order_id || order.order_id,
      });
      setOrder(updated);
      await loadTrack();
      setOtpModalVisible(false);
      setDeliveryOtp('');
      Alert.alert(t('common.success'), t('vendorOrders.orderDelivered'));
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
      setActionLoading(false);
    }
  };

  const handleResendDeliveryOtp = async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const res = await vendorOrderService.resendDeliveryOtp(orderId, {
        shopOrderId: order.shop_order_id || order.order_id,
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
      setActionLoading(false);
    }
  };

  const handleContactCustomer = () => {
    if (order?.can_contact_customer) {
      navigation.navigate('OrderContact', { orderId });
      return;
    }
    Alert.alert(t('vendorOrders.contactCustomer'), t('vendorOrders.contactUnavailable'));
  };

  const handlePrintInvoice = async () => {
    if (!order?.can_print_invoice) {
      Alert.alert(t('vendorOrders.printInvoice'), t('vendorOrders.invoiceUnavailable'));
      return;
    }
    setActionLoading(true);
    try {
      const fileId = order.shop_order_id || orderId;
      const uri = await vendorOrderService.downloadInvoicePdf(fileId);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('vendorOrders.printInvoice'),
        });
      } else {
        await Linking.openURL(uri);
      }
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.invoiceFailed')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadOrder = async () => {
    if (!order?.can_download_order) {
      Alert.alert(t('vendorOrders.download'), t('vendorOrders.downloadUnavailable'));
      return;
    }
    setActionLoading(true);
    try {
      const fileId = order.shop_order_id || orderId;
      const uri = await vendorOrderService.downloadOrderPdf(fileId);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('vendorOrders.downloadOrder'),
        });
      } else {
        await Linking.openURL(uri);
      }
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.downloadFailed')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderInfoRow = (label: string, value: string, icon: string) => (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon as any} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <VendorPageHeader title={t('vendorOrders.detailTitle')} onBack={() => navigation.goBack()} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <VendorPageHeader title={t('vendorOrders.detailTitle')} onBack={() => navigation.goBack()} />
        <View style={styles.loadingState}>
          <Text style={styles.emptyText}>{t('vendorOrders.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const color = statusColor(orderStatus);
  const trackTimeline: TrackTimelineItem[] = (track?.timeline ?? []).map((step) => ({
    key: step.key,
    label: step.label,
    description: step.description,
    completed: step.completed,
    timestamp: step.date_display && step.date_display !== '—'
      ? step.date_display
      : step.timestamp,
  }));
  const progressStatusLabel =
    statusSteps.find((s) => s.id === orderStatus)?.name ||
    t(`vendorOrders.${orderStatus}`, { defaultValue: order.status_label || orderStatus });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <VendorPageHeader
        title={t('vendorOrders.detailTitle')}
        subtitle={order.order_number}
        onBack={() => navigation.goBack()}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <VendorCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroOrderId}>{order.order_number}</Text>
              <Text style={styles.heroDate}>
                {order.order_date_display || formatDateTime(order.order_date)}
              </Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: color + '18' }]}>
              <Ionicons
                name={(statusSteps.find((s) => s.id === orderStatus)?.icon || 'help-circle') as any}
                size={14}
                color={color}
              />
              <Text style={[styles.heroBadgeText, { color }]}>
                {progressStatusLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.heroAmount}>
            {order.total_amount > 0
              ? money(order.total_amount)
              : t('vendorOrders.free')}
          </Text>
        </VendorCard>

        <Text style={styles.sectionLabel}>{t('vendorOrders.orderProgress')}</Text>
        <VendorCard style={styles.timelineCard}>
          {trackLoading && trackTimeline.length === 0 ? (
            <View style={styles.trackLoadingWrap}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.trackLoadingText}>
                {t('vendorOrders.trackLoading', { defaultValue: 'Loading progress…' })}
              </Text>
            </View>
          ) : trackTimeline.length > 0 ? (
            <>
              <View style={styles.trackHeader}>
                <Text style={styles.trackStatusLabel}>{progressStatusLabel}</Text>
                {track?.tracking_display && track.tracking_display !== '—' ? (
                  <Text style={styles.trackMeta}>
                    {t('vendorOrders.tracking')}: {track.tracking_display}
                  </Text>
                ) : track?.fulfillment_type ? (
                  <Text style={styles.trackMeta}>
                    {t('vendorOrders.fulfillmentType', {
                      defaultValue: 'Fulfillment: {{type}}',
                      type: track.fulfillment_type,
                    })}
                  </Text>
                ) : null}
              </View>
              <TrackingTimeline timeline={trackTimeline} />
            </>
          ) : (
            <View style={styles.timelineRow}>
              {statusSteps.map((step, index) => {
                const apiStep = order.timeline?.find((s) => s.status === step.id);
                const done =
                  apiStep?.completed === true ||
                  (apiStep?.completed == null && currentIndex >= index);
                const active = apiStep?.current === true || orderStatus === step.id;
                return (
                  <View key={step.id} style={styles.timelineItem}>
                    <View
                      style={[
                        styles.timelineDot,
                        done && { backgroundColor: step.color, borderColor: step.color },
                        active && { transform: [{ scale: 1.15 }] },
                      ]}
                    >
                      <Ionicons
                        name={step.icon as any}
                        size={14}
                        color={done ? '#fff' : COLORS.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.timelineLabel,
                        done && { color: step.color, fontWeight: FONT_WEIGHTS.semiBold },
                      ]}
                      numberOfLines={1}
                    >
                      {apiStep?.label || step.name}
                    </Text>
                    {index < statusSteps.length - 1 ? (
                      <View
                        style={[
                          styles.timelineConnector,
                          (apiStep?.completed || currentIndex > index) && {
                            backgroundColor: step.color,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </VendorCard>

        <Text style={styles.sectionLabel}>{t('vendorOrders.product')}</Text>
        <VendorCard>
          {(order.items?.length ? order.items : [null]).map((item, index) => (
            <View
              key={item?.id || `item-${index}`}
              style={[styles.productRow, index > 0 && { marginTop: SPACING.md }]}
            >
              {item?.product_image || order.product_image ? (
                <Image
                  source={{ uri: item?.product_image || order.product_image }}
                  style={styles.productImage}
                />
              ) : (
                <View style={[styles.productImage, styles.productFallback]}>
                  <Ionicons name="cube" size={28} color={COLORS.primary} />
                </View>
              )}
              <View style={styles.productMeta}>
                <Text style={styles.productName}>
                  {item?.product_name || order.product_name || t('vendorOrders.product')}
                </Text>
                <Text style={styles.productQty}>
                  {t('vendorOrders.qtyValue', {
                    count: item?.quantity ?? order.quantity ?? 1,
                  })}
                </Text>
                {item?.area_m2 != null && item.area_m2 > 0 ? (
                  <>
                    <Text style={styles.productQty}>
                      {t('orders.areaValue', {
                        defaultValue: 'Area: {{area}} m²',
                        area: item.area_m2,
                      })}
                    </Text>
                    <Text style={styles.productQty}>
                      {t('orders.unitPriceValue', {
                        defaultValue: 'Unit price: AED {{price}}/m²',
                        price: Number(item.price_per_m2 ?? item.unit_price).toFixed(2),
                      })}
                    </Text>
                  </>
                ) : null}
                <Text style={styles.productPrice}>
                  {(item?.total ?? order.total_amount) > 0
                    ? money(item?.total ?? order.total_amount)
                    : t('vendorOrders.freeProduct')}
                </Text>
              </View>
            </View>
          ))}
        </VendorCard>

        <Text style={styles.sectionLabel}>{t('vendorOrders.orderInfo')}</Text>
        <VendorCard style={styles.infoCard}>
          {renderInfoRow(
            t('vendorOrders.orderDate'),
            order.order_date_display || formatDateTime(order.order_date),
            'calendar-outline'
          )}
          {renderInfoRow(
            t('vendorOrders.deliveryDate'),
            order.delivery_date_display || formatDate(order.delivery_date),
            'bicycle-outline'
          )}
          {renderInfoRow(
            t('vendorOrders.tracking'),
            order.tracking_display || order.tracking_number || '—',
            'navigate-outline'
          )}
          {renderInfoRow(
            t('vendorOrders.paymentMethod', { defaultValue: 'Payment method' }),
            order.payment_method || '—',
            'card-outline'
          )}
          {renderInfoRow(
            t('vendorOrders.paymentStatus', { defaultValue: 'Payment status' }),
            order.payment_status || '—',
            'checkmark-circle-outline'
          )}
          {order.subtotal != null
            ? renderInfoRow(
                t('vendorOrders.subtotal', { defaultValue: 'Subtotal' }),
                money(order.subtotal),
                'pricetag-outline'
              )
            : null}
          {order.tax != null
            ? renderInfoRow(
                t('vendorOrders.tax', { defaultValue: 'Tax' }),
                money(order.tax),
                'receipt-outline'
              )
            : null}
          {order.shipping != null
            ? renderInfoRow(
                t('vendorOrders.shipping', { defaultValue: 'Shipping' }),
                money(order.shipping),
                'car-outline'
              )
            : null}
          {renderInfoRow(
            t('vendorOrders.total', { defaultValue: 'Total' }),
            money(order.total_amount),
            'cash-outline'
          )}
        </VendorCard>

        <Text style={styles.sectionLabel}>{t('vendorOrders.customer')}</Text>
        <VendorCard style={styles.infoCard}>
          <View style={styles.customerHeader}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerInitial}>
                {(order.customer_name || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{order.customer_name}</Text>
              <Text style={styles.customerSub}>
                {order.customer_phone || t('vendorOrders.noPhone')}
              </Text>
            </View>
          </View>
          {renderInfoRow(t('vendorOrders.email'), order.customer_email || '—', 'mail-outline')}
          {renderInfoRow(t('vendorOrders.address'), order.customer_address || '—', 'location-outline')}
        </VendorCard>

        {notesText ? (
          <>
            <Text style={styles.sectionLabel}>{t('vendorOrders.notes')}</Text>
            <VendorCard>
              <Text style={styles.notesText}>{notesText}</Text>
            </VendorCard>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{t('vendorOrders.actions')}</Text>
        <View style={styles.actionsWrap}>
          {(order.can_contact_customer ?? true) && (
            <TouchableOpacity
              style={styles.actionPrimary}
              onPress={handleContactCustomer}
              disabled={actionLoading}
            >
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.actionPrimaryText}>{t('vendorOrders.contactCustomer')}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.actionSecondaryRow}>
            {(order.can_print_invoice ?? true) && (
              <TouchableOpacity
                style={styles.actionSecondary}
                onPress={handlePrintInvoice}
                disabled={actionLoading}
              >
                <Ionicons name="print-outline" size={20} color={COLORS.primary} />
                <Text style={styles.actionSecondaryText}>{t('vendorOrders.invoice')}</Text>
              </TouchableOpacity>
            )}
            {(order.can_download_order ?? true) && (
              <TouchableOpacity
                style={styles.actionSecondary}
                onPress={handleDownloadOrder}
                disabled={actionLoading}
              >
                <Ionicons name="download-outline" size={20} color={COLORS.primary} />
                <Text style={styles.actionSecondaryText}>{t('vendorOrders.download')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {order.can_update_status === false ? (
          <>
            <Text style={styles.sectionLabel}>{t('vendorOrders.tracking', { defaultValue: 'Tracking' })}</Text>
            <VendorCard>
              <View style={styles.trackOnlyBox}>
                <Ionicons name="navigate-outline" size={22} color={COLORS.primary} />
                <Text style={styles.trackOnlyText}>
                  {order.fulfillment_note ||
                    t('vendorOrders.serviceTrackOnly', {
                      defaultValue:
                        'Service order — handled by supervisor/technician. You can track progress only.',
                    })}
                </Text>
              </View>
            </VendorCard>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>{t('vendorOrders.updateStatus')}</Text>
            <VendorCard>
              <View style={styles.statusGrid}>
                {(order.available_statuses?.length
                  ? order.available_statuses.map((opt) => ({
                      id: opt.value,
                      name: opt.label,
                      icon:
                        statusSteps.find((s) => s.id === opt.value)?.icon ||
                        ('ellipse-outline' as const),
                      color: statusColor(String(opt.value)),
                      enabled: opt.enabled !== false,
                    }))
                  : statusSteps.map((s) => ({ ...s, enabled: true }))
                ).map((step) => {
                  const active = orderStatus === step.id;
                  const disabled = actionLoading || step.enabled === false;
                  return (
                    <TouchableOpacity
                      key={step.id}
                      style={[
                        styles.statusChip,
                        active && { backgroundColor: step.color + '18', borderColor: step.color },
                        disabled && !active && styles.statusChipDisabled,
                      ]}
                      onPress={() => handleStatusUpdate(String(step.id))}
                      disabled={disabled}
                    >
                      <Ionicons
                        name={step.icon as any}
                        size={16}
                        color={active ? step.color : COLORS.textSecondary}
                      />
                      <Text style={[styles.statusChipText, active && { color: step.color }]}>
                        {step.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(isProductFulfillment(order, track) || order.uses_delivery_otp) &&
              orderStatus === 'shipped' ? (
                <Text style={styles.otpHint}>
                  {t('vendorOrders.deliveryOtpHint', {
                    defaultValue:
                      'After shipping, ask the customer for the OTP shown in their Tandil app, then enter it here to confirm delivery. No SMS is used.',
                  })}
                </Text>
              ) : null}
              {(order.can_confirm_delivery_otp ||
                ((isProductFulfillment(order, track) || order.uses_delivery_otp) &&
                  orderStatus === 'shipped')) && (
                <TouchableOpacity
                  style={styles.otpConfirmBtn}
                  onPress={() => {
                    setDeliveryOtp('');
                    setOtpModalVisible(true);
                  }}
                  disabled={actionLoading}
                >
                  <Ionicons name="keypad-outline" size={18} color="#fff" />
                  <Text style={styles.otpConfirmBtnText}>
                    {t('vendorOrders.confirmWithOtp', {
                      defaultValue: 'Confirm delivery with OTP',
                    })}
                  </Text>
                </TouchableOpacity>
              )}
            </VendorCard>
          </>
        )}
      </ScrollView>

      <Modal visible={otpModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {t('vendorOrders.deliveryOtpTitle', { defaultValue: 'Delivery OTP' })}
            </Text>
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
                  setOtpModalVisible(false);
                  setDeliveryOtp('');
                }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => void handleConfirmDeliveryOtp()}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {t('vendorOrders.confirmDelivery', { defaultValue: 'Confirm delivery' })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            {(order?.can_resend_delivery_otp || order?.resend_delivery_otp_endpoint) && (
              <TouchableOpacity
                style={styles.resendOtpBtn}
                onPress={() => void handleResendDeliveryOtp()}
                disabled={actionLoading}
              >
                <Text style={styles.resendOtpText}>
                  {t('vendorOrders.resendDeliveryOtp', {
                    defaultValue: 'Resend OTP to customer app',
                  })}
                </Text>
              </TouchableOpacity>
            )}
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
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  heroCard: {
    marginTop: SPACING.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  heroOrderId: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  heroDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
  },
  heroBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  heroAmount: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  timelineCard: {
    paddingVertical: SPACING.md,
  },
  trackLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  trackLoadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  trackHeader: {
    marginBottom: SPACING.sm,
  },
  trackStatusLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  trackMeta: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    zIndex: 2,
  },
  timelineLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  timelineConnector: {
    position: 'absolute',
    top: 13,
    left: '55%',
    right: '-45%',
    height: 2,
    backgroundColor: COLORS.border,
    zIndex: 1,
  },
  productRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
  },
  productFallback: {
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
  productQty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  productPrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginTop: 6,
  },
  infoCard: {
    paddingVertical: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    maxWidth: '48%',
    textAlign: 'right',
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerInitial: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  customerSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  notesText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  actionsWrap: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionPrimaryText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  actionSecondaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionSecondaryText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  statusChipText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  statusChipDisabled: {
    opacity: 0.45,
  },
  trackOnlyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  trackOnlyText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  otpHint: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  otpConfirmBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  otpConfirmBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
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
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 6,
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
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default VendorOrderDetailScreen;
