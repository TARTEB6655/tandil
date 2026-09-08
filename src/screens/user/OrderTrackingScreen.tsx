import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useTranslation } from 'react-i18next';
import Header from '../../components/common/Header';
import { TrackingTimeline } from '../../components/common/TrackingTimeline';
import {
  cancelClientOrder,
  getCancelledOrderTrack,
  getClientOrderDetails,
  getOrderTrack,
  isOrderAlreadyRated,
  isOrderRatedLocally,
  maintenancePhotoUrl,
  resolveDeliveryOtpFromTrack,
  type ClientOrderDetails,
  type OrderTrackData,
  type ShopOrderLineItem,
} from '../../services/orderService';
import { buildFullImageUrl } from '../../config/api';
import {
  ClientVisitReport,
  extractReportFromOrderTrack,
} from '../../services/clientVisitReportService';
import { formatTimeOptionLabel } from '../../utils/schedulingTimeOptions';

function formatBookingDate(raw?: string | null, locale = 'en-US'): string {
  const v = String(raw ?? '').trim();
  if (!v) return '—';
  const ymd = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) {
    const d = new Date(`${ymd[1]}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  return v;
}

function formatSlotClock(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw.trim();
  return formatTimeOptionLabel(`${match[1].padStart(2, '0')}:${match[2]}`);
}

function formatBookingSlot(summary?: {
  booking_slot?: string | null;
  slot_start_time?: string | null;
  slot_end_time?: string | null;
} | null): string {
  const start = String(summary?.slot_start_time ?? '').trim();
  const end = String(summary?.slot_end_time ?? '').trim();
  if (start && end) return `${formatSlotClock(start)} – ${formatSlotClock(end)}`;
  if (start) return formatSlotClock(start);
  const slot = String(summary?.booking_slot ?? '').trim();
  return slot || '—';
}

function resolveTrackPhotoUrl(entry: unknown): string | null {
  const raw = maintenancePhotoUrl(entry);
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return buildFullImageUrl(raw);
}

const OrderTrackingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId, useCancelledTrack } = route.params || {};
  const { t, i18n } = useTranslation();
  const [track, setTrack] = useState<OrderTrackData | null>(null);
  const [orderDetail, setOrderDetail] = useState<ClientOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [visitReport, setVisitReport] = useState<ClientVisitReport | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);

  const load = useCallback(async () => {
    if (orderId == null || orderId === '') {
      setError(t('orders.invalidOrder', 'Invalid order.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loader = useCancelledTrack ? getCancelledOrderTrack : getOrderTrack;
      const [trackResult, detailResult, ratedLocally] = await Promise.all([
        loader(orderId),
        useCancelledTrack
          ? Promise.resolve({
              data: null as ClientOrderDetails | null,
              order_summary: null as null,
              fulfillment_type: null as null,
              uses_delivery_otp: null as null,
              delivery_otp: null as null,
            })
          : getClientOrderDetails(orderId).catch(() => ({
              data: null as ClientOrderDetails | null,
              order_summary: null as null,
              fulfillment_type: null as null,
              uses_delivery_otp: null as null,
              delivery_otp: null as null,
            })),
        isOrderRatedLocally(orderId),
      ]);
      const { data, message } = trackResult;
      const detail = detailResult.data;
      setOrderDetail(detail);

      if (data) {
        // Enrich track with detail items / OTP fields when track payload is thin.
        const enriched: OrderTrackData = {
          ...data,
          fulfillment_type:
            data.fulfillment_type ?? detail?.fulfillment_type ?? detailResult.fulfillment_type,
          uses_delivery_otp:
            data.uses_delivery_otp ?? detail?.uses_delivery_otp ?? detailResult.uses_delivery_otp,
          delivery_otp: data.delivery_otp ?? detail?.delivery_otp ?? detailResult.delivery_otp,
          vendor_mappings: data.vendor_mappings ?? detail?.vendor_mappings,
          order: {
            ...data.order,
            ...(detail
              ? {
                  items: detail.items?.length ? detail.items : data.order?.items,
                  vendor_mappings: detail.vendor_mappings ?? data.order?.vendor_mappings,
                  fulfillment_type: detail.fulfillment_type ?? data.order?.fulfillment_type,
                  uses_delivery_otp: detail.uses_delivery_otp ?? data.order?.uses_delivery_otp,
                  delivery_otp: detail.delivery_otp ?? data.order?.delivery_otp,
                  order_status: detail.order_status ?? data.order?.order_status,
                }
              : {}),
          },
          order_summary: data.order_summary ?? detailResult.order_summary ?? data.order_summary,
        };
        setTrack(enriched);
        setAlreadyRated(ratedLocally || isOrderAlreadyRated(enriched));
        const embedded = extractReportFromOrderTrack(enriched);
        const serviceReport = (enriched as any)?.service_report;
        const status = String(serviceReport?.status ?? '').toLowerCase();

        // Requirement: show Service Report card ONLY when track API says sent_to_client.
        if (!status.includes('sent_to_client')) {
          setVisitReport(null);
        } else {
          const embeddedStatus = String(
            embedded.report?.status ?? embedded.report?.visit?.status ?? ''
          ).toLowerCase();
          if (embedded.report && embeddedStatus.includes('sent_to_client')) {
            setVisitReport(embedded.report);
          } else {
            setVisitReport({
              id: serviceReport?.report_id ?? embedded.report?.id ?? '',
              visit_id: serviceReport?.visit_id ?? embedded.visitId,
              status: serviceReport?.status ?? 'sent_to_client',
              technician_name: undefined,
              employee_id: undefined,
              location: undefined,
              service: undefined,
              submitted_at: undefined,
              technician_notes: null,
              supervisor_notes: null,
              recommendations: [],
              before_photos: [],
              after_photos: [],
            });
          }
        }
      } else if (detail) {
        // Detail-only fallback if track fails but GET /orders/:id works.
        const summary = detailResult.order_summary;
        const fallback: OrderTrackData = {
          order_id: detail.id,
          order_number: detail.order_number || `order_${detail.id}`,
          order_number_short: String(detail.id),
          order: detail,
          order_summary: summary || {
            placed_at: detail.created_at,
            booking_date: detail.booking_date,
            booking_slot: detail.booking_slot,
            delivery_address: [
              detail.shipping_address?.street_address,
              detail.shipping_address?.city,
              detail.shipping_address?.state,
              detail.shipping_address?.zip_code,
              detail.shipping_address?.country,
            ]
              .filter(Boolean)
              .join(', '),
            payment_method: detail.payment_method,
            total: Number(detail.total_amount) || 0,
            currency: 'AED',
            estimated_arrival: detail.estimated_arrival,
            job_duration: detail.job_duration,
            special_instructions: detail.special_instructions,
          },
          current_status: detail.order_status,
          tracking: { status: detail.order_status, timeline: [] },
          maintenance_photos: [],
          can_cancel: !['delivered', 'completed', 'cancelled'].includes(
            String(detail.order_status || '').toLowerCase()
          ),
          fulfillment_type: detail.fulfillment_type,
          uses_delivery_otp: detail.uses_delivery_otp,
          delivery_otp: detail.delivery_otp,
          vendor_mappings: detail.vendor_mappings,
        };
        setTrack(fallback);
        setAlreadyRated(ratedLocally || isOrderAlreadyRated(fallback));
        setVisitReport(null);
      } else {
        setError(message || t('orders.trackLoadFailed', 'Could not load tracking.'));
        setTrack(null);
        setVisitReport(null);
        setAlreadyRated(ratedLocally);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        t('orders.trackLoadFailed', 'Could not load tracking.');
      setError(msg);
      setTrack(null);
      setOrderDetail(null);
      setVisitReport(null);
      setAlreadyRated(false);
    } finally {
      setLoading(false);
    }
  }, [orderId, t, useCancelledTrack]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleCancelOrder = () => {
    Alert.alert(
      t('orders.cancelTitle', 'Cancel order'),
      t('orders.cancelConfirm', 'Are you sure you want to cancel this order?'),
      [
        { text: t('common.no', 'No'), style: 'cancel' },
        {
          text: t('common.yes', 'Yes'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancelling(true);
              try {
                const { success, message, refund } = await cancelClientOrder(orderId);
                if (success) {
                  const parts: string[] = [];
                  if (message?.trim()) parts.push(message.trim());
                  else parts.push(t('orders.cancelSuccessBody', 'Your order has been cancelled.'));
                  if (refund?.wallet_credited != null && Number(refund.wallet_credited) > 0) {
                    const amt = Number(refund.wallet_credited).toFixed(2);
                    const exp = refund.wallet_expires_at
                      ? String(refund.wallet_expires_at).slice(0, 10)
                      : '';
                    parts.push(
                      exp
                        ? t('orders.cancelWalletCredit', { amount: amt, date: exp })
                        : t('orders.cancelWalletCreditShort', { amount: amt })
                    );
                  }
                  Alert.alert(t('orders.cancelSuccessTitle', 'Order cancelled'), parts.join('\n\n'), [
                    { text: t('common.ok', 'OK'), onPress: () => navigation.goBack() },
                  ]);
                } else {
                  Alert.alert(
                    t('common.error', 'Error'),
                    message || t('orders.cancelFailed', 'Could not cancel this order. Please try again.')
                  );
                }
              } finally {
                setCancelling(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handleRateService = () => {
    try {
      const productName =
        orderDetail?.items?.[0]?.product?.name ||
        track?.order?.items?.[0]?.product?.name ||
        undefined;
      navigation.navigate('RateReview', {
        orderId: String(orderId),
        orderNumber: track?.order_number_short || track?.order_number || String(orderId),
        serviceName: productName,
      });
    } catch {
      // ignore
    }
  };

  const photoUrls =
    track?.maintenance_photos?.map(resolveTrackPhotoUrl).filter((u): u is string => u != null) ??
    [];

  const lineItems: ShopOrderLineItem[] =
    (orderDetail?.items?.length ? orderDetail.items : track?.order?.items) || [];

  const summary = track?.order_summary;
  const firstItemProduct = lineItems[0]?.product ?? track?.order?.items?.[0]?.product;
  const estimatedArrival =
    summary?.estimated_arrival ||
    orderDetail?.estimated_arrival ||
    firstItemProduct?.estimated_arrival ||
    null;
  const jobDuration =
    summary?.job_duration ||
    orderDetail?.job_duration ||
    firstItemProduct?.job_duration ||
    null;
  const loc =
    i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'ur' ? 'ur-PK' : 'en-US';
  const placedDate =
    summary?.placed_at != null
      ? (() => {
          const d = new Date(summary.placed_at);
          if (Number.isNaN(d.getTime())) return '—';
          return `${d.toLocaleDateString(loc)} ${d.toLocaleTimeString(loc, {
            hour: '2-digit',
            minute: '2-digit',
          })}`;
        })()
      : '—';
  const bookingDateLabel = formatBookingDate(
    summary?.booking_date ?? orderDetail?.booking_date,
    loc
  );
  const bookingSlotLabel = formatBookingSlot(
    summary ?? {
      placed_at: orderDetail?.created_at || '',
      booking_slot: orderDetail?.booking_slot,
      delivery_address: '',
      payment_method: '',
      total: 0,
      currency: 'AED',
    }
  );

  const statusLower = track?.tracking?.status?.toLowerCase() ?? '';
  const isDone = statusLower === 'completed' || statusLower === 'delivered';
  const canShowRateService = isDone && !alreadyRated;
  const deliveryOtpInfo = resolveDeliveryOtpFromTrack(track, orderDetail);
  const thumb = Math.min(Dimensions.get('window').width - SPACING.lg * 2, 120);

  const productImageUrl = (item: ShopOrderLineItem): string | null => {
    const raw = item.product?.image_url || item.product?.image || null;
    if (!raw) return null;
    if (String(raw).startsWith('http://') || String(raw).startsWith('https://')) return String(raw);
    return buildFullImageUrl(String(raw));
  };

  if (loading && !track) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{t('orders.loadingTracking', 'Loading…')}</Text>
      </View>
    );
  }

  if (error && !track) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>{t('common.error', 'Error')}</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!track) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Header title={t('orders.trackingTitle', { defaultValue: 'Order tracking' })} showBack={true} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <View style={styles.heroDecor} />
          <View style={styles.statusHeader}>
            <View style={styles.heroOrderMeta}>
              <Text style={styles.heroLabel}>{t('orders.orderLabel', 'Order')}</Text>
              <Text style={styles.orderId}>
                #{track.order_number_short || track.order_id}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.statusTextLight}>{track.current_status}</Text>
            </View>
          </View>
          <View style={styles.timelineCard}>
            <TrackingTimeline timeline={track.tracking?.timeline ?? []} />
          </View>
        </View>

        {deliveryOtpInfo.visible ? (
          <View style={styles.otpSection}>
            <View style={styles.otpCard}>
              <View style={styles.otpIconWrap}>
                <Ionicons
                  name={deliveryOtpInfo.expired && !deliveryOtpInfo.otp ? 'time' : 'shield-checkmark'}
                  size={26}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.otpEyebrow}>{t('orders.deliveryOtpEyebrow')}</Text>
              <Text style={styles.otpTitle}>
                {deliveryOtpInfo.otp
                  ? t('orders.deliveryOtpTitle')
                  : t('orders.deliveryOtpExpiredTitle')}
              </Text>
              <Text style={styles.otpHint}>{t('orders.deliveryOtpHint')}</Text>
              {deliveryOtpInfo.otp ? (
                <>
                  <View style={styles.otpCodeBox}>
                    {deliveryOtpInfo.otp.split('').map((digit, index) => (
                      <View key={`otp-d-${index}`} style={styles.otpDigit}>
                        <Text style={styles.otpDigitText}>{digit}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.otpCodePlain} selectable>
                    {deliveryOtpInfo.otp}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        {lineItems.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('orders.items')}</Text>
            <View style={styles.orderCard}>
              {lineItems.map((item) => {
                const img = productImageUrl(item);
                const name = item.product?.name || `Product #${item.product_id}`;
                const qty = Number(item.quantity) || 1;
                const price = Number(item.price || item.subtotal || 0);
                return (
                  <View key={`item-${item.id}`} style={styles.productRow}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.productThumb} />
                    ) : (
                      <View style={[styles.productThumb, styles.productThumbFallback]}>
                        <Ionicons name="cube-outline" size={22} color={COLORS.primary} />
                      </View>
                    )}
                    <View style={styles.productMeta}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {name}
                      </Text>
                      {item.product?.sku ? (
                        <Text style={styles.productSku}>
                          {t('orders.sku', { sku: item.product.sku })}
                        </Text>
                      ) : null}
                      <Text style={styles.productQty}>
                        {t('orders.qtyValue', { count: qty })}
                      </Text>
                      {item.area_m2 != null && Number(item.area_m2) > 0 ? (
                        <>
                          <Text style={styles.productQty}>
                            {t('orders.areaValue', {
                              defaultValue: 'Area: {{area}} m²',
                              area: item.area_m2,
                            })}
                          </Text>
                          {(item.unit_price != null || item.price_per_m2 != null) ? (
                            <Text style={styles.productQty}>
                              {t('orders.unitPriceValue', {
                                defaultValue: 'Unit price: AED {{price}}/m²',
                                price: Number(item.unit_price ?? item.price_per_m2).toFixed(2),
                              })}
                            </Text>
                          ) : null}
                        </>
                      ) : null}
                    </View>
                    <Text style={styles.productPrice}>AED {price.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {photoUrls.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('home.maintenancePhotos', 'Maintenance photos')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoRow}>
                {photoUrls.map((uri, idx) => (
                  <Image
                    key={`mp-${idx}`}
                    source={{ uri }}
                    style={[styles.photoThumb, { width: thumb, height: thumb }]}
                    resizeMode="cover"
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {visitReport ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('clientVisitReport.title', { defaultValue: 'Service Report' })}
            </Text>
            <TouchableOpacity
              style={styles.reportCard}
              activeOpacity={0.88}
              onPress={() =>
                navigation.navigate('ClientVisitReport', {
                  orderId,
                  reportId: visitReport.id,
                  visitId: visitReport.visit_id,
                })
              }
            >
              <View style={styles.reportIconWrap}>
                <Ionicons name="document-text" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.reportMeta}>
                <Text style={styles.reportTitle}>
                  {t('clientVisitReport.readyTitle', {
                    defaultValue: 'Your service report is ready',
                  })}
                </Text>
                <Text style={styles.reportSubtitle} numberOfLines={2}>
                  {visitReport.supervisor_notes ||
                    visitReport.service ||
                    t('clientVisitReport.tapToView', {
                      defaultValue: 'Tap to view notes, photos, and recommendations',
                    })}
                </Text>
                {visitReport.recommendations && visitReport.recommendations.length > 0 ? (
                  <Text style={styles.reportRecCount}>
                    {t('clientVisitReport.recommendationCount', {
                      defaultValue: '{{count}} recommendations',
                      count: visitReport.recommendations.length,
                    })}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('booking.orderSummary', 'Order summary')}</Text>
          <View style={styles.orderCard}>
            <View style={styles.orderInfo}>
              <View style={styles.orderInfoItem}>
                <View style={styles.orderInfoIcon}>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>
                    {t('booking.orderDate', { defaultValue: 'Order date' })}
                  </Text>
                  <Text style={styles.orderInfoValue}>{placedDate}</Text>
                </View>
              </View>

              <View style={styles.orderInfoItem}>
                <View style={styles.orderInfoIcon}>
                  <Ionicons name="calendar" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>
                    {t('booking.bookingDate', { defaultValue: 'Booking date' })}
                  </Text>
                  <Text style={styles.orderInfoValue}>{bookingDateLabel}</Text>
                </View>
              </View>

              <View style={styles.orderInfoItem}>
                <View style={styles.orderInfoIcon}>
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>
                    {t('booking.timeSlot', { defaultValue: 'Time slot' })}
                  </Text>
                  <Text style={styles.orderInfoValue}>{bookingSlotLabel}</Text>
                </View>
              </View>

              <View style={styles.orderInfoItem}>
                <View style={styles.orderInfoIcon}>
                  <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>{t('booking.addressSection', 'Address')}</Text>
                  <Text style={styles.orderInfoValue}>{summary?.delivery_address ?? '—'}</Text>
                </View>
              </View>

              <View style={styles.orderInfoItem}>
                <View style={styles.orderInfoIcon}>
                  <Ionicons name="card-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>{t('booking.payment', 'Payment')}</Text>
                  <Text style={styles.orderInfoValue}>
                    {(() => {
                      const raw = (summary?.payment_method || '').toString().trim();
                      if (!raw) return '—';
                      const n = raw.toLowerCase().replace(/[\s_-]+/g, '');
                      if (n.includes('card') || n.includes('credit') || n.includes('stripe')) {
                        return t('booking.paymentMethods.card', { defaultValue: raw });
                      }
                      if (n.includes('cash')) {
                        return t('booking.paymentMethods.cash', { defaultValue: raw });
                      }
                      if (n.includes('wallet')) {
                        return t('booking.paymentMethods.wallet', { defaultValue: raw });
                      }
                      return raw;
                    })()}
                  </Text>
                </View>
              </View>

              <View style={styles.orderInfoItem}>
                <View style={[styles.orderInfoIcon, styles.orderInfoIconTotal]}>
                  <Ionicons name="cash-outline" size={18} color="#fff" />
                </View>
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>{t('booking.total', 'Total')}</Text>
                  <Text style={[styles.orderInfoValue, styles.totalValue]}>
                    {summary?.currency ?? 'AED'} {Number(summary?.total ?? 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              {estimatedArrival ? (
                <View style={styles.orderInfoItem}>
                  <View style={styles.orderInfoIcon}>
                    <Ionicons name="navigate-outline" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.orderInfoText}>
                    <Text style={styles.orderInfoLabel}>
                      {t('product.estimatedArrival', { defaultValue: 'Estimated arrival' })}
                    </Text>
                    <Text style={styles.orderInfoValue}>{estimatedArrival}</Text>
                  </View>
                </View>
              ) : null}

              {jobDuration ? (
                <View style={styles.orderInfoItem}>
                  <View style={styles.orderInfoIcon}>
                    <Ionicons name="hourglass-outline" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.orderInfoText}>
                    <Text style={styles.orderInfoLabel}>
                      {t('product.jobDuration', { defaultValue: 'Job duration' })}
                    </Text>
                    <Text style={styles.orderInfoValue}>{jobDuration}</Text>
                  </View>
                </View>
              ) : null}

              {summary?.special_instructions ? (
                <View style={styles.orderInfoItem}>
                  <View style={styles.orderInfoIcon}>
                    <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.orderInfoText}>
                    <Text style={styles.orderInfoLabel}>{t('booking.special', 'Note')}</Text>
                    <Text style={styles.orderInfoValue}>{summary.special_instructions}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>

      {(canShowRateService || (!isDone && track.can_cancel)) ? (
        <View style={styles.bottomActions}>
          {canShowRateService ? (
            <TouchableOpacity style={styles.rateButton} onPress={handleRateService} activeOpacity={0.88}>
              <Ionicons name="star" size={20} color={COLORS.background} />
              <Text style={styles.rateButtonText}>{t('orders.rateService', 'Rate service')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cancelButton, cancelling && { opacity: 0.6 }]}
              onPress={handleCancelOrder}
              disabled={cancelling}
              activeOpacity={0.88}
            >
              <Ionicons name="close-circle-outline" size={20} color={COLORS.error} />
              <Text style={styles.cancelButtonText}>
                {cancelling ? t('common.loading', 'Loading...') : t('orders.cancelOrder', 'Cancel order')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  errorTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  errorBody: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.round,
  },
  retryText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  heroCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: SPACING.lg,
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  heroOrderMeta: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  heroLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 2,
    fontWeight: FONT_WEIGHTS.medium,
  },
  orderId: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
  },
  statusTextLight: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: '#fff',
  },
  timelineCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  productThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  productThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '14',
  },
  productMeta: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  productSku: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  productQty: {
    marginTop: 2,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  productPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  otpSection: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  otpCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
    alignItems: 'center',
  },
  otpIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  otpEyebrow: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  otpTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  otpHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  otpCodeBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  otpDigit: {
    minWidth: 40,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  otpDigitText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 1,
  },
  otpCodePlain: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  photoRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  photoThumb: {
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 18,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportCardEmpty: {
    opacity: 0.95,
  },
  reportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportMeta: { flex: 1 },
  reportTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  reportTitleMuted: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
  },
  reportSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  reportRecCount: {
    marginTop: 6,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  reportLoadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  orderCard: {
    backgroundColor: COLORS.background,
    borderRadius: 18,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderInfo: {
    gap: SPACING.md,
  },
  orderInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  orderInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderInfoIconTotal: {
    backgroundColor: COLORS.primary,
  },
  orderInfoText: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  orderInfoLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
    fontWeight: FONT_WEIGHTS.medium,
  },
  orderInfoValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  totalValue: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.lg,
  },
  bottomActions: {
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rateButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.round,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rateButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginLeft: SPACING.sm,
  },
  cancelButton: {
    backgroundColor: COLORS.error + '14',
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.round,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '33',
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginLeft: SPACING.sm,
  },
});

export default OrderTrackingScreen;
