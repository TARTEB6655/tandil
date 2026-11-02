import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import {
  adminVendorPricingService,
  type AdminVendorPricingListItem,
} from '../../services/adminVendorPricingService';

const PER_PAGE = 15;

const AdminVendorPricingListScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [vendors, setVendors] = useState<AdminVendorPricingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const searchRef = useRef(search);
  searchRef.current = search;
  const pageRef = useRef(page);
  pageRef.current = page;

  const fetchPage = useCallback(
    async (pageNum: number, mode: 'replace' | 'append', searchQuery: string) => {
      const result = await adminVendorPricingService.listVendors({
        page: pageNum,
        per_page: PER_PAGE,
        search: searchQuery,
      });
      setPage(result.pagination.current_page);
      setHasMore(result.pagination.current_page < result.pagination.last_page);
      setVendors((prev) =>
        mode === 'append' ? [...prev, ...result.items] : result.items
      );
    },
    []
  );

  const loadFirstPage = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        await fetchPage(1, 'replace', searchRef.current.trim());
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : t('admin.settings.productSettings.vendorPricing.loadFailed', {
                defaultValue: 'Could not load vendors.',
              })
        );
        setVendors([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchPage, t]
  );

  const loadNextPage = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      await fetchPage(pageRef.current + 1, 'append', searchRef.current.trim());
    } catch {
      // keep existing list
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore]);

  const skipSearchDebounce = useRef(true);

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage(false);
    }, [loadFirstPage])
  );

  useEffect(() => {
    if (skipSearchDebounce.current) {
      skipSearchDebounce.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void loadFirstPage(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, loadFirstPage]);

  const renderPriceChip = (label: string, value: string | null, accent?: boolean) => {
    if (!value) return null;
    return (
      <View style={[styles.priceChip, accent && styles.priceChipAccent]}>
        <Text style={[styles.priceChipLabel, accent && styles.priceChipLabelAccent]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.priceChipValue, accent && styles.priceChipValueAccent]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    );
  };

  const renderVendor = ({ item }: { item: AdminVendorPricingListItem }) => {
    const { pricing } = item;
    const currency = item.currency || 'AED';

    const treeValue =
      pricing.pricePerTree != null ? `${currency} ${pricing.pricePerTree.toFixed(2)}` : null;
    const palmValue =
      pricing.pricePerPalm != null ? `${currency} ${pricing.pricePerPalm.toFixed(2)}` : null;

    const hasAnyPrice =
      treeValue != null ||
      palmValue != null ||
      pricing.pricePerTree != null ||
      pricing.pricePerPalm != null;

    const logoUri = item.logoUrl
      ? item.logoUrl.startsWith('http')
        ? item.logoUrl
        : buildFullImageUrl(item.logoUrl)
      : null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() =>
          navigation.navigate('AdminVendorPricingManage', {
            vendorId: item.vendorId,
            businessName: item.businessName,
            contactName: item.contactName,
            logoUrl: item.logoUrl,
            currency,
          })
        }
      >
        <View style={styles.cardTop}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={styles.logoFallback}>
              <Ionicons name="storefront-outline" size={22} color={COLORS.primary} />
            </View>
          )}
          <View style={styles.cardMeta}>
            <Text style={styles.businessName} numberOfLines={2}>
              {item.businessName || '—'}
            </Text>
            {item.contactName ? (
              <Text style={styles.contactName} numberOfLines={1}>
                {item.contactName}
              </Text>
            ) : null}
            {item.email ? (
              <Text style={styles.email} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </View>

        <View style={styles.chipRow}>
          {hasAnyPrice ? (
            <>
              {renderPriceChip(
                t('admin.settings.productSettings.areaBasedPricing.aedPerTree', {
                  defaultValue: 'AED / tree',
                }),
                treeValue
              )}
              {renderPriceChip(
                t('admin.settings.productSettings.areaBasedPricing.aedPerPalm', {
                  defaultValue: 'AED / palm',
                }),
                palmValue
              )}
            </>
          ) : (
            <View style={styles.notSetChip}>
              <Text style={styles.notSetText}>
                {t('admin.settings.productSettings.vendorPricing.notSet', {
                  defaultValue: 'No vendor pricing set yet',
                })}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const listFooter = loadingMore ? (
    <ActivityIndicator style={styles.footerLoader} color={COLORS.primary} />
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerEyebrow}>
            {t('admin.settings.productSettings.title', { defaultValue: 'Product Settings' })}
          </Text>
          <Text style={styles.headerTitle}>
            {t('admin.settings.productSettings.vendorPricing.title', {
              defaultValue: 'Vendor pricing',
            })}
          </Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('admin.settings.productSettings.vendorPricing.search', {
            defaultValue: 'Search company, vendor name, or email',
          })}
          placeholderTextColor={COLORS.textSecondary}
          returnKeyType="search"
          onSubmitEditing={() => void loadFirstPage(false)}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void loadFirstPage(true)}>
            <Text style={styles.retryLink}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={(item) => item.vendorId}
          renderItem={renderVendor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadFirstPage(true)} />
          }
          onEndReached={() => void loadNextPage()}
          onEndReachedThreshold={0.35}
          ListFooterComponent={listFooter}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {t('admin.settings.productSettings.vendorPricing.empty', {
                  defaultValue: 'No vendors found.',
                })}
              </Text>
            </View>
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
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerTextWrap: { flex: 1 },
  headerEyebrow: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: FONT_WEIGHTS.medium,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    color: '#fff',
    fontWeight: FONT_WEIGHTS.bold,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    paddingVertical: 4,
  },
  errorBanner: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.error + '14',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
  },
  retryLink: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoader: {
    paddingVertical: SPACING.lg,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
  },
  logoFallback: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: {
    flex: 1,
    minWidth: 0,
  },
  businessName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  contactName: {
    marginTop: 2,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  email: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  priceChip: {
    maxWidth: '100%',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priceChipAccent: {
    backgroundColor: COLORS.primary + '12',
    borderColor: COLORS.primary + '40',
  },
  priceChipLabel: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  priceChipLabelAccent: {
    color: COLORS.primary,
  },
  priceChipValue: {
    marginTop: 2,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  priceChipValueAccent: {
    color: COLORS.primary,
  },
  notSetChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.warning + '14',
  },
  notSetText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  empty: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
});

export default AdminVendorPricingListScreen;
