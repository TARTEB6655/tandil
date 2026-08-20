/**
 * Technician — my scheduled jobs calendar (mock).
 * Entry: Technician → Schedule tab (Job calendar button) or stack route.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import type { ScheduledJob } from '../../types/scheduling';
import {
  formatDisplayDate,
  getScheduledJobs,
  isoDateOffset,
} from '../../services/schedulingMockService';

const TECH_ID = 'tech_1';

const TechnicianJobCalendarScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getScheduledJobs({
        from: isoDateOffset(0),
        to: isoDateOffset(14),
        technicianId: TECH_ID,
      });
      setJobs(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My job calendar</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Ionicons name="notifications-outline" size={18} color={COLORS.primary} />
          <Text style={styles.bannerText}>
            You will get notified when a booking is confirmed, rescheduled, or updated (API later).
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
        ) : jobs.length === 0 ? (
          <Text style={styles.empty}>No upcoming jobs assigned to you.</Text>
        ) : (
          jobs.map((job) => (
            <View
              key={job.id}
              style={[styles.card, job.overlapsTechnician && styles.cardOverlap]}
            >
              <Text style={styles.date}>{formatDisplayDate(job.date)}</Text>
              <Text style={styles.time}>
                {job.startTime} – {job.endTime}
              </Text>
              <Text style={styles.service}>{job.serviceName}</Text>
              <Text style={styles.meta}>
                {job.customerName}
                {job.address ? ` · ${job.address}` : ''}
              </Text>
              {job.overlapsTechnician ? (
                <Text style={styles.overlap}>Conflict: overlapping assignment</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  banner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary + '12',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  bannerText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 20 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xl },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 2,
  },
  cardOverlap: { borderColor: COLORS.error, backgroundColor: '#FEF2F2' },
  date: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.semiBold },
  time: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  service: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  meta: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  overlap: { marginTop: 4, fontSize: FONT_SIZES.xs, color: COLORS.error, fontWeight: FONT_WEIGHTS.semiBold },
});

export default TechnicianJobCalendarScreen;
