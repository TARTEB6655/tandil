import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { getSupervisorTeam, getSupervisorAssignments, assignSupervisorAssignment, SupervisorTeamMember, SupervisorAssignment } from '../../services/supervisorService';

const AssignTasksScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [teamMembers, setTeamMembers] = useState<SupervisorTeamMember[]>([]);
  const [assignments, setAssignments] = useState<SupervisorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [scheduleDate, setScheduleDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setTasksLoading(true);
      Promise.all([
        getSupervisorTeam(),
        getSupervisorAssignments({ per_page: 20 }),
      ])
        .then(([teamList, assignmentsResult]) => {
          if (!cancelled) {
            setTeamMembers(teamList ?? []);
            setAssignments(assignmentsResult.list ?? []);
            if (teamList?.length && selectedMemberId == null) setSelectedMemberId(teamList[0].id);
            else if (teamList?.length && !teamList.some((m) => m.id === selectedMemberId))
              setSelectedMemberId(teamList[0].id);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTeamMembers([]);
            setAssignments([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
            setTasksLoading(false);
          }
        });
      return () => { cancelled = true; };
    }, [])
  );

  const onDateChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setScheduleDate(date);
  };

  const renderTeamMember = ({ item }: { item: SupervisorTeamMember }) => {
    const isSelected = selectedMemberId === item.id;
    const isActive = (item.status || '').toLowerCase() === 'active';
    return (
      <TouchableOpacity
        style={[styles.teamCard, isSelected && styles.teamCardSelected]}
        onPress={() => setSelectedMemberId(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.teamCardAvatar}>
          <Text style={styles.teamCardAvatarText}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.teamCardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.teamCardId}>{item.employee_id}</Text>
        <View style={[styles.teamCardStatus, { backgroundColor: isActive ? COLORS.success + '18' : COLORS.warning + '18' }]}>
          <Text style={[styles.teamCardStatusText, { color: isActive ? COLORS.success : COLORS.warning }]}>
            {item.status || '—'}
          </Text>
        </View>
        <Text style={styles.teamCardTasks}>{t('supervisorDashboard.tasksLabel')}{item.tasks_display || '0/0'}</Text>
      </TouchableOpacity>
    );
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  const handleAssign = async (job: SupervisorAssignment) => {
    if (!selectedMemberId) {
      Alert.alert(t('assignTasksScreen.selectMemberTitle'), t('assignTasksScreen.selectMemberMessage'));
      return;
    }
    setAssigningId(job.id);
    try {
      const result = await assignSupervisorAssignment(job.id, selectedMemberId, scheduleDate);
      if (result.success) {
        const member = teamMembers.find((m) => m.id === selectedMemberId);
        const dateStr = dayjs(scheduleDate).format('MMM D, YYYY');
        Alert.alert(
          t('assignTasksScreen.assignedTitle'),
          t('assignTasksScreen.assignedMessage', { service: job.service_name, name: member?.name ?? 'technician', date: dateStr }),
          [{ text: t('common.ok'), onPress: () => {
            setAssignments((prev) => prev.filter((a) => a.id !== job.id));
          } }]
        );
      } else {
        Alert.alert(t('assignTasksScreen.assignFailedTitle'), result.message ?? t('assignTasksScreen.assignFailedMessage'));
      }
    } catch (e: any) {
      Alert.alert(
        t('assignTasksScreen.assignFailedTitle'),
        e?.response?.data?.message ?? e?.message ?? t('assignTasksScreen.assignFailedMessage')
      );
    } finally {
      setAssigningId(null);
    }
  };

  const renderTask = ({ item }: { item: SupervisorAssignment }) => (
    <View style={styles.taskCard}>
      <TouchableOpacity
        style={styles.taskCardContent}
        onPress={() => navigation.navigate('SupervisorAssignmentDetail' as never, { assignmentId: item.id } as never)}
        activeOpacity={0.8}
      >
        <View style={styles.taskIconWrap}>
          <Ionicons name="leaf" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.taskContent}>
          <Text style={styles.taskTitle}>{item.service_name}</Text>
          <Text style={styles.taskMeta}>{t('assignTasksScreen.duration')} {formatDuration(item.duration_minutes)}</Text>
          {item.title ? <Text style={styles.taskSub} numberOfLines={1}>{item.title}</Text> : null}
          {item.location ? <Text style={styles.taskLocation} numberOfLines={1}>{item.location}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.assignBtn, (!selectedMemberId || assigningId === item.id) && styles.assignBtnDisabled]}
        onPress={() => handleAssign(item)}
        disabled={!selectedMemberId || assigningId === item.id}
        activeOpacity={0.8}
      >
        {assigningId === item.id ? (
          <ActivityIndicator size="small" color={COLORS.background} />
        ) : (
          <Text style={styles.assignBtnText}>{t('assignTasksScreen.assign')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('assignTasksScreen.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Fixed top: schedule + team members – always visible */}
      <View style={styles.topSection}>
        <View style={styles.scheduleCard}>
          <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
          <View style={styles.scheduleContent}>
            <Text style={styles.scheduleLabel}>{t('assignTasksScreen.scheduleFor')}</Text>
            <TouchableOpacity
              style={styles.scheduleDateBtn}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.scheduleDateText}>{dayjs(scheduleDate).format('dddd, MMM D, YYYY')}</Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={scheduleDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}
        {Platform.OS === 'ios' && showDatePicker && (
          <TouchableOpacity style={styles.datePickerDone} onPress={() => setShowDatePicker(false)}>
            <Text style={styles.datePickerDoneText}>{t('assignTasksScreen.done')}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>{t('assignTasksScreen.teamMembers')}</Text>
        {loading ? (
          <View style={styles.teamLoading}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.teamLoadingText}>{t('assignTasksScreen.loadingTeam')}</Text>
          </View>
        ) : teamMembers.length === 0 ? (
          <View style={styles.teamEmpty}>
            <Text style={styles.teamEmptyText}>{t('assignTasksScreen.emptyTeam')}</Text>
          </View>
        ) : (
          <FlatList
            data={teamMembers}
            renderItem={renderTeamMember}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.teamListContent}
          />
        )}
      </View>

      {/* Scrollable: Available Tasks only */}
      <Text style={[styles.sectionTitle, styles.taskListSectionTitle]}>{t('assignTasksScreen.availableTasks')}</Text>
      {tasksLoading ? (
        <View style={styles.tasksLoadingBox}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.teamLoadingText}>{t('assignTasksScreen.loadingTasks')}</Text>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.tasksEmptyBox}>
          <Text style={styles.teamEmptyText}>{t('assignTasksScreen.emptyTasks')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.taskScroll}
          contentContainerStyle={styles.taskScrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {assignments.map((item) => (
            <View key={item.id}>
              {renderTask({ item })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  headerSpacer: { width: 40 },
  topSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scheduleContent: { flex: 1, marginLeft: SPACING.md },
  scheduleLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  scheduleDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleDateText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  datePickerDone: {
    alignSelf: 'flex-end',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  datePickerDoneText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  taskListSectionTitle: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  taskScroll: {
    flex: 1,
  },
  taskScrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  tasksLoadingBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  tasksEmptyBox: {
    flex: 1,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  teamLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  teamLoadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  teamEmpty: {
    paddingVertical: SPACING.lg,
  },
  teamEmptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  teamListContent: {
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  teamCard: {
    width: 160,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  teamCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  teamCardAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  teamCardAvatarText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  teamCardName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  teamCardId: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  teamCardStatus: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: 2,
  },
  teamCardStatusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  teamCardTasks: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  taskList: { gap: SPACING.sm },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  taskCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  taskContent: { flex: 1 },
  taskTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  taskMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  taskSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    marginTop: 2,
  },
  taskLocation: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  assignBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  assignBtnDisabled: {
    opacity: 0.5,
  },
  assignBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
});

export default AssignTasksScreen;
