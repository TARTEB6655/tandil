import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Keyboard,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import {
  adminSupportChatService,
  AdminSupportChatSession,
} from '../../services/adminSupportChatService';

const PER_PAGE = 20;
type StatusFilter = '' | 'open' | 'in_progress' | 'resolved' | 'closed';

const STATUS_FILTER_KEYS: { value: StatusFilter; labelKey: string }[] = [
  { value: '', labelKey: 'adminVendorLiveChat.filterAll' },
  { value: 'open', labelKey: 'adminVendorLiveChat.filterOpen' },
  { value: 'in_progress', labelKey: 'adminVendorLiveChat.filterInProgress' },
  { value: 'resolved', labelKey: 'adminVendorLiveChat.filterResolved' },
  { value: 'closed', labelKey: 'adminVendorLiveChat.filterClosed' },
];

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hour = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${day}/${month}/${year} ${hour12}:${min} ${ampm}`;
  } catch {
    return iso;
  }
}

function statusColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'open') return COLORS.error;
  if (s === 'in_progress') return COLORS.warning;
  if (s === 'resolved' || s === 'closed') return COLORS.success;
  return COLORS.textSecondary;
}

const AdminVendorLiveChatSessionsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [sessions, setSessions] = useState<AdminSupportChatSession[]>([]);
  const [pagination, setPagination] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const fetchSessions = useCallback(
    async (pageNum: number = 1, isRefresh: boolean = false) => {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await adminSupportChatService.listSessions({
          user_role: 'vendor',
          status: statusFilter || undefined,
          per_page: PER_PAGE,
          page: pageNum,
          search: searchQuery.trim() || undefined,
        });
        if (pageNum === 1 || isRefresh) {
          setSessions(res.sessions);
          setPagination(res.pagination);
          setPage(1);
        } else {
          setSessions((prev) => [...prev, ...res.sessions]);
          setPagination(res.pagination);
          setPage(pageNum);
        }
      } catch {
        if (pageNum === 1) {
          setSessions([]);
          setPagination(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchSessions(1);
  }, [fetchSessions]);

  useFocusEffect(
    useCallback(() => {
      fetchSessions(1);
    }, [fetchSessions])
  );

  const onRefresh = useCallback(() => {
    fetchSessions(1, true);
  }, [fetchSessions]);

  const loadMore = useCallback(() => {
    if (!pagination || page >= pagination.last_page || loadingMore) return;
    fetchSessions(page + 1);
  }, [pagination, page, loadingMore, fetchSessions]);

  const handleSearchSubmit = useCallback(() => {
    Keyboard.dismiss();
    fetchSessions(1, true);
  }, [fetchSessions]);

  const handleUpdateStatus = useCallback(
    async (item: AdminSupportChatSession, status: 'open' | 'in_progress' | 'resolved' | 'closed') => {
      if ((item.status || '').toLowerCase() === status) return;
      try {
        await adminSupportChatService.updateStatus(item.id, status);
        setSessions((prev) =>
          prev.map((session) =>
            String(session.id) === String(item.id)
              ? { ...session, status, status_label: status.replace(/_/g, ' ') }
              : session
          )
        );
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
            ?.message ||
          (err as { message?: string })?.message ||
          t('adminVendorLiveChat.statusUpdateFailed', { defaultValue: 'Failed to update status.' });
        Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
      }
    },
    [t]
  );

  const renderSession = ({ item }: { item: AdminSupportChatSession }) => {
    const displayName = item.business_name || item.vendor_name;
    const unread = item.unread_count ?? 0;
    const currentStatus = (item.status || '').toLowerCase();
    const isResolved = currentStatus === 'resolved';
    const isClosed = currentStatus === 'closed';

    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AdminVendorLiveChat', { session: item })}
        >
          <View style={styles.cardHeader}>
            <View style={styles.vendorAvatar}>
              <Text style={styles.vendorAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.cardHeaderText}>
              <View style={styles.titleRow}>
                <Text style={styles.vendorName} numberOfLines={1}>
                  {displayName}
                </Text>
                {unread > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                ) : null}
              </View>
              {item.vendor_email ? (
                <Text style={styles.vendorEmail} numberOfLines={1}>
                  {item.vendor_email}
                </Text>
              ) : null}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                {item.status_label || item.status}
              </Text>
            </View>
          </View>
          {item.last_message ? (
            <Text style={styles.lastMessage} numberOfLines={2}>
              {item.last_message}
            </Text>
          ) : (
            <Text style={styles.lastMessageMuted}>
              {t('adminVendorLiveChat.noMessagesYet', { defaultValue: 'No messages yet' })}
            </Text>
          )}
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>
              {formatDate(item.last_message_at || item.updated_at || item.created_at)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </View>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          {!isResolved ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.resolveButton]}
              onPress={() => handleUpdateStatus(item, 'resolved')}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
              <Text style={[styles.actionButtonText, styles.resolveButtonText]}>
                {t('adminVendorLiveChat.markResolved', { defaultValue: 'Mark Resolved' })}
              </Text>
            </TouchableOpacity>
          ) : null}
          {!isClosed ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.closeButton]}
              onPress={() => handleUpdateStatus(item, 'closed')}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
              <Text style={[styles.actionButtonText, styles.closeButtonText]}>
                {t('adminVendorLiveChat.markClosed', { defaultValue: 'Mark Closed' })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const total = pagination?.total ?? 0;

  return (
    <View style={styles.container}>
      <Header
        title={t('adminVendorLiveChat.title', { defaultValue: 'Vendor Live Chat' })}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder={t('adminVendorLiveChat.searchPlaceholder', {
              defaultValue: 'Search vendor name or message...',
            })}
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                fetchSessions(1, true);
              }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleSearchSubmit}>
          <Text style={styles.searchSubmitText}>
            {t('adminVendorLiveChat.search', { defaultValue: 'Search' })}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTER_KEYS.map((opt) => (
          <TouchableOpacity
            key={opt.value || 'all'}
            style={[styles.filterChip, statusFilter === opt.value && styles.filterChipActive]}
            onPress={() => setStatusFilter(opt.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === opt.value && styles.filterChipTextActive,
              ]}
            >
              {t(opt.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && page === 1 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('adminVendorLiveChat.loading', { defaultValue: 'Loading vendor chats...' })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSession}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {t('adminVendorLiveChat.empty', {
                  defaultValue: 'No vendor chat sessions found.',
                })}
              </Text>
            </View>
          }
          ListHeaderComponent={
            total > 0 ? (
              <Text style={styles.resultCount}>
                {total}{' '}
                {t('adminVendorLiveChat.sessions', { defaultValue: 'vendor chats' })}
              </Text>
            ) : null
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.footerLoader} />
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { marginLeft: SPACING.md },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  clearBtn: { padding: SPACING.sm },
  searchSubmitBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
  },
  searchSubmitText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  filterChip: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  filterChipTextActive: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  resultCount: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  vendorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  vendorAvatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  cardHeaderText: { flex: 1, marginRight: SPACING.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  vendorName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  vendorEmail: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  lastMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  lastMessageMuted: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  actionButtonText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  resolveButton: {
    borderColor: COLORS.success + '55',
    backgroundColor: COLORS.success + '10',
  },
  resolveButtonText: { color: COLORS.success },
  closeButton: {
    borderColor: COLORS.error + '55',
    backgroundColor: COLORS.error + '10',
  },
  closeButtonText: { color: COLORS.error },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  loadingText: { marginTop: SPACING.sm, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyText: { marginTop: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  footerLoader: { paddingVertical: SPACING.md },
});

export default AdminVendorLiveChatSessionsScreen;
