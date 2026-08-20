/**
 * Admin — block dates or specific time slots.
 * Add: POST /admin/job-scheduling/blocked-dates (form-data)
 * Date is selected via calendar picker (not typed).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import TimeSelectField from '../../components/common/TimeSelectField';
import type { BlockedPeriod } from '../../types/scheduling';
import {
  addAdminBlockedDate,
  deleteAdminBlockedDate,
  getAdminBlockedDates,
} from '../../services/adminBlockedDatesService';
import { formatDisplayDate, isoDateOffset } from '../../services/schedulingMockService';
import { formatTimeOptionLabel } from '../../utils/schedulingTimeOptions';

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string): Date {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const fallback = new Date();
    fallback.setHours(12, 0, 0, 0);
    return fallback;
  }
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return d;
}

const AdminSchedulingBlocksScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const dateLocale =
    i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'ur' ? 'ur-PK' : 'en-US';
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<BlockedPeriod[]>([]);
  const [date, setDate] = useState(isoDateOffset(5));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reason, setReason] = useState('');
  const [slotStart, setSlotStart] = useState('11:00');
  const [mode, setMode] = useState<'date' | 'slot'>('date');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedDateObj = useMemo(() => parseIsoDate(date), [date]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch a wide window so upcoming + recent blocks show in the list
      setBlocks(
        await getAdminBlockedDates({
          from: isoDateOffset(-30),
          to: isoDateOffset(180),
        })
      );
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.scheduling.blocks.loadFailed'));
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type !== 'set' || !selected) return;
    }
    if (selected) {
      setDate(toIsoDate(selected));
    }
  };

  const handleAdd = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert(t('admin.scheduling.blocks.selectDate'), t('admin.scheduling.blocks.selectDateBody'));
      return;
    }
    if (mode === 'slot' && !slotStart.trim()) {
      Alert.alert(t('admin.scheduling.blocks.selectTime'), t('admin.scheduling.blocks.selectTimeBody'));
      return;
    }

    setSaving(true);
    try {
      await addAdminBlockedDate({
        date: date.trim(),
        block_type: mode === 'slot' ? 'time_slot' : 'full_day',
        time: mode === 'slot' ? slotStart.trim() : undefined,
        reason: reason.trim() || undefined,
      });
      setReason('');
      await load();
      Alert.alert(t('admin.scheduling.blocks.addedTitle'), t('admin.scheduling.blocks.addedBody'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.scheduling.blocks.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (id: string) => {
    Alert.alert(t('admin.scheduling.blocks.removeTitle'), t('admin.scheduling.blocks.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.scheduling.blocks.remove'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (deletingId) return;
            setDeletingId(id);
            try {
              await deleteAdminBlockedDate(id);
              setBlocks((prev) => prev.filter((b) => b.id !== id));
            } catch (e: unknown) {
              Alert.alert(
                t('common.error'),
                e instanceof Error ? e.message : t('admin.scheduling.blocks.deleteFailed')
              );
            } finally {
              setDeletingId(null);
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.scheduling.blocks.title')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
        <View style={styles.modeRow}>
          {(['date', 'slot'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeChip, mode === m && styles.modeChipOn]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>
                {m === 'date' ? t('admin.scheduling.blocks.fullDay') : t('admin.scheduling.blocks.timeSlot')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t('admin.scheduling.blocks.date')}</Text>
        <TouchableOpacity
          style={styles.dateField}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
          <Text style={styles.dateFieldText}>{formatDisplayDate(date, dateLocale)}</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {showDatePicker ? (
          <DateTimePicker
            value={selectedDateObj}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        ) : null}
        {Platform.OS === 'ios' && showDatePicker ? (
          <TouchableOpacity style={styles.datePickerDone} onPress={() => setShowDatePicker(false)}>
            <Text style={styles.datePickerDoneText}>{t('common.done')}</Text>
          </TouchableOpacity>
        ) : null}

        {mode === 'slot' ? (
          <>
            <Text style={styles.label}>{t('admin.scheduling.blocks.slotStart')}</Text>
            <TimeSelectField
              value={slotStart}
              onChange={setSlotStart}
              placeholder={t('admin.scheduling.blocks.slotStartPlaceholder')}
              sheetTitle={t('admin.scheduling.blocks.slotStart')}
            />
          </>
        ) : null}

        <Text style={styles.label}>{t('admin.scheduling.blocks.reason')}</Text>
        <TextInput
          style={styles.input}
          value={reason}
          onChangeText={setReason}
          placeholder={t('admin.scheduling.blocks.reasonPlaceholder')}
        />

        <Button
          title={t('admin.scheduling.blocks.add')}
          onPress={() => void handleAdd()}
          loading={saving}
          disabled={saving}
        />
        </View>

        <Text style={styles.section}>{t('admin.scheduling.blocks.current')}</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : blocks.length === 0 ? (
          <Text style={styles.empty}>{t('admin.scheduling.blocks.empty')}</Text>
        ) : (
          blocks.map((b) => (
            <View key={b.id} style={styles.blockCard}>
              <View style={[styles.blockIcon, b.type === 'slot' && styles.blockIconSlot]}>
                <Ionicons
                  name={b.type === 'slot' ? 'time' : 'close-circle'}
                  size={18}
                  color={b.type === 'slot' ? '#2B8AE0' : COLORS.error}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.blockTitle}>
                  {formatDisplayDate(b.date, dateLocale)}
                  {b.type === 'slot' && b.startTime
                    ? ` · ${formatTimeOptionLabel(b.startTime)}`
                    : ` · ${t('admin.scheduling.blocks.fullDay')}`}
                </Text>
                {b.reason ? <Text style={styles.blockReason}>{b.reason}</Text> : null}
              </View>
              <TouchableOpacity
                onPress={() => handleRemove(b.id)}
                hitSlop={10}
                disabled={deletingId === b.id}
                style={deletingId === b.id ? { opacity: 0.5 } : undefined}
              >
                {deletingId === b.id ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  formCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  modeRow: { flexDirection: 'row', gap: SPACING.sm },
  modeChip: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
  },
  modeChipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  modeText: { color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.semiBold },
  modeTextOn: { color: COLORS.background },
  label: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.surfaceLight,
    minHeight: 44,
  },
  dateFieldText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  datePickerDone: {
    alignSelf: 'flex-end',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  datePickerDoneText: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
  },
  section: {
    marginTop: SPACING.lg,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  empty: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  blockIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.error + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockIconSlot: { backgroundColor: '#2B8AE0' + '18' },
  blockTitle: { fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  blockReason: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
});

export default AdminSchedulingBlocksScreen;
