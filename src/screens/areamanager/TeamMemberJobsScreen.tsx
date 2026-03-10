import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  getAreaManagerMemberJobs,
  AreaManagerMemberJob,
  AreaManagerMemberJobsData,
  AreaManagerMemberJobsStatus,
} from '../../services/areaManagerService';

type RouteParams = {
  memberId?: string;
  memberName?: string;
  employeeId?: string;
};

const STATUS_OPTIONS: { value: AreaManagerMemberJobsStatus; label: string }[] = [
  { value: 'processing', label: 'Processing' },
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
];

function getStatusColor(status?: string) {
  if (!status) return COLORS.textSecondary;
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'done') return COLORS.success;
  if (s === 'processing' || s === 'in_progress' || s === 'in progress') return COLORS.warning;
  return COLORS.info;
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return value;
  }
}

const TeamMemberJobsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as RouteParams;
  const memberId = params?.memberId ?? '';
  const fallbackName = params?.memberName ?? 'Team member';
  const fallbackEmployeeId = params?.employeeId ?? '';

  const [data, setData] = useState<AreaManagerMemberJobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AreaManagerMemberJobsStatus>('processing');
  const isFirstMount = useRef(true);

  const fetchJobs = useCallback(() => {
    if (!memberId) {
      setLoading(false);
      setError('Missing member.');
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    getAreaManagerMemberJobs(memberId, { status: statusFilter, per_page: 20 })
      .then((res) => {
        setData(res ?? null);
        if (!res) setError('Failed to load jobs.');
      })
      .catch(() => setError('Failed to load jobs.'))
      .finally(() => setLoading(false));
  }, [memberId, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (memberId) fetchJobs();
  }, [statusFilter, memberId, fetchJobs]);

  const teamMember = data?.team_member;
  const jobs: AreaManagerMemberJob[] = data?.jobs ?? [];
  const memberName = teamMember?.name ?? fallbackName;
  const employeeId = teamMember?.employee_id ?? fallbackEmployeeId;

  const renderJob = ({ item }: { item: AreaManagerMemberJob }) => {
    const statusColor = getStatusColor(item.status);
    const title = item.title || item.job_number || `Job #${item.id}`;
    const location = item.location ?? '—';
    const dateStr = item.scheduled_at || item.created_at || item.updated_at || item.completed_at;
    return (
      <View style={styles.card}>
        <View style={[styles.statusBar, { backgroundColor: statusColor }]} />
        <View style={styles.cardBody}>
          <Text style={styles.jobTitle}>{title}</Text>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.location} numberOfLines={1}>{location}</Text>
          </View>
          {item.service ? (
            <Text style={styles.service}>{item.service}</Text>
          ) : null}
          <View style={styles.footer}>
            <Text style={styles.date}>{formatDate(dateStr)}</Text>
            {item.status ? (
              <View style={[styles.statusChip, { backgroundColor: statusColor + '22' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  if (!memberId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Jobs</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Missing member.</Text>
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
        <Text style={styles.headerTitle}>Jobs</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.hero}>
        <View style={styles.heroAvatarRow}>
          {teamMember?.profile_picture_url ? (
            <Image
              source={{ uri: teamMember.profile_picture_url }}
              style={styles.heroAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.heroAvatarPlaceholder}>
              <Text style={styles.heroAvatarText}>
                {teamMember?.initial || memberName.charAt(0)}
              </Text>
            </View>
          )}
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroName}>{memberName}</Text>
            <Text style={styles.heroId}>{employeeId}</Text>
          </View>
        </View>
        <View style={styles.jobsCount}>
          <Ionicons name="briefcase-outline" size={18} color={COLORS.background} />
          <Text style={styles.jobsCountText}>{jobs.length} jobs</Text>
        </View>
      </View>
      <View style={styles.filterRow}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.filterChip,
              statusFilter === opt.value && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(opt.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === opt.value && styles.filterChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : error && !data ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          renderItem={renderJob}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No jobs assigned</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: 'center' },
  hero: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  heroAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  heroAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: SPACING.md,
  },
  heroAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  heroAvatarText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  heroTextWrap: { alignItems: 'center' },
  heroName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: SPACING.xs,
  },
  heroId: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: SPACING.xs,
  },
  jobsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  jobsCountText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  filterChipTextActive: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  statusBar: {
    width: 4,
    minHeight: 80,
  },
  cardBody: {
    flex: 1,
    padding: SPACING.md,
  },
  jobTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  location: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  service: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginBottom: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  date: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  statusChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default TeamMemberJobsScreen;
