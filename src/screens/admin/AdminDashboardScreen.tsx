import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Image } from 'expo-image';
import { adminService, AdminActivity, AdminDashboardProfile } from '../../services/adminService';

function getGreetingKey(): 'admin.dashboard.greetingMorning' | 'admin.dashboard.greetingAfternoon' | 'admin.dashboard.greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'admin.dashboard.greetingMorning';
  if (hour < 17) return 'admin.dashboard.greetingAfternoon';
  return 'admin.dashboard.greetingEvening';
}

const ACTIVITY_ICON_MAP: Record<string, { icon: string; color: string }> = {
  check: { icon: 'checkmark-circle', color: COLORS.success },
  error: { icon: 'warning', color: COLORS.error },
  warning: { icon: 'warning', color: COLORS.warning },
  person: { icon: 'person-add', color: COLORS.primary },
  user: { icon: 'person-add', color: COLORS.primary },
  customer: { icon: 'person-add', color: COLORS.primary },
  register: { icon: 'person-add', color: COLORS.primary },
  registration: { icon: 'person-add', color: COLORS.primary },
  subscription: { icon: 'checkmark-circle', color: COLORS.success },
  visit: { icon: 'checkmark-circle', color: COLORS.success },
  inventory: { icon: 'warning', color: COLORS.warning },
  stock: { icon: 'warning', color: COLORS.warning },
  alert: { icon: 'warning', color: COLORS.warning },
  default: { icon: 'document-text', color: COLORS.textSecondary },
};

function getActivityIcon(activity: AdminActivity): { icon: string; color: string } {
  const iconType = (activity.icon_type || activity.type || '').toLowerCase();
  const mapped = ACTIVITY_ICON_MAP[iconType] ?? ACTIVITY_ICON_MAP.default;
  const desc = (activity.description || '').toLowerCase();
  if (mapped !== ACTIVITY_ICON_MAP.default) return mapped;
  if (desc.includes('customer') || desc.includes('registered') || desc.includes('user')) return ACTIVITY_ICON_MAP.person;
  if (desc.includes('stock') || desc.includes('inventory') || desc.includes('out of')) return ACTIVITY_ICON_MAP.inventory;
  if (desc.includes('visit') || desc.includes('completed')) return ACTIVITY_ICON_MAP.visit;
  if (desc.includes('subscription')) return ACTIVITY_ICON_MAP.subscription;
  return mapped;
}

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

const AdminDashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [showTimeRangeModal, setShowTimeRangeModal] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<Array<{ id: string; message: string; timestamp: string; icon: string; color: string }>>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [supportTicketsCount, setSupportTicketsCount] = useState(0);
  const [profile, setProfile] = useState<AdminDashboardProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchStatistics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminService.getDashboardStatistics({ period: timeRange });
      if (response.success && response.data) {
        setStatistics(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching dashboard statistics:', error);
      // Set default/fallback data if API fails
        const fallbackData = {
          total: 0,
          daily: 0,
          weekly: 0,
          monthly: 0,
          yearly: 0,
          growth: { daily: '+0', weekly: '+0', monthly: '+0', yearly: '+0' }
        };
        setStatistics({
          customers: fallbackData,
          technicians: fallbackData,
          employees: fallbackData,
          total_users: fallbackData,
          active_subscriptions: fallbackData,
          monthly_revenue: fallbackData,
        });
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  const fetchRecentActivities = useCallback(async () => {
    try {
      setActivitiesLoading(true);
      const response = await adminService.getRecentActivities({ limit: 20 });
      const list = response.data ?? [];
      const now = Date.now();
      // Only show past activities: exclude future created_at and exclude timestamp text like "3 weeks from now"
      const pastOnly = list.filter((a: AdminActivity) => {
        const t = new Date(a.created_at || 0).getTime();
        const isPastDate = t > 0 && t <= now;
        const timestampStr = (a.timestamp || '').toLowerCase();
        const isFutureLabel = timestampStr.includes('from now');
        return isPastDate && !isFutureLabel;
      });
      // Sort by created_at descending (newest first) so the 3 most recent show first
      const sorted = [...pastOnly].sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
      const recentThree = sorted.slice(0, 3);
      const mapped = recentThree.map((a: AdminActivity, index: number) => {
        const { icon, color } = getActivityIcon(a);
        return {
          id: `activity-${index}-${a.related_id ?? ''}`,
          message: a.description ?? '',
          timestamp: a.timestamp ?? a.created_at ?? '',
          icon,
          color,
        };
      });
      setRecentActivities(mapped);
    } catch (error: any) {
      console.error('Error fetching recent activities:', error);
      setRecentActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  const fetchPendingReportsCount = useCallback(async () => {
    try {
      const res = await adminService.getReports({ status: 'pending', per_page: 1, page: 1 });
      const total = res?.meta?.total ?? (Array.isArray(res?.data) ? res.data.length : 0);
      setPendingReportsCount(typeof total === 'number' ? total : 0);
    } catch (_) {
      setPendingReportsCount(0);
    }
  }, []);

  const fetchNewOrdersCount = useCallback(async () => {
    try {
      const res = await adminService.getOrders({ per_page: 1, page: 1 });
      const total = res?.meta?.total ?? res?.total ?? (Array.isArray(res?.data) ? res.data.length : 0);
      setNewOrdersCount(typeof total === 'number' ? total : 0);
    } catch (_) {
      setNewOrdersCount(0);
    }
  }, []);

  const fetchSupportTicketsCount = useCallback(async () => {
    try {
      const res = await adminService.getSupportTickets({ per_page: 1, page: 1 });
      const total = res?.data?.pagination?.total ?? 0;
      setSupportTicketsCount(typeof total === 'number' ? total : 0);
    } catch (_) {
      setSupportTicketsCount(0);
    }
  }, []);

  const fetchDashboardProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      const res = await adminService.getDashboardProfile();
      if (res.success && res.data) setProfile(res.data);
      else setProfile(null);
    } catch (_) {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStatistics();
      fetchRecentActivities();
      fetchPendingReportsCount();
      fetchNewOrdersCount();
      fetchSupportTicketsCount();
      fetchDashboardProfile();
    }, [fetchStatistics, fetchRecentActivities, fetchPendingReportsCount, fetchNewOrdersCount, fetchSupportTicketsCount, fetchDashboardProfile])
  );

  const greetingText = profile?.greeting?.trim() || t(getGreetingKey());
  const adminName = profile?.name?.trim() || '';
  const adminRole = profile?.role_display_name?.trim() || '';
  const adminId = profile?.formatted_id?.trim() || '';
  const profilePictureUrl = profile?.profile_picture_url?.trim() || null;
  const avatarInitial = adminName ? adminName.charAt(0).toUpperCase() : 'A';

  const quickStats = useMemo(
    () => [
      { id: 'pending_reports', labelKey: 'admin.dashboard.pendingReports', value: String(pendingReportsCount), actionKey: 'admin.dashboard.view', color: COLORS.warning, navTarget: 'PendingReports' as const },
      { id: 'new_orders', labelKey: 'admin.dashboard.newOrders', value: String(newOrdersCount), actionKey: 'admin.dashboard.manage', color: COLORS.success, navTarget: 'AdminOrders' as const },
      { id: 'support_tickets', labelKey: 'admin.dashboard.supportTickets', value: String(supportTicketsCount), actionKey: 'admin.dashboard.respond', color: COLORS.error, navTarget: 'AdminSupportTickets' as const },
    ],
    [pendingReportsCount, newOrdersCount, supportTicketsCount]
  );

  const topProducts = [
    { id: 1, name: 'Organic Fertilizer 5kg', sales: 245, revenue: 'AED 22K' },
    { id: 2, name: 'Drip Irrigation Kit', sales: 189, revenue: 'AED 15K' },
    { id: 3, name: 'Premium Potting Soil', sales: 167, revenue: 'AED 10K' },
  ];

  const renderActivity = ({ item }: { item: any }) => (
    <View style={styles.activityCard}>
      <View style={[styles.activityIcon, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon as any} size={20} color={item.color} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityMessage}>{item.message}</Text>
        <Text style={styles.activityTime}>{item.timestamp}</Text>
      </View>
    </View>
  );

  const renderQuickStat = ({ item }: { item: any }) => (
    <View style={styles.quickStatCard}>
      <View style={styles.quickStatHeader}>
        <Text style={styles.quickStatValue}>{item.value}</Text>
        <View style={[styles.quickStatBadge, { backgroundColor: item.color + '20' }]}>
          <Text style={[styles.quickStatBadgeText, { color: item.color }]}>{t('admin.dashboard.new')}</Text>
        </View>
      </View>
      <Text style={styles.quickStatLabel}>{t(item.labelKey)}</Text>
      <TouchableOpacity
        style={styles.quickStatAction}
        onPress={() => navigation.navigate(item.navTarget as never)}
      >
        <Text style={[styles.quickStatActionText, { color: item.color }]}>{t(item.actionKey)} →</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProduct = ({ item }: { item: any }) => (
    <View style={styles.productCard}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productSales}>{item.sales} {t('admin.dashboard.sales')}</Text>
      </View>
      <Text style={styles.productRevenue}>{item.revenue}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextWrap}>
            {profileLoading ? (
              <Text style={styles.greeting}>{t('admin.dashboard.loading', 'Loading...')}</Text>
            ) : (
              <>
                <Text style={styles.greeting}>{greetingText}</Text>
                <Text style={styles.adminName}>{adminName || '—'}</Text>
                {adminRole ? <Text style={styles.adminRole}>{adminRole}</Text> : null}
                {adminId ? <Text style={styles.adminId}>{t('admin.dashboard.idPrefix')}{adminId}</Text> : null}
              </>
            )}
          </View>
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              style={styles.notificationIconButton}
              onPress={() => navigation.navigate('AdminSupportTickets' as never)}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
              {supportTicketsCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText} numberOfLines={1}>
                    {supportTicketsCount > 99 ? '99+' : supportTicketsCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('Main' as never, { screen: 'SettingsTab' } as never)}
            >
            {profilePictureUrl ? (
              <Image source={{ uri: profilePictureUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarInitial}</Text>
              </View>
            )}
          </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Statistics Section */}
        <View style={styles.userStatsSection}>
          <View style={styles.userStatsHeader}>
            <View style={styles.userStatsTitleContainer}>
              <Text style={styles.userStatsTitle}>{t('admin.dashboard.userStatistics')}</Text>
              <Text style={styles.userStatsSubtitle}>{t('admin.dashboard.userStatisticsSubtitle')}</Text>
            </View>
            <TouchableOpacity
              style={styles.timeRangeButton}
              onPress={() => setShowTimeRangeModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.timeRangeText}>
                {timeRange === 'daily' ? t('admin.dashboard.daily') : timeRange === 'weekly' ? t('admin.dashboard.weekly') : timeRange === 'monthly' ? t('admin.dashboard.monthly') : t('admin.dashboard.yearly')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : statistics ? (
            <View style={[styles.userStatsGrid, { paddingHorizontal: 0 }]}>
              {/* Customers Card */}
              <View style={styles.userStatCard}>
                <View style={[styles.userStatIcon, { backgroundColor: '#4A90E2' + '20' }]}>
                  <Ionicons name="people" size={24} color="#4A90E2" />
                </View>
                <Text style={styles.userStatValue}>
                  {timeRange === 'daily' ? statistics.customers.daily :
                   timeRange === 'weekly' ? statistics.customers.weekly :
                   timeRange === 'monthly' ? statistics.customers.monthly :
                   statistics.customers.yearly}
                </Text>
                <Text style={styles.userStatLabel}>{t('admin.dashboard.customers')}</Text>
                <Text style={styles.userStatPeriod}>
                  {timeRange === 'daily' ? t('admin.dashboard.today') :
                   timeRange === 'weekly' ? t('admin.dashboard.thisWeek') :
                   timeRange === 'monthly' ? t('admin.dashboard.thisMonth') :
                   t('admin.dashboard.thisYear')}
                </Text>
                <View style={styles.userStatGrowth}>
                  {(() => {
                    const growthValue = timeRange === 'daily' ? statistics.customers.growth.daily :
                                      timeRange === 'weekly' ? statistics.customers.growth.weekly :
                                      timeRange === 'monthly' ? statistics.customers.growth.monthly :
                                      statistics.customers.growth.yearly;
                    const isPositive = growthValue.startsWith('+') && growthValue !== '+0';
                    const isNegative = growthValue.startsWith('-');
                    const isNeutral = growthValue === '+0' || growthValue === '0';
                    const growthColor = isPositive ? COLORS.success : isNegative ? COLORS.error : COLORS.textSecondary;
                    return (
                      <Text style={[styles.userStatGrowthText, { color: growthColor }]}>
                        {isPositive && '↑ '}
                        {isNegative && '↓ '}
                        {isNeutral && '— '}
                        {growthValue.includes('%') ? growthValue : `${growthValue}%`} {t('admin.dashboard.vsPreviousPeriod')}
                      </Text>
                    );
                  })()}
                </View>
              </View>

              {/* Technicians Card */}
              <View style={styles.userStatCard}>
                <View style={[styles.userStatIcon, { backgroundColor: '#4CAF50' + '20' }]}>
                  <Ionicons name="briefcase" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.userStatValue}>
                  {timeRange === 'daily' ? statistics.technicians.daily :
                   timeRange === 'weekly' ? statistics.technicians.weekly :
                   timeRange === 'monthly' ? statistics.technicians.monthly :
                   statistics.technicians.yearly}
                </Text>
                <Text style={styles.userStatLabel}>{t('admin.dashboard.technicians')}</Text>
                <Text style={styles.userStatPeriod}>
                  {timeRange === 'daily' ? t('admin.dashboard.today') :
                   timeRange === 'weekly' ? t('admin.dashboard.thisWeek') :
                   timeRange === 'monthly' ? t('admin.dashboard.thisMonth') :
                   t('admin.dashboard.thisYear')}
                </Text>
                <View style={styles.userStatGrowth}>
                  {(() => {
                    const growthValue = timeRange === 'daily' ? statistics.technicians.growth.daily :
                                      timeRange === 'weekly' ? statistics.technicians.growth.weekly :
                                      timeRange === 'monthly' ? statistics.technicians.growth.monthly :
                                      statistics.technicians.growth.yearly;
                    const isPositive = growthValue.startsWith('+') && growthValue !== '+0';
                    const isNegative = growthValue.startsWith('-');
                    const isNeutral = growthValue === '+0' || growthValue === '0';
                    const growthColor = isPositive ? COLORS.success : isNegative ? COLORS.error : COLORS.textSecondary;
                    return (
                      <Text style={[styles.userStatGrowthText, { color: growthColor }]}>
                        {isPositive && '↑ '}
                        {isNegative && '↓ '}
                        {isNeutral && '— '}
                        {growthValue.includes('%') ? growthValue : `${growthValue}%`} {t('admin.dashboard.vsPreviousPeriod')}
                      </Text>
                    );
                  })()}
                </View>
              </View>

              {/* Employees/Staff Card */}
              <View style={styles.userStatCard}>
                <View style={[styles.userStatIcon, { backgroundColor: '#9C27B0' + '20' }]}>
                  <Ionicons name="people-outline" size={24} color="#9C27B0" />
                </View>
                <Text style={styles.userStatValue}>
                  {statistics.employees ? (
                    timeRange === 'daily' ? statistics.employees.daily :
                    timeRange === 'weekly' ? statistics.employees.weekly :
                    timeRange === 'monthly' ? statistics.employees.monthly :
                    statistics.employees.yearly
                  ) : (
                    timeRange === 'daily' ? statistics.technicians.daily :
                    timeRange === 'weekly' ? statistics.technicians.weekly :
                    timeRange === 'monthly' ? statistics.technicians.monthly :
                    statistics.technicians.yearly
                  )}
                </Text>
                <Text style={styles.userStatLabel}>{t('admin.dashboard.employeesStaff')}</Text>
                <Text style={styles.userStatPeriod}>
                  {timeRange === 'daily' ? t('admin.dashboard.today') :
                   timeRange === 'weekly' ? t('admin.dashboard.thisWeek') :
                   timeRange === 'monthly' ? t('admin.dashboard.thisMonth') :
                   t('admin.dashboard.thisYear')}
                </Text>
                <View style={styles.userStatGrowth}>
                  {(() => {
                    const employeesData = statistics.employees || statistics.technicians;
                    const growthValue = timeRange === 'daily' ? employeesData.growth.daily :
                                      timeRange === 'weekly' ? employeesData.growth.weekly :
                                      timeRange === 'monthly' ? employeesData.growth.monthly :
                                      employeesData.growth.yearly;
                    const isPositive = growthValue.startsWith('+') && growthValue !== '+0';
                    const isNegative = growthValue.startsWith('-');
                    const isNeutral = growthValue === '+0' || growthValue === '0';
                    const growthColor = isPositive ? COLORS.success : isNegative ? COLORS.error : COLORS.textSecondary;
                    return (
                      <Text style={[styles.userStatGrowthText, { color: growthColor }]}>
                        {isPositive && '↑ '}
                        {isNegative && '↓ '}
                        {isNeutral && '— '}
                        {growthValue.includes('%') ? growthValue : `${growthValue}%`} {t('admin.dashboard.vsPreviousPeriod')}
                      </Text>
                    );
                  })()}
                </View>
              </View>

              {/* Total Users Card */}
              {statistics.total_users && (
                <View style={styles.userStatCard}>
                  <View style={[styles.userStatIcon, { backgroundColor: COLORS.primary + '20' }]}>
                    <Ionicons name="people-outline" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.userStatValue}>
                    {(() => {
                      const value = timeRange === 'daily' ? statistics.total_users.daily :
                                   timeRange === 'weekly' ? statistics.total_users.weekly :
                                   timeRange === 'monthly' ? statistics.total_users.monthly :
                                   statistics.total_users.yearly;
                      return value.toLocaleString('en-US');
                    })()}
                  </Text>
                  <Text style={styles.userStatLabel}>{t('admin.dashboard.totalUsers')}</Text>
                  <Text style={styles.userStatPeriod}>
                    {timeRange === 'daily' ? t('admin.dashboard.today') :
                     timeRange === 'weekly' ? t('admin.dashboard.thisWeek') :
                     timeRange === 'monthly' ? t('admin.dashboard.thisMonth') :
                     t('admin.dashboard.thisYear')}
                  </Text>
                  <View style={styles.userStatGrowth}>
                    {(() => {
                      const growthValue = timeRange === 'daily' ? statistics.total_users.growth.daily :
                                        timeRange === 'weekly' ? statistics.total_users.growth.weekly :
                                        timeRange === 'monthly' ? statistics.total_users.growth.monthly :
                                        statistics.total_users.growth.yearly;
                      const isPositive = growthValue.startsWith('+') && growthValue !== '+0';
                      const isNegative = growthValue.startsWith('-');
                      const isNeutral = growthValue === '+0' || growthValue === '0';
                      const growthColor = isPositive ? COLORS.success : isNegative ? COLORS.error : COLORS.textSecondary;
                      return (
                        <Text style={[styles.userStatGrowthText, { color: growthColor }]}>
                          {isPositive && '↑ '}
                          {isNegative && '↓ '}
                          {isNeutral && '— '}
                          {growthValue.includes('%') ? growthValue : `${growthValue}%`} {t('admin.dashboard.vsPreviousPeriod')}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
              )}

              {/* Active Subscriptions Card */}
              {statistics.active_subscriptions && (
                <View style={styles.userStatCard}>
                  <View style={[styles.userStatIcon, { backgroundColor: COLORS.success + '20' }]}>
                    <Ionicons name="calendar-outline" size={24} color={COLORS.success} />
                  </View>
                  <Text style={styles.userStatValue}>
                    {(() => {
                      const value = timeRange === 'daily' ? statistics.active_subscriptions.daily :
                                   timeRange === 'weekly' ? statistics.active_subscriptions.weekly :
                                   timeRange === 'monthly' ? statistics.active_subscriptions.monthly :
                                   statistics.active_subscriptions.yearly;
                      return value.toLocaleString('en-US');
                    })()}
                  </Text>
                  <Text style={styles.userStatLabel}>{t('admin.dashboard.activeSubscriptions')}</Text>
                  <Text style={styles.userStatPeriod}>
                    {timeRange === 'daily' ? t('admin.dashboard.today') :
                     timeRange === 'weekly' ? t('admin.dashboard.thisWeek') :
                     timeRange === 'monthly' ? t('admin.dashboard.thisMonth') :
                     t('admin.dashboard.thisYear')}
                  </Text>
                  <View style={styles.userStatGrowth}>
                    {(() => {
                      const growthValue = timeRange === 'daily' ? statistics.active_subscriptions.growth.daily :
                                        timeRange === 'weekly' ? statistics.active_subscriptions.growth.weekly :
                                        timeRange === 'monthly' ? statistics.active_subscriptions.growth.monthly :
                                        statistics.active_subscriptions.growth.yearly;
                      const isPositive = growthValue.startsWith('+') && growthValue !== '+0';
                      const isNegative = growthValue.startsWith('-');
                      const isNeutral = growthValue === '+0' || growthValue === '0';
                      const growthColor = isPositive ? COLORS.success : isNegative ? COLORS.error : COLORS.textSecondary;
                      return (
                        <Text style={[styles.userStatGrowthText, { color: growthColor }]}>
                          {isPositive && '↑ '}
                          {isNegative && '↓ '}
                          {isNeutral && '— '}
                          {growthValue.includes('%') ? growthValue : `${growthValue}%`} {t('admin.dashboard.vsPreviousPeriod')}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
              )}

              {/* Monthly Revenue Card */}
              {statistics.monthly_revenue && (
                <View style={styles.userStatCard}>
                  <View style={[styles.userStatIcon, { backgroundColor: COLORS.warning + '20' }]}>
                    <Ionicons name="trending-up-outline" size={24} color={COLORS.warning} />
                  </View>
                  <Text style={styles.userStatValue}>
                    {(() => {
                      const value = timeRange === 'daily' ? statistics.monthly_revenue.daily :
                                   timeRange === 'weekly' ? statistics.monthly_revenue.weekly :
                                   timeRange === 'monthly' ? statistics.monthly_revenue.monthly :
                                   statistics.monthly_revenue.yearly;
                      if (value >= 1000000) {
                        return `AED ${(value / 1000000).toFixed(1)}M`;
                      } else if (value >= 1000) {
                        return `AED ${(value / 1000).toFixed(0)}K`;
                      }
                      return `AED ${value.toLocaleString('en-US')}`;
                    })()}
                  </Text>
                  <Text style={styles.userStatLabel}>{t('admin.dashboard.monthlyRevenue')}</Text>
                  <Text style={styles.userStatPeriod}>
                    {timeRange === 'daily' ? t('admin.dashboard.today') :
                     timeRange === 'weekly' ? t('admin.dashboard.thisWeek') :
                     timeRange === 'monthly' ? t('admin.dashboard.thisMonth') :
                     t('admin.dashboard.thisYear')}
                  </Text>
                  <View style={styles.userStatGrowth}>
                    {(() => {
                      const growthValue = timeRange === 'daily' ? statistics.monthly_revenue.growth.daily :
                                        timeRange === 'weekly' ? statistics.monthly_revenue.growth.weekly :
                                        timeRange === 'monthly' ? statistics.monthly_revenue.growth.monthly :
                                        statistics.monthly_revenue.growth.yearly;
                      const isPositive = growthValue.startsWith('+') && growthValue !== '+0';
                      const isNegative = growthValue.startsWith('-');
                      const isNeutral = growthValue === '+0' || growthValue === '0';
                      const growthColor = isPositive ? COLORS.success : isNegative ? COLORS.error : COLORS.textSecondary;
                      return (
                        <Text style={[styles.userStatGrowthText, { color: growthColor }]}>
                          {isPositive && '↑ '}
                          {isNegative && '↓ '}
                          {isNeutral && '— '}
                          {growthValue.includes('%') ? growthValue : `${growthValue}%`} {t('admin.dashboard.vsPreviousPeriod')}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.dashboard.quickOverview')}</Text>
          <FlatList
            data={quickStats}
            renderItem={renderQuickStat}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickStatsList}
          />
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.dashboard.recentActivities')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('RecentActivities' as never)}>
              <Text style={styles.viewAllText}>{t('admin.dashboard.viewAll')}</Text>
            </TouchableOpacity>
          </View>

          {activitiesLoading ? (
            <View style={styles.activitiesLoading}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.activitiesLoadingText}>{t('admin.dashboard.loadingActivities')}</Text>
            </View>
          ) : (
            <FlatList
              data={recentActivities}
              renderItem={renderActivity}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.activitiesEmpty}>
                  <Text style={styles.activitiesEmptyText}>{t('admin.dashboard.noRecentActivities')}</Text>
                </View>
              }
            />
          )}
        </View>

        {/* Top Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.dashboard.topSellingProducts')}</Text>
          <FlatList
            data={topProducts}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        </View>

        {/* Admin Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.dashboard.adminControls')}</Text>
          <View style={styles.adminActions}>
            <TouchableOpacity style={styles.adminAction} onPress={() => navigation.navigate('UsersTab' as never)}>
              <View style={styles.adminActionIcon}>
                <Ionicons name="people-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.adminActionText}>{t('admin.dashboard.manageUsers')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminAction} onPress={() => navigation.navigate('AdminSubscriptions' as never)}>
              <View style={styles.adminActionIcon}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.adminActionText}>{t('admin.dashboard.subscriptions')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminAction} onPress={() => navigation.navigate('AdminTips' as never)}>
              <View style={styles.adminActionIcon}>
                <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.adminActionText}>{t('admin.dashboard.sendTips')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminAction} onPress={() => navigation.navigate('AdminProducts' as never)}>
              <View style={styles.adminActionIcon}>
                <Ionicons name="cart-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.adminActionText}>{t('admin.dashboard.products')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminAction} onPress={() => navigation.navigate('PendingReports' as never)}>
              <View style={styles.adminActionIcon}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.adminActionText}>{t('admin.dashboard.reports')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminAction} onPress={() => navigation.navigate('AdminCategories' as never)}>
              <View style={styles.adminActionIcon}>
                <Ionicons name="pricetag-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.adminActionText}>{t('admin.dashboard.category')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminAction} onPress={() => navigation.navigate('AdminExclusiveOffers' as never)}>
              <View style={styles.adminActionIcon}>
                <Ionicons name="pricetags-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.adminActionText}>{t('admin.dashboard.exclusiveOffers')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminAction} onPress={() => navigation.navigate('AdminServices' as never)}>
              <View style={styles.adminActionIcon}>
                <Ionicons name="construct-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.adminActionText}>{t('admin.dashboard.services')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Time Range Selection Modal */}
      <Modal
        transparent={true}
        visible={showTimeRangeModal}
        animationType="fade"
        onRequestClose={() => setShowTimeRangeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTimeRangeModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('admin.dashboard.selectTimeRange')}</Text>
            {(['daily', 'weekly', 'monthly', 'yearly'] as TimeRange[]).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.modalOption,
                  timeRange === range && styles.modalOptionSelected
                ]}
                onPress={() => {
                  setTimeRange(range);
                  setShowTimeRangeModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  timeRange === range && styles.modalOptionTextSelected
                ]}>
                  {range === 'daily' ? t('admin.dashboard.daily') : range === 'weekly' ? t('admin.dashboard.weekly') : range === 'monthly' ? t('admin.dashboard.monthly') : t('admin.dashboard.yearly')}
                </Text>
                {timeRange === range && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
  adminName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  adminRole: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginTop: 2,
  },
  adminId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
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
  headerTextWrap: {
    flex: 1,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  statGridItem: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  statGridIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statGridValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statGridLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  statGridChange: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
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
    marginBottom: SPACING.md,
  },
  viewAllText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  activitiesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  activitiesLoadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  activitiesEmpty: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  activitiesEmptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  quickStatsList: {
    gap: SPACING.md,
  },
  quickStatCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    width: 160,
  },
  quickStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  quickStatValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  quickStatBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  quickStatBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  quickStatLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  quickStatAction: {
    marginTop: SPACING.xs,
  },
  quickStatActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  activityCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  activityTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  productSales: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  productRevenue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  adminActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  adminAction: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  adminActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  adminActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    textAlign: 'center',
  },
  // User Statistics Styles
  userStatsSection: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  userStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  userStatsTitleContainer: {
    flex: 1,
    marginRight: SPACING.md,
    flexShrink: 1,
  },
  userStatsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  userStatsSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  timeRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 90,
    height: 36,
    flexShrink: 0,
  },
  timeRangeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginRight: SPACING.xs,
  },
  loadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  userStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    gap: SPACING.md,
  },
  userStatCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  userStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  userStatValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  userStatLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  userStatPeriod: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  userStatGrowth: {
    marginTop: SPACING.xs,
  },
  userStatGrowthText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    width: '80%',
    maxWidth: 300,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  modalOptionSelected: {
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  modalOptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  modalOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default AdminDashboardScreen;




