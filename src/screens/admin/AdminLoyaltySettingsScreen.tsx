import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { adminLoyaltyService } from '../../services/adminLoyaltyService';
import {
  LOYALTY_GROUP_OPTIONS,
  LOYALTY_SETTINGS_ACTIVITY_OPTIONS,
  type AdminLoyaltyCustomer,
  type LoyaltyCustomerGroup,
  type LoyaltyEligibleActivity,
} from '../../types/adminLoyalty';

const AdminLoyaltySettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [pointsPerAed, setPointsPerAed] = useState('1');
  const [activities, setActivities] = useState<LoyaltyEligibleActivity[]>([]);
  const [pointsExpireMonths, setPointsExpireMonths] = useState('');
  const [rewardsExpireMonths, setRewardsExpireMonths] = useState('');
  const [citiesText, setCitiesText] = useState('');
  const [groups, setGroups] = useState<LoyaltyCustomerGroup[]>(['all']);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [customers, setCustomers] = useState<AdminLoyaltyCustomer[]>([]);
  const [campaignOnly, setCampaignOnly] = useState(false);
  const [statusLabel, setStatusLabel] = useState('Live');
  const [customerSearch, setCustomerSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const uniqueCustomers = (list: AdminLoyaltyCustomer[]) => {
    const byId = new Map<number, AdminLoyaltyCustomer>();
    const byEmail = new Set<string>();
    list.forEach((customer) => {
      if (!Number.isFinite(customer.id) || customer.id <= 0) return;
      if (byId.has(customer.id)) return;
      const emailKey = (customer.email || '').trim().toLowerCase();
      if (emailKey && byEmail.has(emailKey)) return;
      byId.set(customer.id, customer);
      if (emailKey) byEmail.add(emailKey);
    });
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const resolveSelectedIds = (
    list: AdminLoyaltyCustomer[],
    selectedIds: number[],
    named: { id: number; name: string }[] = []
  ) => {
    const idSet = new Set(list.map((customer) => customer.id));
    const matched = selectedIds.filter((id) => idSet.has(id));
    if (matched.length > 0) return matched;

    const names = new Set(
      named.map((item) => item.name.trim().toLowerCase()).filter(Boolean)
    );
    if (!names.size) return [];
    return list
      .filter((customer) => names.has(customer.name.trim().toLowerCase()))
      .map((customer) => customer.id);
  };

  const loadCustomers = useCallback(
    async (
      selectedIds: number[] = [],
      named: { id: number; name: string }[] = [],
      applySelection = false
    ) => {
      setLoadingCustomers(true);
      try {
        const customersList = uniqueCustomers(await adminLoyaltyService.listCustomers());
        setCustomers(customersList);
        if (applySelection) {
          setSelectedCustomerIds(resolveSelectedIds(customersList, selectedIds, named));
        }
      } catch {
        setCustomers([]);
        if (applySelection) setSelectedCustomerIds([]);
      } finally {
        setLoadingCustomers(false);
      }
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await adminLoyaltyService.getSettings();
      setEnabled(s.enabled);
      setPointsPerAed(String(s.points_per_aed));
      setActivities([...s.eligible_activities]);
      setPointsExpireMonths(
        s.points_expire_after_months != null ? String(s.points_expire_after_months) : ''
      );
      setRewardsExpireMonths(
        s.rewards_expire_after_months != null ? String(s.rewards_expire_after_months) : ''
      );
      setCitiesText(s.restrict_cities.join(', '));
      setGroups([...s.restrict_customer_groups]);
      setCampaignOnly(s.restrict_campaign_only);
      const rawStatus = (s.status || '').toLowerCase();
      if (rawStatus === 'live' || rawStatus === 'active') {
        setStatusLabel(t('admin.loyalty.settings.statusLive', 'Live'));
      } else if (rawStatus === 'paused' || rawStatus === 'inactive' || rawStatus === 'disabled') {
        setStatusLabel(t('admin.loyalty.settings.statusPaused', 'Paused'));
      } else {
        setStatusLabel(
          s.status ||
            (s.enabled
              ? t('admin.loyalty.settings.statusLive', 'Live')
              : t('admin.loyalty.settings.statusPaused', 'Paused'))
        );
      }
      await loadCustomers(
        s.restrict_customer_groups.includes('specific') ? s.restrict_customer_ids || [] : [],
        s.specific_customers || [],
        true
      );
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        err?.response?.data?.message ||
          err?.message ||
          t('admin.loyalty.settings.loadFailed', 'Failed to load loyalty settings.')
      );
    } finally {
      setLoading(false);
    }
  }, [loadCustomers, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleActivity = (id: LoyaltyEligibleActivity) => {
    setActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const toggleGroup = (id: LoyaltyCustomerGroup) => {
    if (id === 'all') {
      setGroups(['all']);
      setSelectedCustomerIds([]);
      setCustomerSearch('');
      return;
    }
    setGroups(['specific']);
    if (customers.length === 0) {
      loadCustomers([], [], false);
    }
  };

  const toggleCustomer = (id: number) => {
    setGroups(['specific']);
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((customerId) => customerId !== id) : [...prev, id]
    );
  };

  const filteredCustomers = customers.filter((customer) => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      customer.name.toLowerCase().includes(q) ||
      customer.email.toLowerCase().includes(q) ||
      (customer.phone || '').includes(q)
    );
  });

  const selectedVisibleCount = filteredCustomers.filter((customer) =>
    selectedCustomerIds.includes(customer.id)
  ).length;

  const selectAllVisible = () => {
    setGroups(['specific']);
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      filteredCustomers.forEach((customer) => next.add(customer.id));
      return Array.from(next);
    });
  };

  const clearSelected = () => {
    setSelectedCustomerIds([]);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const parseOptionalMonths = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.trunc(n);
  };

  const handleSave = async () => {
    const ppa = Number(pointsPerAed);
    if (!Number.isFinite(ppa) || ppa <= 0) {
      Alert.alert(
        t('admin.loyalty.settings.invalidTitle', 'Check settings'),
        t('admin.loyalty.settings.invalidPointsPerAed', 'Enter a valid points per AED value.')
      );
      return;
    }
    if (activities.length === 0) {
      Alert.alert(
        t('admin.loyalty.settings.invalidTitle', 'Check settings'),
        t('admin.loyalty.settings.invalidActivities', 'Select at least one eligible activity.')
      );
      return;
    }

    const targeting: LoyaltyCustomerGroup = groups.includes('specific') ? 'specific' : 'all';
    if (targeting === 'specific' && selectedCustomerIds.length === 0) {
      Alert.alert(
        t('admin.loyalty.settings.invalidTitle', 'Check settings'),
        t('admin.loyalty.settings.invalidCustomers', 'Select at least one customer.')
      );
      return;
    }

    const cities = citiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const saved = await adminLoyaltyService.updateSettings({
        enabled,
        points_per_aed: ppa,
        eligible_activities: activities,
        points_expire_after_months: parseOptionalMonths(pointsExpireMonths),
        rewards_expire_after_months: parseOptionalMonths(rewardsExpireMonths),
        restrict_cities: cities,
        // API: customer_targeting = "all" | "specific"
        restrict_customer_groups: [targeting],
        // API: specific_customer_ids = [] when all
        restrict_customer_ids: targeting === 'specific' ? selectedCustomerIds : [],
        specific_customers:
          targeting === 'specific'
            ? customers
                .filter((customer) => selectedCustomerIds.includes(customer.id))
                .map((customer) => ({ id: customer.id, name: customer.name }))
            : [],
        restrict_campaign_only: campaignOnly,
      });

      setEnabled(saved.enabled);
      setPointsPerAed(String(saved.points_per_aed));
      setActivities([...saved.eligible_activities]);
      setPointsExpireMonths(
        saved.points_expire_after_months != null
          ? String(saved.points_expire_after_months)
          : ''
      );
      setRewardsExpireMonths(
        saved.rewards_expire_after_months != null
          ? String(saved.rewards_expire_after_months)
          : ''
      );
      setCitiesText(saved.restrict_cities.join(', '));
      setGroups([...saved.restrict_customer_groups]);
      setSelectedCustomerIds(
        saved.restrict_customer_groups.includes('specific')
          ? resolveSelectedIds(
              customers,
              saved.restrict_customer_ids || [],
              saved.specific_customers || []
            )
          : []
      );
      setCampaignOnly(saved.restrict_campaign_only);
      setStatusLabel(
        saved.status ||
          (saved.enabled
            ? t('admin.loyalty.settings.statusLive', 'Live')
            : t('admin.loyalty.settings.statusPaused', 'Paused'))
      );
      await loadCustomers(
        saved.restrict_customer_groups.includes('specific')
          ? saved.restrict_customer_ids || []
          : [],
        saved.specific_customers || [],
        true
      );

      Alert.alert(
        t('admin.users.success', 'Success'),
        t('admin.loyalty.settings.saved', 'Loyalty settings saved.')
      );
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        err?.response?.data?.message ||
          err?.message ||
          t('admin.loyalty.settings.saveFailed', 'Failed to save settings.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.loyalty.settings.title', 'Loyalty settings')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Ionicons name="options-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.heroTitle}>
                {t('admin.loyalty.settings.heroTitle', 'Control your loyalty engine')}
              </Text>
              <Text style={styles.heroSubtitle}>
                {t(
                  'admin.loyalty.settings.heroSubtitle',
                  'Tune earning rules, expiry windows, and customer restrictions from one place.'
                )}
              </Text>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{pointsPerAed || '0'}</Text>
                  <Text style={styles.heroStatLabel}>
                    {t('admin.loyalty.settings.pointsPerAedShort', 'Pts/AED')}
                  </Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{activities.length}</Text>
                  <Text style={styles.heroStatLabel}>
                    {t('admin.loyalty.settings.activitiesShort', 'Activities')}
                  </Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{statusLabel}</Text>
                  <Text style={styles.heroStatLabel}>
                    {t('admin.loyalty.settings.statusShort', 'Status')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.label}>
                    {t('admin.loyalty.settings.enabled', 'Loyalty system enabled')}
                  </Text>
                  <Text style={styles.hint}>
                    {t(
                      'admin.loyalty.settings.enabledHint',
                      'When off, customers cannot earn or redeem points.'
                    )}
                  </Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={setEnabled}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                  thumbColor={enabled ? COLORS.primary : COLORS.background}
                />
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('admin.loyalty.settings.earning', 'Earning')}
              </Text>
              <Text style={styles.sectionBadge}>
                {t('admin.loyalty.settings.sectionCore', 'Core')}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>
                {t('admin.loyalty.settings.pointsPerAed', 'Points per AED')}
              </Text>
              <TextInput
                style={styles.input}
                value={pointsPerAed}
                onChangeText={setPointsPerAed}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('admin.loyalty.settings.activities', 'Eligible activities')}
              </Text>
              <Text style={styles.sectionBadge}>
                {activities.length} {t('admin.loyalty.settings.selected', 'selected')}
              </Text>
            </View>
            <View style={styles.card}>
              {LOYALTY_SETTINGS_ACTIVITY_OPTIONS.map((opt, index) => {
                const checked = activities.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.checkRow,
                      index === LOYALTY_SETTINGS_ACTIVITY_OPTIONS.length - 1 &&
                        styles.checkRowLast,
                    ]}
                    onPress={() => toggleActivity(opt.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkIconWrap, checked && styles.checkIconWrapActive]}>
                      <Ionicons
                        name={checked ? 'checkmark' : 'add'}
                        size={16}
                        color={checked ? COLORS.surface : COLORS.textSecondary}
                      />
                    </View>
                    <Text style={styles.checkLabel}>{t(opt.labelKey, opt.defaultLabel)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('admin.loyalty.settings.expiry', 'Expiry')}
              </Text>
              <Text style={styles.sectionBadge}>
                {t('admin.loyalty.settings.sectionPolicy', 'Policy')}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>
                {t('admin.loyalty.settings.pointsExpireMonths', 'Points expiry (months)')}
              </Text>
              <Text style={styles.hint}>
                {t('admin.loyalty.settings.expireNeverHint', 'Leave empty for never.')}
              </Text>
              <TextInput
                style={styles.input}
                value={pointsExpireMonths}
                onChangeText={setPointsExpireMonths}
                keyboardType="number-pad"
                placeholder={t('admin.loyalty.settings.never', 'Never')}
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>
                {t('admin.loyalty.settings.rewardsExpireMonths', 'Rewards expiry (months)')}
              </Text>
              <TextInput
                style={styles.input}
                value={rewardsExpireMonths}
                onChangeText={setRewardsExpireMonths}
                keyboardType="number-pad"
                placeholder={t('admin.loyalty.settings.never', 'Never')}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('admin.loyalty.settings.restrictions', 'Restrictions')}
              </Text>
              <Text style={styles.sectionBadge}>
                {t('admin.loyalty.settings.sectionRules', 'Rules')}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>
                {t('admin.loyalty.settings.cities', 'Cities (comma-separated)')}
              </Text>
              <Text style={styles.hint}>
                {t(
                  'admin.loyalty.settings.citiesHint',
                  'Empty = all cities. Example: Abu Dhabi, Dubai'
                )}
              </Text>
              <TextInput
                style={styles.input}
                value={citiesText}
                onChangeText={setCitiesText}
                placeholder="Abu Dhabi, Dubai"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>
                {t('admin.loyalty.settings.customerGroups', 'Customer targeting')}
              </Text>
              <View style={styles.chipWrap}>
                {LOYALTY_GROUP_OPTIONS.map((opt) => {
                  const selected = groups.includes(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => toggleGroup(opt.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t(opt.labelKey, opt.defaultLabel)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {groups.includes('specific') ? (
                <View style={styles.customerSelectWrap}>
                  <Text style={styles.hint}>
                    {t(
                      'admin.loyalty.settings.customerSelectHint',
                      'Choose one or more customers for this loyalty rule.'
                    )}
                  </Text>

                  <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      value={customerSearch}
                      onChangeText={setCustomerSearch}
                      placeholder={t(
                        'admin.loyalty.settings.searchCustomers',
                        'Search name, email, or phone'
                      )}
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {customerSearch ? (
                      <TouchableOpacity onPress={() => setCustomerSearch('')} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.customerListHeader}>
                    <Text style={styles.customerListCount}>
                      {t('admin.loyalty.settings.customersCount', {
                        defaultValue: '{{selected}} of {{total}} selected',
                        selected: selectedVisibleCount,
                        total: filteredCustomers.length,
                      })}
                    </Text>
                    <View style={styles.customerActions}>
                      <TouchableOpacity onPress={selectAllVisible} hitSlop={8}>
                        <Text style={styles.customerActionText}>
                          {t('admin.loyalty.settings.selectAll', 'Select all')}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.customerActionDot}>·</Text>
                      <TouchableOpacity onPress={clearSelected} hitSlop={8}>
                        <Text style={styles.customerActionText}>
                          {t('admin.loyalty.settings.clear', 'Clear')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.customerList}>
                    {loadingCustomers ? (
                      <View style={styles.customerLoading}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      </View>
                    ) : filteredCustomers.length === 0 ? (
                      <Text style={styles.emptyCustomers}>
                        {t('admin.loyalty.settings.noCustomers', 'No customers found')}
                      </Text>
                    ) : (
                      <>
                        <ScrollView
                          nestedScrollEnabled
                          style={styles.customerListScroll}
                          contentContainerStyle={styles.customerListContent}
                          showsVerticalScrollIndicator
                          persistentScrollbar
                          keyboardShouldPersistTaps="handled"
                        >
                          {filteredCustomers.map((customer, index) => {
                            const selected = selectedCustomerIds.includes(customer.id);
                            return (
                              <TouchableOpacity
                                key={`customer-${customer.id}`}
                                style={[
                                  styles.customerRow,
                                  selected && styles.customerRowSelected,
                                  index === filteredCustomers.length - 1 &&
                                    styles.customerRowLast,
                                ]}
                                onPress={() => toggleCustomer(customer.id)}
                                activeOpacity={0.75}
                              >
                                <View
                                  style={[
                                    styles.customerAvatar,
                                    selected && styles.customerAvatarSelected,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.customerAvatarText,
                                      selected && styles.customerAvatarTextSelected,
                                    ]}
                                  >
                                    {getInitials(customer.name)}
                                  </Text>
                                </View>
                                <View style={styles.customerInfo}>
                                  <Text style={styles.customerName} numberOfLines={1}>
                                    {customer.name}
                                  </Text>
                                  <Text style={styles.customerEmail} numberOfLines={1}>
                                    {customer.email ||
                                      customer.phone ||
                                      t(
                                        'admin.loyalty.settings.noContact',
                                        'No contact info'
                                      )}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.customerCheck,
                                    selected && styles.customerCheckSelected,
                                  ]}
                                >
                                  {selected ? (
                                    <Ionicons
                                      name="checkmark"
                                      size={14}
                                      color={COLORS.surface}
                                    />
                                  ) : null}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </>
                    )}
                  </View>
                  {filteredCustomers.length > 4 ? (
                    <View style={styles.scrollHint}>
                      <Ionicons name="swap-vertical" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.scrollHintText}>
                        {t(
                          'admin.loyalty.settings.scrollMore',
                          'Scroll inside the list to see more'
                        )}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={[styles.rowBetween, { marginTop: SPACING.md }]}>
                <View style={styles.flex}>
                  <Text style={styles.label}>
                    {t('admin.loyalty.settings.campaignOnly', 'Campaign periods only')}
                  </Text>
                  <Text style={styles.hint}>
                    {t(
                      'admin.loyalty.settings.campaignOnlyHint',
                      'Earn points only during active campaigns.'
                    )}
                  </Text>
                </View>
                <Switch
                  value={campaignOnly}
                  onValueChange={setCampaignOnly}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                  thumbColor={campaignOnly ? COLORS.primary : COLORS.background}
                />
              </View>
            </View>

            <Button
              title={t('admin.loyalty.settings.save', 'Save settings')}
              onPress={handleSave}
              loading={saving}
              style={{ marginTop: SPACING.lg }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '18',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
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
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  sectionBadge: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 16,
  },
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
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checkRowLast: { borderBottomWidth: 0 },
  checkIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconWrapActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkLabel: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '14',
  },
  chipText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  chipTextSelected: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  customerSelectWrap: { marginTop: SPACING.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm + 2 : SPACING.sm,
    backgroundColor: COLORS.background,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    paddingVertical: 0,
  },
  customerListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  customerListCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  customerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerActionText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  customerActionDot: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  customerList: {
    height: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  customerListScroll: {
    height: 220,
  },
  customerListContent: {
    paddingBottom: 4,
  },
  customerLoading: {
    flex: 1,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  customerRowLast: {
    borderBottomWidth: 0,
  },
  customerRowSelected: {
    backgroundColor: COLORS.primary + '0F',
  },
  customerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarSelected: {
    backgroundColor: COLORS.primary,
  },
  customerAvatarText: {
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  customerAvatarTextSelected: {
    color: COLORS.surface,
  },
  customerInfo: { flex: 1 },
  customerName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  customerEmail: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  customerCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  customerCheckSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  scrollHintText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  emptyCustomers: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
});

export default AdminLoyaltySettingsScreen;
