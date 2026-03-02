import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  updateTechnicianAvailability,
  getTechnicianDashboard,
  getTechnicianAvailability,
  API_LABEL_TO_LEAVE_TYPE_VALUE,
} from '../../services/technicianService';

const DAY_TO_API: Record<string, string> = {
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
};

const API_TO_DAY: Record<string, string> = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
};

/** Normalize "12:00:00" -> "12:00" for break times */
function toHHmm(s: string): string {
  if (!s) return s;
  const part = s.split(':').slice(0, 2).join(':');
  return part.length >= 5 ? part : s;
}

const SLOT_IDS = [
  { id: 'morning', start: '09:00', end: '12:00' },
  { id: 'afternoon', start: '12:00', end: '17:00' },
  { id: 'evening', start: '17:00', end: '21:00' },
];

type AvailabilityParams = {
  breaks?: Array<{ date: string; start_time: string; end_time: string; reason?: string }>;
  vacations?: Array<{ id?: number; start_date: string; end_date: string; leave_type?: string; reason?: string }>;
  service_areas?: string[];
};

const SLOT_HOURS: Record<string, number> = { morning: 3, afternoon: 5, evening: 4 };

const DAY_IDS = [
  { id: 'monday', shortKey: 'mon' },
  { id: 'tuesday', shortKey: 'tue' },
  { id: 'wednesday', shortKey: 'wed' },
  { id: 'thursday', shortKey: 'thu' },
  { id: 'friday', shortKey: 'fri' },
  { id: 'saturday', shortKey: 'sat' },
  { id: 'sunday', shortKey: 'sun' },
];

const AvailabilityScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const [isOnline, setIsOnline] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [selectedDays, setSelectedDays] = useState(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
  const [slotEnabled, setSlotEnabled] = useState<Record<string, boolean>>({
    morning: true,
    afternoon: true,
    evening: false,
  });
  const [breaks, setBreaks] = useState<Array<{ date: string; start_time: string; end_time: string; reason?: string }>>([]);
  const [vacations, setVacations] = useState<Array<{ id?: number; start_date: string; end_date: string; leave_type?: string; reason?: string }>>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [weekStats, setWeekStats] = useState<{ availableDays: number; totalHours: number; completedJobs: number }>({
    availableDays: 0,
    totalHours: 0,
    completedJobs: 0,
  });

  const params = (route.params ?? {}) as AvailabilityParams;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (params.breaks != null) setBreaks(params.breaks);
    if (params.vacations != null) setVacations(params.vacations);
    if (params.service_areas != null) setServiceAreas(params.service_areas);
  }, [params.breaks, params.vacations, params.service_areas]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      setLoadingSchedule(true);
      getTechnicianAvailability()
        .then(data => {
          if (cancelled) return;
          const fromParams = paramsRef.current;
          if (data) {
            setIsOnline(data.is_online);
            setAutoAccept(data.auto_accept_jobs);
            const days = (data.working_days ?? [])
              .map(d => API_TO_DAY[d?.toLowerCase?.()] ?? d)
              .filter(Boolean);
            if (days.length > 0) setSelectedDays(days);
            const slots = (data.working_hours_slots ?? []).map(s => s.slot);
            setSlotEnabled(prev => {
              const next = { ...prev };
              SLOT_IDS.forEach(s => {
                next[s.id] = slots.includes(s.id);
              });
              return next;
            });
            const areas = data.service_areas?.length
              ? data.service_areas
              : data.service_area
                ? [data.service_area]
                : [];
            if (fromParams.service_areas == null) setServiceAreas(areas);
            if (fromParams.breaks == null) {
              setBreaks((data.breaks ?? []).map(b => ({
                date: b.date,
                start_time: toHHmm(b.start_time),
                end_time: toHHmm(b.end_time),
                reason: b.reason,
              })));
            }
            if (fromParams.vacations == null) {
              setVacations((data.vacations ?? []).map(v => ({
                ...(v.id != null && { id: v.id }),
                start_date: v.start_date,
                end_date: v.end_date,
                leave_type: v.leave_type ? (API_LABEL_TO_LEAVE_TYPE_VALUE[v.leave_type] ?? v.leave_type) : undefined,
                reason: v.reason ?? undefined,
              })));
            }
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingSchedule(false);
        });
      getTechnicianDashboard().then(dashboard => {
        if (cancelled) return;
        const completedJobs = dashboard?.weekly_kpis?.visits_done ?? 0;
        setWeekStats(prev => ({ ...prev, completedJobs }));
      });
      return () => { cancelled = true; };
    }, [])
  );

  useEffect(() => {
    const days = selectedDays.length;
    const hoursPerDay = SLOT_IDS.reduce((sum, s) => sum + (slotEnabled[s.id] ? (SLOT_HOURS[s.id] ?? 0) : 0), 0);
    setWeekStats(prev => ({ ...prev, availableDays: days, totalHours: days * hoursPerDay }));
  }, [selectedDays.length, slotEnabled]);

  const weekDays = DAY_IDS.map(d => ({
    id: d.id,
    short: t(`technician.availability.days.${d.shortKey}`),
  }));

  const handleDayToggle = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(day => day !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleTimeSlotToggle = (slotId: string) => {
    setSlotEnabled(prev => ({ ...prev, [slotId]: !prev[slotId] }));
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      const working_days = selectedDays.map(d => DAY_TO_API[d] ?? d).filter(Boolean);
      const working_hours_slots = SLOT_IDS.filter(s => slotEnabled[s.id]).map(s => ({
        slot: s.id,
        start: s.start,
        end: s.end,
      }));
      const result = await updateTechnicianAvailability({
        is_online: isOnline,
        auto_accept_jobs: autoAccept,
        working_days,
        working_hours_slots,
        ...(breaks.length > 0 && { breaks }),
        ...(vacations.length > 0 && { vacations }),
        service_areas: serviceAreas,
        ...(serviceAreas.length === 1 && { service_area: serviceAreas[0] }),
      });
      setSaving(false);
      if (result.success) {
        Alert.alert(t('technician.saved'), result.message ?? t('technician.availability.availabilitySaved'), [{ text: t('technician.ok') }]);
      } else {
        Alert.alert(t('technician.error'), result.message ?? t('technician.availability.saveFailed'));
      }
    } catch {
      setSaving(false);
      Alert.alert(t('technician.error'), t('technician.availability.saveFailed') + ' ' + t('technician.tryAgain'));
    }
  };

  const renderDayItem = (day: any) => (
    <TouchableOpacity
      key={day.id}
      style={[
        styles.dayItem,
        selectedDays.includes(day.id) && styles.dayItemActive
      ]}
      onPress={() => handleDayToggle(day.id)}
    >
      <Text style={[
        styles.dayLabel,
        selectedDays.includes(day.id) && styles.dayLabelActive
      ]}>
        {day.short}
      </Text>
    </TouchableOpacity>
  );

  const getSlotLabel = (id: string) => t(`technician.availability.${id}`);
  const getSlotTime = (id: string) => t(`technician.availability.${id}Time`);

  const renderTimeSlot = (slot: (typeof SLOT_IDS)[0]) => (
    <View key={slot.id} style={styles.timeSlotCard}>
      <View style={styles.timeSlotHeader}>
        <View>
          <Text style={styles.timeSlotLabel}>{getSlotLabel(slot.id)}</Text>
          <Text style={styles.timeSlotTime}>{getSlotTime(slot.id)}</Text>
        </View>
        <Switch
          value={slotEnabled[slot.id] ?? false}
          onValueChange={() => handleTimeSlotToggle(slot.id)}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          thumbColor={COLORS.background}
        />
      </View>
    </View>
  );

  if (loadingSchedule) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{t('technician.availability.loadingSchedule')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('technician.availability.title')}</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveSchedule}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.saveButtonText}>{t('technician.availability.save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Online Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.availability.onlineStatus')}</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusInfo}>
                <Ionicons name="wifi" size={24} color={COLORS.primary} />
                <View style={styles.statusText}>
                  <Text style={styles.statusTitle}>{t('technician.availability.goOnline')}</Text>
                  <Text style={styles.statusSubtitle}>{t('technician.availability.acceptNewJobRequests')}</Text>
                </View>
              </View>
              <Switch
                value={isOnline}
                onValueChange={setIsOnline}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            </View>
          </View>
        </View>

        {/* Auto Accept */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.availability.jobAcceptance')}</Text>
          <View style={styles.autoAcceptCard}>
            <View style={styles.autoAcceptHeader}>
              <View style={styles.autoAcceptInfo}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                <View style={styles.autoAcceptText}>
                  <Text style={styles.autoAcceptTitle}>{t('technician.availability.autoAcceptJobs')}</Text>
                  <Text style={styles.autoAcceptSubtitle}>{t('technician.availability.automaticallyAcceptJobRequests')}</Text>
                </View>
              </View>
              <Switch
                value={autoAccept}
                onValueChange={setAutoAccept}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            </View>
          </View>
        </View>

        {/* Working Days */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.availability.workingDays')}</Text>
          <View style={styles.daysContainer}>
            {weekDays.map(renderDayItem)}
          </View>
        </View>

        {/* Time Slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.availability.workingHours')}</Text>
          <View style={styles.timeSlotsContainer}>
            {SLOT_IDS.map(renderTimeSlot)}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.quickActions')}</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('SetBreakTime', { initialBreaks: breaks })}
            >
              <Ionicons name="time-outline" size={24} color={COLORS.primary} />
              <Text style={styles.quickActionText}>{t('technician.availability.setBreakTime')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('SetVacation', { initialVacations: vacations })}
            >
              <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
              <Text style={styles.quickActionText}>{t('technician.availability.setVacation')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('ServiceAreas', { initialServiceAreas: serviceAreas })}
            >
              <Ionicons name="location-outline" size={24} color={COLORS.primary} />
              <Text style={styles.quickActionText}>{t('technician.availability.serviceAreas')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="settings-outline" size={24} color={COLORS.primary} />
              <Text style={styles.quickActionText}>{t('technician.availability.advancedSettings')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics - from dashboard API and local availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.availability.thisWeek')}</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="calendar-outline" size={24} color={COLORS.success} />
              <Text style={styles.statValue}>{t('technician.availability.daysLabel', { count: weekStats.availableDays })}</Text>
              <Text style={styles.statLabel}>{t('technician.availability.available')}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={24} color={COLORS.primary} />
              <Text style={styles.statValue}>{t('technician.availability.hoursLabel', { count: weekStats.totalHours })}</Text>
              <Text style={styles.statLabel}>{t('technician.availability.totalHours')}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Ionicons name="construct-outline" size={24} color={COLORS.warning} />
              <Text style={styles.statValue}>{t('technician.availability.jobsLabel', { count: weekStats.completedJobs })}</Text>
              <Text style={styles.statLabel}>{t('technician.status.completed')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  saveButton: {
    padding: SPACING.sm,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
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
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: SPACING.md,
  },
  statusTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  statusSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  autoAcceptCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  autoAcceptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoAcceptInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoAcceptText: {
    marginLeft: SPACING.md,
  },
  autoAcceptTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  autoAcceptSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayItemActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  dayLabelActive: {
    color: COLORS.background,
  },
  timeSlotsContainer: {
    gap: SPACING.md,
  },
  timeSlotCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeSlotLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  timeSlotTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAction: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  quickActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});

export default AvailabilityScreen;
