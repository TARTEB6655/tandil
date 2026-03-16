import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { submitSupervisorLeaveRequest, getSupervisorLeaveRequests, SupervisorLeaveRequest } from '../../services/supervisorService';

const DAY_IDS = [
  { id: 'monday', shortKey: 'mon' },
  { id: 'tuesday', shortKey: 'tue' },
  { id: 'wednesday', shortKey: 'wed' },
  { id: 'thursday', shortKey: 'thu' },
  { id: 'friday', shortKey: 'fri' },
  { id: 'saturday', shortKey: 'sat' },
  { id: 'sunday', shortKey: 'sun' },
];

const LEAVE_TYPES = [
  { value: 'sick_leave', apiValue: 'sick', labelKey: 'technician.vacation.leaveType.sickLeave' },
  { value: 'annual_leave', apiValue: 'annual', labelKey: 'technician.vacation.leaveType.annualLeave' },
  { value: 'unpaid_leave', apiValue: 'unpaid', labelKey: 'technician.vacation.leaveType.unpaidLeave' },
  { value: 'paternity_leave', apiValue: 'paternity', labelKey: 'technician.vacation.leaveType.paternityLeave' },
  { value: 'other', apiValue: 'other', labelKey: 'technician.vacation.leaveType.other' },
] as const;

function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const SupervisorAvailabilityScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [availableDays, setAvailableDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [reason, setReason] = useState('');
  const [leaves, setLeaves] = useState<SupervisorLeaveRequest[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [leavesRefreshing, setLeavesRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<'start' | 'end' | null>(null);
  const [pickerValue, setPickerValue] = useState<Date>(new Date());
  const [leaveTypeModalVisible, setLeaveTypeModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = useCallback(async (isRefresh = false) => {
    if (isRefresh) setLeavesRefreshing(true);
    else setLeavesLoading(true);
    try {
      const res = await getSupervisorLeaveRequests({ per_page: 50 });
      if (res?.success && Array.isArray(res.data)) {
        setLeaves(res.data);
      } else {
        setLeaves([]);
      }
    } catch {
      setLeaves([]);
    } finally {
      setLeavesLoading(false);
      setLeavesRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeaves();
    }, [fetchLeaves])
  );

  const onRefreshLeaves = useCallback(() => {
    fetchLeaves(true);
  }, [fetchLeaves]);

  const toggleDay = (dayId: string) => {
    setAvailableDays(prev =>
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    );
  };

  const addLeave = async () => {
    if (!startDate.trim()) {
      Alert.alert(t('technician.error', 'Error'), t('technician.vacation.pleaseSelectStartDate', 'Please select start date.'));
      return;
    }
    if (!endDate.trim()) {
      Alert.alert(t('technician.error', 'Error'), t('technician.vacation.pleaseSelectEndDate', 'Please select end date.'));
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      Alert.alert(t('technician.error', 'Error'), t('technician.vacation.endDateAfterStart', 'End date must be on or after start date.'));
      return;
    }
    if (!leaveType) {
      Alert.alert(t('technician.error', 'Error'), t('supervisor.availability.leaveTypeRequired', 'Leave type is required.'));
      return;
    }
    const apiLeaveType = LEAVE_TYPES.find(l => l.value === leaveType)?.apiValue ?? leaveType;
    const workingDaysStr = availableDays
      .map(id => DAY_IDS.find(d => d.id === id)?.shortKey)
      .filter(Boolean)
      .join(',');
    setSubmitting(true);
    try {
      const res = await submitSupervisorLeaveRequest({
        leave_type: apiLeaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || undefined,
        working_days: workingDaysStr || undefined,
      });
      if (res?.success) {
        setStartDate('');
        setEndDate('');
        setLeaveType('');
        setReason('');
        fetchLeaves(true);
        Alert.alert(t('supervisor.availability.savedTitle', 'Saved'), t('supervisor.availability.leaveRequestSubmitted', 'Leave request submitted successfully.'));
      } else {
        Alert.alert(t('technician.error', 'Error'), res?.message || 'Failed to submit leave request.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit leave request.';
      Alert.alert(t('technician.error', 'Error'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  const removeLeave = (index: number) => {
    setLeaves(prev => prev.filter((_, i) => i !== index));
  };

  const getLeaveTypeLabel = (apiLeaveType: string) => {
    const found = LEAVE_TYPES.find(l => l.apiValue === apiLeaveType);
    return found ? t(found.labelKey) : apiLeaveType;
  };

  const getStatusStyle = (status: string) => {
    if (status === 'approved') return { bg: COLORS.success + '20', color: COLORS.success };
    if (status === 'rejected') return { bg: COLORS.error + '20', color: COLORS.error };
    return { bg: COLORS.warning + '20', color: COLORS.warning };
  };

  const openStartPicker = () => {
    setPickerValue(startDate ? new Date(startDate + 'T12:00:00') : new Date());
    setPickerOpen('start');
  };

  const openEndPicker = () => {
    setPickerValue(endDate ? new Date(endDate + 'T12:00:00') : new Date());
    setPickerOpen('end');
  };

  const handlePickerChange = (event: any, selectedDate: Date | undefined) => {
    if (event.type === 'dismissed') {
      setPickerOpen(null);
      return;
    }
    if (selectedDate) {
      setPickerValue(selectedDate);
      if (Platform.OS === 'android') {
        const formatted = formatDateToYYYYMMDD(selectedDate);
        if (pickerOpen === 'start') setStartDate(formatted);
        else setEndDate(formatted);
        setPickerOpen(null);
      }
    }
  };

  const handlePickerDone = () => {
    const formatted = formatDateToYYYYMMDD(pickerValue);
    if (pickerOpen === 'start') setStartDate(formatted);
    else setEndDate(formatted);
    setPickerOpen(null);
  };

  const handleSave = () => {
    Alert.alert(
      t('supervisor.availability.savedTitle', 'Saved'),
      t('supervisor.availability.savedMessage', 'Your availability and leave requests have been updated.'),
      [{ text: t('common.ok', 'OK') }]
    );
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('supervisor.availability.title', 'Availability & Leave')}</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>{t('technician.availability.save', 'Save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={leavesRefreshing} onRefresh={onRefreshLeaves} colors={[COLORS.primary]} />
        }
      >
        {/* Availability – which days */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>{t('supervisor.availability.workingDays', 'Working days')}</Text>
              <Text style={styles.sectionSubtitle}>{t('supervisor.availability.workingDaysHint', 'Select the days you are available. (Required)')}</Text>
            </View>
          </View>
          <View style={styles.daysRow}>
            {DAY_IDS.map(day => {
              const isSelected = availableDays.includes(day.id);
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                  onPress={() => toggleDay(day.id)}
                >
                  <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                    {t(`technician.availability.days.${day.shortKey}`, day.shortKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            <Text style={styles.summaryText}>
              {availableDays.length} {t('supervisor.availability.daysSelected', 'days selected')}
            </Text>
          </View>
        </View>

        {/* Request leave */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="leaf-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>{t('supervisor.availability.requestLeave', 'Request leave')}</Text>
              <Text style={styles.sectionSubtitle}>{t('supervisor.availability.requestLeaveHint', 'Add leave with type and reason. (Leave type is required)')}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('technician.vacation.startDate', 'Start date')} *</Text>
            <TouchableOpacity style={styles.inputRow} onPress={openStartPicker}>
              <Text style={[styles.inputRowValue, !startDate && styles.inputRowPlaceholder]}>
                {startDate || t('technician.selectDate', 'Select date')}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>

            <Text style={styles.cardLabel}>{t('technician.vacation.endDate', 'End date')} *</Text>
            <TouchableOpacity style={styles.inputRow} onPress={openEndPicker}>
              <Text style={[styles.inputRowValue, !endDate && styles.inputRowPlaceholder]}>
                {endDate || t('technician.selectDate', 'Select date')}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>

            {/* Date picker modal – shows when user taps start or end date */}
          {pickerOpen !== null && (
            <Modal visible transparent animationType="slide">
              <TouchableOpacity
                style={styles.dateModalOverlay}
                activeOpacity={1}
                onPress={() => setPickerOpen(null)}
              >
                <View style={styles.dateModalContent} onStartShouldSetResponder={() => true}>
                  <Text style={styles.dateModalTitle}>
                    {pickerOpen === 'start'
                      ? t('technician.vacation.startDate', 'Start date')
                      : t('technician.vacation.endDate', 'End date')}
                  </Text>
                  <View style={styles.datePickerContainer}>
                    <DateTimePicker
                      value={pickerValue}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handlePickerChange}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.dateModalDone}
                    onPress={handlePickerDone}
                  >
                    <Text style={styles.dateModalDoneText}>{t('technician.done', 'Done')}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          )}

            <Text style={styles.cardLabel}>{t('technician.vacation.typeOfLeave', 'Type of leave')} *</Text>
            <TouchableOpacity style={styles.inputRow} onPress={() => setLeaveTypeModalVisible(true)}>
              <Text style={[styles.inputRowValue, !leaveType && styles.inputRowPlaceholder]}>
                {leaveType
                  ? (LEAVE_TYPES.find(l => l.value === leaveType) ? t(LEAVE_TYPES.find(l => l.value === leaveType)!.labelKey) : leaveType)
                  : t('technician.vacation.selectLeaveType', 'Select type of leave')}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
            </TouchableOpacity>

            <Text style={styles.cardLabel}>{t('technician.vacation.reasonOptional', 'Reason (optional)')}</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder={t('supervisor.availability.reasonPlaceholder', 'Reason for leave')}
              placeholderTextColor={COLORS.textSecondary}
              value={reason}
              onChangeText={setReason}
              multiline
            />

            <TouchableOpacity
              style={[styles.addLeaveBtn, submitting && styles.addLeaveBtnDisabled]}
              onPress={addLeave}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.background} />
              ) : (
                <Ionicons name="add" size={22} color={COLORS.background} />
              )}
              <Text style={styles.addLeaveBtnText}>{t('supervisor.availability.addLeave', 'Add leave request')}</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={leaveTypeModalVisible} transparent animationType="fade">
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLeaveTypeModalVisible(false)}>
              <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                <Text style={styles.modalTitle}>{t('technician.vacation.typeOfLeave', 'Type of leave')}</Text>
                <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator>
                  {LEAVE_TYPES.map(item => (
                    <TouchableOpacity
                      key={item.value}
                      style={styles.modalOption}
                      onPress={() => {
                        setLeaveType(item.value);
                        setLeaveTypeModalVisible(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{t(item.labelKey)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setLeaveTypeModalVisible(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* List of leaves – from GET /supervisor/leave-requests */}
          <Text style={styles.listTitle}>{t('supervisor.availability.yourLeaves', 'Your leave requests')} ({leaves.length})</Text>
          {leavesLoading && leaves.length === 0 ? (
            <View style={styles.emptyCard}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.emptyText}>{t('technician.loading', 'Loading...')}</Text>
            </View>
          ) : leaves.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={40} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>{t('supervisor.availability.noLeaves', 'No leave requests added yet.')}</Text>
            </View>
          ) : (
            leaves.map((leave, index) => {
              const statusStyle = getStatusStyle(leave.status);
              const statusLabel = leave.status === 'approved' ? (t('technician.leaveStatus.approved') || 'Approved') : leave.status === 'rejected' ? (t('technician.leaveStatus.rejected') || 'Rejected') : (t('technician.leaveStatus.pending') || 'Pending');
              return (
                <View key={leave.id} style={styles.leaveCard}>
                  <View style={styles.leaveCardContent}>
                    <View style={styles.leaveCardHeader}>
                      <Text style={styles.leaveDates}>{leave.start_date} – {leave.end_date}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>{statusLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.leaveTypeText}>{getLeaveTypeLabel(leave.leave_type)}</Text>
                    {leave.duration_days != null ? (
                      <Text style={styles.leaveMeta}>{leave.duration_days} {leave.duration_days === 1 ? 'day' : 'days'}</Text>
                    ) : null}
                    {leave.reason ? <Text style={styles.leaveReason}>{leave.reason}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => removeLeave(index)} style={styles.removeBtn}>
                    <Ionicons name="trash-outline" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.sm },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  saveBtn: { padding: SPACING.sm },
  saveBtnText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxl },

  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  sectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  sectionTitleWrap: { flex: 1 },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  dayChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  dayChipSelected: {
    backgroundColor: COLORS.primary + '18',
    borderColor: COLORS.primary,
  },
  dayChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  dayChipTextSelected: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  summaryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.medium,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  inputRowValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  inputRowPlaceholder: {
    color: COLORS.textSecondary,
  },
  reasonInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addLeaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  addLeaveBtnText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  addLeaveBtnDisabled: {
    opacity: 0.7,
  },

  listTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  leaveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  leaveCardContent: { flex: 1 },
  leaveCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  leaveDates: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  leaveTypeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 4,
  },
  leaveMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leaveReason: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  removeBtn: { padding: SPACING.sm },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: 380,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalScroll: { maxHeight: 280 },
  modalScrollContent: { paddingBottom: SPACING.sm },
  modalOption: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalOptionText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  modalCancel: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: FONT_SIZES.md, color: COLORS.primary },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  dateModalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  datePickerContainer: {
    minHeight: 200,
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  dateModalDone: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  dateModalDoneText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default SupervisorAvailabilityScreen;
