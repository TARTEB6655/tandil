import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { adminLoyaltyService } from '../../services/adminLoyaltyService';
import type {
  AdminLoyaltyCustomer,
  AdminLoyaltyReportFilters,
  AdminLoyaltyReportSummary,
  LoyaltyReportCustomerScope,
  LoyaltyReportExportFormat,
  LoyaltyReportPeriod,
} from '../../types/adminLoyalty';

type ReportCard = {
  key: keyof AdminLoyaltyReportSummary;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  defaultTitle: string;
};

const REPORT_CARDS: ReportCard[] = [
  {
    key: 'total_customers_with_points',
    icon: 'people-outline',
    titleKey: 'admin.loyalty.reports.customersWithPoints',
    defaultTitle: 'Customers with points',
  },
  {
    key: 'total_points_outstanding',
    icon: 'diamond-outline',
    titleKey: 'admin.loyalty.reports.pointsOutstanding',
    defaultTitle: 'Points outstanding',
  },
  {
    key: 'points_earned_period',
    icon: 'trending-up-outline',
    titleKey: 'admin.loyalty.reports.pointsEarned',
    defaultTitle: 'Points earned',
  },
  {
    key: 'points_redeemed_period',
    icon: 'trending-down-outline',
    titleKey: 'admin.loyalty.reports.pointsRedeemed',
    defaultTitle: 'Points redeemed',
  },
  {
    key: 'rewards_redeemed_count',
    icon: 'gift-outline',
    titleKey: 'admin.loyalty.reports.rewardsRedeemed',
    defaultTitle: 'Rewards redeemed',
  },
  {
    key: 'active_campaigns',
    icon: 'flash-outline',
    titleKey: 'admin.loyalty.reports.activeCampaigns',
    defaultTitle: 'Active campaigns',
  },
];

const AdminLoyaltyReportsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<AdminLoyaltyReportSummary | null>(null);
  const [customers, setCustomers] = useState<AdminLoyaltyCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<LoyaltyReportExportFormat>('pdf');
  const [customerScope, setCustomerScope] = useState<LoyaltyReportCustomerScope>('all');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [period, setPeriod] = useState<LoyaltyReportPeriod>('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const buildFilters = (): AdminLoyaltyReportFilters => ({
    customer_scope: customerScope,
    customer_ids: customerScope === 'specific' ? selectedCustomerIds : [],
    period,
    from_date: period === 'custom' ? fromDate.trim() || null : null,
    to_date: period === 'custom' ? toDate.trim() || null : null,
  });

  const validateFilters = (): boolean => {
    if (customerScope === 'specific' && selectedCustomerIds.length === 0) {
      Alert.alert(
        t('admin.loyalty.reports.filtersTitle', 'Check filters'),
        t('admin.loyalty.reports.selectCustomers', 'Select at least one customer.')
      );
      return false;
    }
    if (period === 'custom' && (!fromDate.trim() || !toDate.trim())) {
      Alert.alert(
        t('admin.loyalty.reports.filtersTitle', 'Check filters'),
        t('admin.loyalty.reports.selectDates', 'Enter both from and to dates.')
      );
      return false;
    }
    return true;
  };

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const filters = buildFilters();
      if (filters.customer_scope === 'specific' && filters.customer_ids.length === 0) {
        // Wait until user picks customers / applies filters
        const customerList = await adminLoyaltyService.listCustomers();
        setCustomers(customerList);
        return;
      }
      if (
        filters.period === 'custom' &&
        (!filters.from_date || !filters.to_date)
      ) {
        const customerList = await adminLoyaltyService.listCustomers();
        setCustomers(customerList);
        return;
      }

      const [data, customerList] = await Promise.all([
        adminLoyaltyService.getReportSummary(filters),
        adminLoyaltyService.listCustomers(),
      ]);
      setSummary(data);
      setCustomers(customerList);
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        err?.message || t('admin.loyalty.reports.loadFailed', 'Failed to load reports.')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerScope, selectedCustomerIds, period, fromDate, toDate, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleCustomer = (id: number) => {
    setCustomerScope('specific');
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((customerId) => customerId !== id) : [...prev, id]
    );
  };

  const handleApplyFilters = () => {
    if (!validateFilters()) return;
    load();
  };

  const handleExport = async () => {
    if (!validateFilters()) return;
    setExporting(true);
    try {
      const exported = await adminLoyaltyService.exportReport(buildFilters(), exportFormat);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(exported.uri, {
          mimeType: exported.mimeType,
          dialogTitle: t('admin.loyalty.reports.shareTitle', 'Loyalty report'),
        });
      } else {
        Alert.alert(
          t('admin.users.success', 'Success'),
          t('admin.loyalty.reports.exportSaved', 'Report downloaded: {{file}}').replace(
            '{{file}}',
            exported.fileName
          )
        );
      }
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        err?.message || t('admin.loyalty.reports.exportFailed', 'Failed to export report.')
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.loyalty.reports.title', 'Reports & export')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      {loading && !summary ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[COLORS.primary]}
            />
          }
        >
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="bar-chart-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.exportBadge}>
                <Ionicons name="download-outline" size={14} color={COLORS.primary} />
                <Text style={styles.exportBadgeText}>
                  {t('admin.loyalty.reports.exportable', 'Export ready')}
                </Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>
              {t('admin.loyalty.reports.heroTitle', 'Read the health of your loyalty program')}
            </Text>
            <Text style={styles.heroSubtitle}>
              {t(
                'admin.loyalty.reports.intro',
                'Overview of loyalty activity. Export CSV for offline analysis.'
              )}
            </Text>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>
                  {summary?.total_points_outstanding ?? 0}
                </Text>
                <Text style={styles.heroStatLabel}>
                  {t('admin.loyalty.reports.pointsOutstandingShort', 'Outstanding')}
                </Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>
                  {summary?.rewards_redeemed_count ?? 0}
                </Text>
                <Text style={styles.heroStatLabel}>
                  {t('admin.loyalty.reports.redeemedShort', 'Redeemed')}
                </Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{summary?.active_campaigns ?? 0}</Text>
                <Text style={styles.heroStatLabel}>
                  {t('admin.loyalty.reports.liveCampaignsShort', 'Campaigns')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.filterCard}>
            <Text style={styles.filterTitle}>
              {t('admin.loyalty.reports.filters', 'Report filters')}
            </Text>
            <Text style={styles.fieldLabel}>
              {t('admin.loyalty.reports.customerScope', 'Customer scope')}
            </Text>
            <View style={styles.chipWrap}>
              {(['all', 'specific'] as LoyaltyReportCustomerScope[]).map((option) => {
                const selected = customerScope === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => {
                      setCustomerScope(option);
                      if (option === 'all') {
                        setSelectedCustomerIds([]);
                        setCustomerSearch('');
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={option === 'all' ? 'globe-outline' : 'person-outline'}
                      size={14}
                      color={selected ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {option === 'all'
                        ? t('admin.loyalty.groups.all', 'All customers')
                        : t('admin.loyalty.groups.specific', 'Specific customer')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {customerScope === 'specific' ? (
              <View style={styles.customerSelectWrap}>
                <View style={styles.customerHeader}>
                  <View style={styles.customerCountWrap}>
                    <Text style={styles.customerCountNum}>{selectedCustomerIds.length}</Text>
                    <Text style={styles.customerCountLabel}>
                      /{customers.length}{' '}
                      {t('admin.loyalty.rewardForm.selected', 'selected')}
                    </Text>
                  </View>
                  <View style={styles.customerActions}>
                    <TouchableOpacity
                      style={styles.customerActionBtn}
                      onPress={() => setSelectedCustomerIds(customers.map((c) => c.id))}
                    >
                      <Text style={styles.customerActionText}>
                        {t('admin.loyalty.settings.selectAll', 'Select all')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.customerActionBtn, styles.customerActionBtnClear]}
                      onPress={() => setSelectedCustomerIds([])}
                    >
                      <Text style={[styles.customerActionText, styles.customerActionTextClear]}>
                        {t('admin.loyalty.settings.clearAll', 'Clear')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.searchWrap}>
                  <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    placeholder={t('admin.loyalty.settings.searchCustomers', 'Search customers…')}
                    placeholderTextColor={COLORS.textSecondary}
                    autoCapitalize="none"
                  />
                  {customerSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setCustomerSearch('')}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  nestedScrollEnabled
                  style={styles.customerListScroll}
                  contentContainerStyle={styles.customerListContent}
                  showsVerticalScrollIndicator
                  persistentScrollbar
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredCustomers.length === 0 ? (
                    <View style={styles.noCustomers}>
                      <Ionicons name="person-outline" size={24} color={COLORS.textSecondary} />
                      <Text style={styles.noCustomersText}>
                        {t('admin.loyalty.settings.noCustomers', 'No customers found')}
                      </Text>
                    </View>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const selected = selectedCustomerIds.includes(customer.id);
                      const photoUrl = customer.profile_picture_url?.trim() || null;
                      return (
                        <TouchableOpacity
                          key={customer.id}
                          style={[styles.customerRow, selected && styles.customerRowSelected]}
                          onPress={() => toggleCustomer(customer.id)}
                          activeOpacity={0.75}
                        >
                          <View
                            style={[
                              styles.customerAvatar,
                              selected && styles.customerAvatarSelected,
                            ]}
                          >
                            {photoUrl ? (
                              <Image
                                source={{ uri: photoUrl }}
                                style={styles.customerAvatarImage}
                                contentFit="cover"
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.customerAvatarText,
                                  selected && styles.customerAvatarTextSelected,
                                ]}
                              >
                                {customer.name.charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={styles.customerInfo}>
                            <Text
                              style={[
                                styles.customerName,
                                selected && styles.customerNameSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {customer.name}
                            </Text>
                            <Text style={styles.customerEmail} numberOfLines={1}>
                              {customer.email}
                            </Text>
                          </View>
                          <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
                            {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
                {filteredCustomers.length > 4 && (
                  <View style={styles.scrollHint}>
                    <Ionicons name="swap-vertical" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.scrollHintText}>
                      {t('admin.loyalty.settings.scrollMore', 'Scroll to see more')}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
              {t('admin.loyalty.reports.period', 'Period')}
            </Text>
            <View style={styles.chipWrap}>
              {(['week', 'month', 'custom'] as LoyaltyReportPeriod[]).map((option) => {
                const selected = period === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setPeriod(option)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {option === 'week'
                        ? t('admin.loyalty.reports.week', 'Week')
                        : option === 'month'
                          ? t('admin.loyalty.reports.month', 'Month')
                          : t('admin.loyalty.reports.customDate', 'Specific date')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {period === 'custom' ? (
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.fieldLabel}>{t('admin.loyalty.reports.from', 'From')}</Text>
                  <TextInput
                    style={styles.input}
                    value={fromDate}
                    onChangeText={setFromDate}
                    placeholder="2026-07-01"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.dateCol}>
                  <Text style={styles.fieldLabel}>{t('admin.loyalty.reports.to', 'To')}</Text>
                  <TextInput
                    style={styles.input}
                    value={toDate}
                    onChangeText={setToDate}
                    placeholder="2026-07-31"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>
            ) : null}

            <Button
              title={t('admin.loyalty.reports.applyFilters', 'Apply filters')}
              onPress={handleApplyFilters}
              style={{ marginTop: SPACING.md }}
              size="small"
            />
          </View>

          <View style={styles.grid}>
            {REPORT_CARDS.map((card) => (
              <View key={card.key} style={styles.card}>
                <View style={styles.cardIcon}>
                  <Ionicons name={card.icon} size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.cardValue}>
                  {summary ? summary[card.key] : '—'}
                </Text>
                <Text style={styles.cardLabel}>{t(card.titleKey, card.defaultTitle)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.filterCard}>
            <Text style={styles.filterTitle}>
              {t('admin.loyalty.reports.exportFormat', 'Export format')}
            </Text>
            <View style={styles.chipWrap}>
              {(['pdf', 'csv', 'json'] as LoyaltyReportExportFormat[]).map((option) => {
                const selected = exportFormat === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setExportFormat(option)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {option.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Button
            title={
              exportFormat === 'pdf'
                ? t('admin.loyalty.reports.exportPdf', 'Export PDF')
                : exportFormat === 'csv'
                  ? t('admin.loyalty.reports.exportCsv', 'Export CSV')
                  : t('admin.loyalty.reports.exportJson', 'Export JSON')
            }
            onPress={handleExport}
            loading={exporting}
            style={{ marginTop: SPACING.lg }}
          />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '18',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary + '12',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  exportBadgeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  heroTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: SPACING.xs,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  heroStatLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  filterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: 4,
  },
  fieldSpacing: {
    marginTop: SPACING.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  chipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  chipTextSelected: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },

  customerSelectWrap: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  customerCountWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  customerCountNum: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  customerCountLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  customerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  customerActionBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary + '14',
  },
  customerActionBtnClear: { backgroundColor: COLORS.error + '12' },
  customerActionText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  customerActionTextClear: { color: COLORS.error },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text, paddingVertical: 0 },
  customerListScroll: { maxHeight: 240, backgroundColor: COLORS.surface },
  customerListContent: { paddingVertical: SPACING.xs },
  noCustomers: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    gap: SPACING.xs,
  },
  noCustomersText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '60',
  },
  customerRowSelected: { backgroundColor: COLORS.primary + '08' },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  customerAvatarSelected: { backgroundColor: COLORS.primary + '20' },
  customerAvatarImage: { width: 36, height: 36, borderRadius: 18 },
  customerAvatarText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textSecondary,
  },
  customerAvatarTextSelected: { color: COLORS.primary },
  customerInfo: { flex: 1 },
  customerName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  customerNameSelected: { color: COLORS.primary },
  customerEmail: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 1 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  checkBoxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  scrollHintText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },

  dateRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  dateCol: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: '46%',
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  cardValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  cardLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
});

export default AdminLoyaltyReportsScreen;
