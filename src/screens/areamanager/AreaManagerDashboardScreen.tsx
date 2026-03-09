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
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  getAreaManagerDashboardSummary,
  getAreaManagerDashboardAlerts,
  getAreaManagerTeamLeaders,
  AreaManagerDashboardSummary,
  AreaManagerDashboardAlert,
  AreaManagerTeamLeader,
} from '../../services/areaManagerService';

dayjs.extend(relativeTime);

function formatMonthlyRevenue(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `AED ${k % 1 === 0 ? k : k.toFixed(1)}K`;
  }
  return `AED ${value.toLocaleString()}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 17) return 'Good afternoon!';
  return 'Good evening!';
}

const STAT_CONFIG = [
  { key: 'total_farms' as const, label: 'Total Farms', icon: 'home-outline', color: COLORS.primary },
  { key: 'active_subscriptions' as const, label: 'Active Subscriptions', icon: 'calendar-outline', color: COLORS.success },
  { key: 'monthly_revenue' as const, label: 'Monthly Revenue', icon: 'trending-up-outline', color: COLORS.warning },
];

const AreaManagerDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<AreaManagerDashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<AreaManagerDashboardAlert[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<AreaManagerTeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      Promise.all([
        getAreaManagerDashboardSummary(),
        getAreaManagerDashboardAlerts(),
        getAreaManagerTeamLeaders(),
      ])
        .then(([summaryData, alertsData, teamLeadersData]) => {
          if (!cancelled) {
            setSummary(summaryData ?? null);
            setAlerts(Array.isArray(alertsData) ? alertsData : []);
            setTeamLeaders(Array.isArray(teamLeadersData) ? teamLeadersData : []);
            setError(summaryData ? null : 'Failed to load dashboard.');
          }
        })
        .catch(() => {
          if (!cancelled) setError('Failed to load dashboard.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [])
  );

  const regionStats = summary
    ? STAT_CONFIG.map((s) => ({
        label: s.label,
        value:
          s.key === 'monthly_revenue'
            ? formatMonthlyRevenue(summary.monthly_revenue)
            : String(summary[s.key]),
        icon: s.icon,
        color: s.color,
      }))
    : STAT_CONFIG.map((s) => ({ ...s, value: '—', label: s.label }));

  const teamLeadersOnDashboard = teamLeaders.slice(0, 3);

  const alertsOnDashboard = alerts.slice(0, 2);
  const formatAlertTime = (ts: string) => {
    try {
      return dayjs(ts).fromNow();
    } catch {
      return ts;
    }
  };

  const getAlertBorderColor = (type: string) => {
    if (type === 'warning') return COLORS.warning;
    if (type === 'success') return COLORS.success;
    return COLORS.info;
  };

  const getAlertIcon = (type: string) =>
    type === 'warning' ? 'warning-outline' : type === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline';
  const getAlertIconColor = (type: string) =>
    type === 'warning' ? COLORS.warning : type === 'success' ? COLORS.success : COLORS.info;

  const renderSupervisor = ({ item }: { item: AreaManagerTeamLeader }) => (
    <TouchableOpacity
      style={styles.supervisorCard}
      onPress={() => navigation.navigate('TeamLeaderDetail', { teamLeaderId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.supervisorHeader}>
        <View style={styles.supervisorAvatar}>
          {item.profile_picture_url ? (
            <Image
              source={{ uri: item.profile_picture_url }}
              style={styles.supervisorAvatarImage}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.supervisorAvatarText}>{item.initial || item.name.charAt(0)}</Text>
          )}
        </View>
        <View style={styles.supervisorInfo}>
          <Text style={styles.supervisorName}>{item.name}</Text>
          <Text style={styles.supervisorId}>{item.employee_id}</Text>
        </View>
        <View style={styles.performanceBadge}>
          <Text style={styles.performanceText}>{item.performance_percent}%</Text>
        </View>
      </View>
      <View style={styles.supervisorStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Team</Text>
          <Text style={styles.statValue}>{item.team}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={styles.statValue}>{item.active}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Done</Text>
          <Text style={styles.statValue}>{item.done}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAlert = ({ item, index }: { item: AreaManagerDashboardAlert; index: number }) => (
    <View style={[
      styles.alertCard,
      { borderLeftColor: getAlertBorderColor(item.type) }
    ]}>
      <Ionicons
        name={getAlertIcon(item.type) as any}
        size={20}
        color={getAlertIconColor(item.type)}
      />
      <View style={styles.alertContent}>
        <Text style={styles.alertMessage}>{item.message}</Text>
        <Text style={styles.alertTime}>{formatAlertTime(item.timestamp)}</Text>
      </View>
    </View>
  );

  if (loading && !summary) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.managerName}>—</Text>
              <Text style={styles.managerId}>ID: —</Text>
            </View>
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (error && !summary) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.managerName}>Area Manager</Text>
            </View>
          </View>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  const displayName = summary?.name ?? '—';
  const displayId = summary?.id ?? '—';
  const displayRole = summary?.role ?? 'Area Manager';
  const displayRegion = summary?.region?.trim() || null;
  const roleRegionText = displayRegion ? `${displayRole} • ${displayRegion}` : displayRole;
  const avatarInitial = (displayName !== '—' ? displayName : 'A').charAt(0).toUpperCase();
  const profilePictureUrl = summary?.profile_picture_url ?? summary?.profile_picture ?? null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.managerName}>{displayName}</Text>
            <Text style={styles.managerRole}>{roleRegionText}</Text>
            <Text style={styles.managerId}>ID: {displayId}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Main' as never, { screen: 'ProfileTab' } as never)}
          >
            {profilePictureUrl ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarInitial}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Region Stats */}
        <View style={styles.statsContainer}>
          {regionStats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                <Ionicons name={stat.icon as any} size={24} color={stat.color} />
              </View>
              <Text style={styles.statCardValue}>{stat.value}</Text>
              <Text style={styles.statCardLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Region Alerts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Region Alerts</Text>
            <View style={styles.alertCount}>
              <Text style={styles.alertCountText}>{alerts.length}</Text>
            </View>
          </View>
          <FlatList
            data={alertsOnDashboard}
            renderItem={renderAlert}
            keyExtractor={(_, index) => `alert-${index}`}
            scrollEnabled={false}
          />
          <TouchableOpacity
            style={styles.viewAllAlertsBtn}
            onPress={() => navigation.navigate('RegionAlerts')}
          >
            <Text style={styles.viewAllAlertsBtnText}>View All</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Team Leaders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Team Leaders</Text>
            <Text style={styles.sectionCount}>{teamLeaders.length} Active</Text>
          </View>
          <FlatList
            data={teamLeadersOnDashboard}
            renderItem={renderSupervisor}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
          />
          <TouchableOpacity
            style={styles.viewAllAlertsBtn}
            onPress={() => navigation.navigate('TeamLeaders')}
          >
            <Text style={styles.viewAllAlertsBtnText}>View All</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('RegionMap' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="map-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>Region Map</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Analytics' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="stats-chart-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>Analytics</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('TeamsTab' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="people-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>All Teams</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('RegionReports' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>Reports</Text>
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
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statCardValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  statCardLabel: {
    fontSize: FONT_SIZES.xs,
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
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  alertCount: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  alertCountText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
  },
  alertCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
  },
  alertContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  alertMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  alertTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  viewAllAlertsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  viewAllAlertsBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  supervisorCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  supervisorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  supervisorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  supervisorAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  supervisorAvatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  supervisorInfo: {
    flex: 1,
  },
  supervisorName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  supervisorId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  performanceBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  performanceText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  supervisorStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
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

export default AreaManagerDashboardScreen;




