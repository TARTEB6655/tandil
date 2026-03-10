import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS, BORDER_RADIUS } from '../../constants';
import {
  getAreaManagerAnalytics,
  AreaManagerAnalyticsData,
  AreaManagerAnalyticsPeriod,
} from '../../services/areaManagerService';

const PERIOD_OPTIONS: { value: AreaManagerAnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const TREND_BAR_MAX_HEIGHT = 72;
const TREND_BAR_MIN_HEIGHT = 10;

function formatAvgTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [period, setPeriod] = useState<AreaManagerAnalyticsPeriod>('week');
  const [data, setData] = useState<AreaManagerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstMount = useRef(true);

  const fetchAnalytics = useCallback(() => {
    setLoading(true);
    setError(null);
    getAreaManagerAnalytics(period)
      .then((res) => {
        setData(res ?? null);
        if (!res) setError('Failed to load analytics.');
      })
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [fetchAnalytics])
  );

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    fetchAnalytics();
  }, [period, fetchAnalytics]);

  const visits = data?.visits ?? 0;
  const completionPercent = data?.completion_percent ?? 0;
  const avgTimeMinutes = data?.avg_time_minutes ?? 0;
  const activeTeams = data?.active_teams ?? 0;
  const weeklyTrend = data?.weekly_trend ?? [];
  const topTeams = data?.top_teams ?? [];

  const maxCount = Math.max(
    1,
    ...weeklyTrend.map((p) => p.count)
  );
  const barHeights = weeklyTrend.map((p) =>
    TREND_BAR_MIN_HEIGHT +
    (p.count / maxCount) * (TREND_BAR_MAX_HEIGHT - TREND_BAR_MIN_HEIGHT)
  );

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Filters */}
        <View style={styles.filtersRow}>
          {PERIOD_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, period === opt.value && styles.filterChipActive]}
              onPress={() => setPeriod(opt.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  period === opt.value && styles.filterTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KPI Grid */}
        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.primary + '20' }]}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.gridValue}>{visits}</Text>
            <Text style={styles.gridLabel}>Visits</Text>
          </View>
          <View style={styles.gridItem}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.success + '20' }]}>
              <Ionicons name="checkmark-done-outline" size={18} color={COLORS.success} />
            </View>
            <Text style={styles.gridValue}>{Math.round(completionPercent)}%</Text>
            <Text style={styles.gridLabel}>Completion</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, completionPercent)}%` },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.warning + '20' }]}>
              <Ionicons name="time-outline" size={18} color={COLORS.warning} />
            </View>
            <Text style={styles.gridValue}>{formatAvgTime(avgTimeMinutes)}</Text>
            <Text style={styles.gridLabel}>Avg Time</Text>
          </View>
          <View style={styles.gridItem}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.primary + '20' }]}>
              <Ionicons name="people-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.gridValue}>{activeTeams}</Text>
            <Text style={styles.gridLabel}>Active Teams</Text>
          </View>
        </View>

        {/* Weekly Trend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Trend</Text>
          <View style={styles.barsRow}>
            {barHeights.length > 0 ? (
              barHeights.map((h, i) => (
                <View key={weeklyTrend[i]?.date ?? i} style={styles.barCol}>
                  <View style={[styles.bar, { height: h }]} />
                </View>
              ))
            ) : (
              Array.from({ length: 7 }).map((_, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={[styles.bar, { height: TREND_BAR_MIN_HEIGHT }]} />
                </View>
              ))
            )}
          </View>
        </View>

        {/* Top Teams */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Teams</Text>
          {topTeams.length === 0 ? (
            <Text style={styles.emptyTeamsText}>No teams yet</Text>
          ) : (
            topTeams.map((t) => (
              <View key={t.id} style={styles.teamRow}>
                <View style={[styles.iconCircle, { backgroundColor: COLORS.primary + '10' }]}>
                  <Ionicons name="ribbon-outline" size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.teamName}>{t.employee_id}</Text>
                <Text style={styles.teamMetric}>
                  {t.visits} visits • {(typeof t.rating === 'number' ? t.rating : Number(t.rating) || 0).toFixed(1)}★
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
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
  scrollContent: { paddingBottom: SPACING.xxl },
  filtersRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: { color: COLORS.textSecondary },
  filterTextActive: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.medium,
  },
  gridRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  gridItem: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  gridValue: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.bold,
  },
  gridLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: 6,
    backgroundColor: COLORS.success,
    borderRadius: 3,
  },
  card: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: SPACING.md,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 90,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  bar: {
    width: 16,
    minWidth: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '66',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  teamName: { color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  teamMetric: { color: COLORS.textSecondary, marginLeft: 'auto' },
  emptyTeamsText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    paddingVertical: SPACING.sm,
  },
});

export default AnalyticsScreen;
