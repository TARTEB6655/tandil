import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, type AdminNotificationItem } from '../../services/adminService';

const AdminNotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [list, setList] = useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingNotificationId, setOpeningNotificationId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [markingSelected, setMarkingSelected] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await adminService.getNotifications({ page: 1, per_page: 50 });
      setList(res.list ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load notifications.');
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const iconFor = (item: AdminNotificationItem) => {
    const action = String(item.action || '').toLowerCase();
    const type = String(item.type || '').toLowerCase();
    if (action.includes('ticket') || type.includes('support')) return 'chatbubble-ellipses-outline';
    if (action.includes('order') || type.includes('order')) return 'cart-outline';
    if (action.includes('user') || type.includes('user')) return 'person-outline';
    return 'notifications-outline';
  };

  const handleNotificationPress = useCallback(async (item: AdminNotificationItem) => {
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
      action.includes('ticket') ||
      metaEntity === 'support_ticket' ||
      Number.isFinite(ticketId);

    if (!isTicketNotification) return;

    if (!Number.isFinite(ticketId)) {
      navigation.navigate('AdminSupportTickets');
      return;
    }

    setOpeningNotificationId(item.id);
    try {
      const res = await adminService.getSupportTicketById(ticketId);
      if (res.success && res.data) {
        navigation.navigate('SupportTicketChat', { ticket: res.data });
      } else {
        navigation.navigate('AdminSupportTickets');
      }
    } catch {
      navigation.navigate('AdminSupportTickets');
    } finally {
      setOpeningNotificationId(null);
    }
  }, [navigation]);

  const toggleSelected = useCallback((id: string | number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = list.map((item) => item.id);
    if (allIds.length === 0) return;
    const areAllSelected = allIds.every((id) => selectedIds.includes(id));
    setSelectedIds(areAllSelected ? [] : allIds);
  }, [list, selectedIds]);

  const handleMarkSelectedAsRead = useCallback(async () => {
    if (selectedIds.length === 0 || markingSelected) return;
    setMarkingSelected(true);
    try {
      await Promise.all(selectedIds.map((id) => adminService.markNotificationAsRead(id)));
      const now = new Date().toISOString();
      setList((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, read_at: item.read_at ?? now } : item))
      );
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Failed to mark selected notifications as read.');
    } finally {
      setMarkingSelected(false);
    }
  }, [selectedIds, markingSelected]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const res = await adminService.markAllNotificationsAsRead();
      if (!res.success) throw new Error(res.message || 'Failed to mark all notifications as read.');
      const now = new Date().toISOString();
      setList((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? now })));
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Failed to mark all notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0 || deletingSelected) return;
    setDeletingSelected(true);
    try {
      await Promise.all(selectedIds.map((id) => adminService.deleteNotification(id)));
      setList((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Failed to delete selected notifications.');
    } finally {
      setDeletingSelected(false);
    }
  }, [selectedIds, deletingSelected]);

  const handleClearAll = useCallback(async () => {
    if (clearingAll || list.length === 0) return;
    setClearingAll(true);
    try {
      const res = await adminService.clearAllNotifications();
      if (!res.success) throw new Error(res.message || 'Failed to clear all notifications.');
      setList([]);
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Failed to clear all notifications.');
    } finally {
      setClearingAll(false);
    }
  }, [clearingAll, list.length]);

  const renderItem = ({ item }: { item: AdminNotificationItem }) => (
    <TouchableOpacity
      style={[styles.card, !item.read_at && styles.cardUnread]}
      activeOpacity={0.82}
      onPress={() => handleNotificationPress(item)}
      disabled={openingNotificationId === item.id}
    >
      <View style={styles.leadingColumn}>
        <TouchableOpacity
          style={styles.checkboxTouchable}
          onPress={() => toggleSelected(item.id)}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.checkbox,
              selectedIds.includes(item.id) && styles.checkboxSelected,
            ]}
          >
            {selectedIds.includes(item.id) ? (
              <Ionicons name="checkmark" size={16} color={COLORS.background} />
            ) : null}
          </View>
        </TouchableOpacity>
        <View style={styles.iconWrap}>
          <Ionicons name={iconFor(item) as any} size={22} color={COLORS.primary} />
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.title || 'Notification'}</Text>
          {openingNotificationId === item.id ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : null}
        </View>
        <Text style={styles.message}>{item.message || '—'}</Text>
        <Text style={styles.time}>
          {item.created_at ? dayjs(item.created_at).format('DD MMM YYYY, hh:mm A') : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.actionsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsRow}
        >
        <TouchableOpacity style={styles.actionBtn} onPress={handleSelectAll}>
          <Text style={styles.actionBtnText}>
            {list.length > 0 && list.every((item) => selectedIds.includes(item.id)) ? 'Unselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary, (selectedIds.length === 0 || markingSelected) && styles.actionBtnDisabled]}
          onPress={handleMarkSelectedAsRead}
          disabled={selectedIds.length === 0 || markingSelected}
        >
          {markingSelected ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <Text style={styles.actionBtnPrimaryText}>Mark as Read</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnOutline, markingAll && styles.actionBtnDisabled]}
          onPress={handleMarkAllAsRead}
          disabled={markingAll}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.actionBtnOutlineText}>Mark All Read</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnDanger, (selectedIds.length === 0 || deletingSelected) && styles.actionBtnDisabled]}
          onPress={handleDeleteSelected}
          disabled={selectedIds.length === 0 || deletingSelected}
        >
          {deletingSelected ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <Text style={styles.actionBtnDangerText}>Delete</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnDangerOutline, (clearingAll || list.length === 0) && styles.actionBtnDisabled]}
          onPress={handleClearAll}
          disabled={clearingAll || list.length === 0}
        >
          {clearingAll ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <Text style={styles.actionBtnDangerOutlineText}>Clear All</Text>
          )}
        </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="notifications-off-outline" size={44} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} colors={[COLORS.primary]} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  backButton: { padding: SPACING.sm },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  headerSpacer: { width: 40 },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  actionsContainer: {
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 0,
  },
  actionBtn: {
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionBtnOutline: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.primary,
  },
  actionBtnDanger: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  actionBtnDangerOutline: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.error,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  actionBtnPrimaryText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  actionBtnOutlineText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  actionBtnDangerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  actionBtnDangerOutlineText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardUnread: {
    borderColor: COLORS.primary + '55',
  },
  leadingColumn: {
    width: 48,
    alignItems: 'center',
    marginRight: SPACING.sm,
    paddingTop: 2,
  },
  checkboxTouchable: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.textSecondary + '88',
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '14',
    marginTop: 0,
  },
  content: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  time: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.error, textAlign: 'center' },
  retryButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
});

export default AdminNotificationsScreen;
