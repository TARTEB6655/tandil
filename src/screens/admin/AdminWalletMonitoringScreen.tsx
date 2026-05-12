import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, AdminUser, UsersResponse } from '../../services/adminService';

const SEARCH_DEBOUNCE_MS = 450;
const PER_PAGE_OPTIONS = [10, 20, 50] as const;

function parseUsersFromResponse(res: UsersResponse | null | undefined): AdminUser[] {
  if (!res?.data) return [];
  if (Array.isArray(res.data)) return res.data;
  const inner = (res.data as { data?: AdminUser[] }).data;
  return Array.isArray(inner) ? inner : [];
}

function getLastPage(res: UsersResponse): number {
  const d = res?.data;
  if (d && typeof d === 'object' && !Array.isArray(d) && 'last_page' in d) {
    const lp = (d as { last_page?: number }).last_page;
    return typeof lp === 'number' && lp > 0 ? lp : 1;
  }
  return 1;
}

function getTotalUsers(res: UsersResponse): number {
  const d = res?.data;
  if (d && typeof d === 'object' && !Array.isArray(d) && 'total' in d) {
    const t = (d as { total?: number }).total;
    if (typeof t === 'number' && t >= 0) return t;
  }
  return parseUsersFromResponse(res).length;
}

function parseMoney(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const AdminWalletMonitoringScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [perPage, setPerPage] = useState<number>(20);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLastPage, setTableLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalBalance: 0,
    activeLiability: 0,
    forfeited: 0,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Avoid full-screen loader after the first successful table load (pagination/search stay on list). */
  const hasCompletedInitialTableLoad = useRef(false);

  const currency = 'AED';

  const fetchOverview = useCallback(async () => {
    setOverviewError(null);
    try {
      const res = await adminService.getAdminWalletOverview();
      const d = res?.data;
      if (d) {
        setSummary({
          totalBalance: parseMoney(d.total_wallet_balance),
          activeLiability: parseMoney(d.active_wallet_liability),
          forfeited: parseMoney(d.forfeited_total),
        });
      } else {
        setSummary({
          totalBalance: 0,
          activeLiability: 0,
          forfeited: 0,
        });
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        t('admin.walletMonitoring.overviewLoadFailed', {
          defaultValue: 'Could not load wallet overview.',
        });
      setOverviewError(msg);
      setSummary({
        totalBalance: 0,
        activeLiability: 0,
        forfeited: 0,
      });
    }
  }, [t]);

  const fetchTable = useCallback(
    async (opts: { search: string; pageNum: number; per: number; isRefresh?: boolean }) => {
      if (opts.isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await adminService.getUsers({
          role: 'client',
          per_page: opts.per,
          page: opts.pageNum,
          search: opts.search.trim() || undefined,
        });
        setRows(parseUsersFromResponse(res));
        setTableTotal(getTotalUsers(res));
        setTableLastPage(getLastPage(res));
        hasCompletedInitialTableLoad.current = true;
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (e as Error)?.message ||
          t('admin.walletMonitoring.loadFailed', { defaultValue: 'Could not load wallet data.' });
        setError(msg);
        setRows([]);
        setTableTotal(0);
        setTableLastPage(1);
        hasCompletedInitialTableLoad.current = true;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  const reloadAll = useCallback(
    async (search: string, pageNum: number, per: number, isRefresh = false) => {
      await Promise.all([fetchOverview(), fetchTable({ search, pageNum, per, isRefresh })]);
    },
    [fetchOverview, fetchTable]
  );

  useFocusEffect(
    useCallback(() => {
      void reloadAll(searchQuery, page, perPage);
    }, [reloadAll, searchQuery, page, perPage])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const onRefresh = () => void reloadAll(searchQuery, page, perPage, true);

  const formatMoney = (n: number) => `${currency} ${n.toFixed(2)}`;

  const openClientWallet = (item: AdminUser) => {
    navigation.navigate('AdminWalletClientDetail', {
      userId: item.id,
      clientName: item.name,
      clientEmail: item.email,
    });
  };

  const summaryCards = useMemo(
    () => [
      {
        key: 'balance',
        label: t('admin.walletMonitoring.totalWalletBalance', { defaultValue: 'Total wallet balance' }),
        value: formatMoney(summary.totalBalance),
        tone: 'blue' as const,
      },
      {
        key: 'liability',
        label: t('admin.walletMonitoring.activeLiability', { defaultValue: 'Active liability' }),
        value: formatMoney(summary.activeLiability),
        tone: 'green' as const,
      },
      {
        key: 'forfeited',
        label: t('admin.walletMonitoring.forfeitedTotal', { defaultValue: 'Forfeited total' }),
        value: formatMoney(summary.forfeited),
        tone: 'grey' as const,
      },
    ],
    [summary.totalBalance, summary.activeLiability, summary.forfeited, t, currency]
  );

  const renderRow = ({ item }: { item: AdminUser }) => (
    <TouchableOpacity
      style={styles.tableRow}
      onPress={() => openClientWallet(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.cellName} numberOfLines={1}>
        {item.name || '—'}
      </Text>
      <Text style={styles.cellEmail} numberOfLines={1}>
        {item.email || '—'}
      </Text>
      <Text style={styles.cellWallet}>{formatMoney(parseMoney(item.wallet_balance))}</Text>
    </TouchableOpacity>
  );

  const fullScreenLoading = loading && !refreshing && !hasCompletedInitialTableLoad.current;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('admin.walletMonitoring.title', { defaultValue: 'Wallet Monitoring' })}</Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      <Text style={styles.subtitle}>
        {t('admin.walletMonitoring.subtitle', {
          defaultValue:
            'Tap a client to see wallet balance, paid and cancelled orders, refunds, and payment status.',
        })}
      </Text>

      {fullScreenLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList<AdminUser>
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRow}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListHeaderComponent={
            <View>
              {overviewError ? (
                <View style={styles.overviewErrorBanner}>
                  <Text style={styles.overviewErrorText}>{overviewError}</Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                {summaryCards.map((c) => (
                  <View
                    key={c.key}
                    style={[
                      styles.summaryCard,
                      c.tone === 'blue' && styles.summaryBlue,
                      c.tone === 'green' && styles.summaryGreen,
                      c.tone === 'grey' && styles.summaryGrey,
                    ]}
                  >
                    <Text style={styles.summaryLabel}>{c.label}</Text>
                    <Text style={styles.summaryValue}>{c.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.searchCard}>
                <Text style={styles.searchTitle}>
                  {t('admin.walletMonitoring.searchTitle', { defaultValue: 'Search' })}
                </Text>
                <Text style={styles.searchHint}>
                  {t('admin.walletMonitoring.searchHint', {
                    defaultValue:
                      'Type to filter clients; results refresh automatically after a short pause while typing.',
                  })}
                </Text>
                <View style={styles.searchRow}>
                  <View style={styles.searchInputWrap}>
                    <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder={t('admin.walletMonitoring.searchPlaceholder', {
                        defaultValue: 'Name or email',
                      })}
                      placeholderTextColor={COLORS.textSecondary}
                      value={searchInput}
                      onChangeText={setSearchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.perPageBlock}>
                    <Text style={styles.perPageLabel}>
                      {t('admin.walletMonitoring.perPage', { defaultValue: 'Per page' })}
                    </Text>
                    <View style={styles.perPageRow}>
                      {PER_PAGE_OPTIONS.map((n) => (
                        <TouchableOpacity
                          key={n}
                          style={[styles.perPageChip, perPage === n && styles.perPageChipActive]}
                          onPress={() => {
                            setPerPage(n);
                            setPage(1);
                          }}
                        >
                          <Text style={[styles.perPageChipText, perPage === n && styles.perPageChipTextActive]}>
                            {n}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.tableHead}>
                <Text style={styles.tableHeadText}>
                  {t('admin.walletMonitoring.clients', { defaultValue: 'Clients' })}
                </Text>
                <Text style={styles.tableMeta}>
                  {t('admin.walletMonitoring.usersCount', {
                    defaultValue: '{{count}} users',
                    count: tableTotal,
                  })}
                </Text>
              </View>
              <View style={styles.colHeader}>
                <Text style={[styles.colH, styles.colName]}>{t('admin.walletMonitoring.columns.name', 'Name')}</Text>
                <Text style={[styles.colH, styles.colEmail]}>{t('admin.walletMonitoring.columns.email', 'Email')}</Text>
                <Text style={[styles.colH, styles.colWallet]}>
                  {t('admin.walletMonitoring.columns.walletBalance', { defaultValue: 'Wallet balance' })}
                </Text>
              </View>
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {t('admin.walletMonitoring.empty', { defaultValue: 'No clients match your search.' })}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            tableLastPage > 1 ? (
              <View style={styles.pager}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Text style={styles.pageBtnText}>{t('admin.walletMonitoring.prev', 'Previous')}</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {t('admin.walletMonitoring.pageOf', {
                    defaultValue: 'Page {{page}} / {{last}}',
                    page,
                    last: tableLastPage,
                  })}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page >= tableLastPage && styles.pageBtnDisabled]}
                  disabled={page >= tableLastPage}
                  onPress={() => setPage((p) => Math.min(tableLastPage, p + 1))}
                >
                  <Text style={styles.pageBtnText}>{t('admin.walletMonitoring.next', 'Next')}</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  headerRightSpacer: {
    width: 40,
  },
  subtitle: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewErrorBanner: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.error + '18',
    borderWidth: 1,
    borderColor: COLORS.error + '44',
  },
  overviewErrorText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  summaryBlue: {
    backgroundColor: '#E8F4FC',
    borderColor: '#B8D9F0',
  },
  summaryGreen: {
    backgroundColor: '#E8F5EC',
    borderColor: '#B8DCC4',
  },
  summaryGrey: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  searchCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  searchHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  searchRow: {
    gap: SPACING.md,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  perPageBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  perPageLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  perPageRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  perPageChip: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  perPageChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '14',
  },
  perPageChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  perPageChipTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  tableHeadText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  tableMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  colHeader: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  colH: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  colName: { flex: 1.1 },
  colEmail: { flex: 1.2 },
  colWallet: { flex: 0.95, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  cellName: { flex: 1.1, fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  cellEmail: { flex: 1.2, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  cellWallet: {
    flex: 0.95,
    textAlign: 'right',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  errorBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.error + '12',
    borderRadius: BORDER_RADIUS.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  pageBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  pageInfo: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
});

export default AdminWalletMonitoringScreen;
