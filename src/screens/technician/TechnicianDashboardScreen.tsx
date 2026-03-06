import React, { useState, useEffect, useCallback } from 'react';
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
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useTranslation } from 'react-i18next';
import { getTechnicianDashboard, getTechnicianNotifications, acceptTechnicianTask, rejectTechnicianTask, TechnicianDashboardData, TechnicianTodayTask, TechnicianRecentVisit } from '../../services/technicianService';
import { buildProfilePictureUrl } from '../../config/api';
import dayjs from 'dayjs';

/** Map API task to dashboard job shape */
function mapTaskToJob(task: TechnicianTodayTask) {
  const status = (task.status ?? 'assigned').toLowerCase().replace(/\s+/g, '_');
  const durationStr = task.duration_minutes != null
    ? `${task.duration_minutes} min`
    : (task.estimated_duration ?? task.estimatedDuration ?? '—');
  const price = task.price;
  const priceDisplay = task.price_display;
  return {
    id: String(task.id),
    customerName: task.farm_name ?? task.customer_name ?? task.customerName ?? '—',
    service: task.service_name ?? task.service ?? '—',
    address: task.location ?? task.address ?? '—',
    scheduledTime: task.scheduled_time ?? task.scheduledTime ?? '—',
    status,
    estimatedDuration: durationStr,
    taskType: task.task_type ?? task.taskType ?? 'care',
    price,
    priceDisplay: priceDisplay ?? (price != null && Number(price) >= 0 ? `AED ${Number(price).toFixed(2)}` : undefined),
  };
}

/** Map API recent visit to dashboard card shape */
function mapRecentVisitToJob(visit: TechnicianRecentVisit) {
  return {
    id: String(visit.id),
    customerName: visit.farm_name,
    service: visit.service_name,
    completedAt: visit.date,
    dateFormatted: dayjs(visit.date).format('D/M/YYYY'),
    earnings: visit.price,
    earningsDisplay: visit.price_display ?? `AED ${Number(visit.price).toFixed(2)}`,
    rating: visit.rating,
  };
}

const TechnicianDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [dashboard, setDashboard] = useState<TechnicianDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileImageError, setProfileImageError] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const fetchDashboard = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getTechnicianDashboard();
      setDashboard(data ?? null);
    } catch (_) {
      setDashboard(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getTechnicianNotifications({ per_page: 1, page: 1 })
        .then((res) => setNotificationCount(res.total ?? 0))
        .catch(() => setNotificationCount(0));
    }, [])
  );

  useEffect(() => {
    setProfileImageError(false);
  }, [dashboard?.profile_picture_url, dashboard?.profile_picture]);

  const technician = dashboard
    ? {
        name: dashboard.name || '—',
        employeeId: dashboard.employee_id || '—',
        email: dashboard.email || '',
        isOnline: dashboard.is_online ?? true,
        profilePictureUrl: dashboard.profile_picture_url
          || (dashboard.profile_picture ? buildProfilePictureUrl(dashboard.profile_picture) : null),
        thisWeekEarnings: dashboard.weekly_kpis?.earnings ?? 0,
        completedVisits: dashboard.weekly_kpis?.visits_done ?? 0,
        rating: dashboard.weekly_kpis?.rating ?? 0,
      }
    : {
        name: '—',
        employeeId: '—',
        email: '',
        isOnline: false,
        profilePictureUrl: null as string | null,
        thisWeekEarnings: 0,
        completedVisits: 0,
        rating: 0,
      };

  const allTodayJobs = (dashboard?.today_tasks ?? []).map(mapTaskToJob);
  const currentJobs = allTodayJobs.slice(0, 4);
  const recentJobs = (dashboard?.recent_visits ?? []).map(mapRecentVisitToJob);

  const showProfileImage = Boolean(technician.profilePictureUrl?.trim()) && !profileImageError;
  const profileImageUri = technician.profilePictureUrl?.trim() || undefined;

  const renderCurrentJob = ({ item }: { item: any }) => (
    <View style={styles.jobCard}>
      <TouchableOpacity
        style={styles.jobContent}
        onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
      >
        <View style={styles.jobHeader}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <View style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === 'in_progress' ? COLORS.primary + '20'
                : item.status === 'accepted' ? COLORS.info + '20'
                : item.status === 'pending' || item.status === 'pending_acceptance' ? COLORS.warning + '20'
                : COLORS.textSecondary + '20',
            }
          ]}>
            <Text style={[
              styles.jobStatusText,
              {
                color:
                  item.status === 'in_progress' ? COLORS.primary
                  : item.status === 'accepted' ? COLORS.info
                  : item.status === 'pending' || item.status === 'pending_acceptance' ? COLORS.warning
                  : COLORS.textSecondary,
              }
            ]}>
              {item.status === 'in_progress' ? t('technician.status.inProgress') : item.status === 'accepted' ? t('technician.status.accepted') : item.status === 'pending' || item.status === 'pending_acceptance' ? (t('technician.status.pending_acceptance', { defaultValue: 'Pending acceptance' })) : t('technician.status.assigned')}
            </Text>
          </View>
        </View>
        
        <Text style={styles.serviceName}>{item.service}</Text>
        <Text style={styles.jobAddress}>{item.address}</Text>
        
        <View style={styles.jobFooter}>
          <View style={styles.jobInfo}>
            <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.jobInfoText}>{item.scheduledTime}</Text>
          </View>
          <View style={styles.jobInfo}>
            <Ionicons name="timer-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.jobInfoText}>{item.estimatedDuration}</Text>
          </View>
          {item.priceDisplay != null && (
            <View style={styles.jobInfo}>
              <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
              <Text style={styles.jobPriceText}>{item.priceDisplay}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Accept/Cancel buttons when status is pending or pending_acceptance */}
      {(item.status === 'pending' || item.status === 'pending_acceptance') && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => {
              Alert.alert(
                t('technician.acceptJob'),
                t('technician.acceptJobConfirm', { name: item.customerName }),
                [
                  { text: t('technician.cancel'), style: 'cancel' },
                  {
                    text: t('technician.accept'),
                    onPress: async () => {
                      try {
                        const result = await acceptTechnicianTask(item.id);
                        if (result.success) {
                          fetchDashboard(true);
                          Alert.alert(t('technician.acceptJob'), result.message ?? t('technician.jobAccepted'), [{ text: t('technician.ok') }]);
                        } else {
                          Alert.alert(t('technician.error'), result.message ?? t('technician.failedAccept'));
                        }
                      } catch {
                        Alert.alert(t('technician.error'), t('technician.failedAccept') + ' ' + t('technician.tryAgain'));
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="checkmark" size={16} color={COLORS.background} />
            <Text style={styles.actionButtonText}>{t('technician.accept')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              Alert.alert(
                t('technician.rejectJob'),
                t('technician.rejectJobConfirm', { name: item.customerName }),
                [
                  { text: t('technician.cancel'), style: 'cancel' },
                  {
                    text: t('technician.reject'),
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const result = await rejectTechnicianTask(item.id, 'Not available');
                        if (result.success) {
                          fetchDashboard(true);
                          Alert.alert(t('technician.rejectJob'), result.message ?? t('technician.jobRejected'), [{ text: t('technician.ok') }]);
                        } else {
                          Alert.alert(t('technician.error'), result.message ?? t('technician.failedReject'));
                        }
                      } catch {
                        Alert.alert(t('technician.error'), t('technician.failedReject') + ' ' + t('technician.tryAgain'));
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Ionicons name="close" size={16} color={COLORS.background} />
            <Text style={styles.actionButtonText}>{t('technician.reject')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderRecentJob = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.recentJobCard} activeOpacity={0.7}>
      <View style={styles.recentJobHeader}>
        <View style={styles.recentJobTitleWrap}>
          <Text style={styles.recentCustomerName} numberOfLines={1} ellipsizeMode="tail">
            {item.customerName}
          </Text>
        </View>
        {/* Price positioned absolutely so it always shows even when title is very long */}
        <View style={styles.recentEarningsWrap}>
          <Text style={styles.recentEarnings} numberOfLines={1}>
            {item.earningsDisplay ?? `AED ${Number(item.earnings).toFixed(2)}`}
          </Text>
        </View>
      </View>
      
      <Text style={styles.recentServiceName} numberOfLines={2} ellipsizeMode="tail">{item.service}</Text>
      <Text style={styles.recentDate}>{item.dateFormatted ?? item.completedAt}</Text>
      
      <View style={styles.ratingContainer}>
        <Ionicons name="star" size={16} color={COLORS.warning} />
        <Text style={styles.ratingText}>{item.rating}/5</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && !dashboard) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, styles.centeredContent]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('home.loading', 'Loading...')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{t('technician.greeting')}</Text>
            <Text style={styles.technicianName}>{technician.name}</Text>
            <Text style={styles.employeeId}>{t('technician.id')}: {technician.employeeId}</Text>
          </View>
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              style={styles.notificationIconButton}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
              {notificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText} numberOfLines={1}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => {
                navigation.navigate('Main' as never, { screen: 'ProfileTab' } as never);
              }}
            >
            <View style={styles.avatar}>
              {showProfileImage && profileImageUri ? (
                <Image
                  key={profileImageUri}
                  source={{ uri: profileImageUri }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={() => setProfileImageError(true)}
                  onLoad={() => setProfileImageError(false)}
                />
              ) : (
                <Text style={styles.avatarText}>{(technician.name || 'T').charAt(0).toUpperCase()}</Text>
              )}
            </View>
          </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.onlineStatus}>
          <View style={[styles.statusDot, { backgroundColor: technician.isOnline ? COLORS.success : COLORS.textSecondary }]} />
          <Text style={styles.statusText}>
            {technician.isOnline ? t('technician.online', 'Online') : t('technician.offline', 'Offline')} - {t('technician.fieldWorker', 'Field Worker')}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchDashboard(true)} colors={[COLORS.primary]} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{t('orders.currency', { defaultValue: 'AED' })} {Number(technician.thisWeekEarnings).toFixed(2)}</Text>
            <Text style={styles.statLabel}>{t('technician.thisWeek')}</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{technician.completedVisits}</Text>
            <Text style={styles.statLabel}>{t('technician.visitsDone')}</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="star-outline" size={24} color={COLORS.warning} />
            <Text style={styles.statValue}>{Number(technician.rating) ? Number(technician.rating).toFixed(1) : '0'}</Text>
            <Text style={styles.statLabel}>{t('technician.rating')}</Text>
          </View>
        </View>

        {/* Today's Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('technician.todaysTasks')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TodayTasks')}>
              <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
            </TouchableOpacity>
          </View>
          
          {allTodayJobs.length > 0 ? (
            <FlatList
              data={currentJobs}
              renderItem={renderCurrentJob}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyStateText}>{t('technician.noActiveTasks')}</Text>
              <Text style={styles.emptyStateSubtext}>{t('technician.noActiveTasksSubtext')}</Text>
            </View>
          )}
        </View>

        {/* Recent Visits */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('technician.recentVisits')}</Text>
            <TouchableOpacity onPress={() => {
              navigation.navigate('Main' as never, { screen: 'TasksTab' } as never);
            }}>
              <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
            </TouchableOpacity>
          </View>

          {recentJobs.length > 0 ? (
            <FlatList
              data={recentJobs}
              renderItem={renderRecentJob}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyStateText}>{t('technician.noRecentVisits')}</Text>
              <Text style={styles.emptyStateSubtext}>{t('technician.noRecentVisitsSubtext')}</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.quickActions')}</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => {
                navigation.navigate('Main' as never, { screen: 'ScheduleTab' } as never);
              }}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('technician.availability.title')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('PayoutSummary')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="wallet-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('technician.payouts')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => {
                navigation.navigate('Main' as never, { screen: 'TasksTab' } as never);
              }}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="list-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('technician.history')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => {
                navigation.navigate('Main' as never, { screen: 'ProfileTab' } as never);
              }}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="person-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionText}>{t('technician.tabs.profile')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('AcceptedJobs')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.success} />
              </View>
              <Text style={styles.quickActionText}>{t('technician.acceptJobs')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('RejectedJobs')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="close-circle-outline" size={24} color={COLORS.error} />
              </View>
              <Text style={styles.quickActionText}>{t('technician.rejectJobs')}</Text>
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
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  greeting: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  technicianName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  employeeId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginTop: 2,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  notificationIconButton: {
    padding: SPACING.sm,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
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
    overflow: 'hidden',
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
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.medium,
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
    marginBottom: SPACING.sm,
  },
  viewAllText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  jobCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  jobStatusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  serviceName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  jobAddress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  jobFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobInfoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  jobPriceText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  recentJobCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  recentJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    minHeight: 24,
  },
  recentJobTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 92,
  },
  recentCustomerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  recentEarningsWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  recentEarnings: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  recentServiceName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  recentDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyStateSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
  jobContent: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.error,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.background,
  },
});

export default TechnicianDashboardScreen;
