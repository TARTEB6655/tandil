import React, { useCallback, useMemo, useState, memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  adminService,
  type AdminNotificationItem,
  getAdminNotificationKindI18nKey,
} from '../../services/adminService';

dayjs.extend(relativeTime);

const NOTIFICATION_KIND_OPTIONS = ['announcement', 'tip', 'leave', 'other'] as const;
const AUDIENCE_ROLE_OPTIONS = [
  'client',
  'technician',
  'supervisor',
  'area_manager',
  'hr',
  'admin',
  'other',
] as const;

type ReadFilter = 'all' | 'unread' | 'read';

type AppliedNotificationsQuery = {
  q: string;
  filter: ReadFilter;
  kind: string;
  audience: string;
};

const DEFAULT_NOTIFICATIONS_QUERY: AppliedNotificationsQuery = {
  q: '',
  filter: 'all',
  kind: 'all',
  audience: 'all',
};

type StatCardConfig = {
  value: number;
  labelKey: string;
  variant: 'blue' | 'red' | 'green';
};

type DashboardHeaderProps = {
  t: (key: string, opts?: Record<string, unknown>) => string;
  navigation: { navigate: (name: string) => void };
  searchQuery: string;
  onSearchChange: (q: string) => void;
  readFilter: ReadFilter;
  onReadFilter: (v: ReadFilter) => void;
  kindFilter: string;
  onKindFilter: (v: string) => void;
  audienceRole: string;
  onAudienceRole: (v: string) => void;
  onApplyFilters: () => void;
  listLength: number;
  markingAll: boolean;
  onMarkAllRead: () => void;
  displayList: AdminNotificationItem[];
  selectedIds: Array<string | number>;
  onSelectAllPage: () => void;
  onDeleteSelected: () => void;
  deletingSelected: boolean;
  onClearAll: () => void;
  clearingAll: boolean;
  statCards: StatCardConfig[];
};

const NotificationDashboardHeader = memo(function NotificationDashboardHeader({
  t,
  navigation,
  searchQuery,
  onSearchChange,
  readFilter,
  onReadFilter,
  kindFilter,
  onKindFilter,
  audienceRole,
  onAudienceRole,
  onApplyFilters,
  onResetFilters,
  listLength,
  markingAll,
  onMarkAllRead,
  displayList,
  selectedIds,
  onSelectAllPage,
  onDeleteSelected,
  deletingSelected,
  onClearAll,
  clearingAll,
  statCards,
}: DashboardHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState<'read' | 'kind' | 'audience' | null>(null);
  const closePicker = () => setPickerOpen(null);

  const kindLabel = (k: string) => {
    if (k === 'announcement') return t('admin.notificationStats.filterKindAnnouncement');
    if (k === 'tip') return t('admin.notificationStats.filterKindTip');
    if (k === 'leave') return t('admin.notificationStats.filterKindLeave');
    if (k === 'other') return t('admin.notificationStats.filterKindOther');
    return k;
  };

  const audienceLabel = (r: string) => {
    if (r === 'all') return t('admin.notificationStats.filterAllRoles');
    if (r === 'other') return t('admin.notificationStats.filterAudienceOther');
    if (r === 'client') return t('admin.notificationStats.roles.client');
    if (r === 'technician') return t('admin.notificationStats.roles.technician');
    if (r === 'supervisor') return t('admin.notificationStats.roles.supervisor');
    if (r === 'area_manager') return t('admin.notificationStats.roles.area_manager');
    if (r === 'hr') return t('admin.notificationStats.roles.hr');
    if (r === 'admin') return t('admin.notificationStats.roles.admin');
    return r;
  };

  const statIcon = (variant: StatCardConfig['variant']) => {
    if (variant === 'blue') return { name: 'notifications-outline' as const, color: COLORS.primary };
    if (variant === 'red') return { name: 'people-outline' as const, color: COLORS.error };
    return { name: 'checkmark-circle-outline' as const, color: '#16a34a' };
  };

  const readSummary =
    readFilter === 'all'
      ? t('admin.notificationStats.filterAll')
      : readFilter === 'unread'
        ? t('admin.notificationStats.filterUnread')
        : t('admin.notificationStats.filterRead');

  const kindSummary =
    kindFilter === 'all' ? t('admin.notificationStats.filterAllTypes') : kindLabel(kindFilter);

  const audienceSummary = audienceLabel(audienceRole);

  const modalTitle =
    pickerOpen === 'read'
      ? t('admin.notificationStats.filterPickerStatus')
      : pickerOpen === 'kind'
        ? t('admin.notificationStats.filterPickerKind')
        : pickerOpen === 'audience'
          ? t('admin.notificationStats.filterPickerAudience')
          : '';

  return (
    <View>
      <Text style={styles.pageTitle}>{t('admin.notificationStats.title')}</Text>
      <Text style={styles.pageSubtitle}>{t('admin.notificationStats.dashboardSubtitle')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
        <TouchableOpacity
          style={styles.actionPill}
          onPress={() => navigation.navigate('AdminNotifications')}
        >
          <Ionicons name="notifications-outline" size={18} color={COLORS.text} />
          <Text style={styles.actionPillText}>{t('admin.notificationStats.actionMyNotifications')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionPill}
          onPress={() => navigation.navigate('AdminNotificationDeliveryAnalytics')}
        >
          <Ionicons name="bar-chart-outline" size={18} color={COLORS.text} />
          <Text style={styles.actionPillText}>{t('admin.notificationStats.actionDeliveryAnalytics')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionPill}
          onPress={() => navigation.navigate('AdminBroadcastLog')}
        >
          <Ionicons name="list-outline" size={18} color={COLORS.text} />
          <Text style={styles.actionPillText}>{t('admin.notificationStats.actionBroadcastLog')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionPill, styles.actionPillPrimary]}
          onPress={() => navigation.navigate('AdminSendNotification')}
        >
          <Ionicons name="add" size={18} color={COLORS.surface} />
          <Text style={styles.actionPillTextPrimary}>{t('admin.notificationStats.actionSendNotification')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionPill}
          onPress={onMarkAllRead}
          disabled={markingAll || listLength === 0}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Ionicons name="checkmark-done-outline" size={18} color={COLORS.text} />
              <Text style={styles.actionPillText}>{t('admin.notificationStats.actionMarkAllRead')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.filterCard}>
        <View style={styles.filterHeaderRow}>
          <Text style={styles.filterLabel}>{t('admin.notificationStats.filtersLabel')}</Text>
          <TouchableOpacity onPress={onResetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.resetLink}>{t('admin.notificationStats.resetAll')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={22} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.notificationStats.searchPlaceholder')}
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
          />
        </View>
        <View style={styles.filterDropdownsRow}>
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => setPickerOpen('read')}
            activeOpacity={0.85}
          >
            <Ionicons name="swap-vertical-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.filterDropdownLabel} numberOfLines={1}>
              {readSummary}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => setPickerOpen('kind')}
            activeOpacity={0.85}
          >
            <Ionicons name="pricetag-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.filterDropdownLabel} numberOfLines={1}>
              {kindSummary}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => setPickerOpen('audience')}
            activeOpacity={0.85}
          >
            <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.filterDropdownLabel} numberOfLines={1}>
              {audienceSummary}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyBtnOutline} onPress={onApplyFilters} activeOpacity={0.85}>
            <Text style={styles.applyBtnOutlineText}>{t('admin.notificationStats.applyFilters')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={pickerOpen !== null} transparent animationType="fade" onRequestClose={closePicker}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closePicker} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalSheetTitle}>{modalTitle}</Text>
            <ScrollView style={styles.modalOptionsScroll} keyboardShouldPersistTaps="handled" bounces={false}>
              {pickerOpen === 'read' &&
                (['all', 'unread', 'read'] as ReadFilter[]).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.modalOption, readFilter === key && styles.modalOptionActive]}
                    onPress={() => {
                      onReadFilter(key);
                      closePicker();
                    }}
                  >
                    <Text style={[styles.modalOptionText, readFilter === key && styles.modalOptionTextActive]}>
                      {key === 'all'
                        ? t('admin.notificationStats.filterAll')
                        : key === 'unread'
                          ? t('admin.notificationStats.filterUnread')
                          : t('admin.notificationStats.filterRead')}
                    </Text>
                  </TouchableOpacity>
                ))}
              {pickerOpen === 'kind' && (
                <>
                  <TouchableOpacity
                    style={[styles.modalOption, kindFilter === 'all' && styles.modalOptionActive]}
                    onPress={() => {
                      onKindFilter('all');
                      closePicker();
                    }}
                  >
                    <Text style={[styles.modalOptionText, kindFilter === 'all' && styles.modalOptionTextActive]}>
                      {t('admin.notificationStats.filterAllTypes')}
                    </Text>
                  </TouchableOpacity>
                  {NOTIFICATION_KIND_OPTIONS.map((k) => (
                    <TouchableOpacity
                      key={k}
                      style={[styles.modalOption, kindFilter === k && styles.modalOptionActive]}
                      onPress={() => {
                        onKindFilter(k);
                        closePicker();
                      }}
                    >
                      <Text style={[styles.modalOptionText, kindFilter === k && styles.modalOptionTextActive]}>
                        {kindLabel(k)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {pickerOpen === 'audience' && (
                <>
                  <TouchableOpacity
                    style={[styles.modalOption, audienceRole === 'all' && styles.modalOptionActive]}
                    onPress={() => {
                      onAudienceRole('all');
                      closePicker();
                    }}
                  >
                    <Text
                      style={[styles.modalOptionText, audienceRole === 'all' && styles.modalOptionTextActive]}
                    >
                      {t('admin.notificationStats.filterAllRoles')}
                    </Text>
                  </TouchableOpacity>
                  {AUDIENCE_ROLE_OPTIONS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.modalOption, audienceRole === r && styles.modalOptionActive]}
                      onPress={() => {
                        onAudienceRole(r);
                        closePicker();
                      }}
                    >
                      <Text style={[styles.modalOptionText, audienceRole === r && styles.modalOptionTextActive]}>
                        {audienceLabel(r)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.bulkBar}>
        <Text style={styles.bulkTitle}>{t('admin.notificationStats.bulkActions')}</Text>
        <View style={styles.bulkRow}>
            <TouchableOpacity style={styles.bulkCheckRow} onPress={onSelectAllPage}>
            <Ionicons
              name={
                displayList.length > 0 && displayList.every((i) => selectedIds.includes(i.id))
                  ? 'checkbox'
                  : 'square-outline'
              }
              size={22}
              color={COLORS.primary}
            />
            <Text style={styles.bulkCheckLabel}>{t('admin.notificationStats.selectAllPage')}</Text>
          </TouchableOpacity>
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>
              {t('admin.notificationStats.selectedCount', { count: selectedIds.length })}
            </Text>
          </View>
        </View>
        <View style={styles.bulkActionsRow}>
          <TouchableOpacity
            style={[styles.linkDanger, (selectedIds.length === 0 || deletingSelected) && styles.disabled]}
            onPress={onDeleteSelected}
            disabled={selectedIds.length === 0 || deletingSelected}
          >
            {deletingSelected ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Text style={styles.linkDangerText}>{t('admin.notificationStats.deleteSelected')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteAllBtn, (clearingAll || listLength === 0) && styles.disabled]}
            onPress={onClearAll}
            disabled={clearingAll || listLength === 0}
          >
            {clearingAll ? (
              <ActivityIndicator size="small" color={COLORS.surface} />
            ) : (
              <Text style={styles.deleteAllBtnText}>{t('admin.notificationStats.deleteAll')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        {statCards.map((card, idx) => {
          const ic = statIcon(card.variant);
          const cardStyle =
            card.variant === 'blue'
              ? styles.statCardBlue
              : card.variant === 'red'
                ? styles.statCardRed
                : styles.statCardGreen;
          const valStyle =
            card.variant === 'blue'
              ? styles.statValue
              : card.variant === 'red'
                ? [styles.statValue, styles.statValueRed]
                : [styles.statValue, styles.statValueGreen];
          const iconBg =
            card.variant === 'blue'
              ? styles.statIconBlue
              : card.variant === 'red'
                ? styles.statIconRed
                : styles.statIconGreen;
          return (
            <View key={`${card.labelKey}-${idx}`} style={[styles.statCard, cardStyle]}>
              <Text style={valStyle}>{card.value}</Text>
              <Text style={styles.statLabel}>{t(card.labelKey)}</Text>
              <View style={[styles.statIconBadge, iconBg]}>
                <Ionicons name={ic.name} size={22} color={ic.color} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

/**
 * Alerts tab: notification statistics dashboard (list + filters + bulk actions).
 * Uses GET /admin/notifications with server-side q, filter, kind, audience_role (see Postman).
 */
const AdminNotificationStatisticsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const queryRef = useRef<AppliedNotificationsQuery>({ ...DEFAULT_NOTIFICATIONS_QUERY });

  const [list, setList] = useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingNotificationId, setOpeningNotificationId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [audienceRole, setAudienceRole] = useState<string>('all');

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const p = queryRef.current;
      const res = await adminService.getAdminNotificationsList({
        page: 1,
        per_page: 20,
        q: p.q,
        filter: p.filter,
        kind: p.kind === 'all' ? '' : p.kind,
        audience_role: p.audience === 'all' ? '' : p.audience,
      });
      setList(res.list ?? []);
      setSelectedIds([]);
      if (!res.success) {
        setError(res.message ?? t('admin.notificationStats.inboxLoadError'));
      } else {
        setError(null);
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
          : '';
      setError(msg || (e instanceof Error ? e.message : t('admin.notificationStats.inboxLoadError')));
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  const handleApplyFilters = useCallback(() => {
    queryRef.current = {
      q: searchQuery.trim(),
      filter: readFilter,
      kind: kindFilter,
      audience: audienceRole,
    };
    fetchNotifications(false);
  }, [searchQuery, readFilter, kindFilter, audienceRole, fetchNotifications]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setReadFilter('all');
    setKindFilter('all');
    setAudienceRole('all');
    queryRef.current = { ...DEFAULT_NOTIFICATIONS_QUERY };
    fetchNotifications(false);
  }, [fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      const p = queryRef.current;
      setSearchQuery(p.q);
      setReadFilter(p.filter);
      setKindFilter(p.kind);
      setAudienceRole(p.audience);
      fetchNotifications();
    }, [fetchNotifications])
  );

  const stats = useMemo(() => {
    const total = list.length;
    const unread = list.filter((i) => !i.read_at).length;
    return { total, unread, read: total - unread };
  }, [list]);

  const inboxStatCards = useMemo<StatCardConfig[]>(
    () => [
      { value: stats.total, labelKey: 'admin.notificationStats.statTotal', variant: 'blue' },
      { value: stats.unread, labelKey: 'admin.notificationStats.statUnread', variant: 'red' },
      { value: stats.read, labelKey: 'admin.notificationStats.statRead', variant: 'green' },
    ],
    [stats]
  );

  const iconFor = (item: AdminNotificationItem) => {
    const action = String(item.action || '').toLowerCase();
    const ty = String(item.type || '').toLowerCase();
    const blob = `${ty} ${action} ${item.title} ${item.message}`.toLowerCase();
    if (blob.includes('leave')) return 'calendar-outline';
    if (action.includes('ticket') || ty.includes('support')) return 'chatbubble-ellipses-outline';
    if (action.includes('order') || ty.includes('order')) return 'cart-outline';
    if (action.includes('user') || ty.includes('user')) return 'person-outline';
    if (ty.includes('tip')) return 'leaf-outline';
    return 'information-circle-outline';
  };

  const categoryLabel = (item: AdminNotificationItem) => t(getAdminNotificationKindI18nKey(item));

  const handleNotificationPress = useCallback(
    async (item: AdminNotificationItem) => {
      const meta = (item.meta ?? {}) as Record<string, unknown>;
      const action = String(item.action || '').toLowerCase();
      const metaEntity = String(meta.entity ?? '').toLowerCase();
      const rawTicketId = meta.ticket_id;
      const ticketId =
        typeof rawTicketId === 'number'
          ? rawTicketId
          : typeof rawTicketId === 'string' && rawTicketId.trim()
            ? Number(rawTicketId)
            : NaN;

      const isTicketNotification =
        action.includes('ticket') || metaEntity === 'support_ticket' || Number.isFinite(ticketId);

      if (!isTicketNotification) return;

      if (!Number.isFinite(ticketId)) {
        navigation.navigate('AdminSupportTickets' as never);
        return;
      }

      setOpeningNotificationId(item.id);
      try {
        const res = await adminService.getSupportTicketById(ticketId);
        if (res.success && res.data) {
          navigation.navigate('SupportTicketChat' as never, { ticket: res.data } as never);
        } else {
          navigation.navigate('AdminSupportTickets' as never);
        }
      } catch {
        navigation.navigate('AdminSupportTickets' as never);
      } finally {
        setOpeningNotificationId(null);
      }
    },
    [navigation]
  );

  const toggleSelected = useCallback((id: string | number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }, []);

  const handleSelectAllPage = useCallback(() => {
    const ids = list.map((item) => item.id);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : ids);
  }, [list, selectedIds]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const res = await adminService.markAllNotificationsAsRead();
      if (!res.success) throw new Error(res.message || 'Failed');
      setSelectedIds([]);
      await fetchNotifications(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to mark all as read.';
      Alert.alert(t('common.error'), msg);
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, t, fetchNotifications]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0 || deletingSelected) return;
    setDeletingSelected(true);
    try {
      await Promise.all(selectedIds.map((id) => adminService.deleteNotification(id)));
      setList((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
          : '';
      Alert.alert(t('common.error'), msg || 'Failed to delete.');
    } finally {
      setDeletingSelected(false);
    }
  }, [selectedIds, deletingSelected, t]);

  const handleDeleteOne = useCallback(
    async (id: string | number) => {
      try {
        await adminService.deleteNotification(id);
        setList((prev) => prev.filter((item) => item.id !== id));
        setSelectedIds((prev) => prev.filter((x) => x !== id));
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'response' in e
            ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
            : '';
        Alert.alert(t('common.error'), msg || 'Failed to delete.');
      }
    },
    [t]
  );

  const handleClearAll = useCallback(async () => {
    if (clearingAll || list.length === 0) return;
    Alert.alert(
      t('admin.notificationStats.deleteAll'),
      t('admin.notificationStats.deleteAllConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.notificationStats.deleteAll'),
          style: 'destructive',
          onPress: async () => {
            setClearingAll(true);
            try {
              const res = await adminService.clearAllNotifications();
              if (!res.success) throw new Error(res.message || 'Failed');
              setSelectedIds([]);
              await fetchNotifications(true);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Failed to clear.';
              Alert.alert(t('common.error'), msg);
            } finally {
              setClearingAll(false);
            }
          },
        },
      ]
    );
  }, [clearingAll, list.length, t, fetchNotifications]);

  const renderItem = useCallback(
    ({ item }: { item: AdminNotificationItem }) => (
      <TouchableOpacity
        style={[styles.notifCard, !item.read_at && styles.notifCardUnread]}
        activeOpacity={0.82}
        onPress={() => handleNotificationPress(item)}
        disabled={openingNotificationId === item.id}
      >
        <View style={styles.notifLeading}>
          <TouchableOpacity
            style={styles.checkboxHit}
            onPress={() => toggleSelected(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.checkbox, selectedIds.includes(item.id) && styles.checkboxOn]}>
              {selectedIds.includes(item.id) ? (
                <Ionicons name="checkmark" size={14} color={COLORS.surface} />
              ) : null}
            </View>
          </TouchableOpacity>
          <View style={styles.notifIconCircle}>
            <Ionicons name={iconFor(item) as 'information-circle-outline'} size={20} color={COLORS.primary} />
          </View>
        </View>
        <View style={styles.notifBody}>
          <Text style={styles.notifTitle} numberOfLines={2}>
            {item.title || 'Notification'}
          </Text>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {item.message || '—'}
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{categoryLabel(item)}</Text>
          </View>
        </View>
        <View style={styles.notifTrailing}>
          {openingNotificationId === item.id ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.notifTime}>
              {item.created_at ? dayjs(item.created_at).fromNow() : '—'}
            </Text>
          )}
          <TouchableOpacity
            style={styles.trashBtn}
            onPress={() => handleDeleteOne(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    ),
    [handleNotificationPress, handleDeleteOne, openingNotificationId, selectedIds, toggleSelected, t]
  );

  const listHeaderEl = (
    <NotificationDashboardHeader
      t={t}
      navigation={navigation}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      readFilter={readFilter}
      onReadFilter={setReadFilter}
      kindFilter={kindFilter}
      onKindFilter={setKindFilter}
      audienceRole={audienceRole}
      onAudienceRole={setAudienceRole}
      onApplyFilters={handleApplyFilters}
      onResetFilters={handleResetFilters}
      listLength={list.length}
      markingAll={markingAll}
      onMarkAllRead={handleMarkAllAsRead}
      displayList={list}
      selectedIds={selectedIds}
      onSelectAllPage={handleSelectAllPage}
      onDeleteSelected={handleDeleteSelected}
      deletingSelected={deletingSelected}
      onClearAll={handleClearAll}
      clearingAll={clearingAll}
      statCards={inboxStatCards}
    />
  );

  if (loading && list.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && list.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchNotifications()}>
            <Text style={styles.retryBtnText}>{t('admin.notificationStats.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeaderEl}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>{t('admin.notificationStats.emptyList')}</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: {
    color: COLORS.surface,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  pageTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  pageSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  actionsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionPillPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionPillText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  actionPillTextPrimary: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.surface,
  },
  actionPillTextOnPrimary: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.surface,
  },
  filterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  filterLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  resetLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.md,
    minHeight: 52,
  },
  searchIcon: {
    marginLeft: SPACING.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  filterDropdownsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  filterDropdown: {
    flex: 1,
    minWidth: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  filterDropdownLabel: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  applyBtnOutline: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignSelf: 'center',
  },
  applyBtnOutlineText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    maxHeight: '55%',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalSheetTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalOptionsScroll: {
    maxHeight: 360,
  },
  modalOption: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  modalOptionActive: {
    backgroundColor: COLORS.primary + '12',
  },
  modalOptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  modalOptionTextActive: {
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  bulkBar: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  bulkTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  bulkCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  bulkCheckLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    flex: 1,
  },
  selectedBadge: {
    backgroundColor: COLORS.primary + '22',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  selectedBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  bulkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  linkDanger: {
    paddingVertical: SPACING.xs,
  },
  linkDangerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  deleteAllBtn: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  deleteAllBtnText: {
    color: COLORS.surface,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    paddingRight: SPACING.xl + 8,
    position: 'relative',
    backgroundColor: COLORS.surface,
  },
  statCardBlue: {
    borderColor: COLORS.primary + '44',
  },
  statCardRed: {
    borderColor: COLORS.error + '44',
  },
  statCardGreen: {
    borderColor: '#16a34a' + '44',
  },
  statValue: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  statValueRed: {
    color: COLORS.error,
  },
  statValueGreen: {
    color: '#16a34a',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statIconBadge: {
    position: 'absolute',
    right: SPACING.sm,
    top: SPACING.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBlue: {
    backgroundColor: COLORS.primary + '18',
  },
  statIconRed: {
    backgroundColor: COLORS.error + '18',
  },
  statIconGreen: {
    backgroundColor: '#16a34a' + '18',
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  notifCardUnread: {
    borderColor: COLORS.primary + '55',
  },
  notifLeading: {
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  checkboxHit: {
    marginBottom: SPACING.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.textSecondary + '88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  notifIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBody: {
    flex: 1,
    minWidth: 0,
  },
  notifTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  notifMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  pill: {
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  notifTrailing: {
    alignItems: 'flex-end',
    marginLeft: SPACING.xs,
    minWidth: 72,
  },
  notifTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  trashBtn: {
    padding: SPACING.xs,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
});

export default AdminNotificationStatisticsScreen;
