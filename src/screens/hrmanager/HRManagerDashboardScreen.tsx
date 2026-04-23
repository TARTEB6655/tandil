import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { hrService, HRDashboardSummary, HRPendingLeaveRequest, HRVisitAssignmentsData } from '../../services/hrService';

function getGreetingKey(): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'greetingMorning';
  if (hour < 17) return 'greetingAfternoon';
  return 'greetingEvening';
}

function formatLeaveTypeLabel(leaveType: string, t: any): string {
  const map: Record<string, string> = {
    annual: t('admin.hrLeave.leaveTypes.annual', 'Annual Leave'),
    sick: t('admin.hrLeave.leaveTypes.sick', 'Sick Leave'),
    unpaid: t('admin.hrLeave.leaveTypes.unpaid', 'Unpaid Leave'),
    paternity: t('admin.hrLeave.leaveTypes.paternity', 'Paternity Leave'),
    other: t('admin.hrLeave.leaveTypes.other', 'Other'),
  };
  const key = (leaveType || '').toLowerCase().replace(/\s+/g, '_');
  return map[key] || leaveType;
}

function formatRoleLabel(role: string, t: any): string {
  const key = (role || '').toLowerCase().trim();
  if (key.includes('team leader') || key.includes('supervisor')) {
    return t('admin.hrEmployees.teamLeader', 'Team Leader');
  }
  if (key.includes('field worker') || key.includes('technician')) {
    return t('admin.hrEmployees.fieldWorker', 'Field Worker');
  }
  if (key.includes('area manager')) {
    return t('admin.hrEmployees.areaManager', 'Area Manager');
  }
  if (key.includes('hr')) {
    return t('admin.hrEmployees.hrStaff', 'HR Staff');
  }
  return role;
}

const HRManagerDashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<HRDashboardSummary | null>(null);
  const [visitAssignments, setVisitAssignments] = useState<HRVisitAssignmentsData>({
    today: { total: 0, assigned: 0, unassigned: 0 },
    tomorrow: { total: 0, assigned: 0, unassigned: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLeaveId, setActionLeaveId] = useState<number | null>(null);

  const fetchSummary = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const [summaryRes, visitRes] = await Promise.all([
        hrService.getDashboardSummary(),
        hrService.getVisitAssignments().catch(() => ({ success: false, data: null })),
      ]);
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      } else {
        setSummary(null);
        setError(t('admin.hrDashboard.failedToLoad', 'Failed to load dashboard'));
      }
      if (visitRes && visitRes.success && visitRes.data) {
        setVisitAssignments(visitRes.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || t('admin.hrDashboard.failedToLoad', 'Failed to load dashboard'));
      setSummary(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSummary();
    }, [fetchSummary])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSummary(false);
  }, [fetchSummary]);

  const removePendingLeave = useCallback((leaveId: number) => {
    setSummary(prev => {
      if (!prev) return prev;
      const next = prev.pending_leave_requests.filter(r => r.id !== leaveId);
      return { ...prev, pending_leave_requests: next };
    });
  }, []);

  const handleApproveLeave = useCallback(async (item: HRPendingLeaveRequest) => {
    setActionLeaveId(item.id);
    try {
      await hrService.approveLeaveRequest(item.id);
      removePendingLeave(item.id);
      Alert.alert(t('admin.hrManagerDashboard.successTitle'), t('admin.hrManagerDashboard.leaveApproved', { name: item.applicant_name }));
      fetchSummary(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('admin.hrLeave.failedToApprove', 'Failed to approve leave');
      Alert.alert(t('common.error') || 'Error', msg);
    } finally {
      setActionLeaveId(null);
    }
  }, [removePendingLeave, fetchSummary, t]);

  const handleRejectLeave = useCallback(async (item: HRPendingLeaveRequest) => {
    setActionLeaveId(item.id);
    try {
      await hrService.rejectLeaveRequest(item.id);
      removePendingLeave(item.id);
      Alert.alert(t('admin.hrManagerDashboard.leaveRejectedTitle'), t('admin.hrManagerDashboard.leaveRejectedMessage', { name: item.applicant_name }));
      fetchSummary(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('admin.hrLeave.failedToReject', 'Failed to reject leave');
      Alert.alert(t('common.error') || 'Error', msg);
    } finally {
      setActionLeaveId(null);
    }
  }, [removePendingLeave, fetchSummary, t]);

  const employees = [
    {
      id: 'emp_001',
      employeeId: 'EMP-1001',
      name: 'Ahmed Hassan',
      position: 'Field Worker',
      joiningDate: '2023-05-15',
      status: 'active',
      leaveBalance: 12,
    },
    {
      id: 'emp_002',
      employeeId: 'SUP-2001',
      name: 'Hassan Ahmed',
      position: 'Team Leader',
      joiningDate: '2022-08-10',
      status: 'active',
      leaveBalance: 8,
    },
    {
      id: 'emp_003',
      employeeId: 'EMP-1003',
      name: 'Omar Saeed',
      position: 'Field Worker',
      joiningDate: '2023-11-20',
      status: 'on_leave',
      leaveBalance: 15,
    },
  ];

  const scheduleAssignments = [
    {
      id: 'today',
      date: 'Today',
      totalVisits: visitAssignments.today.total,
      assigned: visitAssignments.today.assigned,
      unassigned: visitAssignments.today.unassigned,
    },
    {
      id: 'tomorrow',
      date: 'Tomorrow',
      totalVisits: visitAssignments.tomorrow.total,
      assigned: visitAssignments.tomorrow.assigned,
      unassigned: visitAssignments.tomorrow.unassigned,
    },
  ];

  const renderEmployee = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.employeeCard}>
      <View style={styles.employeeHeader}>
        <View style={styles.employeeAvatar}>
          <Text style={styles.employeeAvatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{item.name}</Text>
          <Text style={styles.employeeId}>{item.employeeId}</Text>
          <Text style={styles.employeePosition}>{formatRoleLabel(item.position, t)}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.status === 'active' ? COLORS.success + '20' : COLORS.warning + '20' }
        ]}>
          <Text style={[
            styles.statusText,
            { color: item.status === 'active' ? COLORS.success : COLORS.warning }
          ]}>
            {item.status === 'active' ? t('admin.hrManagerDashboard.active') : t('admin.hrManagerDashboard.onLeave')}
          </Text>
        </View>
      </View>
      <View style={styles.employeeDetails}>
        <Text style={styles.employeeDetailText}>{t('admin.hrManagerDashboard.joined', { date: item.joiningDate })}</Text>
        <Text style={styles.employeeDetailText}>{t('admin.hrManagerDashboard.leaveDays', { count: item.leaveBalance })}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderLeaveRequest = ({ item }: { item: HRPendingLeaveRequest }) => {
    const leaveTypeLabel = formatLeaveTypeLabel(item.leave_type, t);
    const duration = t('admin.hrLeave.daysCount', {
      count: item.duration_days,
      defaultValue: `${item.duration_days} ${item.duration_days === 1 ? 'day' : 'days'}`,
    });
    return (
      <View style={styles.leaveCard}>
        <View style={styles.leaveHeader}>
          <View>
            <Text style={styles.leaveName}>{item.applicant_name}</Text>
            <Text style={styles.leaveEmployeeId}>{item.applicant_id}</Text>
          </View>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{t('admin.hrManagerDashboard.pending')}</Text>
          </View>
        </View>
        <Text style={styles.leaveType}>{leaveTypeLabel} • {duration}</Text>
        <Text style={styles.leaveDate}>{t('admin.hrManagerDashboard.fromDate', { date: item.start_date, defaultValue: `From: ${item.start_date}` })}</Text>
        <View style={styles.leaveActions}>
          <TouchableOpacity
            style={[styles.approveButton, actionLeaveId === item.id && styles.leaveActionDisabled]}
            onPress={() => {
              Alert.alert(
                t('admin.hrManagerDashboard.approveLeaveTitle'),
                t('admin.hrManagerDashboard.approveLeaveConfirm', { type: leaveTypeLabel, name: item.applicant_name, id: item.applicant_id }),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('admin.hrManagerDashboard.approve'),
                    onPress: () => handleApproveLeave(item),
                  },
                ]
              );
            }}
            disabled={actionLeaveId !== null}
          >
            {actionLeaveId === item.id ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color={COLORS.background} />
                <Text style={styles.approveText}>{t('admin.hrManagerDashboard.approve')}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rejectButton, actionLeaveId === item.id && styles.leaveActionDisabled]}
            onPress={() => {
              Alert.alert(
                t('admin.hrManagerDashboard.rejectLeaveTitle'),
                t('admin.hrManagerDashboard.rejectLeaveConfirm', { type: leaveTypeLabel, name: item.applicant_name, id: item.applicant_id }),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('admin.hrManagerDashboard.reject'),
                    style: 'destructive',
                    onPress: () => handleRejectLeave(item),
                  },
                ]
              );
            }}
            disabled={actionLeaveId !== null}
          >
            {actionLeaveId === item.id ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <>
                <Ionicons name="close" size={16} color={COLORS.background} />
                <Text style={styles.rejectText}>{t('admin.hrManagerDashboard.reject')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSchedule = ({ item }: { item: any }) => (
    <View style={styles.scheduleCard}>
      <Text style={styles.scheduleDate}>
        {item.id === 'today'
          ? t('admin.hrManagerDashboard.today')
          : item.id === 'tomorrow'
          ? t('admin.hrManagerDashboard.tomorrow')
          : item.date}
      </Text>
      <View style={styles.scheduleStats}>
        <View style={styles.scheduleStatItem}>
          <Text style={styles.scheduleStatValue}>{item.totalVisits}</Text>
          <Text style={styles.scheduleStatLabel}>{t('admin.hrManagerDashboard.totalVisits')}</Text>
        </View>
        <View style={styles.scheduleStatItem}>
          <Text style={[styles.scheduleStatValue, { color: COLORS.success }]}>{item.assigned}</Text>
          <Text style={styles.scheduleStatLabel}>{t('admin.hrManagerDashboard.assigned')}</Text>
        </View>
        <View style={styles.scheduleStatItem}>
          <Text style={[styles.scheduleStatValue, { color: COLORS.error }]}>{item.unassigned}</Text>
          <Text style={styles.scheduleStatLabel}>{t('admin.hrManagerDashboard.unassigned')}</Text>
        </View>
      </View>
    </View>
  );

  const pendingLeaves = summary?.pending_leave_requests ?? [];

  if (loading && !summary) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && !summary) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchSummary()}>
          <Text style={styles.retryButtonText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header – from GET /hr/dashboard/summary */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{t(`admin.hrManagerDashboard.${getGreetingKey()}`)}</Text>
            <Text style={styles.managerName}>{summary?.name ?? '—'}</Text>
            <Text style={styles.managerRole}>{summary?.role ?? '—'}</Text>
            <Text style={styles.managerId}>ID: {summary?.id ?? '—'}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Main' as never, { screen: 'ProfileTab' } as never)}
          >
            {summary?.profile_picture_url ? (
              <Image source={{ uri: summary.profile_picture_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(summary?.name ?? 'M').charAt(0)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Stats Cards – from API */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{summary?.total_staff ?? 0}</Text>
            <Text style={styles.statLabel}>{t('admin.hrManagerDashboard.totalStaff')}</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="person-add-outline" size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{summary?.new_hires ?? 0}</Text>
            <Text style={styles.statLabel}>{t('admin.hrManagerDashboard.newHires')}</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color={COLORS.warning} />
            <Text style={styles.statValue}>{summary?.leave_requests ?? 0}</Text>
            <Text style={styles.statLabel}>{t('admin.hrManagerDashboard.leaveRequests')}</Text>
          </View>
        </View>

        {/* Pending Leave Requests – from API */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.hrManagerDashboard.pendingLeaveRequests')}</Text>
            <Text style={styles.sectionCount}>{pendingLeaves.length}</Text>
          </View>

          <FlatList
            data={pendingLeaves}
            renderItem={renderLeaveRequest}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
          />
        </View>

        {/* Schedule Assignments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Assignments</Text>
          <FlatList
            data={scheduleAssignments}
            renderItem={renderSchedule}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>

        {/* Employees */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.hrManagerDashboard.employeeDirectory')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('EmployeeList' as never)}>
              <Text style={styles.viewAllText}>{t('admin.hrManagerDashboard.viewAll')}</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={employees}
            renderItem={renderEmployee}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.hrManagerDashboard.quickActions')}</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => navigation.navigate('AddEmployee')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="person-add-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('admin.hrManagerDashboard.addEmployee')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => navigation.navigate('ManageLeaves')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('admin.hrManagerDashboard.manageLeaves')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => navigation.navigate('HRAssignVisits')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="clipboard-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('admin.hrManagerDashboard.assignVisits')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => navigation.navigate('HRReports')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="stats-chart-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('admin.hrManagerDashboard.reports')}</Text>
            </TouchableOpacity>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  retryButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  header: {
    backgroundColor: COLORS.background,
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  managerName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  managerRole: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginTop: 2,
  },
  managerId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    padding: SPACING.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
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
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  viewAllText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  employeeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  employeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  employeeAvatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  employeeId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  employeePosition: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  employeeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  employeeDetailText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  leaveCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  leaveName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  leaveEmployeeId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  pendingBadge: {
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  pendingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
    fontWeight: FONT_WEIGHTS.medium,
  },
  leaveType: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  leaveDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  leaveActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  approveText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  leaveActionDisabled: {
    opacity: 0.7,
  },
  rejectText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  scheduleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  scheduleDate: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  scheduleStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scheduleStatItem: {
    alignItems: 'center',
  },
  scheduleStatValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  scheduleStatLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAction: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  quickActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    textAlign: 'center',
  },
});

export default HRManagerDashboardScreen;

