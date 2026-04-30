import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { setAppLanguage } from '../../i18n';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  getAreaManagerDashboardSummary,
  getAreaManagerDashboardAlerts,
  getAreaManagerTeamLeaders,
  getAreaManagerNotifications,
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

function getGreetingKey(): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'greetingMorning';
  if (hour < 17) return 'greetingAfternoon';
  return 'greetingEvening';
}

const STAT_KEYS = [
  { key: 'total_farms' as const, labelKey: 'totalFarms', icon: 'home-outline', color: COLORS.primary },
  { key: 'active_subscriptions' as const, labelKey: 'activeSubscriptions', icon: 'calendar-outline', color: COLORS.success },
  { key: 'monthly_revenue' as const, labelKey: 'monthlyRevenue', icon: 'trending-up-outline', color: COLORS.warning },
] as const;

const AreaManagerDashboardScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<AreaManagerDashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<AreaManagerDashboardAlert[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<AreaManagerTeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      Promise.all([
        getAreaManagerDashboardSummary(),
        getAreaManagerDashboardAlerts(),
        getAreaManagerTeamLeaders(),
        getAreaManagerNotifications({ per_page: 20, page: 1 }).catch(() => null),
      ])
        .then(([summaryData, alertsData, teamLeadersData, notificationsData]) => {
          if (!cancelled) {
            setSummary(summaryData ?? null);
            setAlerts(Array.isArray(alertsData) ? alertsData : []);
            setTeamLeaders(Array.isArray(teamLeadersData) ? teamLeadersData : []);
            setUnreadNotificationsCount(notificationsData?.unreadCount ?? 0);
            setError(summaryData ? null : t('admin.areaManagerDashboard.failedToLoad'));
          }
        })
        .catch(() => {
          if (!cancelled) setError(t('admin.areaManagerDashboard.failedToLoad'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [t])
  );

  const regionStats = summary
    ? STAT_KEYS.map((s) => ({
        label: t(`admin.areaManagerDashboard.${s.labelKey}`),
        value:
          s.key === 'monthly_revenue'
            ? formatMonthlyRevenue(summary.monthly_revenue)
            : String(summary[s.key]),
        icon: s.icon,
        color: s.color,
      }))
    : STAT_KEYS.map((s) => ({ ...s, value: '—', label: t(`admin.areaManagerDashboard.${s.labelKey}`) }));

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
          <Text style={styles.statLabel}>{t('admin.areaManagerDashboard.team')}</Text>
          <Text style={styles.statValue}>{item.team}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('admin.areaManagerDashboard.active')}</Text>
          <Text style={styles.statValue}>{item.active}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('admin.areaManagerDashboard.done')}</Text>
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
              <Text style={styles.greeting}>{t(`admin.areaManagerDashboard.${getGreetingKey()}`)}</Text>
              <Text style={styles.managerName}>—</Text>
              <Text style={styles.managerId}>{t('admin.areaManagerDashboard.idLabel', { id: '—' })}</Text>
            </View>
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.areaManagerDashboard.loading')}</Text>
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
              <Text style={styles.greeting}>{t(`admin.areaManagerDashboard.${getGreetingKey()}`)}</Text>
              <Text style={styles.managerName}>{t('admin.areaManagerDashboard.areaManager')}</Text>
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
  const displayRole = summary?.role ?? t('admin.areaManagerDashboard.areaManager');
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
            <Text style={styles.greeting}>{t(`admin.areaManagerDashboard.${getGreetingKey()}`)}</Text>
            <Text style={styles.managerName}>{displayName}</Text>
            <Text style={styles.managerRole}>{roleRegionText}</Text>
            <Text style={styles.managerId}>{t('admin.areaManagerDashboard.idLabel', { id: displayId })}</Text>
          </View>
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications' as never)}
              accessibilityLabel="Open notifications"
            >
              <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
              {unreadNotificationsCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => setLanguageModalVisible(true)}
              accessibilityLabel={t('common.language')}
            >
              <Ionicons name="globe-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>
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
      </View>

      <Modal visible={languageModalVisible} transparent animationType="fade" onRequestClose={() => setLanguageModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('common.language')}</Text>
            <View style={styles.languageOptions}>
              {[
                { code: 'en', label: 'English' },
                { code: 'ar', label: 'العربية' },
                { code: 'ur', label: 'اردو' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.languageOptionButton, i18n.language === lang.code && styles.languageOptionButtonActive]}
                  onPress={async () => {
                    await setAppLanguage(lang.code as 'en' | 'ar' | 'ur');
                    setLanguageModalVisible(false);
                  }}
                >
                  <Text style={[styles.languageOptionText, i18n.language === lang.code && styles.languageOptionTextActive]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setLanguageModalVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <Text style={styles.sectionTitle}>{t('admin.areaManagerDashboard.regionAlerts')}</Text>
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
            <Text style={styles.viewAllAlertsBtnText}>{t('admin.areaManagerDashboard.viewAll')}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Team Leaders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.areaManagerDashboard.teamLeaders')}</Text>
            <Text style={styles.sectionCount}>{t('admin.areaManagerDashboard.activeCount', { count: teamLeaders.length })}</Text>
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
            <Text style={styles.viewAllAlertsBtnText}>{t('admin.areaManagerDashboard.viewAll')}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.areaManagerDashboard.quickActions')}</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('RegionMap' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="map-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('admin.areaManagerDashboard.regionMap')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Analytics' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="stats-chart-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('admin.areaManagerDashboard.analytics')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('TeamsTab' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="people-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('admin.areaManagerDashboard.allTeams')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('RegionReports' as never)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('admin.areaManagerDashboard.reports')}</Text>
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
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  languageButton: {
    padding: SPACING.sm,
  },
  notificationButton: {
    padding: SPACING.sm,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 0,
    minWidth: 24,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 9,
    fontWeight: FONT_WEIGHTS.bold,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  languageOptions: {
    gap: SPACING.sm,
  },
  languageOptionButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
  },
  languageOptionButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  languageOptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  languageOptionTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  modalClose: {
    alignSelf: 'flex-end',
    marginTop: SPACING.md,
  },
  modalCloseText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
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




