import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useTranslation } from 'react-i18next';
import Header from '../../components/common/Header';
import { TrackingTimeline } from '../../components/common/TrackingTimeline';
import {
  getOrderTrack,
  maintenancePhotoUrl,
  type OrderTrackData,
} from '../../services/orderService';
import { buildFullImageUrl } from '../../config/api';

function resolveTrackPhotoUrl(entry: unknown): string | null {
  const raw = maintenancePhotoUrl(entry);
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return buildFullImageUrl(raw);
}

function badgeColorForStatus(statusLabel: string): string {
  const s = statusLabel.toLowerCase();
  if (s.includes('cancel')) return COLORS.error;
  if (s.includes('deliver') || s.includes('complete')) return COLORS.success;
  if (s.includes('progress') || s.includes('assign')) return COLORS.primary;
  if (s.includes('confirm')) return COLORS.info;
  if (s.includes('pending')) return COLORS.warning;
  return COLORS.textSecondary;
}

const OrderTrackingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId } = route.params || {};
  const { t, i18n } = useTranslation();
  const [track, setTrack] = useState<OrderTrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (orderId == null || orderId === '') {
      setError(t('orders.invalidOrder', 'Invalid order.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, message } = await getOrderTrack(orderId);
      if (data) {
        setTrack(data);
      } else {
        setError(message || t('orders.trackLoadFailed', 'Could not load tracking.'));
        setTrack(null);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        t('orders.trackLoadFailed', 'Could not load tracking.');
      setError(msg);
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancelOrder = () => {
    Alert.alert(
      t('orders.cancelTitle', 'Cancel order'),
      t('orders.cancelConfirm', 'Are you sure you want to cancel this order?'),
      [
        { text: t('common.no', 'No'), style: 'cancel' },
        {
          text: t('common.yes', 'Yes'),
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleRateService = () => {
    try {
      navigation.navigate('RateReview', { orderId: String(orderId) });
    } catch {
      // ignore
    }
  };

  const photoUrls =
    track?.maintenance_photos?.map(resolveTrackPhotoUrl).filter((u): u is string => u != null) ??
    [];

  const summary = track?.order_summary;
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

  const badgeBg = badgeColorForStatus(track.current_status);

  return (
    <View style={styles.container}>
      <Header
        title={t('tabs.orders')}
        showBack={true}
        rightComponent={
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={COLORS.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusContainer}>
          <View style={styles.statusHeader}>
            <Text style={styles.orderId}>
              {t('orders.orderNumberShort', {
                short: track.order_number_short || String(track.order_id),
                defaultValue: `Order #${track.order_number_short || track.order_id}`,
              })}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: badgeBg + '22' }]}>
              <Text style={[styles.statusText, { color: badgeBg }]}>{track.current_status}</Text>
            </View>
          </View>

          <TrackingTimeline timeline={track.tracking?.timeline ?? []} />
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('booking.orderSummary', 'Order summary')}</Text>
          <View style={styles.orderCard}>
            <View style={styles.orderInfo}>
              <View style={styles.orderInfoItem}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>{t('booking.date', 'Placed')}</Text>
                  <Text style={styles.orderInfoValue}>{placedDate}</Text>
                </View>
              </View>

              <View style={styles.orderInfoItem}>
                <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>{t('booking.addressSection', 'Address')}</Text>
                  <Text style={styles.orderInfoValue}>{summary?.delivery_address ?? '—'}</Text>
                </View>
              </View>

              <View style={styles.orderInfoItem}>
                <Ionicons name="card-outline" size={20} color={COLORS.textSecondary} />
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>{t('booking.payment', 'Payment')}</Text>
                  <Text style={styles.orderInfoValue}>{summary?.payment_method ?? '—'}</Text>
                </View>
              </View>

              <View style={styles.orderInfoItem}>
                <Ionicons name="cash-outline" size={20} color={COLORS.textSecondary} />
                <View style={styles.orderInfoText}>
                  <Text style={styles.orderInfoLabel}>{t('booking.total', 'Total')}</Text>
                  <Text style={styles.orderInfoValue}>
                    {summary?.currency ?? 'AED'} {Number(summary?.total ?? 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              {summary?.special_instructions ? (
                <View style={styles.orderInfoItem}>
                  <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSecondary} />
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

      <View style={styles.bottomActions}>
        {isDone ? (
          <TouchableOpacity style={styles.rateButton} onPress={handleRateService}>
            <Ionicons name="star-outline" size={20} color={COLORS.background} />
            <Text style={styles.rateButtonText}>{t('orders.rateService', 'Rate service')}</Text>
          </TouchableOpacity>
        ) : track.can_cancel ? (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
            <Ionicons name="close-circle-outline" size={20} color={COLORS.error} />
            <Text style={styles.cancelButtonText}>
              {t('orders.cancelOrder', 'Cancel order')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
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
    borderRadius: BORDER_RADIUS.md,
  },
  retryText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.medium,
  },
  moreButton: {
    padding: SPACING.sm,
  },
  statusContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  orderId: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  photoRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  photoThumb: {
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  orderInfo: {
    gap: SPACING.md,
  },
  orderInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  orderInfoText: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  orderInfoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  orderInfoValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  bottomActions: {
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rateButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rateButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    marginLeft: SPACING.sm,
  },
  cancelButton: {
    backgroundColor: COLORS.error + '20',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    marginLeft: SPACING.sm,
  },
});

export default OrderTrackingScreen;
