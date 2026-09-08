import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TrackTimelineItem } from '../../services/orderService';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS } from '../../constants';

interface TrackingTimelineProps {
  timeline: TrackTimelineItem[];
}

function normalizeKey(value?: string | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ timeline }) => {
  const { t, i18n } = useTranslation();
  if (!timeline?.length) return null;

  const translateTimelineLabel = (step: TrackTimelineItem): string => {
    const key = normalizeKey(step.key) || normalizeKey(step.label);
    const candidates = [
      `orders.status.${key}`,
      `vendorOrders.${key}`,
    ];
    for (const statusKey of candidates) {
      if (key && i18n.exists(statusKey)) return t(statusKey);
    }
    return step.label || key || '—';
  };

  const translateTimelineDescription = (step: TrackTimelineItem): string | null => {
    if (!step.description?.trim()) return null;
    const key = normalizeKey(step.key) || normalizeKey(step.label);
    const msgKey = `orders.messages.${key}`;
    if (key && i18n.exists(msgKey)) return t(msgKey);

    const descNorm = step.description.trim().toLowerCase();
    if (descNorm.includes('preparing') && i18n.exists('orders.messages.processing')) {
      return t('orders.messages.processing');
    }
    if (
      (descNorm.includes('out for delivery') || descNorm.includes('otp')) &&
      i18n.exists('orders.messages.shipped')
    ) {
      return t('orders.messages.shipped');
    }
    if (descNorm.includes('ready') && i18n.exists('orders.messages.completed')) {
      return t('orders.messages.completed');
    }
    if (descNorm.includes('delivered') && i18n.exists('orders.messages.delivered')) {
      return t('orders.messages.delivered');
    }
    if (descNorm.includes('confirm') && i18n.exists('orders.messages.confirmed')) {
      return t('orders.messages.confirmed');
    }
    return step.description;
  };

  return (
    <View style={styles.wrap}>
      {timeline.map((step, index) => {
        const isLast = index === timeline.length - 1;
        const done = step.completed;
        const lineActive = done;
        const desc = translateTimelineDescription(step);

        return (
          <View key={step.key || String(index)} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dotOuter,
                  done ? styles.dotOuterDone : styles.dotOuterPending,
                ]}
              >
                <Ionicons
                  name={done ? 'checkmark' : 'ellipse-outline'}
                  size={done ? 14 : 18}
                  color={done ? COLORS.background : COLORS.textSecondary}
                />
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.connector,
                    lineActive ? styles.connectorActive : styles.connectorInactive,
                  ]}
                />
              )}
            </View>
            <View style={styles.body}>
              <Text style={[styles.label, done ? styles.labelDone : styles.labelPending]}>
                {translateTimelineLabel(step)}
              </Text>
              {desc ? (
                <Text style={styles.desc} numberOfLines={3}>
                  {desc}
                </Text>
              ) : null}
              {step.timestamp ? (
                <Text style={styles.time}>{step.timestamp}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 56,
  },
  rail: {
    width: 36,
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  dotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dotOuterDone: {
    backgroundColor: COLORS.success,
  },
  dotOuterPending: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  connector: {
    width: 3,
    height: 40,
    marginTop: 4,
    borderRadius: 2,
  },
  connectorActive: {
    backgroundColor: COLORS.success,
  },
  connectorInactive: {
    backgroundColor: COLORS.border,
  },
  body: {
    flex: 1,
    paddingBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginBottom: 4,
  },
  labelDone: {
    color: COLORS.success,
  },
  labelPending: {
    color: COLORS.textSecondary,
  },
  desc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  time: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
});
