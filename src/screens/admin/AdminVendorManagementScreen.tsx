import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  adminVendorManagementService,
  AdminManagedVendor,
  AdminVendorManagementOverview,
} from '../../services/adminVendorManagementService';

const SCREEN_BG = COLORS.surfaceLight;

const AdminVendorManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [vendors, setVendors] = useState<AdminManagedVendor[]>([]);
  const [overview, setOverview] = useState<AdminVendorManagementOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pageNum = 1, isRefresh = false, query = search) => {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const result = await adminVendorManagementService.getManagementPage({
          page: pageNum,
          per_page: 15,
          sort: 'newest',
          search: query,
        });
        if (pageNum === 1) {
          setVendors(result.vendors);
          setOverview(result.overview);
        } else {
          setVendors((prev) => [...prev, ...result.vendors]);
        }
        setPage(result.pagination.current_page);
        setHasMore(result.pagination.current_page < result.pagination.last_page);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : t('adminVendorManagement.loadFailed', { defaultValue: 'Failed to load vendors.' })
        );
        if (pageNum === 1) setVendors([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [search, t]
  );

  useFocusEffect(
    useCallback(() => {
      load(1);
    }, [load])
  );

  const currency = overview?.currency || vendors[0]?.currency || 'AED';
  const revenueDisplay =
    overview?.revenue_formatted ||
    `${currency} ${Math.round(overview?.total_revenue ?? 0)}`;

  const renderVendor = ({ item }: { item: AdminManagedVendor }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() =>
        navigation.navigate('AdminVendorProducts', {
          vendorId: item.vendor_id || item.id,
          vendorName: item.business_name,
        })
      }
    >
      <View style={styles.cardAccent} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          {item.logo_url ? (
            <Image source={{ uri: item.logo_url }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Ionicons name="storefront" size={22} color={COLORS.primary} />
            </View>
          )}
          <View style={styles.cardMeta}>
            <Text style={styles.vendorName} numberOfLines={1}>
              {item.business_name}
            </Text>
            {item.contact_name ? (
              <Text style={styles.vendorSub} numberOfLines={1}>
                {item.contact_name}
              </Text>
            ) : null}
            {item.email ? (
              <Text style={styles.vendorEmail} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
            {item.status_label ? (
              <View
                style={[
                  styles.statusBadge,
                  String(item.status || item.status_label)
                    .toLowerCase()
                    .includes('suspend') && styles.statusBadgeSuspended,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    String(item.status || item.status_label)
                      .toLowerCase()
                      .includes('suspend') && styles.statusBadgeTextSuspended,
                  ]}
                >
                  {item.status_label}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.chevronWrap}>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.primary + '18' }]}>
              <Ionicons name="cube-outline" size={14} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.statValue}>{item.products_count}</Text>
              <Text style={styles.statLabel}>
                {t('adminVendorManagement.products', { defaultValue: 'Products' })}
              </Text>
            </View>
          </View>
          <View style={styles.statChip}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.success + '18' }]}>
              <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.success} />
            </View>
            <View>
              <Text style={styles.statValue}>{item.active_products || item.products_count}</Text>
              <Text style={styles.statLabel}>
                {t('adminVendorManagement.active', { defaultValue: 'Active' })}
              </Text>
            </View>
          </View>
          <View style={[styles.statChip, styles.statChipRevenue]}>
            <View style={[styles.statIcon, { backgroundColor: '#D4A01718' }]}>
              <Ionicons name="cash-outline" size={14} color="#D4A017" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statValue} numberOfLines={1}>
                {item.revenue_formatted || `${item.currency} ${Math.round(item.revenue)}`}
              </Text>
              <Text style={styles.statLabel}>
                {t('adminVendorManagement.revenue', { defaultValue: 'Revenue' })}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const listHeader = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroDecor} />
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.heroBadge}>
          <Ionicons name="storefront-outline" size={14} color="#fff" />
          <Text style={styles.heroBadgeText}>
            {t('admin.dashboard.adminControls', { defaultValue: 'Admin' })}
          </Text>
        </View>
        <Text style={styles.heroTitle}>
          {t('adminVendorManagement.title', { defaultValue: 'Vendor Management' })}
        </Text>
        <Text style={styles.heroSubtitle}>
          {t('adminVendorManagement.heroSubtitle', {
            defaultValue: 'Monitor vendors, products, and marketplace revenue',
          })}
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.primary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('adminVendorManagement.searchPlaceholder', {
            defaultValue: 'Search vendors...',
          })}
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(1, true, search)}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              load(1, true, '');
            }}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.searchBtn} onPress={() => load(1, true, search)}>
            <Text style={styles.searchBtnText}>{t('common.ok', { defaultValue: 'Go' })}</Text>
          </TouchableOpacity>
        )}
      </View>

      {overview ? (
        <View style={styles.overviewRow}>
          <View style={[styles.overviewCard, styles.overviewPrimary]}>
            <Ionicons name="people-outline" size={20} color="#fff" />
            <Text style={styles.overviewValueLight}>{overview.total_vendors}</Text>
            <Text style={styles.overviewLabelLight}>
              {t('adminVendorManagement.vendors', { defaultValue: 'Vendors' })}
            </Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
            <Text style={styles.overviewValue}>{overview.total_products}</Text>
            <Text style={styles.overviewLabel}>
              {t('adminVendorManagement.products', { defaultValue: 'Products' })}
            </Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="cash-outline" size={20} color="#D4A017" />
            <Text style={styles.overviewValue} numberOfLines={1}>
              {revenueDisplay}
            </Text>
            <Text style={styles.overviewLabel}>
              {t('adminVendorManagement.revenue', { defaultValue: 'Revenue' })}
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>
        {t('adminVendorManagement.vendors', { defaultValue: 'Vendors' })}
      </Text>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && vendors.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="cloud-offline-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(1, true)}>
            <Text style={styles.retryText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={(item) => item.id}
          renderItem={renderVendor}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(1, true)}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={() => {
            if (!loadingMore && hasMore) load(page + 1);
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="storefront-outline" size={36} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {t('adminVendorManagement.empty', { defaultValue: 'No vendors found' })}
              </Text>
              <Text style={styles.emptyText}>
                {t('adminVendorManagement.emptyHint', {
                  defaultValue: 'Approved vendors will appear here.',
                })}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: SPACING.md }} color={COLORS.primary} />
            ) : (
              <View style={{ height: SPACING.lg }} />
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BG },
  listContent: { paddingBottom: SPACING.xxl },
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.sm,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: -18,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.text, paddingVertical: 4 },
  searchBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  searchBtnText: { color: '#fff', fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.bold },
  overviewRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  overviewPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  overviewValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  overviewValueLight: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  overviewLabel: { fontSize: 10, color: COLORS.textSecondary },
  overviewLabelLight: { fontSize: 10, color: 'rgba(255,255,255,0.85)' },
  sectionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  card: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardAccent: { width: 4, backgroundColor: COLORS.primary },
  cardBody: { flex: 1, padding: SPACING.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  cardMeta: { flex: 1 },
  vendorName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  vendorSub: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  vendorEmail: { fontSize: FONT_SIZES.xs, color: COLORS.primary, marginTop: 2 },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: COLORS.primary + '14',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  statusBadgeSuspended: {
    backgroundColor: COLORS.error + '18',
  },
  statusBadgeTextSuspended: {
    color: COLORS.error,
  },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: SPACING.xs },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  statChipRevenue: { flex: 1.35 },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  statLabel: { fontSize: 9, color: COLORS.textSecondary },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  emptyText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textAlign: 'center' },
  errorText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  retryText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
});

export default AdminVendorManagementScreen;
