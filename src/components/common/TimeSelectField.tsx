/**
 * Tap-to-select time from predefined HH:mm options (no free typing).
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  SCHEDULING_TIME_OPTIONS,
  formatTimeOptionLabel,
  withCurrentTimeOption,
} from '../../utils/schedulingTimeOptions';

type Props = {
  value: string;
  onChange: (next: string) => void;
  options?: string[];
  /** Show 12h label in the field (value stored as HH:mm). */
  showAmPm?: boolean;
  formatLabel?: (value: string) => string;
  sheetTitle?: string;
  disabled?: boolean;
  placeholder?: string;
  style?: object;
  /** Compact field for dense rows */
  compact?: boolean;
};

const TimeSelectField: React.FC<Props> = ({
  value,
  onChange,
  options = SCHEDULING_TIME_OPTIONS,
  showAmPm = true,
  formatLabel,
  sheetTitle = 'Select time',
  disabled = false,
  placeholder = 'Select time',
  style,
  compact = false,
}) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const list = useMemo(() => withCurrentTimeOption(options, value), [options, value]);

  const labelFor = (v: string) => {
    if (formatLabel) return formatLabel(v);
    if (showAmPm) return formatTimeOptionLabel(v);
    return v;
  };

  const display = value ? labelFor(value) : placeholder;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.field,
          compact && styles.fieldCompact,
          disabled && styles.fieldDisabled,
          style,
        ]}
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        activeOpacity={0.75}
        disabled={disabled}
      >
        <Text
          style={[styles.fieldText, !value && styles.placeholder, disabled && styles.textDisabled]}
          numberOfLines={1}
        >
          {display}
        </Text>
        <Ionicons
          name="chevron-down"
          size={compact ? 14 : 16}
          color={disabled ? COLORS.border : COLORS.textSecondary}
        />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{sheetTitle}</Text>
          <FlatList
            data={list}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const selected = item === value;
              return (
                <TouchableOpacity
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {labelFor(item)}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.background,
    minHeight: 44,
  },
  fieldCompact: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.sm,
  },
  fieldDisabled: {
    opacity: 0.45,
  },
  fieldText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  placeholder: {
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.regular,
  },
  textDisabled: {
    color: COLORS.textSecondary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    width: '100%',
    maxHeight: '55%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingTop: SPACING.sm,
    // iOS shadow + Android elevation for a more "card sheet" feel
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  sheetTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: 2,
    flexGrow: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    minHeight: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  optionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '18',
  },
  optionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default TimeSelectField;
