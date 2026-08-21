import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  claimSupervisorAssignment,
  getSupervisorAssignmentDetail,
  rejectSupervisorNewAssignment,
  SupervisorAssignment,
  SupervisorAssignmentDetail,
} from '../../services/supervisorService';

function formatDuration(minutes?: number | null): string {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(raw?: string | null): string {
  const iso = String(raw ?? '').trim();
  const ymd = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  const key = ymd ? ymd[1] : iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return iso || '—';
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTimeSlot(job: SupervisorAssignment | SupervisorAssignmentDetail): string {
  const slot = job.time_slot;
  if (typeof slot === 'string' && slot.trim()) return slot.trim();
  if (slot && typeof slot === 'object') {
    const start = String(slot.start_time ?? slot.start ?? '').trim();
    const end = String(slot.end_time ?? slot.end ?? '').trim();
    if (start && end) return `${start} – ${end}`;
    if (start) return start;
  }
  return (
    String(
      job.scheduled_time ||
        job.job_time ||
        job.booking_slot ||
        job.order_item?.booking_slot ||
        ''
    ).trim() || '—'
  );
}

const SupervisorNewJobDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const passedJob = (route.params?.job ?? null) as SupervisorAssignment | null;
  const jobId = Number(
    route.params?.jobId ??
      route.params?.assignmentId ??
      route.params?.visit_id ??
      route.params?.id ??
      passedJob?.id
  );

  const [job, setJob] = useState<SupervisorAssignmentDetail | SupervisorAssignment | null>(passedJob);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isFinite(jobId)) {
        setError(t('supervisorDashboard.jobNotFound'));
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      getSupervisorAssignmentDetail(jobId)
        .then((data) => {
          if (cancelled) return;
          if (data) {
            setJob({
              ...passedJob,
              ...data,
              client_name: data.customer?.name ?? data.client_name ?? passedJob?.client_name ?? null,
              client_email: data.customer?.email ?? data.client_email ?? passedJob?.client_email ?? null,
              client_phone: data.customer?.phone ?? data.client_phone ?? passedJob?.client_phone ?? null,
              can_claim: data.can_claim ?? passedJob?.can_claim ?? true,
              can_reject: data.can_reject ?? passedJob?.can_reject ?? true,
            });
          } else if (!passedJob) {
            setError(t('supervisorDashboard.jobNotFound'));
            setJob(null);
          }
        })
        .catch(() => {
          if (cancelled) return;
          if (!passedJob) {
            setError(t('supervisorDashboard.couldNotLoadJob'));
            setJob(null);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- use jobId only; passedJob is initial merge fallback
    }, [jobId, t])
  );

  const clientName = job?.client_name || (job as SupervisorAssignmentDetail)?.customer?.name || '—';
  const clientEmail = job?.client_email || (job as SupervisorAssignmentDetail)?.customer?.email || null;
  const clientPhone = job?.client_phone || (job as SupervisorAssignmentDetail)?.customer?.phone || null;
  const clientPhoto =
    (job as SupervisorAssignmentDetail)?.customer?.profile_picture_url || null;
  const productImage = job?.order_item?.product?.image_url ?? null;
  const showClaim = job?.can_claim !== false;
  const showReject = job?.can_reject !== false;

  const rows = useMemo(() => {
    if (!job) return [];
    return [
      {
        icon: 'calendar-outline' as const,
        label: t('supervisorDashboard.bookingDate'),
        value: formatDate(job.date || job.booking_date || job.order_item?.booking_date || job.scheduled_date),
      },
      {
        icon: 'time-outline' as const,
        label: t('supervisorDashboard.timeSlot'),
        value: formatTimeSlot(job),
      },
      {
        icon: 'timer-outline' as const,
        label: t('supervisorDashboard.duration'),
        value: formatDuration(job.duration_minutes),
      },
      {
        icon: 'cash-outline' as const,
        label: t('supervisorDashboard.price'),
        value: job.price_display || (job.price != null ? `AED ${job.price}` : '—'),
      },
      {
        icon: 'navigate-outline' as const,
        label: t('supervisorDashboard.location'),
        value: job.location || '—',
      },
      {
        icon: 'location-outline' as const,
        label: t('supervisorDashboard.address'),
        value: job.address || '—',
      },
    ];
  }, [job, t]);

  const handleAction = (action: 'accept' | 'reject') => {
    if (!job) return;
    const title = job.title || job.service_name;
    Alert.alert(
      action === 'accept' ? t('supervisorDashboard.accept') : t('supervisorDashboard.reject'),
      action === 'accept' ? `Accept job “${title}”?` : `Reject job “${title}”?`,
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: action === 'accept' ? t('supervisorDashboard.accept') : t('supervisorDashboard.reject'),
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setActionLoading(action);
              const result =
                action === 'accept'
                  ? await claimSupervisorAssignment(job.id)
                  : await rejectSupervisorNewAssignment(job.id);
              if (!result.success) {
                Alert.alert(
                  t('common.error', { defaultValue: 'Error' }),
                  result.message || t('common.somethingWentWrong', { defaultValue: 'Something went wrong.' })
                );
                return;
              }
              Alert.alert(
                action === 'accept' ? t('supervisorDashboard.jobAccepted') : t('supervisorDashboard.jobRejected'),
                result.message ||
                  (action === 'accept'
                    ? t('supervisorDashboard.jobAcceptedMessage')
                    : t('supervisorDashboard.jobRejectedMessage')),
                [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => navigation.goBack() }]
              );
            } catch (err: any) {
              Alert.alert(
                t('common.error', { defaultValue: 'Error' }),
                err?.response?.data?.message ||
                  err?.message ||
                  t('common.somethingWentWrong', { defaultValue: 'Something went wrong.' })
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  if (loading && !job) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('supervisorDashboard.jobDetail')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('supervisorDashboard.loadingDetail')}</Text>
        </View>
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('supervisorDashboard.jobDetail')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerBox}>
          <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.errorText}>{error || t('supervisorDashboard.jobNotFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('supervisorDashboard.jobDetail')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
        ) : null}

        <View style={styles.hero}>
          {productImage ? (
            <Image source={{ uri: productImage }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={styles.heroIconWrap}>
              <Ionicons name="briefcase-outline" size={36} color={COLORS.primary} />
            </View>
          )}
          <Text style={styles.serviceName}>{job.service_name || t('supervisorDashboard.orderJob')}</Text>
          {job.title ? <Text style={styles.jobTitle}>{job.title}</Text> : null}
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{job.status || 'pending'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t('supervisorDashboard.clientDetails')}</Text>
          </View>
          <View style={styles.clientRow}>
            {clientPhoto ? (
              <Image source={{ uri: clientPhoto }} style={styles.clientAvatarImage} contentFit="cover" />
            ) : (
              <View style={styles.clientAvatar}>
                <Text style={styles.clientAvatarLetter}>{(clientName || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{clientName}</Text>
              {clientEmail ? (
                <TouchableOpacity
                  style={styles.contactLine}
                  onPress={() =>
                    Linking.openURL(`mailto:${clientEmail}`).catch(() =>
                      Alert.alert(t('common.error'), t('supervisorDashboard.couldNotOpenEmail'))
                    )
                  }
                >
                  <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.contactLink}>{clientEmail}</Text>
                </TouchableOpacity>
              ) : null}
              {clientPhone ? (
                <TouchableOpacity
                  style={styles.contactLine}
                  onPress={() =>
                    Linking.openURL(`tel:${String(clientPhone).replace(/\s/g, '')}`).catch(() =>
                      Alert.alert(t('common.error'), t('supervisorDashboard.couldNotOpenPhone'))
                    )
                  }
                >
                  <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.contactLink}>{clientPhone}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t('supervisorDashboard.jobOverview')}</Text>
          </View>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Ionicons name={row.icon} size={18} color={COLORS.textSecondary} />
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {(job.order_id != null || job.order_item?.product) ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>{t('supervisorDashboard.orderDetails')}</Text>
            </View>
            {job.order_id != null ? (
              <View style={styles.row}>
                <Ionicons name="receipt-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.rowLabel}>{t('supervisorDashboard.orderId')}</Text>
                <Text style={styles.rowValue}>#{job.order_id}</Text>
              </View>
            ) : null}
            {job.order?.payment_status ? (
              <View style={styles.row}>
                <Ionicons name="card-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.rowLabel}>{t('supervisorDashboard.paymentStatus')}</Text>
                <Text style={styles.rowValue}>{job.order.payment_status}</Text>
              </View>
            ) : null}
            {job.order?.order_status ? (
              <View style={styles.row}>
                <Ionicons name="flag-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.rowLabel}>{t('supervisorDashboard.orderStatus')}</Text>
                <Text style={styles.rowValue}>{job.order.order_status}</Text>
              </View>
            ) : null}
            {job.order_item?.product?.name ? (
              <View style={styles.row}>
                <Ionicons name="cube-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.rowLabel}>{t('supervisorDashboard.product')}</Text>
                <Text style={styles.rowValue}>{job.order_item.product.name}</Text>
              </View>
            ) : null}
            {job.order_item?.quantity != null ? (
              <View style={styles.row}>
                <Ionicons name="layers-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.rowLabel}>{t('supervisorDashboard.quantity')}</Text>
                <Text style={styles.rowValue}>{String(job.order_item.quantity)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {job.notes ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>{t('supervisorDashboard.notes')}</Text>
            </View>
            <Text style={styles.notesText}>{job.notes}</Text>
          </View>
        ) : null}

        {(showClaim || showReject) ? (
          <View style={styles.actions}>
            {showReject ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                disabled={actionLoading != null}
                onPress={() => handleAction('reject')}
                activeOpacity={0.8}
              >
                {actionLoading === 'reject' ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Text style={styles.rejectText}>{t('supervisorDashboard.reject')}</Text>
                )}
              </TouchableOpacity>
            ) : null}
            {showClaim ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                disabled={actionLoading != null}
                onPress={() => handleAction('accept')}
                activeOpacity={0.8}
              >
                {actionLoading === 'accept' ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <Text style={styles.acceptText}>{t('supervisorDashboard.accept')}</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  heroImage: {
    width: 88,
    height: 88,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  serviceName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  jobTitle: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statusPill: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.warning + '20',
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.warning,
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  clientAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  clientAvatarLetter: {
    color: COLORS.background,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  contactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 4,
  },
  contactLink: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  rowLabel: {
    width: 100,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  rowValue: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  notesText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  rejectBtn: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  acceptBtn: {
    backgroundColor: COLORS.primary,
  },
  rejectText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  acceptText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default SupervisorNewJobDetailScreen;
