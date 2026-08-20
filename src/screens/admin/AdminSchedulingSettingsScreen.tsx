/**
 * Admin — working days/hours and booking limits.
 * API: GET/PUT /admin/job-scheduling/working-hours
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import TimeSelectField from '../../components/common/TimeSelectField';
import type { SchedulingSettings, Weekday } from '../../types/scheduling';
import {
  getAdminWorkingHours,
  getDefaultWorkingHoursSettings,
  saveAdminWorkingHours,
} from '../../services/adminJobSchedulingService';

const AdminSchedulingSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const dayLabel = (day: Weekday) => t(`admin.scheduling.hours.days.${day}`);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SchedulingSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSettings(await getAdminWorkingHours());
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : t('admin.scheduling.hours.loadFailed');
      setLoadError(message);
      setSettings(getDefaultWorkingHoursSettings());
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleDay = (day: Weekday) => {
    if (!settings) return;
    setSettings({
      ...settings,
      workingDays: settings.workingDays.map((d) =>
        d.day === day ? { ...d, enabled: !d.enabled } : d
      ),
    });
  };

  const setDayHours = (day: Weekday, field: 'startTime' | 'endTime', value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      workingDays: settings.workingDays.map((d) =>
        d.day === day ? { ...d, [field]: value } : d
      ),
    });
  };

  const validate = (): string | null => {
    if (!settings) return t('admin.scheduling.hours.notLoaded');
    for (const d of settings.workingDays) {
      if (!d.enabled) continue;
      if (!/^\d{2}:\d{2}$/.test(d.startTime.trim()) || !/^\d{2}:\d{2}$/.test(d.endTime.trim())) {
        return t('admin.scheduling.hours.selectTimes', { day: dayLabel(d.day) });
      }
      if (d.startTime >= d.endTime) {
        return t('admin.scheduling.hours.endAfterStart', { day: dayLabel(d.day) });
      }
    }
    if (settings.maxBookingsPerSlot < 1 || settings.maxBookingsPerDay < 1) {
      return t('admin.scheduling.hours.limitsMin');
    }
    return null;
  };

  const handleSave = async () => {
    if (!settings) return;
    const error = validate();
    if (error) {
      Alert.alert(t('admin.scheduling.hours.invalid'), error);
      return;
    }
    setSaving(true);
    try {
      const res = await saveAdminWorkingHours(settings);
      setSettings(res.data);
      Alert.alert(
        t('admin.scheduling.hours.saved'),
        res.message || t('admin.scheduling.hours.savedBody')
      );
    } catch (e: unknown) {
      Alert.alert(
        t('common.error'),
        e instanceof Error ? e.message : t('admin.scheduling.hours.saveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.scheduling.hours.title')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loadError ? (
          <View style={styles.warnBanner}>
            <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
            <Text style={styles.warnText}>
              {t('admin.scheduling.hours.loadWarn', { error: loadError })}
            </Text>
          </View>
        ) : null}

        <View style={styles.introCard}>
          <Ionicons name="time" size={20} color={COLORS.primary} />
          <Text style={styles.introText}>{t('admin.scheduling.hours.intro')}</Text>
        </View>

        <Text style={styles.section}>{t('admin.scheduling.hours.sectionDays')}</Text>
        <View style={styles.panel}>
        {settings.workingDays.map((d) => (
          <View key={d.day} style={[styles.dayRow, d.enabled && styles.dayRowOn]}>
            <Switch
              value={d.enabled}
              onValueChange={() => toggleDay(d.day)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '55' }}
              thumbColor={d.enabled ? COLORS.primary : '#f4f3f4'}
            />
            <Text style={[styles.dayLabel, !d.enabled && styles.muted]}>{dayLabel(d.day)}</Text>
            <TimeSelectField
              compact
              value={d.startTime}
              disabled={!d.enabled}
              onChange={(v) => setDayHours(d.day, 'startTime', v)}
              placeholder={t('admin.scheduling.hours.start')}
            />
            <Text style={styles.to}>–</Text>
            <TimeSelectField
              compact
              value={d.endTime}
              disabled={!d.enabled}
              onChange={(v) => setDayHours(d.day, 'endTime', v)}
              placeholder={t('admin.scheduling.hours.end')}
            />
          </View>
        ))}
        </View>

        <Text style={styles.section}>{t('admin.scheduling.hours.sectionLimits')}</Text>
        <View style={styles.panel}>
        <View style={styles.limitCard}>
          <View style={styles.limitIcon}>
            <Ionicons name="albums-outline" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.limitLabel}>{t('admin.scheduling.hours.maxPerSlot')}</Text>
          <TextInput
            style={styles.numInput}
            keyboardType="number-pad"
            value={String(settings.maxBookingsPerSlot)}
            onChangeText={(v) =>
              setSettings({
                ...settings,
                maxBookingsPerSlot: Math.max(1, parseInt(v || '1', 10) || 1),
              })
            }
          />
        </View>
        <View style={styles.limitCard}>
          <View style={styles.limitIcon}>
            <Ionicons name="today-outline" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.limitLabel}>{t('admin.scheduling.hours.maxPerDay')}</Text>
          <TextInput
            style={styles.numInput}
            keyboardType="number-pad"
            value={String(settings.maxBookingsPerDay)}
            onChangeText={(v) =>
              setSettings({
                ...settings,
                maxBookingsPerDay: Math.max(1, parseInt(v || '1', 10) || 1),
              })
            }
          />
        </View>
        <View style={[styles.limitCard, styles.limitCardLast]}>
          <View style={styles.limitIcon}>
            <Ionicons name="hourglass-outline" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.limitLabel}>{t('admin.scheduling.hours.buffer')}</Text>
          <TextInput
            style={styles.numInput}
            keyboardType="number-pad"
            value={String(settings.bufferMinutesBetweenJobs)}
            onChangeText={(v) =>
              setSettings({
                ...settings,
                bufferMinutesBetweenJobs: Math.max(0, parseInt(v || '0', 10) || 0),
              })
            }
          />
        </View>
        </View>

        <Button title={t('admin.scheduling.hours.save')} onPress={() => void handleSave()} loading={saving} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.sm },
  warnBanner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.warning + '18',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  warnText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 20 },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '22',
  },
  introText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text, lineHeight: 20 },
  section: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  panel: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayRowOn: { backgroundColor: COLORS.primary + '08' },
  dayLabel: { width: 36, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  muted: { color: COLORS.textSecondary },
  to: { color: COLORS.textSecondary },
  limitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  limitCardLast: { borderBottomWidth: 0 },
  limitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  limitLabel: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text, paddingRight: SPACING.md },
  numInput: {
    width: 64,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 8,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    backgroundColor: COLORS.surfaceLight,
  },
});

export default AdminSchedulingSettingsScreen;
