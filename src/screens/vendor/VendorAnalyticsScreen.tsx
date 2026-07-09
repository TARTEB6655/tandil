import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { VendorPageHeader, VENDOR_SCREEN_BG } from '../../components/vendor/VendorUi';
import {
  vendorAnalyticsService,
  VendorAnalyticsPayload,
  VendorAnalyticsMetric,
  VendorAnalyticsDataPoint,
} from '../../services/vendorAnalyticsService';

function formatMetricValue(metric?: VendorAnalyticsMetric, fallback = '0'): string {
  if (!metric) return fallback;
  if (metric.display?.trim()) return metric.display.trim();
  if (metric.currency) return `${metric.currency} ${metric.value}`;
  if (metric.unit) return `${metric.value}${metric.unit}`;
  return String(metric.value ?? fallback);
}

function isNegativeGrowth(growth?: string): boolean {
  if (!growth) return false;
  return growth.trim().startsWith('-');
}

function SimpleBarChart({
  title,
  points,
  valueKey,
}: {
  title: string;
  points: VendorAnalyticsDataPoint[];
  valueKey: 'orders' | 'revenue';
}) {
  const values = points.map((p) => Number(p[valueKey] ?? 0));
  const max = Math.max(...values, 1);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {points.length === 0 ? (
        <View style={styles.chartEmpty}>
          <Ionicons name="analytics-outline" size={36} color={COLORS.textSecondary} />
          <Text style={styles.chartEmptyText}>No trend data</Text>
        </View>
      ) : (
        <View style={styles.barsRow}>
          {points.map((point, index) => {
            const value = Number(point[valueKey] ?? 0);
            const barHeight = Math.max(4, Math.round((value / max) * 96));
            return (
              <View key={`${point.label}-${index}`} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: barHeight }]} />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {point.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const VendorAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VendorAnalyticsPayload | null>(null);

  const loadAnalytics = useCallback(async (period: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const payload = await vendorAnalyticsService.getPerformance(period);
      setData(payload);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('vendorAnalytics.loadFailed', { defaultValue: 'Failed to load analytics.' });
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics(selectedPeriod);
    }, [loadAnalytics, selectedPeriod])
  );

  const onSelectPeriod = (periodId: string) => {
    if (periodId === selectedPeriod) return;
    setSelectedPeriod(periodId);
  };

  const handleExportReport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const fileUri = await vendorAnalyticsService.exportPerformanceCsv(selectedPeriod);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: t('vendorAnalytics.exportReport', { defaultValue: 'Export Report' }),
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert(
          t('common.success', { defaultValue: 'Success' }),
          t('vendorAnalytics.exportSaved', {
            defaultValue: 'Report downloaded successfully.',
          })
        );
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('vendorAnalytics.exportFailed', {
          defaultValue: 'Failed to export performance report.',
        });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
    } finally {
      setExporting(false);
    }
  };

  const handleShareAnalytics = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const share = await vendorAnalyticsService.sharePerformance(selectedPeriod);
      const periodLabel = data?.period_label || selectedPeriod;
      const expiryNote =
        share.expires_in_days != null
          ? `\n\n${t('vendorAnalytics.shareExpires', {
              defaultValue: 'Link expires in {{days}} days.',
              days: share.expires_in_days,
            })}`
          : '';

      await Share.share({
        message: `${data?.title || 'Analytics'} — ${periodLabel}\n${share.share_url}${expiryNote}`,
        url: share.share_url,
        title: t('vendorAnalytics.shareAnalytics', { defaultValue: 'Share Analytics' }),
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('vendorAnalytics.shareFailed', {
          defaultValue: 'Failed to create analytics share link.',
        });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
    } finally {
      setSharing(false);
    }
  };

  const handleAction = async (actionId: string, available?: boolean) => {
    if (actionId === 'export_report') {
      await handleExportReport();
      return;
    }

    if (actionId === 'share_analytics') {
      await handleShareAnalytics();
      return;
    }

    if (available === false) {
      Alert.alert(
        t('vendorAnalytics.unavailable', { defaultValue: 'Unavailable' }),
        t('vendorAnalytics.actionUnavailable', {
          defaultValue: 'This action is not available yet.',
        })
      );
    }
  };

  const filters =
    data?.filters?.length
      ? data.filters
      : [
          { id: 'week', label: 'Week' },
          { id: 'month', label: 'Month', selected: true },
          { id: 'quarter', label: 'Quarter' },
          { id: 'year', label: 'Year' },
        ];

  const overview = data?.overview;
  const performance = data?.performance_metrics;
  const dailyPoints = data?.trends.daily_performance?.data_points ?? [];
  const weeklyPoints = data?.trends.weekly_revenue?.data_points ?? [];
  const topProducts = data?.top_products ?? [];
  const activity = data?.recent_activity ?? [];
  const actions = (data?.actions?.length
    ? data.actions
    : [
        { id: 'export_report', label: 'Export Report', available: true },
        { id: 'share_analytics', label: 'Share Analytics', available: true },
      ]
  ).map((action) =>
    action.id === 'export_report' ? { ...action, available: true } : action
  );

  const renderMetricCard = (
    title: string,
    metric: VendorAnalyticsMetric | undefined,
    icon: string,
    color: string
  ) => {
    const growth = metric?.growth_display;
    const negative = isNegativeGrowth(growth);
    const trendColor = negative ? COLORS.error : color;

    return (
      <View style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <View style={[styles.metricIcon, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon as any} size={24} color={color} />
          </View>
          {growth ? (
            <View style={[styles.trendBadge, { backgroundColor: trendColor + '20' }]}>
              <Text style={[styles.trendText, { color: trendColor }]}>{growth}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.metricValue}>{formatMetricValue(metric)}</Text>
        <Text style={styles.metricTitle}>{title}</Text>
        {metric?.subtitle ? <Text style={styles.metricSubtitle}>{metric.subtitle}</Text> : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <VendorPageHeader
        title={data?.title || t('vendorDashboard.analytics', { defaultValue: 'Analytics' })}
        subtitle={
          data?.subtitle ||
          t('vendorDashboard.analyticsHint', { defaultValue: 'Sales, orders & performance' })
        }
        onBack={() => navigation.goBack()}
      />

      <View style={styles.periodSelectorWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodSelector}
        >
          {filters.map((period) => {
            const active = selectedPeriod === period.id || Boolean(period.selected && !data);
            return (
              <TouchableOpacity
                key={period.id}
                style={[styles.periodButton, active && styles.periodButtonActive]}
                onPress={() => onSelectPeriod(period.id)}
                disabled={loading}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={active ? COLORS.background : COLORS.primary}
                />
                <Text
                  style={[styles.periodButtonText, active && styles.periodButtonTextActive]}
                >
                  {period.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && !data ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAnalytics(selectedPeriod, true)}
              tintColor={COLORS.primary}
            />
          }
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => loadAnalytics(selectedPeriod)}>
                <Text style={styles.retryText}>
                  {t('common.retry', { defaultValue: 'Retry' })}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {overview?.title || 'Overview'}
              {data?.period_label || overview?.period_label
                ? ` — ${data?.period_label || overview?.period_label}`
                : ''}
            </Text>
            <View style={styles.metricsGrid}>
              {renderMetricCard(
                'Total Products',
                overview?.total_products,
                'cube-outline',
                COLORS.primary
              )}
              {renderMetricCard(
                'Total Orders',
                overview?.total_orders,
                'bag-outline',
                COLORS.success
              )}
              {renderMetricCard(
                'Total Revenue',
                overview?.total_revenue,
                'trending-up-outline',
                COLORS.warning
              )}
              {renderMetricCard(
                'Total Views',
                overview?.total_views,
                'eye-outline',
                COLORS.info
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Metrics</Text>
            <View style={styles.performanceGrid}>
              <View style={styles.performanceCard}>
                <View style={styles.performanceHeader}>
                  <Ionicons name="trending-up-outline" size={20} color={COLORS.success} />
                  <Text style={styles.performanceTitle}>Conversion Rate</Text>
                </View>
                <Text style={styles.performanceValue}>
                  {formatMetricValue(performance?.conversion_rate, '0%')}
                </Text>
                <Text style={styles.performanceSubtitle}>
                  {performance?.conversion_rate?.subtitle || 'View to Order ratio'}
                </Text>
              </View>

              <View style={styles.performanceCard}>
                <View style={styles.performanceHeader}>
                  <Ionicons name="cash-outline" size={20} color={COLORS.warning} />
                  <Text style={styles.performanceTitle}>Avg Order Value</Text>
                </View>
                <Text style={styles.performanceValue}>
                  {formatMetricValue(performance?.avg_order_value, 'AED 0')}
                </Text>
                <Text style={styles.performanceSubtitle}>
                  {performance?.avg_order_value?.subtitle || 'Per transaction'}
                </Text>
              </View>

              <View style={styles.performanceCard}>
                <View style={styles.performanceHeader}>
                  <Ionicons name="star-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.performanceTitle}>Satisfaction</Text>
                </View>
                <Text style={styles.performanceValue}>
                  {performance?.satisfaction?.available === false
                    ? '—'
                    : formatMetricValue(performance?.satisfaction, '0/5')}
                </Text>
                <Text style={styles.performanceSubtitle}>
                  {performance?.satisfaction?.subtitle || 'Customer rating'}
                </Text>
              </View>

              <View style={styles.performanceCard}>
                <View style={styles.performanceHeader}>
                  <Ionicons name="refresh-outline" size={20} color={COLORS.error} />
                  <Text style={styles.performanceTitle}>Return Rate</Text>
                </View>
                <Text style={styles.performanceValue}>
                  {formatMetricValue(performance?.return_rate, '0%')}
                </Text>
                <Text style={styles.performanceSubtitle}>
                  {performance?.return_rate?.subtitle || 'Product returns'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trends & Insights</Text>
            <SimpleBarChart
              title={data?.trends.daily_performance?.title || 'Daily Performance'}
              points={dailyPoints}
              valueKey="orders"
            />
            <SimpleBarChart
              title={data?.trends.weekly_revenue?.title || 'Weekly Revenue'}
              points={weeklyPoints}
              valueKey="revenue"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Performing Products</Text>
            <View style={styles.topProductsContainer}>
              {topProducts.length === 0 ? (
                <Text style={styles.emptyText}>
                  {t('vendorAnalytics.noTopProducts', {
                    defaultValue: 'No top products for this period.',
                  })}
                </Text>
              ) : (
                topProducts.map((product, index) => (
                  <View key={`${product.name}-${index}`} style={styles.topProductCard}>
                    <View style={styles.productRank}>
                      <Text style={styles.rankNumber}>{index + 1}</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {product.name || product.title || 'Product'}
                      </Text>
                      <Text style={styles.productStats}>
                        {product.orders ?? 0} orders •{' '}
                        {product.revenue_display ||
                          (typeof product.revenue === 'number'
                            ? `AED ${product.revenue}`
                            : product.revenue || '—')}
                      </Text>
                    </View>
                    {product.growth_display || product.growth ? (
                      <View style={styles.productGrowth}>
                        <Text style={styles.growthText}>
                          {product.growth_display || product.growth}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityContainer}>
              {activity.length === 0 ? (
                <Text style={styles.emptyText}>
                  {t('vendorAnalytics.noActivity', {
                    defaultValue: 'No recent activity for this period.',
                  })}
                </Text>
              ) : (
                activity.map((item, index) => {
                  const type = item.type || 'notifications';
                  const color =
                    type === 'order'
                      ? COLORS.success
                      : type === 'view'
                        ? COLORS.info
                        : type === 'review'
                          ? COLORS.warning
                          : COLORS.primary;
                  const icon =
                    type === 'order'
                      ? 'bag-outline'
                      : type === 'view'
                        ? 'eye-outline'
                        : type === 'review'
                          ? 'star-outline'
                          : 'trending-up-outline';
                  return (
                    <View key={`${item.message}-${index}`} style={styles.activityItem}>
                      <View style={[styles.activityIcon, { backgroundColor: color + '20' }]}>
                        <Ionicons name={icon as any} size={20} color={color} />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityMessage}>{item.message || '—'}</Text>
                        <Text style={styles.activityTime}>
                          {item.time || item.time_ago || ''}
                        </Text>
                      </View>
                      {item.value || item.value_display ? (
                        <Text style={[styles.activityValue, { color }]}>
                          {item.value_display || item.value}
                        </Text>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <View style={styles.actionsSection}>
            {actions.map((action) => {
              const isExport = action.id === 'export_report';
              const isShare = action.id === 'share_analytics';
              const busy = (isExport && exporting) || (isShare && sharing);
              const disabled = busy || (!isExport && !isShare && action.available === false);
              return (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    isExport ? styles.exportButton : styles.shareButton,
                    disabled && styles.actionDisabled,
                  ]}
                  onPress={() => handleAction(action.id, action.available)}
                  activeOpacity={0.85}
                  disabled={disabled}
                >
                  {busy ? (
                    <ActivityIndicator
                      size="small"
                      color={isExport ? COLORS.primary : COLORS.background}
                    />
                  ) : (
                    <Ionicons
                      name={isExport ? 'download-outline' : 'share-outline'}
                      size={24}
                      color={
                        disabled
                          ? COLORS.textSecondary
                          : isExport
                            ? COLORS.primary
                            : COLORS.background
                      }
                    />
                  )}
                  <Text
                    style={[
                      isExport ? styles.exportButtonText : styles.shareButtonText,
                      disabled && styles.actionDisabledText,
                    ]}
                  >
                    {busy
                      ? isExport
                        ? t('vendorAnalytics.exporting', { defaultValue: 'Exporting...' })
                        : t('vendorAnalytics.sharing', { defaultValue: 'Sharing...' })
                      : action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VENDOR_SCREEN_BG,
  },
  periodSelectorWrap: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: SPACING.xs,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  periodButtonTextActive: {
    color: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.error + '12',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.error + '33',
  },
  errorText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  retryText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  metricCard: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  trendText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  metricValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  metricTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  metricSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  performanceCard: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  performanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  performanceTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    flex: 1,
  },
  performanceValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  performanceSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  chartCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  chartTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  chartEmptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '70%',
    height: 100,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  topProductsContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  topProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  productRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  rankNumber: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  productInfo: { flex: 1, minWidth: 0 },
  productName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  productStats: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  productGrowth: {
    marginLeft: SPACING.sm,
  },
  growthText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.success,
  },
  activityContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: { flex: 1, minWidth: 0 },
  activityMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  activityTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activityValue: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  emptyText: {
    padding: SPACING.lg,
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  actionsSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  exportButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  shareButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionDisabledText: {
    color: COLORS.textSecondary,
  },
});

export default VendorAnalyticsScreen;
