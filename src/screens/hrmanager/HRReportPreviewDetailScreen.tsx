import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { hrService } from '../../services/hrService';

type CompletedJob = {
  id: number | string;
  title?: string;
  service_name?: string;
  location?: string;
  scheduled_date?: string;
  completed_at?: string;
  price?: number;
  status?: string;
};

const MONTH_NAMES: Record<string, string> = {
  '1': 'January',
  '2': 'February',
  '3': 'March',
  '4': 'April',
  '5': 'May',
  '6': 'June',
  '7': 'July',
  '8': 'August',
  '9': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

const getNumber = (value: any): number => (typeof value === 'number' ? value : Number(value || 0));

const HRReportPreviewDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { technicianId, technicianName, year, month } = route.params ?? {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    leaveDaysApproved: 0,
    daysWithCompletedJob: 0,
    jobsCompleted: 0,
    visitsInScope: 0,
  });
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);

  const title = useMemo(() => {
    const monthName = MONTH_NAMES[String(month)] || String(month || '');
    return `Preview - ${technicianName || 'Technician'} (${monthName} ${year || ''})`;
  }, [technicianName, month, year]);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!technicianId || !year || !month) {
        setError('Missing preview parameters.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await hrService.getTechnicianMonthlyPreview({
          technician_id: Number(technicianId),
          year: Number(year),
          month: Number(month),
        });
        const data = res?.data || {};
        const summary = data?.summary || data?.stats || data;
        setStats({
          leaveDaysApproved: getNumber(summary?.leave_days_approved ?? summary?.leave_days ?? 0),
          daysWithCompletedJob: getNumber(summary?.days_with_completed_job ?? 0),
          jobsCompleted: getNumber(summary?.jobs_completed ?? 0),
          visitsInScope: getNumber(summary?.visits_in_scope ?? 0),
        });
        const jobs = Array.isArray(data?.completed_jobs)
          ? data.completed_jobs
          : Array.isArray(summary?.completed_jobs)
          ? summary.completed_jobs
          : [];
        setCompletedJobs(jobs);
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load preview details.');
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [technicianId, year, month]);

  return (
    <View style={styles.container}>
      <Header title="Preview Detail" showBack onBackPress={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Leave days (approved)</Text>
                <Text style={styles.statValue}>{stats.leaveDaysApproved}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Days with completed job</Text>
                <Text style={styles.statValue}>{stats.daysWithCompletedJob}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Jobs completed</Text>
                <Text style={styles.statValue}>{stats.jobsCompleted}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Visits in scope</Text>
                <Text style={styles.statValue}>{stats.visitsInScope}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Completed jobs ({completedJobs.length})</Text>
            {completedJobs.length === 0 ? (
              <Text style={styles.emptyText}>No completed jobs for selected month.</Text>
            ) : (
              completedJobs.map(job => (
                <View key={String(job.id)} style={styles.jobRow}>
                  <Text style={styles.jobTitle}>{job.title || job.service_name || `Visit #${job.id}`}</Text>
                  <Text style={styles.jobMeta}>
                    {(job.scheduled_date || job.completed_at || '').toString()}
                    {job.price ? ` | AED ${Number(job.price).toFixed(2)}` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text, marginBottom: SPACING.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statItem: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: 4 },
  statValue: { fontSize: FONT_SIZES.lg, color: COLORS.text, fontWeight: FONT_WEIGHTS.bold },
  emptyText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  jobRow: {
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  jobTitle: { fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  jobMeta: { marginTop: 3, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.sm, color: COLORS.error, textAlign: 'center' },
});

export default HRReportPreviewDetailScreen;
