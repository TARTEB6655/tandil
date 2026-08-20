/**
 * Admin — view / reschedule / update a booking.
 * PUT /admin/job-scheduling/jobs/{visit_id} (form-data)
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
  Modal,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Button } from '../../components/common/Button';
import TimeSelectField from '../../components/common/TimeSelectField';
import type { ScheduledJob } from '../../types/scheduling';
import { updateAdminJobBooking } from '../../services/adminJobCalendarService';
import { adminService, type AdminTechnician } from '../../services/adminService';
import { formatDisplayDate, getScheduledJobById } from '../../services/schedulingMockService';
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
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
}

const AdminJobBookingDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const dateLocale =
    i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'ur' ? 'ur-PK' : 'en-US';
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const jobId = String(route.params?.jobId || '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<ScheduledJob | null>(null);
  const [date, setDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [technicianId, setTechnicianId] = useState<string | null>(null);
  const [technicianName, setTechnicianName] = useState('');
  const [notes, setNotes] = useState('');
  const [technicians, setTechnicians] = useState<AdminTechnician[]>([]);
  const [techLoading, setTechLoading] = useState(false);
  const [techModalOpen, setTechModalOpen] = useState(false);
  const [techSearch, setTechSearch] = useState('');

  const selectedDateObj = useMemo(() => parseIsoDate(date), [date]);

  const applyJob = (row: ScheduledJob) => {
    setJob(row);
    setDate(row.date);
    setStartTime(row.startTime);
    setEndTime(row.endTime);
    setTechnicianId(row.technicianId ? String(row.technicianId) : null);
    setTechnicianName(row.technicianName || '');
    setNotes(row.notes || '');
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const passed = route.params?.job as ScheduledJob | undefined;
      let loaded: ScheduledJob | null = null;
      if (passed && String(passed.id) === jobId) {
        loaded = passed;
        applyJob(passed);
      } else {
        const row = await getScheduledJobById(jobId);
        loaded = row;
        if (row) applyJob(row);
        else setJob(null);
      }

      setTechLoading(true);
      const techRes = await adminService
        .getTechnicians({ per_page: 100, page: 1 })
        .catch(() => null);
      const list = techRes?.data ?? [];
      setTechnicians(list);
      setTechLoading(false);

      if (loaded && !loaded.technicianId && loaded.technicianName) {
        const match = list.find(
          (t) => t.name.trim().toLowerCase() === loaded!.technicianName!.trim().toLowerCase()
        );
        if (match) {
          setTechnicianId(String(match.id));
          setTechnicianName(match.name);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [jobId, route.params?.job]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filteredTechnicians = useMemo(() => {
    const q = techSearch.trim().toLowerCase();
    if (!q) return technicians;
    return technicians.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        String(t.employee_id || '')
          .toLowerCase()
          .includes(q) ||
        String(t.email || '')
          .toLowerCase()
          .includes(q)
    );
  }, [technicians, techSearch]);

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type !== 'set' || !selected) return;
    }
    if (selected) setDate(toIsoDate(selected));
  };

  const handleReschedule = async () => {
    if (!job) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert(t('admin.scheduling.booking.selectDate'), t('admin.scheduling.booking.selectDateBody'));
      return;
    }
    if (!startTime.trim() || !endTime.trim()) {
      Alert.alert(t('admin.scheduling.booking.selectTime'), t('admin.scheduling.booking.selectTimeBody'));
      return;
    }
    if (startTime.trim() >= endTime.trim()) {
      Alert.alert(t('admin.scheduling.booking.invalidTime'), t('admin.scheduling.booking.endAfterStart'));
      return;
    }

    setSaving(true);
    try {
      const updated = await updateAdminJobBooking(job.id, {
        date: date.trim(),
        start: startTime.trim(),
        end: endTime.trim(),
        technician_id: technicianId,
        internal_notes: notes.trim(),
      });

      if (updated) {
        applyJob({
          ...updated,
          status: 'rescheduled',
        });
      } else {
        applyJob({
          ...job,
          date: date.trim(),
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          technicianId,
          technicianName: technicianName || null,
          notes: notes.trim() || undefined,
          status: 'rescheduled',
        });
      }

      Alert.alert(
        t('admin.scheduling.booking.rescheduled'),
        t('admin.scheduling.booking.rescheduledBody'),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.scheduling.booking.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.empty}>{t('admin.scheduling.booking.notFound')}</Text>
        <Button title={t('admin.scheduling.booking.goBack')} onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.scheduling.booking.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.service}>{job.serviceName}</Text>
          <Text style={styles.meta}>{job.customerName}</Text>
          <Text style={styles.meta}>
            {t('admin.scheduling.booking.currently', {
              date: formatDisplayDate(job.date, dateLocale),
              time: `${formatTimeOptionLabel(job.startTime)}–${formatTimeOptionLabel(job.endTime)}`,
            })}
          </Text>
          {job.overlapsTechnician ? (
            <View style={styles.overlap}>
              <Ionicons name="warning" size={16} color={COLORS.error} />
              <Text style={styles.overlapText}>{t('admin.scheduling.booking.overlap')}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.label}>{t('admin.scheduling.booking.date')}</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
          <Text style={styles.selectFieldText}>
            {date ? formatDisplayDate(date, dateLocale) : t('admin.scheduling.booking.selectDate')}
          </Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
        {showDatePicker ? (
          <DateTimePicker
            value={selectedDateObj}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        ) : null}
        {Platform.OS === 'ios' && showDatePicker ? (
          <TouchableOpacity style={styles.datePickerDone} onPress={() => setShowDatePicker(false)}>
            <Text style={styles.datePickerDoneText}>{t('common.done')}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('admin.scheduling.booking.start')}</Text>
            <TimeSelectField
              value={startTime}
              onChange={setStartTime}
              placeholder={t('admin.scheduling.booking.start')}
              sheetTitle={t('admin.scheduling.booking.startTime')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('admin.scheduling.booking.end')}</Text>
            <TimeSelectField
              value={endTime}
              onChange={setEndTime}
              placeholder={t('admin.scheduling.booking.end')}
              sheetTitle={t('admin.scheduling.booking.endTime')}
            />
          </View>
        </View>

        <Text style={styles.label}>{t('admin.scheduling.booking.technician')}</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => setTechModalOpen(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="person-outline" size={18} color={COLORS.primary} />
          <Text
            style={[styles.selectFieldText, !technicianName && styles.placeholder]}
            numberOfLines={1}
          >
            {technicianName || t('admin.scheduling.booking.selectTechnician')}
          </Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.label}>{t('admin.scheduling.booking.notes')}</Text>
        <TextInput
          style={[styles.input, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder={t('admin.scheduling.booking.notesPlaceholder')}
        />

        <Button
          title={t('admin.scheduling.booking.reschedule')}
          onPress={() => void handleReschedule()}
          loading={saving}
          style={{ marginTop: SPACING.md }}
        />
      </ScrollView>

      <Modal
        visible={techModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTechModalOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setTechModalOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('admin.scheduling.booking.selectTechnician')}</Text>
          <TextInput
            style={styles.searchInput}
            value={techSearch}
            onChangeText={setTechSearch}
            placeholder={t('admin.scheduling.booking.searchTech')}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {techLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.lg }} />
          ) : (
            <FlatList
              data={filteredTechnicians}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <TouchableOpacity
                  style={[
                    styles.techOption,
                    !technicianId && styles.techOptionSelected,
                  ]}
                  onPress={() => {
                    setTechnicianId(null);
                    setTechnicianName('');
                    setTechModalOpen(false);
                  }}
                >
                  <Text style={styles.techName}>{t('admin.scheduling.booking.unassigned')}</Text>
                  {!technicianId ? (
                    <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              }
              ListEmptyComponent={
                <Text style={styles.emptyList}>{t('admin.scheduling.booking.noTechnicians')}</Text>
              }
              renderItem={({ item }) => {
                const selected = String(item.id) === String(technicianId);
                return (
                  <TouchableOpacity
                    style={[styles.techOption, selected && styles.techOptionSelected]}
                    onPress={() => {
                      setTechnicianId(String(item.id));
                      setTechnicianName(item.name);
                      setTechModalOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.techName, selected && styles.techNameSelected]}>
                        {item.name}
                      </Text>
                      <Text style={styles.techMeta}>
                        {item.employee_id ? `ID ${item.employee_id}` : item.email}
                        {item.zone?.name ? ` · ${item.zone.name}` : ''}
                      </Text>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  centered: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  empty: { color: COLORS.textSecondary, marginBottom: SPACING.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.xs },
  summary: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: 4,
  },
  service: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  meta: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  overlap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.sm,
    backgroundColor: '#FEF2F2',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  overlapText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.error },
  label: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.background,
    minHeight: 44,
  },
  selectFieldText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  placeholder: { color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.regular },
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
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    color: COLORS.text,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingTop: SPACING.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  sheetTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
  },
  techOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  techOptionSelected: { backgroundColor: COLORS.primary + '12' },
  techName: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  techNameSelected: { color: COLORS.primary },
  techMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  emptyList: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    padding: SPACING.lg,
  },
});

export default AdminJobBookingDetailScreen;
