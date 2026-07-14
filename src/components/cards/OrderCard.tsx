import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order, OrderStatus } from '../../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS, ORDER_STATUS_LABELS } from '../../constants';
import { useTranslation } from 'react-i18next';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
  variant?: 'default' | 'compact';
}

const getStatusColor = (status: OrderStatus) => {
  switch (status) {
    case 'pending':
      return COLORS.warning;
    case 'confirmed':
      return COLORS.info;
    case 'assigned':
      return COLORS.primary;
    case 'in_progress':
      return COLORS.primary;
    case 'completed':
      return COLORS.success;
    case 'delivered':
      return COLORS.success;
    case 'cancelled':
      return COLORS.error;
    default:
      return COLORS.textSecondary;
  }
};

const getStatusIcon = (status: OrderStatus) => {
  switch (status) {
    case 'pending':
      return 'time-outline';
    case 'confirmed':
      return 'checkmark-circle-outline';
    case 'assigned':
      return 'person-outline';
    case 'in_progress':
      return 'construct-outline';
    case 'completed':
      return 'checkmark-done-circle-outline';
    case 'delivered':
      return 'checkmark-done-circle';
    case 'cancelled':
      return 'close-circle-outline';
    default:
      return 'help-circle-outline';
  }
};

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onPress,
  variant = 'default',
}) => {
  const isCompact = variant === 'compact';
  const statusColor = getStatusColor(order.status);
  const statusIcon = getStatusIcon(order.status);
  const { t, i18n } = useTranslation();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(
      i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'ur' ? 'ur-PK' : 'en-US',
      {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  };

  const addressLine =
    order.address?.street || order.address?.city
      ? `${order.address.street || ''}${order.address.street && order.address.city ? ', ' : ''}${order.address.city || ''}`
      : t('addresses.sheikhZayedDubai', {
          defaultValue: `${order.address?.street || ''}, ${order.address?.city || ''}`,
        });

  return (
    <TouchableOpacity
      style={[styles.container, isCompact && styles.compactContainer]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.accentBar, { backgroundColor: statusColor }]} />

      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.orderInfo}>
            <View style={styles.idRow}>
              <View style={styles.idIconWrap}>
                <Ionicons name="receipt-outline" size={14} color={COLORS.primary} />
              </View>
              <Text style={styles.orderId}>
                {t('orders.orderNumber', { id: order.id, defaultValue: `#${order.id}` })}
              </Text>
            </View>
            <Text style={styles.date}>{formatDate(order.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <Ionicons name={statusIcon as any} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(`orders.status.${order.status}`, {
                defaultValue: ORDER_STATUS_LABELS[order.status],
              })}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.amount}>
            {t('orders.currency', { defaultValue: 'AED' })} {order.totalAmount}
          </Text>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.address} numberOfLines={1}>
              {addressLine}
            </Text>
          </View>

          {!isCompact && (
            <View style={styles.details}>
              <View style={styles.detailChip}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                <Text style={styles.detailText}>{formatDate(order.scheduledDate)}</Text>
              </View>
              <View style={styles.detailChip}>
                <Ionicons name="card-outline" size={14} color={COLORS.primary} />
                <Text style={styles.detailText}>
                  {order.paymentMethod
                    ? t(`booking.paymentMethods.${order.paymentMethod}`, {
                        defaultValue: order.paymentMethod,
                      })
                    : 'N/A'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {order.specialInstructions && !isCompact && (
          <View style={styles.instructions}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.warning} />
            <Text style={styles.instructionsText} numberOfLines={2}>
              {t(`orders.special.${order.id}`, { defaultValue: order.specialInstructions })}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.viewTrack}>{t('orders.viewTracking', 'View tracking')}</Text>
          <View style={styles.chevronWrap}>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 18,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  compactContainer: {
    marginBottom: SPACING.sm,
  },
  accentBar: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  orderInfo: {
    flex: 1,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  idIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderId: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  date: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginLeft: 30,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    gap: 4,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  content: {
    marginBottom: SPACING.sm,
  },
  amount: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  address: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
    marginBottom: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  instructionsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewTrack: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
