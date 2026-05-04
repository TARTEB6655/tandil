import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  adminService,
  type NotificationDeliveryStatsData,
  type NotificationDeliveryByAudience,
} from '../../services/adminService';

const AUDIENCE_FILTER_OPTIONS: { value: string; labelKey: string }[] = [
  { value: '', labelKey: 'allRoles' },
  { value: 'client', labelKey: 'client' },
  { value: 'technician', labelKey: 'technician' },
  { value: 'supervisor', labelKey: 'supervisor' },
  { value: 'area_manager', labelKey: 'area_manager' },
  { value: 'hr', labelKey: 'hr' },
  { value: 'admin', labelKey: 'admin' },
];

const AUDIENCE_ORDER: (keyof NotificationDeliveryByAudience)[] = [
  'client',
  'technician',
  'supervisor',
  'area_manager',
  'hr',
  'admin',
  'other',
  'unknown',
  'untracked',
];

function formatAudienceSample(aud: NotificationDeliveryByAudience | undefined): string {
  if (!aud) return '—';
  const parts: string[] = [];
  for (const key of AUDIENCE_ORDER) {
    const n = aud[key];
    if (typeof n === 'number' && n > 0) {
      parts.push(`${String(key)}: ${n}`);
    }
  }
  return parts.length > 0 ? parts.join(', ') : '—';
}

type StatVariant = 'default' | 'tracked' | 'untracked';

const StatCard: React.FC<{ label: string; value: number | string; variant?: StatVariant }> = ({
  label,
  value,
  variant = 'default',
}) => (
  <View
    style={[
      styles.statCard,
      variant === 'tracked' && styles.statCardTracked,
      variant === 'untracked' && styles.statCardUntracked,
    ]}
  >
    <Text style={styles.statCardLabel} numberOfLines={2}>
      {label}
    </Text>
    <Text style={styles.statCardValue}>{value}</Text>
  </View>
);

const AdminNotificationDeliveryAnalyticsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [sinceInput, setSinceInput] = useState('');
  const [untilInput, setUntilInput] = useState('');
  const [audienceRole, setAudienceRole] = useState('');
  const [showAudienceModal, setShowAudienceModal] = useState(false);

  const [appliedSince, setAppliedSince] = useState<string | undefined>();
  const [appliedUntil, setAppliedUntil] = useState<string | undefined>();
  const [appliedAudience, setAppliedAudience] = useState<string | undefined>();

  const [delivery, setDelivery] = useState<NotificationDeliveryStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<'stats' | 'broadcast'>('stats');

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await adminService.getNotificationDeliveryStats({
          since: appliedSince,
          until: appliedUntil,
          audience_role: appliedAudience || undefined,
        });
        if (res.success && res.data) {
          setDelivery(res.data);
        } else {
          setDelivery(null);
          setError(res.message ?? t('admin.deliveryAnalytics.loadError'));
        }
      } catch (e: unknown) {
        setDelivery(null);
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (e as Error)?.message ??
          t('admin.deliveryAnalytics.loadError');
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedSince, appliedUntil, appliedAudience, t]
  );

  useEffect(() => {
    if (segment !== 'stats') return;
    fetchData(false);
  }, [fetchData, segment]);

  const applyFilters = () => {
    const s = sinceInput.trim() || undefined;
    const u = untilInput.trim() || undefined;
    const a = audienceRole.trim() || undefined;
    setAppliedSince(s);
    setAppliedUntil(u);
    setAppliedAudience(a);
  };

  const resetFilters = () => {
    setSinceInput('');
    setUntilInput('');
    setAudienceRole('');
    setAppliedSince(undefined);
    setAppliedUntil(undefined);
    setAppliedAudience(undefined);
  };

  const labeled = delivery?.by_audience_labeled;
  const aud = delivery?.by_audience;

  const statCards = useMemo(() => {
    if (!delivery) return [];
    const gt = delivery.grand_total ?? 0;
    const tr = delivery.tracking?.tracked ?? 0;
    const ut = delivery.tracking?.untracked ?? 0;

    const customers = labeled?.customers ?? aud?.client ?? 0;
    const technicians = labeled?.technicians ?? aud?.technician ?? 0;
    const supervisors = labeled?.supervisors ?? aud?.supervisor ?? 0;
    const areaManagers = labeled?.area_managers ?? aud?.area_manager ?? 0;
    const hr = labeled?.hr ?? aud?.hr ?? 0;
    const admins = labeled?.admins ?? aud?.admin ?? 0;
    const other = labeled?.other ?? aud?.other ?? 0;
    const unknown = labeled?.unknown ?? aud?.unknown ?? 0;
    const untrackedBucket = labeled?.untracked ?? aud?.untracked ?? 0;

    return [
      { label: t('admin.deliveryAnalytics.cards.grandTotal'), value: gt, variant: 'default' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.tracked'), value: tr, variant: 'tracked' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.untracked'), value: ut, variant: 'untracked' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.customers'), value: customers, variant: 'default' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.technicians'), value: technicians, variant: 'default' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.supervisors'), value: supervisors, variant: 'default' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.areaManagers'), value: areaManagers, variant: 'default' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.hr'), value: hr, variant: 'default' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.admins'), value: admins, variant: 'default' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.other'), value: other, variant: 'default' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.unknown'), value: unknown, variant: 'default' as StatVariant },
      { label: t('admin.deliveryAnalytics.cards.untrackedBucket'), value: untrackedBucket, variant: 'default' as StatVariant },
    ];
  }, [delivery, labeled, aud, t]);

  const audienceFilterLabel =
    AUDIENCE_FILTER_OPTIONS.find((o) => o.value === audienceRole)?.labelKey ?? 'allRoles';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {t('admin.deliveryAnalytics.title')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentPill, segment === 'stats' && styles.segmentPillActive]}
            onPress={() => setSegment('stats')}
          >
            <Text style={[styles.segmentText, segment === 'stats' && styles.segmentTextActive]}>
              {t('admin.deliveryAnalytics.segmentStats')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentPill, segment === 'broadcast' && styles.segmentPillActive]}
            onPress={() => {
              setSegment('broadcast');
            }}
          >
            <Text style={[styles.segmentText, segment === 'broadcast' && styles.segmentTextActive]}>
              {t('admin.deliveryAnalytics.segmentBroadcast')}
            </Text>
          </TouchableOpacity>
        </View>

        {segment === 'broadcast' ? (
          <View style={styles.broadcastPlaceholder}>
            <Ionicons name="radio-outline" size={40} color={COLORS.textSecondary} />
            <Text style={styles.broadcastPlaceholderTitle}>{t('admin.deliveryAnalytics.broadcastSoonTitle')}</Text>
            <Text style={styles.broadcastPlaceholderBody}>{t('admin.deliveryAnalytics.broadcastSoonBody')}</Text>
            <TouchableOpacity style={styles.linkBtn} onPress={() => setSegment('stats')}>
              <Text style={styles.linkBtnText}>{t('admin.deliveryAnalytics.backToStats')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.filterCard}>
              <Text style={styles.filterLabel}>{t('admin.deliveryAnalytics.since')}</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textSecondary}
                value={sinceInput}
                onChangeText={setSinceInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.filterLabel, styles.filterLabelSpaced]}>{t('admin.deliveryAnalytics.until')}</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textSecondary}
                value={untilInput}
                onChangeText={setUntilInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.filterLabel, styles.filterLabelSpaced]}>{t('admin.deliveryAnalytics.audience')}</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowAudienceModal(true)}
              >
                <Text style={styles.dropdownText}>
                  {t(`admin.deliveryAnalytics.audienceOptions.${audienceFilterLabel}`)}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <View style={styles.filterActions}>
                <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                  <Text style={styles.applyBtnText}>{t('admin.deliveryAnalytics.apply')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetFilters}>
                  <Text style={styles.resetText}>{t('admin.deliveryAnalytics.reset')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {loading && !delivery ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>{t('admin.notificationStats.loading')}</Text>
              </View>
            ) : null}

            {error && !delivery && !loading ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.applyBtn} onPress={() => fetchData(false)}>
                  <Text style={styles.applyBtnText}>{t('admin.notificationStats.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {delivery ? (
              <>
                <View style={styles.statGrid}>
                  {statCards.map((c, i) => (
                    <View key={i} style={styles.statCell}>
                      <StatCard label={c.label} value={c.value} variant={c.variant} />
                    </View>
                  ))}
                </View>

                <Text style={styles.tableSectionTitle}>{t('admin.deliveryAnalytics.byTypeTitle')}</Text>
                <View style={styles.tableCard}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.th, styles.thType]}>{t('admin.deliveryAnalytics.colType')}</Text>
                    <Text style={[styles.th, styles.thNum]}>{t('admin.deliveryAnalytics.colDeliveries')}</Text>
                  </View>
                  <Text style={styles.thAudience}>{t('admin.deliveryAnalytics.colAudience')}</Text>
                  {(delivery.by_notification_type ?? []).length === 0 ? (
                    <Text style={styles.tableEmpty}>{t('admin.deliveryAnalytics.tableEmpty')}</Text>
                  ) : (
                    (delivery.by_notification_type ?? []).map((row, idx) => (
                      <View key={`${row.notification_type}-${idx}`} style={styles.tableRow}>
                        <Text style={styles.tdType} numberOfLines={2}>
                          {row.notification_type_short || row.notification_type}
                        </Text>
                        <Text style={styles.tdNum}>{row.total_deliveries}</Text>
                        <Text style={styles.tdAudience}>{formatAudienceSample(row.by_audience)}</Text>
                      </View>
                    ))
                  )}
                </View>
              </>
            ) : null}
          </>
        )}
        <View style={styles.bottomPad} />
      </ScrollView>

      <Modal transparent visible={showAudienceModal} animationType="fade" onRequestClose={() => setShowAudienceModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAudienceModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('admin.deliveryAnalytics.audience')}</Text>
            {AUDIENCE_FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value || 'all'}
                style={[styles.modalRow, audienceRole === opt.value && styles.modalRowSelected]}
                onPress={() => {
                  setAudienceRole(opt.value);
                  setShowAudienceModal(false);
                }}
              >
                <Text style={styles.modalRowText}>{t(`admin.deliveryAnalytics.audienceOptions.${opt.labelKey}`)}</Text>
                {audienceRole === opt.value ? (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  segmentRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  segmentPillActive: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  segmentText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.medium },
  segmentTextActive: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  filterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  filterLabel: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.textSecondary, textTransform: 'uppercase' },
  filterLabelSpaced: { marginTop: SPACING.md },
  filterInput: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  dropdown: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  dropdownText: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: COLORS.info,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  applyBtnText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.md },
  resetText: { fontSize: FONT_SIZES.md, color: COLORS.info, fontWeight: FONT_WEIGHTS.semiBold },
  loadingBox: { paddingVertical: SPACING.xl, alignItems: 'center', gap: SPACING.md },
  loadingText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorBox: { paddingVertical: SPACING.lg, gap: SPACING.md },
  errorText: { fontSize: FONT_SIZES.sm, color: COLORS.error, textAlign: 'center' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -SPACING.xs, marginBottom: SPACING.lg },
  statCell: { width: '50%', padding: SPACING.xs },
  statCard: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    minHeight: 88,
    justifyContent: 'center',
  },
  statCardTracked: {
    borderColor: COLORS.success,
    borderWidth: 2,
  },
  statCardUntracked: {
    backgroundColor: '#FFF9E8',
    borderColor: '#E8DCC8',
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  statCardValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.info,
  },
  tableSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  tableCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  tableHeaderRow: { flexDirection: 'row', marginBottom: SPACING.xs },
  th: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textSecondary, textTransform: 'uppercase' },
  thType: { flex: 1 },
  thNum: { width: 72, textAlign: 'right' },
  thAudience: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  tableRow: {
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tdType: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text, marginBottom: SPACING.xs },
  tdNum: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: COLORS.info, marginBottom: SPACING.xs },
  tdAudience: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, lineHeight: 18 },
  tableEmpty: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, paddingVertical: SPACING.md, textAlign: 'center' },
  broadcastPlaceholder: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  broadcastPlaceholderTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  broadcastPlaceholderBody: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  linkBtn: { marginTop: SPACING.lg },
  linkBtnText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  bottomPad: { height: SPACING.xl },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, marginBottom: SPACING.md, color: COLORS.text },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalRowSelected: { backgroundColor: COLORS.surface },
  modalRowText: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
});

export default AdminNotificationDeliveryAnalyticsScreen;
