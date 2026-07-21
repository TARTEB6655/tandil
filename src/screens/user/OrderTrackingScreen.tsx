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
  getOrderTrack,
  isOrderAlreadyRated,
  isOrderRatedLocally,
  maintenancePhotoUrl,
  type OrderTrackData,
} from '../../services/orderService';
import { buildFullImageUrl } from '../../config/api';
import {
  ClientVisitReport,
  extractReportFromOrderTrack,
} from '../../services/clientVisitReportService';

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
      const [{ data, message }, ratedLocally] = await Promise.all([
        loader(orderId),
        isOrderRatedLocally(orderId),
      ]);
      if (data) {
        setTrack(data);
        setAlreadyRated(ratedLocally || isOrderAlreadyRated(data));
        const embedded = extractReportFromOrderTrack(data);
        const serviceReport = (data as any)?.service_report;
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

  const summary = track?.order_summary;
  const firstItemProduct = track?.order?.items?.[0]?.product;
  const estimatedArrival =
    summary?.estimated_arrival ||
    firstItemProduct?.estimated_arrival ||
    null;
  const jobDuration =
    summary?.job_duration ||
    firstItemProduct?.job_duration ||
    null;
  const placedDate =
    summary?.placed_at != null
      ? (() => {
          const d = new Date(summary.placed_at);
          if (isNaN(d.getTime())) return '—';
          const loc =
            i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'ur' ? 'ur-PK' : 'en-US';
          return `${d.toLocaleDateString(loc)} ${d.toLocaleTimeString(loc, {
            hour: '2-digit',
            minute: '2-digit',
          })}`;
        })()
      : '—';

  const statusLower = track?.tracking?.status?.toLowerCase() ?? '';
  const isDone = statusLower === 'completed' || statusLower === 'delivered';
  const canShowRateService = isDone && !alreadyRated;
  const thumb = Math.min(Dimensions.get('window').width - SPACING.lg * 2, 120);

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
      <Header title={t('orders.trackingTitle', 'Order tracking')} showBack={true} />

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
                  <Text style={styles.orderInfoLabel}>{t('booking.date', 'Placed')}</Text>
                  <Text style={styles.orderInfoValue}>{placedDate}</Text>
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
                  <Text style={styles.orderInfoValue}>{summary?.payment_method ?? '—'}</Text>
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
