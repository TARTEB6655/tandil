import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
} from '../../constants';
import {
  getSupervisorTeamMember,
  getSupervisorAssignments,
  SupervisorTeamMemberDetail,
  SupervisorAssignment,
} from '../../services/supervisorService';

const todayStr = () => dayjs().format('YYYY-MM-DD');

const TeamMemberProgressScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as {
    memberId: number;
    name: string;
    initial: string;
    completed: number;
    rating: number;
  };
  const memberId = params?.memberId;
  const passedName = params?.name ?? '';
  const passedInitial = params?.initial ?? (passedName.charAt(0) || '?');
  const passedCompleted = params?.completed ?? 0;
  const passedRating = params?.rating ?? 0;

  const [member, setMember] = useState<SupervisorTeamMemberDetail | null>(null);
  const [jobsToday, setJobsToday] = useState<SupervisorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (memberId == null) {
      setError('No member selected.');
      setLoading(false);
      return;
    }
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    setError(null);
    const today = todayStr();
    try {
      const [memberRes, assignRes] = await Promise.all([
        getSupervisorTeamMember(memberId),
        getSupervisorAssignments({ per_page: 100 }),
      ]);
      setMember(memberRes ?? null);
      const list = assignRes?.list ?? [];
      const forToday = list.filter(
        (a) => a.technician_id === memberId && (a.scheduled_date || '').startsWith(today)
      );
      setJobsToday(forToday);
      if (!memberRes && !isRefresh) setError('Could not load member.');
    } catch {
      if (!isRefresh) setError('Could not load data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => load(true);

  const completedToday = jobsToday.filter(
    (j) => (j.status || '').toLowerCase() === 'completed' || j.completed_date != null
  ).length;
  const totalToday = jobsToday.length;
  const completedCount = totalToday > 0 ? completedToday : passedCompleted;
  const progressPercent =
    totalToday > 0
      ? Math.round((completedToday / totalToday) * 100)
      : passedCompleted > 0
        ? 100
        : 0;
  const displayName = member?.name ?? passedName;
  const displayInitial = (member?.name || passedName).charAt(0).toUpperCase() || passedInitial;

  if (memberId == null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Member Progress</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No member selected.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !member && jobsToday.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Member Progress</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !member && jobsToday.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Member Progress</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Member Progress</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarLetter}>{displayInitial}</Text>
          </View>
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroSubtitle}>Today’s progress</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.success + '22' }]}>
              <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
            </View>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed today</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.primary + '22' }]}>
              <Ionicons name="briefcase-outline" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.statNumber}>{totalToday}</Text>
            <Text style={styles.statLabel}>Jobs today</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.warning + '22' }]}>
              <Ionicons name="star" size={28} color={COLORS.warning} />
            </View>
            <Text style={styles.statNumber}>
              {passedRating === 0 ? '0' : passedRating.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Today’s completion</Text>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.min(progressPercent, 100)}%` }]}
            />
          </View>
        </View>

        {/* Jobs today list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobs today</Text>
          {jobsToday.length === 0 ? (
            <View style={styles.emptyJobs}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyJobsText}>No jobs scheduled for today</Text>
            </View>
          ) : (
            jobsToday.map((job) => {
              const isCompleted =
                (job.status || '').toLowerCase() === 'completed' || job.completed_date != null;
              return (
                <TouchableOpacity
                  key={job.id}
                  style={styles.jobCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('SupervisorAssignmentDetail', { assignmentId: job.id })
                  }
                >
                  <View style={[styles.jobStatusDot, { backgroundColor: isCompleted ? COLORS.success : COLORS.warning }]} />
                  <View style={styles.jobBody}>
                    <Text style={styles.jobTitle} numberOfLines={1}>
                      {job.title || job.service_name}
                    </Text>
                    <Text style={styles.jobMeta} numberOfLines={1}>
                      {job.location || job.address || '—'} • {job.job_time || '—'}
                    </Text>
                    <View style={styles.jobFooter}>
                      <Text style={styles.jobService}>{job.service_name}</Text>
                      <View style={[styles.jobBadge, isCompleted && styles.jobBadgeDone]}>
                        <Text style={[styles.jobBadgeText, isCompleted && styles.jobBadgeTextDone]}>
                          {isCompleted ? 'Done' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
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
  retryBtn: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.primary,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  heroName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statNumber: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  progressCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  progressTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressPercent: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  section: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  emptyJobs: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyJobsText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  jobStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.sm,
  },
  jobBody: { flex: 1 },
  jobTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  jobMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  jobFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  jobService: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  jobBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    backgroundColor: COLORS.warning + '22',
  },
  jobBadgeDone: {
    backgroundColor: COLORS.success + '22',
  },
  jobBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.warning,
  },
  jobBadgeTextDone: {
    color: COLORS.success,
  },
});

export default TeamMemberProgressScreen;
