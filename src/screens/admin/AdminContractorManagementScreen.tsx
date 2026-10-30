import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import type {
  ContractorSignupRequest,
  ContractorSignupStatusFilter,
} from '../../types/contractorSignup';
import {
  adminContractorRegistrationService,
  type AdminContractorFilterCounts,
  type AdminContractorSummary,
} from '../../services/adminContractorRegistrationService';
import ContractorSignupDetailModal from '../../components/admin/ContractorSignupDetailModal';
import ContractorRejectReasonModal from '../../components/admin/ContractorRejectReasonModal';
import ContractorApproveModal from '../../components/admin/ContractorApproveModal';
import ContractorSuspendModal from '../../components/admin/ContractorSuspendModal';
import ContractorActivateModal from '../../components/admin/ContractorActivateModal';

const FILTERS: ContractorSignupStatusFilter[] = [
  'pending',
  'active',
  'suspended',
  'rejected',
  'all',
];

function statusStyle(status: ContractorSignupRequest['status']) {
  switch (status) {
    case 'active':
      return { bg: COLORS.success + '18', text: COLORS.success, icon: 'checkmark-circle' as const };
    case 'rejected':
      return { bg: COLORS.error + '18', text: COLORS.error, icon: 'close-circle' as const };
    case 'inactive':
      return { bg: COLORS.textSecondary + '18', text: COLORS.textSecondary, icon: 'pause-circle' as const };
    case 'suspended':
      return { bg: COLORS.warning + '18', text: COLORS.warning, icon: 'remove-circle-outline' as const };
    default:
      return { bg: COLORS.warning + '20', text: COLORS.warning, icon: 'time' as const };
  }
}

const AdminContractorManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [filter, setFilter] = useState<ContractorSignupStatusFilter>('pending');
  const [requests, setRequests] = useState<ContractorSignupRequest[]>([]);
  const [summary, setSummary] = useState<AdminContractorSummary>({
    pending: 0,
    active: 0,
    total: 0,
  });
  const [filterCounts, setFilterCounts] = useState<AdminContractorFilterCounts>({
    pending: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
    rejected: 0,
    all: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(search);
  searchRef.current = search;
  const [selected, setSelected] = useState<ContractorSignupRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [reasonModal, setReasonModal] = useState<
    null | { request: ContractorSignupRequest }
  >(null);
  const [approveTarget, setApproveTarget] = useState<ContractorSignupRequest | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<ContractorSignupRequest | null>(null);
  const [activateTarget, setActivateTarget] = useState<ContractorSignupRequest | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await adminContractorRegistrationService.getRegistrations({
          status: filter,
          page: 1,
          per_page: 15,
          search: searchRef.current,
        });
        setRequests(result.items);
        setSummary(result.summary);
        setFilterCounts(result.filters);
      } catch (err: unknown) {
        Alert.alert(
          t('admin.users.error', 'Error'),
          adminContractorRegistrationService.getErrorMessage(
            err,
            t('adminContractor.loadFailed')
          )
        );
        setRequests([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, t]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 400);
    return () => clearTimeout(timer);
  }, [search, load]);

  const filterCount = (key: ContractorSignupStatusFilter) => {
    if (key === 'all') return filterCounts.all;
    return filterCounts[key] ?? 0;
  };

  const filterLabel = (key: ContractorSignupStatusFilter) => {
    const labels: Record<ContractorSignupStatusFilter, string> = {
      pending: t('adminContractor.filterPending'),
      active: t('adminContractor.filterActive'),
      inactive: t('adminContractor.filterInactive'),
      suspended: t('adminContractor.filterSuspended'),
      rejected: t('adminContractor.filterRejected'),
      all: t('adminContractor.filterAll'),
    };
    return labels[key];
  };

  const statusLabel = (item: ContractorSignupRequest) => {
    if (item.status_label?.trim()) return item.status_label;
    return t(`adminContractor.status.${item.status}`, { defaultValue: item.status });
  };

  const reloadSelected = async (id: string) => {
    const fresh = await adminContractorRegistrationService.getById(id);
    if (fresh) setSelected(fresh);
  };

  const openContractorDetail = useCallback((item: ContractorSignupRequest) => {
    setSelected(item);
    setDetailLoading(true);
    void (async () => {
      try {
        const fresh = await adminContractorRegistrationService.getById(item.id);
        if (fresh) setSelected(fresh);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, []);

  const runApprove = async (item: ContractorSignupRequest) => {
    setActioning(true);
    try {
      await adminContractorRegistrationService.approve(item.id);
      setApproveTarget(null);
      setSelected(null);
      Alert.alert(t('common.success'), t('adminContractor.approvedSuccess'));
      await load(true);
    } catch (err: unknown) {
      Alert.alert(
        t('common.error'),
        adminContractorRegistrationService.getErrorMessage(err, t('adminContractor.approveFailed'))
      );
    } finally {
      setActioning(false);
    }
  };

  const runReject = async (item: ContractorSignupRequest, reason: string) => {
    setActioning(true);
    try {
      await adminContractorRegistrationService.reject(item.id, reason);
      setReasonModal(null);
      setSelected(null);
      Alert.alert(t('common.success'), t('adminContractor.rejectedSuccess'));
      await load(true);
    } catch (err: unknown) {
      Alert.alert(
        t('common.error'),
        adminContractorRegistrationService.getErrorMessage(err, t('adminContractor.rejectFailed'))
      );
    } finally {
      setActioning(false);
    }
  };

  const runActivate = async (item: ContractorSignupRequest) => {
    setActioning(true);
    try {
      await adminContractorRegistrationService.activate(item.id);
      setActivateTarget(null);
      setSelected(null);
      Alert.alert(t('common.success'), t('adminContractor.activatedSuccess'));
      await load(true);
    } catch (err: unknown) {
      Alert.alert(
        t('common.error'),
        adminContractorRegistrationService.getErrorMessage(err, t('adminContractor.activateFailed'))
      );
    } finally {
      setActioning(false);
    }
  };

  const runSuspend = async (item: ContractorSignupRequest) => {
    setActioning(true);
    try {
      await adminContractorRegistrationService.suspend(item.id);
      setSuspendTarget(null);
      setSelected(null);
      Alert.alert(t('common.success'), t('adminContractor.suspendedSuccess'));
      await load(true);
    } catch (err: unknown) {
      Alert.alert(
        t('common.error'),
        adminContractorRegistrationService.getErrorMessage(err, t('adminContractor.suspendFailed'))
      );
    } finally {
      setActioning(false);
    }
  };

  const runDelete = (item: ContractorSignupRequest) => {
    Alert.alert(
      t('adminContractor.deleteTitle', { defaultValue: 'Delete contractor' }),
      t('adminContractor.deleteMessage', {
        defaultValue: 'Delete {{name}}? This cannot be undone.',
        name: item.company_name,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            setActioning(true);
            try {
              const res = await adminContractorRegistrationService.remove(item.id);
              setSelected(null);
              await load(true);
              Alert.alert(
                t('common.success'),
                res.message ||
                  t('adminContractor.deletedSuccess', {
                    defaultValue: 'Contractor registration deleted.',
                  })
              );
            } catch (err: unknown) {
              Alert.alert(
                t('common.error'),
                adminContractorRegistrationService.getErrorMessage(
                  err,
                  t('adminContractor.deleteFailed', { defaultValue: 'Could not delete contractor.' })
                )
              );
            } finally {
              setActioning(false);
            }
          },
        },
      ]
    );
  };

  const detailOpenId = selected?.id ?? null;
  const approveSheetInDetail =
    approveTarget != null && detailOpenId != null && String(approveTarget.id) === String(detailOpenId);
  const suspendSheetInDetail =
    suspendTarget != null && detailOpenId != null && String(suspendTarget.id) === String(detailOpenId);
  const activateSheetInDetail =
    activateTarget != null && detailOpenId != null && String(activateTarget.id) === String(detailOpenId);
  const reasonSheetInDetail =
    reasonModal != null && detailOpenId != null && String(reasonModal.request.id) === String(detailOpenId);

  const renderItem = ({ item }: { item: ContractorSignupRequest }) => {
    const st = statusStyle(item.status);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openContractorDetail(item)}>
        <View style={styles.cardIcon}>
          <Ionicons name="business-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.company_name}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.name} · {item.email}
          </Text>
          <View style={[styles.pill, { backgroundColor: st.bg }]}>
            <Ionicons name={st.icon} size={12} color={st.text} />
            <Text style={[styles.pillText, { color: st.text }]}>
              {statusLabel(item)}
            </Text>
          </View>
        </View>
        {item.status === 'pending' ? (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickApprove}
              onPress={() => setApproveTarget(item)}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickReject} onPress={() => setReasonModal({ request: item })}>
              <Ionicons name="close" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.hero}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.heroSettingsBtn}
          onPress={() => navigation.navigate('AdminContractorRegistrationOptions')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="options-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>
          {t('admin.dashboard.contractorManagement', { defaultValue: 'Contractor Management' })}
        </Text>
        <Text style={styles.heroSub}>{t('adminContractor.heroSub')}</Text>
        <TouchableOpacity
          style={styles.manageOptionsBtn}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('AdminContractorRegistrationOptions')}
        >
          <Ionicons name="list-outline" size={18} color={COLORS.primary} />
          <Text style={styles.manageOptionsText}>{t('adminContractor.manageSignupOptions')}</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('adminContractor.searchPlaceholder')}
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: COLORS.warning + '40' }]}>
            <Text style={[styles.statValue, { color: COLORS.warning }]}>{summary.pending}</Text>
            <Text style={styles.statLabel}>{t('adminContractor.statPending')}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: COLORS.success + '40' }]}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{summary.active}</Text>
            <Text style={styles.statLabel}>{t('adminContractor.statActive')}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: COLORS.primary + '40' }]}>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>{summary.total}</Text>
            <Text style={styles.statLabel}>{t('adminContractor.statTotal')}</Text>
          </View>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            {FILTERS.map((key) => {
              const active = filter === key;
              const st = key !== 'all' ? statusStyle(key as ContractorSignupRequest['status']) : null;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive,
                    active && st && { backgroundColor: st.text, borderColor: st.text },
                  ]}
                  onPress={() => setFilter(key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.filterChipText, active && styles.filterChipTextActive]}
                    numberOfLines={1}
                  >
                    {filterLabel(key)}
                  </Text>
                  <View
                    style={[
                      styles.filterBadge,
                      active && styles.filterBadgeActive,
                      !active && st && { backgroundColor: st.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        active && styles.filterBadgeTextActive,
                        !active && st && { color: st.text },
                      ]}
                    >
                      {filterCount(key)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={40} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>{t('adminContractor.emptyTitle')}</Text>
                <Text style={styles.emptyHint}>{t('adminContractor.emptyHint')}</Text>
              </View>
            }
          />
        )}
      </View>

      <ContractorSignupDetailModal
        visible={selected != null}
        request={selected}
        loading={detailLoading}
        actioning={actioning}
        onClose={() => {
          setSelected(null);
          setDetailLoading(false);
        }}
        onApprove={() => selected && setApproveTarget(selected)}
        onReject={() => selected && setReasonModal({ request: selected })}
        onSuspend={() => selected && setSuspendTarget(selected)}
        onActivate={() => selected && setActivateTarget(selected)}
        onDelete={() => selected && runDelete(selected)}
        overlay={
          <>
            {approveSheetInDetail ? (
              <ContractorApproveModal
                embedded
                visible
                request={approveTarget}
                loading={actioning}
                onClose={() => setApproveTarget(null)}
                onConfirm={() => {
                  if (approveTarget) void runApprove(approveTarget);
                }}
              />
            ) : null}
            {suspendSheetInDetail ? (
              <ContractorSuspendModal
                embedded
                visible
                request={suspendTarget}
                loading={actioning}
                onClose={() => setSuspendTarget(null)}
                onConfirm={() => {
                  if (suspendTarget) void runSuspend(suspendTarget);
                }}
              />
            ) : null}
            {activateSheetInDetail ? (
              <ContractorActivateModal
                embedded
                visible
                request={activateTarget}
                loading={actioning}
                onClose={() => setActivateTarget(null)}
                onConfirm={() => {
                  if (activateTarget) void runActivate(activateTarget);
                }}
              />
            ) : null}
            {reasonSheetInDetail && reasonModal ? (
              <ContractorRejectReasonModal
                embedded
                visible
                request={reasonModal.request}
                title={t('adminContractor.rejectTitle')}
                message={t('adminContractor.rejectConfirm', {
                  name: reasonModal.request.company_name,
                })}
                confirmLabel={t('adminContractor.reject')}
                requireReason
                loading={actioning}
                onClose={() => setReasonModal(null)}
                onConfirm={(reason) => {
                  void runReject(reasonModal.request, reason);
                }}
              />
            ) : null}
          </>
        }
      />

      <ContractorApproveModal
        visible={approveTarget != null && !approveSheetInDetail}
        request={approveTarget}
        loading={actioning}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => {
          if (approveTarget) void runApprove(approveTarget);
        }}
      />

      <ContractorSuspendModal
        visible={suspendTarget != null && !suspendSheetInDetail}
        request={suspendTarget}
        loading={actioning}
        onClose={() => setSuspendTarget(null)}
        onConfirm={() => {
          if (suspendTarget) void runSuspend(suspendTarget);
        }}
      />

      <ContractorActivateModal
        visible={activateTarget != null && !activateSheetInDetail}
        request={activateTarget}
        loading={actioning}
        onClose={() => setActivateTarget(null)}
        onConfirm={() => {
          if (activateTarget) void runActivate(activateTarget);
        }}
      />

      <ContractorRejectReasonModal
        visible={reasonModal != null && !reasonSheetInDetail}
        request={reasonModal?.request ?? null}
        title={t('adminContractor.rejectTitle')}
        message={
          reasonModal
            ? t('adminContractor.rejectConfirm', { name: reasonModal.request.company_name })
            : ''
        }
        confirmLabel={t('adminContractor.reject')}
        requireReason
        loading={actioning}
        onClose={() => setReasonModal(null)}
        onConfirm={(reason) => {
          if (reasonModal) void runReject(reasonModal.request, reason);
        }}
      />
    </View>
  );
};

export default AdminContractorManagementScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroSettingsBtn: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: '#fff' },
  heroSub: { fontSize: FONT_SIZES.sm, color: 'rgba(255,255,255,0.85)', marginTop: SPACING.xs },
  manageOptionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
  },
  manageOptionsText: { flex: 1, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  body: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: -SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
    zIndex: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.text },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  filterSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    lineHeight: 20,
  },
  filterChipTextActive: { color: COLORS.background },
  filterBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textSecondary,
  },
  filterBadgeTextActive: { color: COLORS.background },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxl,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  cardSub: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  pillText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  quickActions: { flexDirection: 'row', gap: SPACING.xs },
  quickApprove: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickReject: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.error + '14',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '44',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyText: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  emptyHint: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textAlign: 'center' },
});
