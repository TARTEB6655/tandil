import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';

function getGreetingKey(): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'greetingMorning';
  if (hour < 17) return 'greetingAfternoon';
  return 'greetingEvening';
}

const HRManagerDashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const hrManager = {
    id: 'hr_001',
    employeeId: 'HR-4001',
    name: 'Mariam Al Hashimi',
    email: 'mariam.hashimi@tandil.com',
    phone: '+971 50 333 4444',
    role: 'HR Manager',
    totalEmployees: 48,
    newHires: 5,
    pendingLeaves: 8,
  };

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

  const leaveRequests = [
    {
      id: 'leave_001',
      employeeId: 'EMP-1005',
      employeeName: 'Mohammed Ali',
      leaveType: 'Sick Leave',
      duration: '2 days',
      startDate: '2024-01-20',
      status: 'pending',
    },
    {
      id: 'leave_002',
      employeeId: 'SUP-2003',
      employeeName: 'Ali Rashid',
      leaveType: 'Annual Leave',
      duration: '5 days',
      startDate: '2024-01-25',
      status: 'pending',
    },
  ];

  const scheduleAssignments = [
    {
      id: 'schedule_001',
      date: 'Today',
      totalVisits: 24,
      assigned: 20,
      unassigned: 4,
    },
    {
      id: 'schedule_002',
      date: 'Tomorrow',
      totalVisits: 28,
      assigned: 15,
      unassigned: 13,
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
          <Text style={styles.employeePosition}>{item.position}</Text>
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

  const renderLeaveRequest = ({ item }: { item: any }) => (
    <View style={styles.leaveCard}>
      <View style={styles.leaveHeader}>
        <View>
          <Text style={styles.leaveName}>{item.employeeName}</Text>
          <Text style={styles.leaveEmployeeId}>{item.employeeId}</Text>
        </View>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>{t('admin.hrManagerDashboard.pending')}</Text>
        </View>
      </View>
      <Text style={styles.leaveType}>{item.leaveType} • {item.duration}</Text>
      <Text style={styles.leaveDate}>From: {item.startDate}</Text>
      <View style={styles.leaveActions}>
        <TouchableOpacity 
          style={styles.approveButton}
          onPress={() => {
            Alert.alert(
              t('admin.hrManagerDashboard.approveLeaveTitle'),
              t('admin.hrManagerDashboard.approveLeaveConfirm', { type: item.leaveType, name: item.employeeName, id: item.employeeId }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('admin.hrManagerDashboard.approve'),
                  onPress: () => {
                    Alert.alert(t('admin.hrManagerDashboard.successTitle'), t('admin.hrManagerDashboard.leaveApproved', { name: item.employeeName }));
                  }
                },
              ]
            );
          }}
        >
          <Ionicons name="checkmark" size={16} color={COLORS.background} />
          <Text style={styles.approveText}>{t('admin.hrManagerDashboard.approve')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.rejectButton}
          onPress={() => {
            Alert.alert(
              t('admin.hrManagerDashboard.rejectLeaveTitle'),
              t('admin.hrManagerDashboard.rejectLeaveConfirm', { type: item.leaveType, name: item.employeeName, id: item.employeeId }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('admin.hrManagerDashboard.reject'),
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(t('admin.hrManagerDashboard.leaveRejectedTitle'), t('admin.hrManagerDashboard.leaveRejectedMessage', { name: item.employeeName }));
                  }
                },
              ]
            );
          }}
        >
          <Ionicons name="close" size={16} color={COLORS.background} />
          <Text style={styles.rejectText}>{t('admin.hrManagerDashboard.reject')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSchedule = ({ item }: { item: any }) => (
    <View style={styles.scheduleCard}>
      <Text style={styles.scheduleDate}>
        {item.date === 'Today' ? t('admin.hrManagerDashboard.today') : item.date === 'Tomorrow' ? t('admin.hrManagerDashboard.tomorrow') : item.date}
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Good afternoon!</Text>
            <Text style={styles.managerName}>{hrManager.name}</Text>
            <Text style={styles.managerRole}>{hrManager.role}</Text>
            <Text style={styles.managerId}>ID: {hrManager.employeeId}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Main' as never, { screen: 'ProfileTab' } as never)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{hrManager.name.charAt(0)}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{hrManager.totalEmployees}</Text>
            <Text style={styles.statLabel}>{t('admin.hrManagerDashboard.totalStaff')}</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="person-add-outline" size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{hrManager.newHires}</Text>
            <Text style={styles.statLabel}>{t('admin.hrManagerDashboard.newHires')}</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color={COLORS.warning} />
            <Text style={styles.statValue}>{hrManager.pendingLeaves}</Text>
            <Text style={styles.statLabel}>{t('admin.hrManagerDashboard.leaveRequests')}</Text>
          </View>
        </View>

        {/* Leave Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.hrManagerDashboard.pendingLeaveRequests')}</Text>
            <Text style={styles.sectionCount}>{leaveRequests.length}</Text>
          </View>
          
          <FlatList
            data={leaveRequests}
            renderItem={renderLeaveRequest}
            keyExtractor={(item) => item.id}
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
              onPress={() => {
                Alert.alert(
                  t('admin.hrManagerDashboard.assignVisitsTitle'),
                  t('admin.hrManagerDashboard.assignVisitsMessage'),
                  [{ text: t('common.ok') }]
                );
              }}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="clipboard-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('admin.hrManagerDashboard.assignVisits')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => {
                Alert.alert(
                  t('admin.hrManagerDashboard.reportsTitle'),
                  t('admin.hrManagerDashboard.reportsMessage'),
                  [{ text: t('common.ok') }]
                );
              }}
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

