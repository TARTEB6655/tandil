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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { adminService, AdminSupportTicket } from '../../services/adminService';

const PER_PAGE = 20;
type StatusFilter = '' | 'open' | 'in_progress' | 'resolved' | 'closed';

const STATUS_OPTIONS: { value: StatusFilter; labelKey: string }[] = [
  { value: '', labelKey: 'admin.supportTickets.all' },
  { value: 'open', labelKey: 'admin.supportTickets.open' },
  { value: 'in_progress', labelKey: 'admin.supportTickets.inProgress' },
  { value: 'resolved', labelKey: 'admin.supportTickets.resolved' },
  { value: 'closed', labelKey: 'admin.supportTickets.closed' },
];

function formatDate(iso: string): string {
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

const AdminSupportTicketsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [pagination, setPagination] = useState<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const fetchTickets = useCallback(
    async (pageNum: number = 1, isRefresh: boolean = false) => {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await adminService.getSupportTickets({
          status: statusFilter || undefined,
          per_page: PER_PAGE,
          page: pageNum,
          search: searchQuery.trim() || undefined,
        });
        const list = res?.data?.data ?? [];
        const pag = res?.data?.pagination ?? null;
        if (pageNum === 1 || isRefresh) {
          setTickets(list);
          setPagination(pag);
          setPage(1);
        } else {
          setTickets((prev) => [...prev, ...list]);
          setPagination(pag);
          setPage(pageNum);
        }
      } catch (_) {
        if (pageNum === 1) setTickets([]);
        setPagination(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchTickets(1);
  }, [fetchTickets]);

  useFocusEffect(
    useCallback(() => {
      fetchTickets(1);
    }, [fetchTickets])
  );

  const onRefresh = useCallback(() => {
    fetchTickets(1, true);
  }, [fetchTickets]);

  const loadMore = useCallback(() => {
    if (!pagination || page >= pagination.last_page || loadingMore) return;
    fetchTickets(page + 1);
  }, [pagination, page, loadingMore, fetchTickets]);

  const handleSearchSubmit = useCallback(() => {
    Keyboard.dismiss();
    fetchTickets(1, true);
  }, [fetchTickets]);

  const renderTicket = ({ item }: { item: AdminSupportTicket }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('SupportTicketChat', { ticket: item })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.ticketNumber}>{item.ticket_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
            {t(`admin.supportTickets.status.${(item.status || '').toLowerCase().replace(/-/g, '_')}`, item.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
      <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>{item.user_name || item.email}</Text>
        <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  const total = pagination?.total ?? 0;

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.supportTickets.title', 'Support Tickets')}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder={t('admin.supportTickets.searchPlaceholder', 'Search by ticket #, subject, email...')}
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); fetchTickets(1, true); }} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleSearchSubmit}>
          <Text style={styles.searchSubmitText}>{t('admin.supportTickets.search', 'Search')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value || 'all'}
            style={[styles.filterChip, statusFilter === opt.value && styles.filterChipActive]}
            onPress={() => setStatusFilter(opt.value)}
          >
            <Text style={[styles.filterChipText, statusFilter === opt.value && styles.filterChipTextActive]}>
              {t(opt.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && page === 1 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.supportTickets.loading', 'Loading tickets...')}</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTicket}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>{t('admin.supportTickets.noTickets', 'No support tickets found.')}</Text>
            </View>
          }
          ListHeaderComponent={
            total > 0 ? (
              <Text style={styles.resultCount}>
                {total} {t('admin.supportTickets.tickets', 'tickets')}
              </Text>
            ) : null
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} style={styles.footerLoader} /> : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
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
  searchSubmitText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.background },
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
    borderRadius: BORDER_RADIUS.full,
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  ticketNumber: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  subject: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text, marginBottom: 4 },
  message: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  metaText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  loadingText: { marginTop: SPACING.sm, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyText: { marginTop: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  footerLoader: { paddingVertical: SPACING.md },
});

export default AdminSupportTicketsScreen;
