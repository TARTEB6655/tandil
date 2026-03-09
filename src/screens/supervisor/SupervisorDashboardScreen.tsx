import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { getSupervisorDashboardSummary, SupervisorDashboardSummaryData, getSupervisorReports, SupervisorReportItem, getSupervisorTeam, SupervisorTeamMember } from '../../services/supervisorService';

const DASHBOARD_REPORTS_LIMIT = 3;

function formatSubmittedAt(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
    if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    if (diffDays < 7) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning!';
  if (h < 17) return 'Good afternoon!';
  return 'Good evening!';
};

const SupervisorDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<SupervisorDashboardSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileImageError, setProfileImageError] = useState(false);
  const [reports, setReports] = useState<SupervisorReportItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<SupervisorTeamMember[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setProfileImageError(false);
      Promise.all([
        getSupervisorDashboardSummary(),
        getSupervisorReports(1, 20),
        getSupervisorTeam(),
      ])
        .then(([summaryData, reportsResult, teamList]) => {
          if (!cancelled) {
            setSummary(summaryData ?? null);
            setReports(reportsResult.list);
            setTeamMembers(teamList ?? []);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSummary(null);
            setReports([]);
            setTeamMembers([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [])
  );

  const supervisor = summary
    ? {
        name: summary.name,
        employeeId: summary.id,
        role: 'Team Leader',
        teamSize: summary.team_members,
        activeVisits: summary.active_visits,
        completedToday: summary.completed_visits,
        profilePictureUrl: summary.profile_picture_url || summary.profile_picture || null,
      }
    : {
        name: '—',
        employeeId: '—',
        role: 'Team Leader',
        teamSize: 0,
        activeVisits: 0,
        completedToday: 0,
        profilePictureUrl: null as string | null,
      };

  const teamPreview = teamMembers.slice(0, 3);
  const pendingReportsPreview = reports.slice(0, DASHBOARD_REPORTS_LIMIT);
  const pendingReportsTotal = reports.length;

  const renderTeamMember = ({ item }: { item: SupervisorTeamMember }) => {
    const isActive = (item.status || '').toLowerCase() === 'active';
    return (
      <TouchableOpacity
        style={styles.memberCard}
        onPress={() => navigation.navigate('SupervisorTeamMemberDetail' as never, { technicianId: item.id } as never)}
        activeOpacity={0.7}
      >
        <View style={styles.memberHeader}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.name}</Text>
            <Text style={styles.memberEmployeeId}>{item.employee_id}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: isActive ? COLORS.success + '20' : COLORS.warning + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: isActive ? COLORS.success : COLORS.warning }
            ]}>
              {item.status || '—'}
            </Text>
          </View>
        </View>
        <Text style={styles.memberTask}>{item.current_activity || '—'}</Text>
        <View style={styles.memberStats}>
          <Text style={styles.memberStatText}>
            Tasks: {item.tasks_display || `${item.tasks_completed}/${item.tasks_total}`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPendingReport = ({ item }: { item: SupervisorReportItem }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => navigation.navigate('SupervisorReport', { reportId: item.id })}
    >
      <View style={styles.reportHeader}>
        <View>
          <Text style={styles.reportTechName}>{item.technician_name}</Text>
          <Text style={styles.reportEmployeeId}>ID: {item.employee_id}</Text>
        </View>
        {item.has_photos ? (
          <Ionicons name="images" size={20} color={COLORS.primary} />
        ) : null}
      </View>
      <Text style={styles.reportCustomer}>{item.location}</Text>
      <Text style={styles.reportService}>{item.service}</Text>
      <Text style={styles.reportTime}>{formatSubmittedAt(item.submitted_at)}</Text>
      <View style={styles.reportAction}>
        <Text style={styles.reviewButtonText}>Review Report →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header – from GET /api/supervisor/dashboard/summary */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            {loading && !summary ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.sm }} />
            ) : (
              <>
                <Text style={styles.supervisorName}>{supervisor.name}</Text>
                <Text style={styles.supervisorRole}>{supervisor.role} • ID: {supervisor.employeeId}</Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Main' as never, { screen: 'ProfileTab' } as never)}
          >
            <View style={styles.avatar}>
              {supervisor.profilePictureUrl && !profileImageError ? (
                <Image
                  source={{ uri: supervisor.profilePictureUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  cachePolicy="disk"
                  onError={() => setProfileImageError(true)}
                />
              ) : (
                <Text style={styles.avatarText}>{(supervisor.name || 'S').charAt(0).toUpperCase()}</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats Cards – team_members, active_visits, completed_visits */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{loading && !summary ? '—' : supervisor.teamSize}</Text>
            <Text style={styles.statLabel}>Team Members</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="clipboard-outline" size={24} color={COLORS.warning} />
            <Text style={styles.statValue}>{loading && !summary ? '—' : supervisor.activeVisits}</Text>
            <Text style={styles.statLabel}>Active Visits</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{loading && !summary ? '—' : supervisor.completedToday}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Pending Field Reports – first 3, View All shows rest on Reports tab */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Field Reports</Text>
            <TouchableOpacity
              style={styles.sectionCountRow}
              onPress={() => navigation.navigate('Main' as never, { screen: 'ReportsTab' } as never)}
            >
              <Text style={styles.sectionCount}>{pendingReportsTotal}</Text>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={pendingReportsPreview}
            renderItem={renderPendingReport}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
          />
        </View>

        {/* Team Members – first 3 from API, View All shows full list */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Team</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SupervisorTeamList' as never)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={teamPreview}
            renderItem={renderTeamMember}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Main' as never, { screen: 'ReportsTab' } as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>Review Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('AssignTasks' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>Assign Tasks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('TeamStats' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="stats-chart-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>Team Stats</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Main' as never, { screen: 'ProfileTab' } as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="person-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>Profile</Text>
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
  supervisorName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  supervisorRole: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginTop: 2,
  },
  profileButton: {
    padding: SPACING.sm,
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  sectionCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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
  reportCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  reportTechName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  reportEmployeeId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 2,
  },
  reportCustomer: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  reportService: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  reportTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  reportAction: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reviewButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  memberCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  memberAvatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  memberEmployeeId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
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
  memberTask: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  memberStats: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  memberStatText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
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

export default SupervisorDashboardScreen;

