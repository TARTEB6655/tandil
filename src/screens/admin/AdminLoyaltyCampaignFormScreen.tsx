import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { adminLoyaltyService } from '../../services/adminLoyaltyService';
import {
  type AdminLoyaltyCustomer,
  LOYALTY_ACTIVITY_OPTIONS,
  LOYALTY_GROUP_OPTIONS,
  type LoyaltyCampaignMultiplier,
  type LoyaltyCustomerGroup,
  type LoyaltyEligibleActivity,
} from '../../types/adminLoyalty';

const parseCities = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const AdminLoyaltyCampaignFormScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const campaignId: number | undefined =
    route.params?.campaignId != null ? Number(route.params.campaignId) : undefined;
  const isEdit = Number.isFinite(campaignId) && (campaignId as number) > 0;

  const [loading, setLoading] = useState(!!isEdit);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [multiplier, setMultiplier] = useState<LoyaltyCampaignMultiplier>(2);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [citiesText, setCitiesText] = useState('');
  const [groups, setGroups] = useState<LoyaltyCustomerGroup[]>(['all']);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [customers, setCustomers] = useState<AdminLoyaltyCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [activities, setActivities] = useState<LoyaltyEligibleActivity[]>([
    'shop_orders',
    'service_orders',
  ]);
  const [notes, setNotes] = useState('');

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const customersList = await adminLoyaltyService.listCustomers();
      setCustomers(customersList);
      if (!isEdit || campaignId == null) return;
      const list = await adminLoyaltyService.listCampaigns();
      const campaign = list.find((c) => c.id === campaignId);
      if (!campaign) {
        Alert.alert(
          t('admin.users.error', 'Error'),
          t('admin.loyalty.campaignForm.notFound', 'Campaign not found.'),
          [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }]
        );
        return;
      }
      setTitle(campaign.title);
      setMultiplier(campaign.multiplier);
      setStartsAt(campaign.starts_at);
      setEndsAt(campaign.ends_at);
      setIsActive(campaign.is_active);
      setCitiesText(campaign.cities_label || campaign.cities.join(', '));
      setGroups([...campaign.customer_groups]);
      setSelectedCustomerIds([...(campaign.customer_ids || [])]);
      setActivities([...campaign.eligible_activities]);
      setNotes(campaign.notes || '');
    } finally {
      setLoading(false);
    }
  }, [isEdit, campaignId, navigation, t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleGroup = (id: LoyaltyCustomerGroup) => {
    if (id === 'all') {
      setGroups(['all']);
      setSelectedCustomerIds([]);
      return;
    }
    setGroups(['specific']);
  };

  const toggleCustomer = (id: number) => {
    setGroups(['specific']);
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((customerId) => customerId !== id) : [...prev, id]
    );
  };

  const toggleActivity = (id: LoyaltyEligibleActivity) => {
    setActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(
        t('admin.loyalty.campaignForm.validationTitle', 'Check the form'),
        t('admin.loyalty.campaignForm.titleRequired', 'Title is required.')
      );
      return;
    }
    if (!DATE_RE.test(startsAt.trim()) || !DATE_RE.test(endsAt.trim())) {
      Alert.alert(
        t('admin.loyalty.campaignForm.validationTitle', 'Check the form'),
        t(
          'admin.loyalty.campaignForm.invalidDates',
          'Start and end dates must be YYYY-MM-DD.'
        )
      );
      return;
    }
    if (activities.length === 0) {
      Alert.alert(
        t('admin.loyalty.campaignForm.validationTitle', 'Check the form'),
        t(
          'admin.loyalty.campaignForm.activitiesRequired',
          'Select at least one eligible activity.'
        )
      );
      return;
    }
    if (groups.includes('specific') && selectedCustomerIds.length === 0) {
      Alert.alert(
        t('admin.loyalty.campaignForm.validationTitle', 'Check the form'),
        t('admin.loyalty.campaignForm.customersRequired', 'Select at least one customer.')
      );
      return;
    }

    const payload = {
      title: title.trim(),
      multiplier,
      starts_at: startsAt.trim(),
      ends_at: endsAt.trim(),
      is_active: isActive,
      cities: parseCities(citiesText),
      customer_groups: groups.length ? groups : (['all'] as LoyaltyCustomerGroup[]),
      customer_ids: groups.includes('specific') ? selectedCustomerIds : [],
      eligible_activities: activities,
      notes: notes.trim() || undefined,
    };

    setSaving(true);
    try {
      if (isEdit && campaignId != null) {
        await adminLoyaltyService.updateCampaign(campaignId, payload);
      } else {
        await adminLoyaltyService.createCampaign(payload);
      }
      Alert.alert(
        t('admin.users.success', 'Success'),
        isEdit
          ? t('admin.loyalty.campaignForm.updated', 'Campaign updated.')
          : t('admin.loyalty.campaignForm.created', 'Campaign created.'),
        [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        err?.message ||
          t('admin.loyalty.campaignForm.saveFailed', 'Failed to save campaign.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={
          isEdit
            ? t('admin.loyalty.campaignForm.editTitle', 'Edit campaign')
            : t('admin.loyalty.campaignForm.addTitle', 'Add campaign')
        }
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
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>
                {t('admin.loyalty.campaignForm.title', 'Title')}
              </Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t(
                  'admin.loyalty.campaignForm.titlePlaceholder',
                  'Campaign name'
                )}
                placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={[styles.fieldLabel, styles.mt]}>
                {t('admin.loyalty.campaignForm.multiplier', 'Multiplier')}
              </Text>
              <View style={styles.chipWrap}>
                {([2, 3] as LoyaltyCampaignMultiplier[]).map((n) => {
                  const selected = multiplier === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setMultiplier(n)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t('admin.loyalty.campaignForm.multiplierChip', {
                          defaultValue: '{{n}}×',
                          n,
                        })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, styles.mt]}>
                {t('admin.loyalty.campaignForm.startsAt', 'Starts at (YYYY-MM-DD)')}
              </Text>
              <TextInput
                style={styles.input}
                value={startsAt}
                onChangeText={setStartsAt}
                placeholder="2026-03-01"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, styles.mt]}>
                {t('admin.loyalty.campaignForm.endsAt', 'Ends at (YYYY-MM-DD)')}
              </Text>
              <TextInput
                style={styles.input}
                value={endsAt}
                onChangeText={setEndsAt}
                placeholder="2026-03-31"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
              />

              <View style={[styles.rowBetween, styles.mt]}>
                <Text style={styles.label}>
                  {t('admin.loyalty.campaignForm.active', 'Active')}
                </Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                  thumbColor={isActive ? COLORS.primary : COLORS.background}
                />
              </View>

              <Text style={[styles.fieldLabel, styles.mt]}>
                {t('admin.loyalty.campaignForm.cities', 'Cities (comma-separated)')}
              </Text>
              <TextInput
                style={styles.input}
                value={citiesText}
                onChangeText={setCitiesText}
                placeholder="Abu Dhabi, Dubai"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
              />

              <Text style={[styles.fieldLabel, styles.mt]}>
                {t('admin.loyalty.campaignForm.groups', 'Customer targeting')}
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
                      <Ionicons
                        name={opt.id === 'all' ? 'globe-outline' : 'person-outline'}
                        size={14}
                        color={selected ? COLORS.primary : COLORS.textSecondary}
                      />
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t(opt.labelKey, opt.defaultLabel)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {groups.includes('specific') ? (
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
                        onPress={() => {
                          setGroups(['specific']);
                          setSelectedCustomerIds(customers.map((c) => c.id));
                        }}
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

              <Text style={[styles.fieldLabel, styles.mt]}>
                {t('admin.loyalty.campaignForm.activities', 'Eligible activities')}
              </Text>
              {LOYALTY_ACTIVITY_OPTIONS.map((opt, index) => {
                const checked = activities.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.checkRow,
                      index === LOYALTY_ACTIVITY_OPTIONS.length - 1 && styles.checkRowLast,
                    ]}
                    onPress={() => toggleActivity(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={styles.checkLabel}>{t(opt.labelKey, opt.defaultLabel)}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.fieldLabel, styles.mt]}>
                {t('admin.loyalty.campaignForm.notes', 'Notes')}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholder={t(
                  'admin.loyalty.campaignForm.notesPlaceholder',
                  'Optional internal notes'
                )}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <Button
              title={t('admin.loyalty.campaignForm.save', 'Save campaign')}
              onPress={handleSave}
              loading={saving}
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: 4,
  },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
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
  textArea: { minHeight: 80, paddingTop: SPACING.sm + 2 },
  mt: { marginTop: SPACING.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
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

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checkRowLast: { borderBottomWidth: 0 },
  checkLabel: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
});

export default AdminLoyaltyCampaignFormScreen;
