import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { getTechnicianLeaveRequests, TechnicianLeaveRequest } from '../../services/technicianService';
import { getSupervisorLeaveRequests } from '../../services/supervisorService';
import { authService } from '../../services/authService';

export type LeaveStatusType = 'pending' | 'approved' | 'rejected';

function formatLeaveTypeLabel(leaveType: string): string {
  const map: Record<string, string> = {
    annual: 'Annual Leave',
    sick: 'Sick Leave',
    unpaid: 'Unpaid Leave',
    paternity: 'Paternity Leave',
    other: 'Other',
  };
  const key = (leaveType || '').toLowerCase().replace(/\s+/g, '_');
  return map[key] || leaveType;
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const PER_PAGE = 50;

const TechnicianLeaveStatusScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [list, setList] = useState<TechnicianLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaveRequests = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const role = await authService.getStoredRole();
      const isSupervisor = role === 'supervisor';
      const res = isSupervisor
        ? await getSupervisorLeaveRequests({ per_page: PER_PAGE })
        : await getTechnicianLeaveRequests({ per_page: PER_PAGE });
      if (res?.success && Array.isArray(res.data)) {
        setList(res.data as TechnicianLeaveRequest[]);
      } else {
        setList([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load leave requests');
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeaveRequests();
    }, [fetchLeaveRequests])
  );

  const onRefresh = useCallback(() => {
    fetchLeaveRequests(true);
  }, [fetchLeaveRequests]);

  const pendingCount = list.filter(l => l.status === 'pending').length;
  const approvedCount = list.filter(l => l.status === 'approved').length;
  const rejectedCount = list.filter(l => l.status === 'rejected').length;

  const getStatusStyle = (status: LeaveStatusType) => {
    switch (status) {
      case 'approved':
        return { bg: COLORS.success + '18', color: COLORS.success, icon: 'checkmark-circle' as const };
      case 'rejected':
        return { bg: COLORS.error + '18', color: COLORS.error, icon: 'close-circle' as const };
      default:
        return { bg: COLORS.warning + '18', color: COLORS.warning, icon: 'time' as const };
    }
  };

  const renderItem = ({ item }: { item: TechnicianLeaveRequest }) => {
    const status = item.status as LeaveStatusType;
    const statusStyle = getStatusStyle(status);
    const statusLabel =
      status === 'approved'
        ? (t('technician.leaveStatus.approved') || 'Approved')
        : status === 'rejected'
          ? (t('technician.leaveStatus.rejected') || 'Rejected')
          : (t('technician.leaveStatus.pending') || 'Pending');
    const leaveTypeLabel = formatLeaveTypeLabel(item.leave_type);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.leaveTypeRow}>
            <View style={styles.leaveTypeChip}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
              <Text style={styles.leaveTypeText}>{leaveTypeLabel}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Ionicons name={statusStyle.icon} size={14} color={statusStyle.color} />
              <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Ionicons name="calendar" size={16} color={COLORS.textSecondary} />
            <Text style={styles.dateText}>
              {formatDisplayDate(item.start_date)} – {formatDisplayDate(item.end_date)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('technician.leaveStatus.duration') || 'Duration'}: </Text>
            <Text style={styles.value}>
              {item.duration_days} {item.duration_days === 1 ? 'day' : 'days'}
            </Text>
          </View>
          {item.reason ? (
            <View style={styles.reasonRow}>
              <Text style={styles.reasonLabel}>{t('technician.leaveStatus.reason') || 'Reason'}: </Text>
              <Text style={styles.reasonText}>{item.reason}</Text>
            </View>
          ) : null}
          <Text style={styles.appliedAt}>
            {t('technician.leaveStatus.appliedOn') || 'Applied on'} {formatDisplayDate(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading && list.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('technician.leaveStatus.title') || 'Leave Status'}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && list.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('technician.leaveStatus.title') || 'Leave Status'}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchLeaveRequests()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('technician.leaveStatus.title') || 'Leave Status'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: COLORS.warning + '20' }]}>
            <Ionicons name="time-outline" size={18} color={COLORS.warning} />
            <Text style={[styles.summaryCount, { color: COLORS.warning }]}>{pendingCount}</Text>
            <Text style={styles.summaryLabel}>{t('technician.leaveStatus.pending') || 'Pending'}</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: COLORS.success + '20' }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.success} />
            <Text style={[styles.summaryCount, { color: COLORS.success }]}>{approvedCount}</Text>
            <Text style={styles.summaryLabel}>{t('technician.leaveStatus.approved') || 'Approved'}</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: COLORS.error + '20' }]}>
            <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
            <Text style={[styles.summaryCount, { color: COLORS.error }]}>{rejectedCount}</Text>
            <Text style={styles.summaryLabel}>{t('technician.leaveStatus.rejected') || 'Rejected'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('technician.leaveStatus.allRequests') || 'All leave requests'}</Text>
        <FlatList
          data={list}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  retryBtn: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  summaryChip: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    marginTop: SPACING.xs,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  separator: {
    height: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    marginBottom: SPACING.sm,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  leaveTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  leaveTypeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  cardBody: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dateText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  reasonRow: {
    marginTop: 2,
  },
  reasonLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  reasonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginTop: 2,
  },
  appliedAt: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
});

export default TechnicianLeaveStatusScreen;
