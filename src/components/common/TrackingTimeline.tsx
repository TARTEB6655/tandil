import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TrackTimelineItem } from '../../services/orderService';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS } from '../../constants';

interface TrackingTimelineProps {
  timeline: TrackTimelineItem[];
}

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ timeline }) => {
  if (!timeline?.length) return null;

  return (
    <View style={styles.wrap}>
      {timeline.map((step, index) => {
        const isLast = index === timeline.length - 1;
        const done = step.completed;
        const lineActive = done;

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
                {step.label}
              </Text>
              {step.description ? (
                <Text style={styles.desc} numberOfLines={3}>
                  {step.description}
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
