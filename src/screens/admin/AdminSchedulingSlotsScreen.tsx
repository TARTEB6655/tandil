/**
 * Admin — configure bookable time slots (API).
 * List:   GET    /admin/job-scheduling/time-slots
 * Add:    POST   /admin/job-scheduling/time-slots
 * Toggle: POST   /admin/job-scheduling/time-slots/{id}/toggle
 * Delete: DELETE /admin/job-scheduling/time-slots/{id}
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import TimeSelectField from '../../components/common/TimeSelectField';
import type { TimeSlotConfig } from '../../types/scheduling';
import {
  addAdminTimeSlot,
  deleteAdminTimeSlot,
  getAdminTimeSlots,
  toggleAdminTimeSlot,
} from '../../services/adminTimeSlotsService';
import { SCHEDULING_DURATION_OPTIONS } from '../../utils/schedulingTimeOptions';

const AdminSchedulingSlotsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlotConfig[]>([]);
  const [newStart, setNewStart] = useState('18:00');
  const [newDuration, setNewDuration] = useState('60');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSlots(await getAdminTimeSlots());
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.scheduling.slots.loadFailed'));
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleSlot = async (id: string) => {
    if (togglingId) return;
    const prev = slots;
    // Optimistic UI
    setSlots((list) =>
      list.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x))
    );
    setTogglingId(id);
    try {
      const updated = await toggleAdminTimeSlot(id);
      if (updated) {
        setSlots((list) => list.map((x) => (x.id === id ? updated : x)));
      } else {
        await load();
      }
    } catch (e: unknown) {
      setSlots(prev);
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.scheduling.slots.toggleFailed'));
    } finally {
      setTogglingId(null);
    }
  };

  const removeSlot = (id: string) => {
    Alert.alert(t('admin.scheduling.slots.removeTitle'), t('admin.scheduling.slots.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (deletingId) return;
            setDeletingId(id);
            try {
              await deleteAdminTimeSlot(id);
              setSlots((list) => list.filter((s) => s.id !== id));
            } catch (e: unknown) {
              Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.scheduling.slots.deleteFailed'));
            } finally {
              setDeletingId(null);
            }
          })();
        },
      },
    ]);
  };

  const addSlot = async () => {
    const start = newStart.trim();
    if (!start) {
      Alert.alert(t('admin.scheduling.slots.selectTime'), t('admin.scheduling.slots.selectTimeBody'));
      return;
    }
    if (slots.some((s) => s.startTime === start)) {
      Alert.alert(t('admin.scheduling.slots.duplicate'), t('admin.scheduling.slots.duplicateBody'));
      return;
    }
    const durationMinutes = Math.max(15, parseInt(newDuration || '60', 10) || 60);
    setAdding(true);
    try {
      await addAdminTimeSlot({
        start_time: start,
        duration_minutes: durationMinutes,
        is_active: 1,
      });
      setNewStart('18:00');
      await load();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.scheduling.slots.addFailed'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.scheduling.slots.title')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.introCard}>
            <Ionicons name="grid" size={20} color={COLORS.primary} />
            <Text style={styles.hint}>{t('admin.scheduling.slots.intro')}</Text>
          </View>

          {slots.length === 0 ? (
            <Text style={styles.empty}>{t('admin.scheduling.slots.empty')}</Text>
          ) : null}

          {slots.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={[styles.chip, s.enabled && styles.chipOn]}>
                <Ionicons
                  name={s.enabled ? 'time' : 'time-outline'}
                  size={18}
                  color={s.enabled ? COLORS.primary : COLORS.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chipTitle, s.enabled && styles.chipTitleOn]}>
                    {s.label}
                  </Text>
                  <Text style={styles.chipMeta}>
                    {s.startTime} · {t('admin.scheduling.slots.durationLabel', { minutes: s.durationMinutes })}
                    {s.enabled ? '' : ` · ${t('admin.scheduling.slots.off')}`}
                  </Text>
                </View>
                {togglingId === s.id ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={styles.toggleBusy} />
                ) : (
                  <Switch
                    value={s.enabled}
                    onValueChange={() => void toggleSlot(s.id)}
                    trackColor={{ false: COLORS.border, true: COLORS.primary + '55' }}
                    thumbColor={s.enabled ? COLORS.primary : '#f4f3f4'}
                    ios_backgroundColor={COLORS.border}
                  />
                )}
              </View>
              <TouchableOpacity
                onPress={() => removeSlot(s.id)}
                hitSlop={10}
                style={[styles.trash, deletingId === s.id && { opacity: 0.5 }]}
                disabled={deletingId === s.id || togglingId === s.id}
              >
                {deletingId === s.id ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                )}
              </TouchableOpacity>
            </View>
          ))}

          <Text style={styles.section}>{t('admin.scheduling.slots.addSection')}</Text>
          <View style={styles.addCard}>
          <View style={styles.addRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('admin.scheduling.slots.start')}</Text>
              <TimeSelectField
                value={newStart}
                onChange={setNewStart}
                placeholder={t('admin.scheduling.slots.start')}
                sheetTitle={t('admin.scheduling.slots.slotStart')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('admin.scheduling.slots.duration')}</Text>
              <TimeSelectField
                value={newDuration}
                onChange={setNewDuration}
                options={SCHEDULING_DURATION_OPTIONS.map(String)}
                showAmPm={false}
                formatLabel={(v) => t('admin.scheduling.slots.durationLabel', { minutes: v })}
                sheetTitle={t('admin.scheduling.slots.duration')}
                placeholder={t('admin.scheduling.slots.duration')}
              />
            </View>
          </View>
          <Button
            title={t('admin.scheduling.slots.add')}
            onPress={() => void addSlot()}
            loading={adding}
            disabled={adding}
            style={{ marginTop: SPACING.md }}
          />
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '22',
    marginBottom: SPACING.sm,
  },
  hint: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  empty: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  chipOn: { borderColor: COLORS.primary + '55', backgroundColor: COLORS.primary + '10' },
  chipTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
  },
  chipTitleOn: { color: COLORS.primary },
  chipMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  toggleBusy: { marginRight: 6 },
  trash: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.error + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: SPACING.lg,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  addCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  addRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-end' },
  label: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: 4 },
});

export default AdminSchedulingSlotsScreen;
