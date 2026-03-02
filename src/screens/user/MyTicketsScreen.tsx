import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { getSupportTickets, type SupportTicket } from '../../services/supportService';

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

const statusColor = (status: string): string => {
  const s = (status || '').toLowerCase();
  if (s === 'open') return COLORS.error;
  if (s === 'in_progress') return COLORS.warning;
  if (s === 'resolved' || s === 'closed') return COLORS.success;
  return COLORS.textSecondary;
};

const MyTicketsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null);

  const loadTickets = useCallback(async (page: number = 1, isRefresh: boolean = false) => {
    if (isRefresh) setRefreshing(true);
    else if (page === 1) setLoading(true);
    setError(null);
    try {
      const res = await getSupportTickets({ per_page: 20, page });
      if (res.success && res.data) {
        const list = res.data.data ?? [];
        const pag = res.data.pagination;
        setPagination(pag);
        if (page === 1) setTickets(list);
        else setTickets((prev) => [...prev, ...list]);
      } else {
        setError(t('helpCenter.myTickets.errorLoad', 'Failed to load tickets.'));
      }
    } catch {
      setError(t('helpCenter.myTickets.errorLoad', 'Failed to load tickets.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadTickets(1);
    }, [loadTickets])
  );

  const onRefresh = () => loadTickets(1, true);

  const renderTicket = ({ item }: { item: SupportTicket }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('SupportTicketChat', { ticket: item })}
    >
      <View style={styles.cardRow}>
        <Text style={styles.ticketNumber}>{item.ticket_number}</Text>
        <View style={[styles.statusChip, { backgroundColor: statusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
            {t(`helpCenter.myTickets.status.${(item.status || '').toLowerCase().replace(/-/g, '_')}`, item.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.subject}>{item.subject}</Text>
      <Text style={styles.date}>{formatDate(item.created_at)}</Text>
    </TouchableOpacity>
  );

  const total = pagination?.total ?? tickets.length;

  return (
    <View style={styles.container}>
      <Header
        title={t('helpCenter.myTickets.title', 'My Tickets')}
        showBack
        onBackPress={() => navigation.goBack()}
      />
      {loading && tickets.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && tickets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTicket}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListHeaderComponent={
            <Text style={styles.countText}>
              {total} {t('helpCenter.myTickets.tickets', 'tickets')}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>{t('helpCenter.myTickets.empty', 'No support tickets yet.')}</Text>
              <TouchableOpacity style={styles.submitCta} onPress={() => navigation.navigate('SubmitTicket')}>
                <Text style={styles.submitCtaText}>{t('helpCenter.submitTicket.title')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.error },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  countText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  ticketNumber: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
  statusChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  subject: { fontSize: FONT_SIZES.md, color: COLORS.text, marginBottom: SPACING.xs },
  date: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingVertical: SPACING.xl * 2 },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginTop: SPACING.md },
  submitCta: { marginTop: SPACING.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  submitCtaText: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
});

export default MyTicketsScreen;
