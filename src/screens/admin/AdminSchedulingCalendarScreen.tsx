/**
 * Admin — scheduled jobs calendar (day / week / month).
 * GET /admin/job-scheduling/calendar?view=&date=
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import type { CalendarViewMode, ScheduledJob } from '../../types/scheduling';
import { getAdminJobCalendar } from '../../services/adminJobCalendarService';
import { formatDisplayDate, isoDateOffset } from '../../services/schedulingMockService';
import { formatTimeOptionLabel } from '../../utils/schedulingTimeOptions';

function todayIso(): string {
  return isoDateOffset(0);
}

function weekRangeLabel(anchor: string, locale: string): string {
  const start = new Date(anchor + 'T12:00:00');
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${formatDisplayDate(fmt(start), locale)} – ${formatDisplayDate(fmt(end), locale)}`;
}

function monthRangeLabel(anchor: string, locale: string): string {
  const d = new Date(anchor + 'T12:00:00');
  return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

const AdminSchedulingCalendarScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const dateLocale =
    i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'ur' ? 'ur-PK' : 'en-US';
  const [mode, setMode] = useState<CalendarViewMode>('day');
  const [anchor, setAnchor] = useState(todayIso());
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const list = await getAdminJobCalendar({ view: mode, date: anchor });
        setJobs(list);
      } catch (e: unknown) {
        setJobs([]);
        Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.scheduling.calendar.loadFailed'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode, anchor, t]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const shiftAnchor = (delta: number) => {
    const d = new Date(anchor + 'T12:00:00');
    if (mode === 'day') d.setDate(d.getDate() + delta);
    else if (mode === 'week') d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setAnchor(iso);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduledJob[]>();
    for (const j of jobs) {
      const list = map.get(j.date) || [];
      list.push(j);
      map.set(j.date, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [jobs]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return COLORS.primary;
      case 'pending':
        return COLORS.warning;
      case 'cancelled':
      case 'rejected':
        return COLORS.error;
      case 'completed':
        return COLORS.success;
      case 'in_progress':
        return COLORS.info;
      default:
        return COLORS.info;
    }
  };

  const rangeTitle =
    mode === 'day'
      ? formatDisplayDate(anchor, dateLocale)
      : mode === 'week'
        ? weekRangeLabel(anchor, dateLocale)
        : monthRangeLabel(anchor, dateLocale);

  const modeLabel = (m: CalendarViewMode) => t(`admin.scheduling.calendar.${m}`);
  const statusLabel = (status: string) =>
    t(`admin.scheduling.calendar.status.${status}`, {
      defaultValue: status.replace(/_/g, ' '),
    });

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.scheduling.calendar.title')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.toolbar}>
        {(['day', 'week', 'month'] as CalendarViewMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeChip, mode === m && styles.modeChipOn]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>
              {modeLabel(m)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity onPress={() => shiftAnchor(-1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.rangeLabel}>{rangeTitle}</Text>
        <TouchableOpacity onPress={() => shiftAnchor(1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load({ silent: true });
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
        ) : grouped.length === 0 ? (
          <Text style={styles.empty}>{t('admin.scheduling.calendar.empty')}</Text>
        ) : (
          grouped.map(([date, dayJobs]) => (
            <View key={date} style={styles.dayBlock}>
              <Text style={styles.dayTitle}>{formatDisplayDate(date, dateLocale)}</Text>
              {dayJobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={[styles.jobCard, job.overlapsTechnician && styles.jobCardOverlap]}
                  onPress={() =>
                    navigation.navigate('AdminJobBookingDetail', {
                      jobId: job.id,
                      job,
                    })
                  }
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.jobAccent,
                      { backgroundColor: statusColor(job.status) },
                    ]}
                  />
                  <View style={styles.jobBody}>
                  <View style={styles.jobTop}>
                    <Text style={styles.jobTime}>
                      {formatTimeOptionLabel(job.startTime)} – {formatTimeOptionLabel(job.endTime)}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: statusColor(job.status) + '22' },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: statusColor(job.status) }]}>
                        {statusLabel(job.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.jobService}>{job.serviceName}</Text>
                  <Text style={styles.jobMeta}>
                    {job.customerName}
                    {job.technicianName ? ` · ${job.technicianName}` : ''}
                  </Text>
                  {job.overlapsTechnician ? (
                    <View style={styles.overlapRow}>
                      <Ionicons name="warning" size={14} color={COLORS.error} />
                      <Text style={styles.overlapText}>{t('admin.scheduling.calendar.overlap')}</Text>
                    </View>
                  ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  toolbar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  modeChipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  modeText: { color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.semiBold },
  modeTextOn: { color: COLORS.background },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeLabel: {
    flex: 1,
    textAlign: 'center',
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
  },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xl },
  dayBlock: { gap: SPACING.sm },
  dayTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  jobCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  jobCardOverlap: { borderColor: COLORS.error, backgroundColor: '#FEF2F2' },
  jobAccent: { width: 5 },
  jobBody: { flex: 1, padding: SPACING.md, gap: 4 },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobTime: { fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  jobService: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  jobMeta: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  overlapRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  overlapText: { fontSize: FONT_SIZES.xs, color: COLORS.error, fontWeight: FONT_WEIGHTS.semiBold },
});

export default AdminSchedulingCalendarScreen;
