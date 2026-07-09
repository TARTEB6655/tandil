import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import Header from '../../components/common/Header';
import {
  adminVendorPartnershipService,
  VendorPartnershipTier,
  VendorPartnershipTierFeatures,
  VendorPartnershipTierPayload,
} from '../../services/adminVendorPartnershipService';

type RouteParams = { tierId?: number | string };

const BADGE_COLORS = [
  { key: 'green', color: '#22C55E' },
  { key: 'silver', color: '#94A3B8' },
  { key: 'gold', color: '#EAB308' },
  { key: 'platinum', color: '#6366F1' },
  { key: 'orange', color: '#F97316' },
  { key: 'blue', color: '#3B82F6' },
];

const MARKETING_LEVELS = ['low', 'medium', 'high'];
const BANNER_SIZES = ['none', 'small', 'medium', 'large'];

const FEATURE_OPTIONS: {
  key: keyof VendorPartnershipTierFeatures;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'partner_logo', label: 'Partner logo', icon: 'ribbon-outline' },
  { key: 'product_images', label: 'Product images', icon: 'images-outline' },
  { key: 'shop_mention', label: 'Shop mention', icon: 'storefront-outline' },
  { key: 'monthly_report', label: 'Monthly report', icon: 'bar-chart-outline' },
  { key: 'app_banner', label: 'In-app banner', icon: 'phone-portrait-outline' },
  { key: 'home_banner', label: 'Home banner', icon: 'tv-outline' },
  { key: 'social_media_post', label: 'Social media', icon: 'logo-instagram' },
  { key: 'discount_code', label: 'Discount code', icon: 'pricetag-outline' },
  { key: 'video_content', label: 'Video content', icon: 'videocam-outline' },
];

type FormState = {
  slug: string;
  name: string;
  badge_color: string;
  price: string;
  currency: string;
  duration_months: string;
  required_products_min: string;
  required_products_max: string;
  max_product_listings: string;
  max_partner_product_images: string;
  marketing_exposure: string;
  social_media_posts_per_month: string;
  app_banners: string;
  home_banner_size: string;
  benefits: string;
  sort_order: string;
  is_active: boolean;
  features: VendorPartnershipTierFeatures;
};

const emptyForm = (): FormState => ({
  slug: '',
  name: '',
  badge_color: 'green',
  price: '',
  currency: 'AED',
  duration_months: '1',
  required_products_min: '',
  required_products_max: '',
  max_product_listings: '',
  max_partner_product_images: '1',
  marketing_exposure: 'low',
  social_media_posts_per_month: '0',
  app_banners: '0',
  home_banner_size: 'none',
  benefits: '',
  sort_order: '0',
  is_active: true,
  features: { partner_logo: true },
});

function tierToForm(tier: VendorPartnershipTier): FormState {
  return {
    slug: tier.slug,
    name: tier.name,
    badge_color: tier.badge_color,
    price: String(tier.price),
    currency: tier.currency,
    duration_months: String(tier.duration_months),
    required_products_min: String(tier.required_products_min),
    required_products_max: String(tier.required_products_max),
    max_product_listings: String(tier.max_product_listings),
    max_partner_product_images: String(tier.max_partner_product_images),
    marketing_exposure: tier.marketing_exposure,
    social_media_posts_per_month: String(tier.social_media_posts_per_month),
    app_banners: String(tier.app_banners),
    home_banner_size: tier.home_banner_size,
    benefits: tier.benefits.join('\n'),
    sort_order: String(tier.sort_order),
    is_active: tier.is_active,
    features: { ...tier.features },
  };
}

function formToPayload(form: FormState): VendorPartnershipTierPayload {
  return {
    slug: form.slug.trim().toLowerCase().replace(/\s+/g, '-'),
    name: form.name.trim(),
    badge_color: form.badge_color,
    price: Number(form.price) || 0,
    currency: form.currency.trim() || 'AED',
    duration_months: Number(form.duration_months) || 1,
    required_products_min: Number(form.required_products_min) || 0,
    required_products_max: Number(form.required_products_max) || 0,
    max_product_listings: Number(form.max_product_listings) || 0,
    max_partner_product_images: Number(form.max_partner_product_images) || 1,
    marketing_exposure: form.marketing_exposure,
    social_media_posts_per_month: Number(form.social_media_posts_per_month) || 0,
    app_banners: Number(form.app_banners) || 0,
    home_banner_size: form.home_banner_size,
    benefits: form.benefits
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    features: form.features,
    sort_order: Number(form.sort_order) || 0,
    is_active: form.is_active,
  };
}

function validateForm(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.slug.trim()) errors.slug = 'Slug is required';
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.price.trim() || Number.isNaN(Number(form.price))) errors.price = 'Valid price required';
  if (!form.duration_months.trim() || Number.isNaN(Number(form.duration_months))) {
    errors.duration_months = 'Valid duration required';
  }
  return errors;
}

function getBadgeHex(key: string): string {
  return BADGE_COLORS.find((item) => item.key === key)?.color || COLORS.primary;
}

const SectionCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
    {children}
  </View>
);

const AdminVendorPartnershipTierFormScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const tierId = route.params?.tierId;
  const isEdit = tierId != null;

  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingTier, setLoadingTier] = useState(!!tierId);

  const previewColor = useMemo(() => getBadgeHex(form.badge_color), [form.badge_color]);
  const benefitCount = useMemo(
    () => form.benefits.split('\n').map((line) => line.trim()).filter(Boolean).length,
    [form.benefits]
  );

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  const toggleFeature = (key: keyof VendorPartnershipTierFeatures) => {
    setForm((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }));
  };

  const loadTier = useCallback(async () => {
    if (!tierId) return;
    setLoadingTier(true);
    try {
      const tier = await adminVendorPartnershipService.getTier(tierId);
      setForm(tierToForm(tier));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('adminVendorPartnership.loadFailed', { defaultValue: 'Failed to load tier.' });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message, [
        { text: t('common.ok', { defaultValue: 'OK' }), onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoadingTier(false);
    }
  }, [navigation, t, tierId]);

  useEffect(() => {
    loadTier();
  }, [loadTier]);

  const handleSave = async () => {
    const validation = validateForm(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      Alert.alert(
        t('adminVendorPartnership.validationTitle', { defaultValue: 'Check the form' }),
        t('adminVendorPartnership.validationMessage', { defaultValue: 'Fix the highlighted fields.' })
      );
      return;
    }

    setLoading(true);
    try {
      const payload = formToPayload(form);
      if (isEdit && tierId != null) {
        await adminVendorPartnershipService.updateTier(tierId, payload);
      } else {
        await adminVendorPartnershipService.createTier(payload);
      }
      Alert.alert(
        t('admin.users.success', { defaultValue: 'Success' }),
        isEdit
          ? t('adminVendorPartnership.updated', { defaultValue: 'Partnership tier updated.' })
          : t('adminVendorPartnership.created', { defaultValue: 'Partnership tier created.' }),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => navigation.goBack() }]
      );
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('adminVendorPartnership.saveFailed', { defaultValue: 'Failed to save tier.' });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingTier) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title={
            isEdit
              ? t('adminVendorPartnership.editTier', { defaultValue: 'Edit Tier' })
              : t('adminVendorPartnership.createTier', { defaultValue: 'Create Tier' })
          }
          showBack
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title={
          isEdit
            ? t('adminVendorPartnership.editTier', { defaultValue: 'Edit Tier' })
            : t('adminVendorPartnership.createTier', { defaultValue: 'Create Tier' })
        }
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.previewCard, { borderLeftColor: previewColor }]}>
            <View style={[styles.previewBadge, { backgroundColor: previewColor + '22' }]}>
              <Ionicons name="ribbon" size={24} color={previewColor} />
            </View>
            <View style={styles.previewContent}>
              <Text style={styles.previewName}>{form.name.trim() || 'Tier Name'}</Text>
              <Text style={styles.previewSlug}>/{form.slug.trim() || 'tier-slug'}</Text>
              <View style={styles.previewPriceRow}>
                <Text style={[styles.previewPrice, { color: previewColor }]}>
                  {form.currency} {form.price || '0'}
                </Text>
                <Text style={styles.previewDuration}>
                  / {form.duration_months || '1'} mo
                </Text>
              </View>
            </View>
            <View style={[styles.previewStatus, form.is_active ? styles.previewActive : styles.previewInactive]}>
              <Text style={[styles.previewStatusText, form.is_active ? styles.previewActiveText : styles.previewInactiveText]}>
                {form.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          <SectionCard
            icon="information-circle-outline"
            title={t('adminVendorPartnership.basicInfo', { defaultValue: 'Basic information' })}
            subtitle="Name, slug and badge color"
          >
            <Input
              label={t('adminVendorPartnership.name', { defaultValue: 'Tier name' })}
              placeholder="Starter"
              value={form.name}
              onChangeText={(value) => updateForm('name', value)}
              autoCapitalize="words"
              error={errors.name}
            />
            <Input
              label={t('adminVendorPartnership.slug', { defaultValue: 'Slug' })}
              placeholder="starter"
              value={form.slug}
              onChangeText={(value) => updateForm('slug', value)}
              autoCapitalize="none"
              error={errors.slug}
            />
            <Text style={styles.fieldLabel}>
              {t('adminVendorPartnership.badgeColor', { defaultValue: 'Badge color' })}
            </Text>
            <View style={styles.colorRow}>
              {BADGE_COLORS.map((item) => {
                const selected = form.badge_color === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: item.color },
                      selected && styles.colorSwatchSelected,
                    ]}
                    onPress={() => updateForm('badge_color', item.key)}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={16} color={COLORS.background} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.colorHint}>{form.badge_color}</Text>
          </SectionCard>

          <SectionCard
            icon="cash-outline"
            title={t('adminVendorPartnership.pricing', { defaultValue: 'Pricing & duration' })}
            subtitle="Set monthly fee and plan length"
          >
            <View style={styles.row}>
              <View style={styles.half}>
                <Input
                  label={t('adminVendorPartnership.price', { defaultValue: 'Price' })}
                  placeholder="150"
                  value={form.price}
                  onChangeText={(value) => updateForm('price', value)}
                  keyboardType="numeric"
                  error={errors.price}
                />
              </View>
              <View style={styles.half}>
                <Input
                  label={t('adminVendorPartnership.currency', { defaultValue: 'Currency' })}
                  placeholder="AED"
                  value={form.currency}
                  onChangeText={(value) => updateForm('currency', value)}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            <Input
              label={t('adminVendorPartnership.durationMonths', { defaultValue: 'Duration (months)' })}
              placeholder="1"
              value={form.duration_months}
              onChangeText={(value) => updateForm('duration_months', value)}
              keyboardType="numeric"
              error={errors.duration_months}
            />
          </SectionCard>

          <SectionCard
            icon="cube-outline"
            title={t('adminVendorPartnership.requirements', { defaultValue: 'Product requirements' })}
            subtitle="Limits for vendor products"
          >
            <View style={styles.row}>
              <View style={styles.half}>
                <Input
                  label={t('adminVendorPartnership.productsMin', { defaultValue: 'Min products' })}
                  placeholder="5"
                  value={form.required_products_min}
                  onChangeText={(value) => updateForm('required_products_min', value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Input
                  label={t('adminVendorPartnership.productsMax', { defaultValue: 'Max products' })}
                  placeholder="10"
                  value={form.required_products_max}
                  onChangeText={(value) => updateForm('required_products_max', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Input
                  label={t('adminVendorPartnership.maxListings', { defaultValue: 'Max listings' })}
                  placeholder="10"
                  value={form.max_product_listings}
                  onChangeText={(value) => updateForm('max_product_listings', value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Input
                  label={t('adminVendorPartnership.maxImages', { defaultValue: 'Max partner images' })}
                  placeholder="1"
                  value={form.max_partner_product_images}
                  onChangeText={(value) => updateForm('max_partner_product_images', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </SectionCard>

          <SectionCard
            icon="megaphone-outline"
            title={t('adminVendorPartnership.marketing', { defaultValue: 'Marketing & exposure' })}
            subtitle="Banners and social reach"
          >
            <Text style={styles.fieldLabel}>
              {t('adminVendorPartnership.marketingExposure', { defaultValue: 'Marketing exposure' })}
            </Text>
            <View style={styles.chipRow}>
              {MARKETING_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[styles.chip, form.marketing_exposure === level && styles.chipActive]}
                  onPress={() => updateForm('marketing_exposure', level)}
                >
                  <Text style={[styles.chipText, form.marketing_exposure === level && styles.chipTextActive]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Input
                  label={t('adminVendorPartnership.socialPosts', { defaultValue: 'Social posts / month' })}
                  placeholder="0"
                  value={form.social_media_posts_per_month}
                  onChangeText={(value) => updateForm('social_media_posts_per_month', value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.half}>
                <Input
                  label={t('adminVendorPartnership.appBanners', { defaultValue: 'App banners' })}
                  placeholder="0"
                  value={form.app_banners}
                  onChangeText={(value) => updateForm('app_banners', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>
              {t('adminVendorPartnership.homeBannerSize', { defaultValue: 'Home banner size' })}
            </Text>
            <View style={styles.chipRow}>
              {BANNER_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.chip, form.home_banner_size === size && styles.chipActive]}
                  onPress={() => updateForm('home_banner_size', size)}
                >
                  <Text style={[styles.chipText, form.home_banner_size === size && styles.chipTextActive]}>
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>

          <SectionCard
            icon="gift-outline"
            title={t('adminVendorPartnership.benefits', { defaultValue: 'Benefits' })}
            subtitle={`${benefitCount} benefit${benefitCount === 1 ? '' : 's'} added`}
          >
            <Input
              label={t('adminVendorPartnership.benefitsHint', { defaultValue: 'One benefit per line' })}
              placeholder={'Partner logo in app\nMonthly report'}
              value={form.benefits}
              onChangeText={(value) => updateForm('benefits', value)}
              multiline
              numberOfLines={5}
            />
          </SectionCard>

          <SectionCard
            icon="options-outline"
            title={t('adminVendorPartnership.features', { defaultValue: 'Feature flags' })}
            subtitle="Toggle included perks"
          >
            <View style={styles.featureGrid}>
              {FEATURE_OPTIONS.map((option) => {
                const enabled = !!form.features[option.key];
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.featureCard, enabled && styles.featureCardActive]}
                    onPress={() => toggleFeature(option.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.featureIconWrap, enabled && styles.featureIconWrapActive]}>
                      <Ionicons
                        name={option.icon}
                        size={18}
                        color={enabled ? COLORS.background : COLORS.primary}
                      />
                    </View>
                    <Text style={[styles.featureLabel, enabled && styles.featureLabelActive]} numberOfLines={2}>
                      {option.label}
                    </Text>
                    <Ionicons
                      name={enabled ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={enabled ? COLORS.primary : COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </SectionCard>

          <SectionCard
            icon="settings-outline"
            title={t('adminVendorPartnership.settings', { defaultValue: 'Settings' })}
          >
            <Input
              label={t('adminVendorPartnership.sortOrder', { defaultValue: 'Sort order' })}
              placeholder="0"
              value={form.sort_order}
              onChangeText={(value) => updateForm('sort_order', value)}
              keyboardType="numeric"
            />
            <View style={styles.activeRow}>
              <View>
                <Text style={styles.activeTitle}>
                  {t('adminVendorPartnership.isActive', { defaultValue: 'Active tier' })}
                </Text>
                <Text style={styles.activeSubtitle}>Visible to vendors when applying</Text>
              </View>
              <Switch
                value={form.is_active}
                onValueChange={(value) => updateForm('is_active', value)}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={form.is_active ? COLORS.primary : COLORS.background}
              />
            </View>
          </SectionCard>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <>
                <Ionicons name={isEdit ? 'save-outline' : 'add-circle-outline'} size={20} color={COLORS.background} />
                <Text style={styles.saveBtnText}>
                  {isEdit
                    ? t('adminVendorPartnership.saveChanges', { defaultValue: 'Save Changes' })
                    : t('adminVendorPartnership.createTier', { defaultValue: 'Create Tier' })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  flex: { flex: 1 },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 5,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  previewBadge: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  previewContent: { flex: 1 },
  previewName: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  previewSlug: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  previewPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  previewPrice: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold },
  previewDuration: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  previewStatus: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  previewActive: { backgroundColor: COLORS.success + '18' },
  previewInactive: { backgroundColor: COLORS.textSecondary + '18' },
  previewStatusText: { fontSize: 10, fontWeight: FONT_WEIGHTS.semiBold },
  previewActiveText: { color: COLORS.success },
  previewInactiveText: { color: COLORS.textSecondary },
  sectionCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  sectionSubtitle: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xs },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: COLORS.text,
    transform: [{ scale: 1.08 }],
  },
  colorHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
    marginBottom: SPACING.sm,
  },
  row: { flexDirection: 'row', gap: SPACING.sm },
  half: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '14',
  },
  chipText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  featureCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  featureCardActive: {
    borderColor: COLORS.primary + '55',
    backgroundColor: COLORS.primary + '08',
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconWrapActive: { backgroundColor: COLORS.primary },
  featureLabel: { flex: 1, fontSize: 11, color: COLORS.text },
  featureLabelActive: { fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  activeTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  activeSubtitle: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
});

export default AdminVendorPartnershipTierFormScreen;
