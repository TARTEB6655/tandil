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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { adminLoyaltyService } from '../../services/adminLoyaltyService';
import {
  LOYALTY_GROUP_OPTIONS,
  type AdminLoyaltyCustomer,
  type LoyaltyCustomerGroup,
} from '../../types/adminLoyalty';

const AdminLoyaltyRewardFormScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const rewardId: number | undefined =
    route.params?.rewardId != null ? Number(route.params.rewardId) : undefined;
  const isEdit = Number.isFinite(rewardId) && (rewardId as number) > 0;

  const [loading, setLoading] = useState(!!isEdit);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsRequired, setPointsRequired] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [citiesText, setCitiesText] = useState('');
  const [targeting, setTargeting] = useState<LoyaltyCustomerGroup>('all');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [customers, setCustomers] = useState<AdminLoyaltyCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');

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
      if (!isEdit || rewardId == null) return;
      const list = await adminLoyaltyService.listRewards();
      const reward = list.find((r) => r.id === rewardId);
      if (!reward) {
        Alert.alert(
          t('admin.users.error', 'Error'),
          t('admin.loyalty.rewardForm.notFound', 'Reward not found.'),
          [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }]
        );
        return;
      }
      setTitle(reward.title);
      setDescription(reward.description);
      setPointsRequired(String(reward.points_required));
      setIsActive(reward.is_active);
      setExpiresAt(reward.expires_at || '');
      setCitiesText(typeof reward.cities === 'string' ? reward.cities : (reward.cities as any[]).join(', '));
      setTargeting(reward.customer_targeting ?? 'all');
      setSelectedCustomerIds([...(reward.specific_customer_ids || reward.customer_ids || [])]);
    } finally {
      setLoading(false);
    }
  }, [isEdit, rewardId, navigation, t]);

  useEffect(() => { load(); }, [load]);

  const toggleCustomer = (id: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    const pts = Number(pointsRequired);
    if (!title.trim()) {
      Alert.alert(t('admin.loyalty.rewardForm.validationTitle', 'Check the form'), t('admin.loyalty.rewardForm.titleRequired', 'Title is required.'));
      return;
    }
    if (!Number.isFinite(pts) || pts <= 0) {
      Alert.alert(t('admin.loyalty.rewardForm.validationTitle', 'Check the form'), t('admin.loyalty.rewardForm.pointsRequired', 'Enter a valid points required value.'));
      return;
    }
    const expires = expiresAt.trim() || null;
    if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
      Alert.alert(t('admin.loyalty.rewardForm.validationTitle', 'Check the form'), t('admin.loyalty.rewardForm.invalidDate', 'Use YYYY-MM-DD for expiry, or leave empty.'));
      return;
    }
    if (targeting === 'specific' && selectedCustomerIds.length === 0) {
      Alert.alert(t('admin.loyalty.rewardForm.validationTitle', 'Check the form'), t('admin.loyalty.rewardForm.customersRequired', 'Select at least one customer.'));
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      points_required: Math.trunc(pts),
      is_active: isActive,
      expires_at: expires,
      cities: [citiesText.trim()],
      customer_groups: [targeting] as LoyaltyCustomerGroup[],
      customer_ids: targeting === 'specific' ? selectedCustomerIds : [],
      campaign_ids: [] as number[],
    };

    setSaving(true);
    try {
      if (isEdit && rewardId != null) {
        await adminLoyaltyService.updateReward(rewardId, payload);
      } else {
        await adminLoyaltyService.createReward(payload);
      }
      Alert.alert(
        t('admin.users.success', 'Success'),
        isEdit
          ? t('admin.loyalty.rewardForm.updated', 'Reward updated.')
          : t('admin.loyalty.rewardForm.created', 'Reward created.'),
        [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert(t('admin.users.error', 'Error'), err?.message || t('admin.loyalty.rewardForm.saveFailed', 'Failed to save reward.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header
          title={isEdit ? t('admin.loyalty.rewardForm.editTitle', 'Edit reward') : t('admin.loyalty.rewardForm.addTitle', 'Add reward')}
          showBack
          showLanguage={false}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={isEdit ? t('admin.loyalty.rewardForm.editTitle', 'Edit reward') : t('admin.loyalty.rewardForm.addTitle', 'Add reward')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Banner */}
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <Ionicons name={isEdit ? 'create' : 'gift'} size={28} color={COLORS.primary} />
            </View>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>
                {isEdit
                  ? t('admin.loyalty.rewardForm.editBannerTitle', 'Update reward details')
                  : t('admin.loyalty.rewardForm.addBannerTitle', 'Create a new reward')}
              </Text>
              <Text style={styles.bannerSubtitle}>
                {isEdit
                  ? t('admin.loyalty.rewardForm.editBannerSub', 'Make changes and save.')
                  : t('admin.loyalty.rewardForm.addBannerSub', 'Fill in the details below.')}
              </Text>
            </View>
          </View>

          {/* Section: Basic info */}
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>{t('admin.loyalty.rewardForm.sectionBasic', 'Basic Info')}</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('admin.loyalty.rewardForm.title', 'Title')} <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t('admin.loyalty.rewardForm.titlePlaceholder', 'e.g. AED 10 wallet credit')}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={[styles.field, styles.fieldTop]}>
              <Text style={styles.label}>{t('admin.loyalty.rewardForm.description', 'Description')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholder={t('admin.loyalty.rewardForm.descriptionPlaceholder', 'What the customer gets…')}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={[styles.field, styles.fieldTop]}>
              <Text style={styles.label}>
                {t('admin.loyalty.rewardForm.points', 'Points required')} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="flash-outline" size={18} color={COLORS.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={pointsRequired}
                  onChangeText={setPointsRequired}
                  keyboardType="number-pad"
                  placeholder="500"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            <View style={[styles.activeRow, styles.fieldTop]}>
              <View style={styles.activeLeft}>
                <View style={[styles.activeIconWrap, { backgroundColor: isActive ? COLORS.success + '18' : COLORS.border }]}>
                  <Ionicons
                    name={isActive ? 'checkmark-circle' : 'pause-circle-outline'}
                    size={20}
                    color={isActive ? COLORS.success : COLORS.textSecondary}
                  />
                </View>
                <View>
                  <Text style={styles.label}>{t('admin.loyalty.rewardForm.active', 'Active')}</Text>
                  <Text style={styles.hint}>
                    {isActive
                      ? t('admin.loyalty.rewardForm.activeHint', 'Reward is visible to customers')
                      : t('admin.loyalty.rewardForm.inactiveHint', 'Reward is hidden from customers')}
                  </Text>
                </View>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: COLORS.border, true: COLORS.success + '50' }}
                thumbColor={isActive ? COLORS.success : COLORS.background}
              />
            </View>
          </View>

          {/* Section: Availability */}
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>{t('admin.loyalty.rewardForm.sectionAvailability', 'Availability')}</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('admin.loyalty.rewardForm.expiresAt', 'Expires at')}</Text>
              <Text style={styles.hint}>{t('admin.loyalty.rewardForm.expiresHint', 'Format: YYYY-MM-DD. Leave empty for no expiry.')}</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  placeholder="2026-12-31"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={[styles.field, styles.fieldTop]}>
              <Text style={styles.label}>{t('admin.loyalty.rewardForm.cities', 'Cities')}</Text>
              <Text style={styles.hint}>{t('admin.loyalty.rewardForm.citiesHint', 'Comma-separated. Leave empty for all cities.')}</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={citiesText}
                  onChangeText={setCitiesText}
                  placeholder="Abu Dhabi, Dubai"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="words"
                />
              </View>
            </View>
          </View>

          {/* Section: Targeting */}
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>{t('admin.loyalty.rewardForm.sectionTargeting', 'Customer Targeting')}</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.chipWrap}>
              {LOYALTY_GROUP_OPTIONS.map((opt) => {
                const selected = targeting === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => {
                      setTargeting(opt.id);
                      if (opt.id === 'all') setSelectedCustomerIds([]);
                    }}
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

            {targeting === 'specific' && (
              <View style={styles.customerSelectWrap}>
                {/* Header */}
                <View style={styles.customerHeader}>
                  <View style={styles.customerCountWrap}>
                    <Text style={styles.customerCountNum}>{selectedCustomerIds.length}</Text>
                    <Text style={styles.customerCountLabel}>
                      /{customers.length} {t('admin.loyalty.rewardForm.selected', 'selected')}
                    </Text>
                  </View>
                  <View style={styles.customerActions}>
                    <TouchableOpacity
                      style={styles.customerActionBtn}
                      onPress={() => setSelectedCustomerIds(customers.map((c) => c.id))}
                    >
                      <Text style={styles.customerActionText}>{t('admin.loyalty.settings.selectAll', 'Select all')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.customerActionBtn, styles.customerActionBtnClear]}
                      onPress={() => setSelectedCustomerIds([])}
                    >
                      <Text style={[styles.customerActionText, styles.customerActionTextClear]}>{t('admin.loyalty.settings.clearAll', 'Clear')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Search */}
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

                {/* List */}
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
                      return (
                        <TouchableOpacity
                          key={customer.id}
                          style={[styles.customerRow, selected && styles.customerRowSelected]}
                          onPress={() => toggleCustomer(customer.id)}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.customerAvatar, selected && styles.customerAvatarSelected]}>
                            <Text style={[styles.customerAvatarText, selected && styles.customerAvatarTextSelected]}>
                              {customer.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.customerInfo}>
                            <Text style={[styles.customerName, selected && styles.customerNameSelected]} numberOfLines={1}>
                              {customer.name}
                            </Text>
                            <Text style={styles.customerEmail} numberOfLines={1}>{customer.email}</Text>
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
            )}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={isEdit ? 'save-outline' : 'add-circle-outline'} size={20} color="#fff" />
            )}
            <Text style={styles.saveBtnText}>
              {saving
                ? t('common.saving', 'Saving…')
                : isEdit
                  ? t('admin.loyalty.rewardForm.update', 'Update reward')
                  : t('admin.loyalty.rewardForm.save', 'Create reward')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },

  /* Banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  bannerSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },

  /* Section headers */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Card */
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  /* Fields */
  field: {},
  fieldTop: { marginTop: SPACING.md },
  label: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text, marginBottom: 6 },
  required: { color: COLORS.error },
  hint: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: 6, lineHeight: 18 },

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
  textArea: { minHeight: 88, paddingTop: SPACING.sm + 2 },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: SPACING.sm, zIndex: 1 },
  inputFlex: { flex: 1, paddingLeft: SPACING.xl + 4 },

  /* Active toggle row */
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  activeLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  activeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Chips */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
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
  chipText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.medium },
  chipTextSelected: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },

  /* Customer selector */
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
  customerCountNum: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  customerCountLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  customerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  customerActionBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary + '14',
  },
  customerActionBtnClear: { backgroundColor: COLORS.error + '12' },
  customerActionText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
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
  },
  customerAvatarSelected: { backgroundColor: COLORS.primary + '20' },
  customerAvatarText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold, color: COLORS.textSecondary },
  customerAvatarTextSelected: { color: COLORS.primary },
  customerInfo: { flex: 1 },
  customerName: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
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

  /* Save button */
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.xs,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: '#fff' },
});

export default AdminLoyaltyRewardFormScreen;
