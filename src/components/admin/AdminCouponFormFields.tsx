import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../common/Input';
import AdminCouponFormSection from './AdminCouponFormSection';
import type { CouponAppliesTo, CouponDiscountType } from '../../types/coupon';
import {
  idsInclude,
  normalizeCouponAppliesTo,
  normalizePositiveIds,
  parseRelationIds,
  toggleIdInList,
} from '../../utils/couponRelationIds';

/** Client-requested discount types (percentage + fixed amount). */
export const COUPON_DISCOUNT_TYPES: CouponDiscountType[] = ['percentage', 'fixed_amount'];

export type CouponFormState = {
  code: string;
  title: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  usageLimit: string;
  usageLimitPerUser: string;
  appliesTo: CouponAppliesTo;
  selectedCategoryIds: number[];
  selectedServiceIds: number[];
};

type CategoryOption = { id: number; name: string };
type ServiceOption = { id: number; name: string };

type Props = {
  form: CouponFormState;
  setForm: React.Dispatch<React.SetStateAction<CouponFormState>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  codeEditable?: boolean;
  categories?: CategoryOption[];
  categoriesLoading?: boolean;
  services?: ServiceOption[];
  servicesLoading?: boolean;
};

const AdminCouponFormFields: React.FC<Props> = ({
  form,
  setForm,
  errors,
  setErrors,
  codeEditable = true,
  categories = [],
  categoriesLoading = false,
  services = [],
  servicesLoading = false,
}) => {
  const { t } = useTranslation();
  const [showTypeModal, setShowTypeModal] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [showServiceModal, setShowServiceModal] = React.useState(false);

  const SCOPE_OPTIONS: {
    key: CouponAppliesTo;
    label: string;
    desc: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      key: 'all',
      label: t('admin.couponForm.scopeAllProducts', 'All products'),
      desc: t('admin.couponForm.scopeAllDesc', 'Valid on entire store cart'),
      icon: 'storefront-outline',
    },
    {
      key: 'categories',
      label: t('admin.couponForm.scopeCategory', 'Specific category'),
      desc: t('admin.couponForm.scopeCatDesc', 'Only selected product categories'),
      icon: 'folder-open-outline',
    },
    {
      key: 'services',
      label: t('admin.couponForm.scopeService', 'Specific service'),
      desc: t('admin.couponForm.scopeSvcDesc', 'Only selected services'),
      icon: 'construct-outline',
    },
  ];

  const typeLabel = (type: CouponDiscountType) => {
    switch (type) {
      case 'percentage':
        return t('admin.coupons.typePercent', 'Percentage (%)');
      case 'fixed_amount':
        return t('admin.coupons.typeFixed', 'Fixed amount (AED)');
      case 'free_shipping':
        return t('admin.coupons.typeFreeShip', 'Free shipping');
      default:
        return type;
    }
  };

  const patch = (partial: Partial<CouponFormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  };

  const clearError = (key: string) => {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  return (
    <View>
      <AdminCouponFormSection
        icon="ticket-outline"
        title={t('admin.couponForm.sectionBasic', 'Coupon details')}
        subtitle={t('admin.couponForm.sectionBasicSub', 'Code customers enter at checkout')}
      >
      <Input
        label={t('admin.couponForm.codeLabel', 'Coupon code *')}
        placeholder={t('admin.couponForm.codePlaceholder', 'e.g. SAVE10')}
        value={form.code}
        onChangeText={(v) => {
          patch({ code: v.toUpperCase().replace(/\s/g, '') });
          clearError('code');
        }}
        autoCapitalize="characters"
        leftIcon="ticket-outline"
        error={errors.code}
        editable={codeEditable}
        disabled={!codeEditable}
      />

      <Input
        label={t('admin.couponForm.titleLabel', 'Title *')}
        placeholder={t('admin.couponForm.titlePlaceholder', 'e.g. 10% off summer sale')}
        value={form.title}
        onChangeText={(v) => {
          patch({ title: v });
          clearError('title');
        }}
        leftIcon="text-outline"
        error={errors.title}
      />

      <Input
        label={t('admin.couponForm.descriptionLabel', 'Description (optional)')}
        placeholder={t(
          'admin.couponForm.descriptionPlaceholder',
          'Shown to customer when applying code'
        )}
        value={form.description}
        onChangeText={(v) => patch({ description: v })}
        multiline
        numberOfLines={3}
      />
      </AdminCouponFormSection>

      <AdminCouponFormSection
        icon="pricetag-outline"
        title={t('admin.couponForm.sectionDiscount', 'Discount rules')}
        subtitle={t('admin.couponForm.sectionDiscountSub', 'Percentage or fixed AED amount')}
      >
      <Text style={styles.fieldLabel}>{t('admin.couponForm.typeLabel', 'Discount type *')}</Text>
      <TouchableOpacity
        style={[styles.picker, errors.discount_type ? styles.pickerError : null]}
        onPress={() => setShowTypeModal(true)}
      >
        <Text style={styles.pickerText}>{typeLabel(form.discountType)}</Text>
        <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {errors.discount_type ? <Text style={styles.errorText}>{errors.discount_type}</Text> : null}

      {form.discountType !== 'free_shipping' ? (
        <Input
          label={
            form.discountType === 'percentage'
              ? t('admin.couponForm.valuePercentLabel', 'Discount value (%) *')
              : t('admin.couponForm.valueFixedLabel', 'Discount amount (AED) *')
          }
          placeholder={form.discountType === 'percentage' ? '10' : '20'}
          value={form.discountValue}
          onChangeText={(v) => {
            patch({ discountValue: v.replace(/[^0-9.]/g, '') });
            clearError('discount_value');
          }}
          keyboardType="numeric"
          leftIcon="calculator-outline"
          error={errors.discount_value}
        />
      ) : (
        <Text style={styles.hint}>
          {t(
            'admin.couponForm.freeShippingHint',
            'No discount on items — shipping fee becomes 0 when coupon is valid.'
          )}
        </Text>
      )}

      {form.discountType === 'percentage' ? (
        <Input
          label={t('admin.couponForm.maxDiscountLabel', 'Maximum discount (AED)')}
          placeholder={t('admin.couponForm.maxDiscountPlaceholder', 'e.g. 30 (optional cap)')}
          value={form.maxDiscountAmount}
          onChangeText={(v) => patch({ maxDiscountAmount: v.replace(/[^0-9.]/g, '') })}
          keyboardType="numeric"
          leftIcon="shield-outline"
        />
      ) : null}

      <Input
        label={t('admin.couponForm.minOrderLabel', 'Minimum order amount (AED) *')}
        placeholder="50"
        value={form.minOrderAmount}
        onChangeText={(v) => {
          patch({ minOrderAmount: v.replace(/[^0-9.]/g, '') });
          clearError('min_order_amount');
        }}
        keyboardType="numeric"
        leftIcon="cart-outline"
        error={errors.min_order_amount}
      />
      </AdminCouponFormSection>

      <AdminCouponFormSection
        icon="location-outline"
        title={t('admin.couponForm.sectionScope', 'Where it applies')}
        subtitle={t('admin.couponForm.scopeHint', 'All products, or limit to categories or services')}
      >
      <View style={styles.scopeColumn}>
        {SCOPE_OPTIONS.map((opt) => {
          const selected = form.appliesTo === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.scopeOption, selected && styles.scopeOptionOn]}
              onPress={() =>
                patch({
                  appliesTo: opt.key,
                  selectedCategoryIds: opt.key === 'categories' ? form.selectedCategoryIds : [],
                  selectedServiceIds: opt.key === 'services' ? form.selectedServiceIds : [],
                })
              }
              activeOpacity={0.85}
            >
              <View style={[styles.scopeIconWrap, selected && styles.scopeIconWrapOn]}>
                <Ionicons name={opt.icon} size={22} color={selected ? COLORS.background : COLORS.primary} />
              </View>
              <View style={styles.scopeOptionText}>
                <Text style={[styles.scopeLabel, selected && styles.scopeLabelOn]}>{opt.label}</Text>
                <Text style={[styles.scopeDesc, selected && styles.scopeDescOn]}>{opt.desc}</Text>
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              ) : (
                <Ionicons name="ellipse-outline" size={24} color={COLORS.border} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {form.appliesTo === 'categories' ? (
        <>
          <TouchableOpacity
            style={[styles.picker, errors.category_ids ? styles.pickerError : null]}
            onPress={() => setShowCategoryModal(true)}
            disabled={categoriesLoading}
          >
            <Text style={styles.pickerText}>
              {form.selectedCategoryIds.length > 0
                ? t('admin.couponForm.categoriesSelected', '{{count}} categories selected').replace(
                    '{{count}}',
                    String(form.selectedCategoryIds.length)
                  )
                : t('admin.couponForm.selectCategories', 'Select categories')}
            </Text>
            <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {errors.category_ids ? (
            <Text style={styles.errorText}>{errors.category_ids}</Text>
          ) : null}
        </>
      ) : null}

      {form.appliesTo === 'services' ? (
        <>
          <TouchableOpacity
            style={[styles.picker, errors.service_ids ? styles.pickerError : null]}
            onPress={() => setShowServiceModal(true)}
            disabled={servicesLoading}
          >
            <Text style={styles.pickerText}>
              {normalizePositiveIds(form.selectedServiceIds).length > 0
                ? t('admin.couponForm.servicesSelected', '{{count}} services selected').replace(
                    '{{count}}',
                    String(normalizePositiveIds(form.selectedServiceIds).length)
                  )
                : t('admin.couponForm.selectServices', 'Select services')}
            </Text>
            <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {errors.service_ids ? (
            <Text style={styles.errorText}>{errors.service_ids}</Text>
          ) : null}
        </>
      ) : null}
      </AdminCouponFormSection>

      <AdminCouponFormSection
        icon="time-outline"
        title={t('admin.couponForm.sectionValidity', 'Expiry & usage limits')}
        subtitle={t('admin.couponForm.sectionValiditySub', 'Dates, usage caps, and active status')}
      >
      <View style={styles.dateRow}>
      <View style={styles.dateHalf}>
      <Input
        label={t('admin.couponForm.startsAtLabel', 'Valid from')}
        placeholder="2026-01-01"
        value={form.startsAt}
        onChangeText={(v) => patch({ startsAt: v })}
        autoCapitalize="none"
        leftIcon="calendar-outline"
      />
      </View>
      <View style={styles.dateHalf}>
      <Input
        label={t('admin.couponForm.endsAtLabel', 'Valid until')}
        placeholder="2026-12-31"
        value={form.endsAt}
        onChangeText={(v) => patch({ endsAt: v })}
        autoCapitalize="none"
        leftIcon="calendar-outline"
      />
      </View>
      </View>

      <Input
        label={t('admin.couponForm.usageLimitLabel', 'Global usage limit')}
        placeholder={t('admin.couponForm.unlimitedPlaceholder', 'Leave empty = unlimited')}
        value={form.usageLimit}
        onChangeText={(v) => patch({ usageLimit: v.replace(/[^0-9]/g, '') })}
        keyboardType="numeric"
        leftIcon="people-outline"
      />

      <Input
        label={t('admin.couponForm.usagePerUserLabel', 'Uses per customer')}
        placeholder={t('admin.couponForm.unlimitedPlaceholder', 'Leave empty = unlimited')}
        value={form.usageLimitPerUser}
        onChangeText={(v) => patch({ usageLimitPerUser: v.replace(/[^0-9]/g, '') })}
        keyboardType="numeric"
        leftIcon="person-outline"
      />

      <View style={styles.activeCard}>
        <View style={styles.switchTextWrap}>
          <Text style={styles.switchLabel}>{t('admin.couponForm.activeLabel', 'Coupon active')}</Text>
          <Text style={styles.switchHint}>
            {t('admin.couponForm.activeHint', 'Turn off anytime to disable this code')}
          </Text>
        </View>
        <Switch
          value={form.isActive}
          onValueChange={(v) => patch({ isActive: v })}
          trackColor={{ false: COLORS.border, true: COLORS.primary + '66' }}
          thumbColor={form.isActive ? COLORS.primary : '#f4f4f5'}
        />
      </View>
      </AdminCouponFormSection>

      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCategoryModal(false)}
          />
          <View style={[styles.modalSheet, styles.modalSheetTall]}>
            <Text style={styles.modalTitle}>
              {t('admin.couponForm.selectCategoriesTitle', 'Select categories')}
            </Text>
            {categoriesLoading ? (
              <Text style={styles.hint}>{t('common.loading', 'Loading...')}</Text>
            ) : categories.length === 0 ? (
              <Text style={styles.hint}>
                {t('admin.couponForm.noCategories', 'No categories found. Add categories first.')}
              </Text>
            ) : (
              <FlatList
                data={categories}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const selected = idsInclude(form.selectedCategoryIds, item.id);
                  return (
                    <TouchableOpacity
                      style={styles.modalOption}
                      onPress={() => {
                        patch({
                          selectedCategoryIds: toggleIdInList(
                            form.selectedCategoryIds,
                            item.id,
                            selected
                          ),
                        });
                        clearError('category_ids');
                      }}
                    >
                      <Text style={styles.modalOptionText}>{item.name}</Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color={COLORS.border} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setShowCategoryModal(false)}
            >
              <Text style={styles.modalDoneText}>{t('common.done', 'Done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showServiceModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowServiceModal(false)}
          />
          <View style={[styles.modalSheet, styles.modalSheetTall]}>
            <Text style={styles.modalTitle}>
              {t('admin.couponForm.selectServicesTitle', 'Select services')}
            </Text>
            {servicesLoading ? (
              <Text style={styles.hint}>{t('common.loading', 'Loading...')}</Text>
            ) : services.length === 0 ? (
              <Text style={styles.hint}>
                {t('admin.couponForm.noServices', 'No services found. Add services first.')}
              </Text>
            ) : (
              <FlatList
                data={services}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const selected = idsInclude(form.selectedServiceIds, item.id);
                  return (
                    <TouchableOpacity
                      style={styles.modalOption}
                      onPress={() => {
                        patch({
                          selectedServiceIds: toggleIdInList(
                            form.selectedServiceIds,
                            item.id,
                            selected
                          ),
                        });
                        clearError('service_ids');
                      }}
                    >
                      <Text style={styles.modalOptionText}>{item.name}</Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color={COLORS.border} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setShowServiceModal(false)}
            >
              <Text style={styles.modalDoneText}>{t('common.done', 'Done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTypeModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTypeModal(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {t('admin.couponForm.selectType', 'Select discount type')}
            </Text>
            <FlatList
              data={COUPON_DISCOUNT_TYPES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    patch({
                      discountType: item,
                      discountValue: item === 'free_shipping' ? '0' : form.discountValue,
                    });
                    clearError('discount_type');
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{typeLabel(item)}</Text>
                  {form.discountType === item ? (
                    <Ionicons name="checkmark" size={22} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export function validateCouponForm(
  form: CouponFormState,
  t: (key: string, opts?: { defaultValue?: string }) => string
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.code.trim()) {
    errors.code = t('admin.couponForm.errorCode', 'Coupon code is required');
  }
  if (!form.title.trim()) {
    errors.title = t('admin.couponForm.errorTitle', 'Title is required');
  }
  if (!form.discountType) {
    errors.discount_type = t('admin.couponForm.errorType', 'Discount type is required');
  }
  if (form.discountType !== 'free_shipping') {
    const val = parseFloat(form.discountValue);
    if (!form.discountValue.trim() || Number.isNaN(val) || val <= 0) {
      errors.discount_value = t('admin.couponForm.errorValue', 'Enter a valid discount value');
    }
    if (form.discountType === 'percentage' && val > 100) {
      errors.discount_value = t('admin.couponForm.errorPercentMax', 'Percentage cannot exceed 100');
    }
  }
  const min = parseFloat(form.minOrderAmount);
  if (form.minOrderAmount.trim() === '' || Number.isNaN(min) || min < 0) {
    errors.min_order_amount = t('admin.couponForm.errorMinOrder', 'Enter minimum order amount');
  }
  if (form.appliesTo === 'categories' && form.selectedCategoryIds.length === 0) {
    errors.category_ids = t(
      'admin.couponForm.errorCategories',
      'Select at least one category'
    );
  }
  if (
    form.appliesTo === 'services' &&
    normalizePositiveIds(form.selectedServiceIds).length === 0
  ) {
    errors.service_ids = t('admin.couponForm.errorServices', 'Select at least one service');
  }
  return errors;
}

export function formToPayload(form: CouponFormState) {
  return {
    code: form.code.trim().toUpperCase(),
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    discount_type: form.discountType,
    discount_value:
      form.discountType === 'free_shipping' ? 0 : parseFloat(form.discountValue) || 0,
    min_order_amount: parseFloat(form.minOrderAmount) || 0,
    max_discount_amount:
      form.discountType === 'percentage' && form.maxDiscountAmount.trim()
        ? parseFloat(form.maxDiscountAmount)
        : null,
    starts_at: form.startsAt.trim() || null,
    ends_at: form.endsAt.trim() || null,
    is_active: form.isActive,
    usage_limit: form.usageLimit.trim() ? parseInt(form.usageLimit, 10) : null,
    usage_limit_per_user: form.usageLimitPerUser.trim()
      ? parseInt(form.usageLimitPerUser, 10)
      : null,
    applies_to: form.appliesTo,
    catalog_scope:
      form.appliesTo === 'services' ? 'services' : 'products',
    category_ids: form.appliesTo === 'categories' ? form.selectedCategoryIds : [],
    service_ids:
      form.appliesTo === 'services'
        ? normalizePositiveIds(form.selectedServiceIds)
        : [],
  };
}

export function adminCouponToFormState(c: {
  code: string;
  title: string;
  description?: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean | number;
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  applies_to?: CouponAppliesTo;
  category_ids?: number[];
  service_ids?: number[];
}): CouponFormState {
  const appliesTo = normalizeCouponAppliesTo(c.applies_to);

  return {
    code: c.code,
    title: c.title,
    description: c.description ?? '',
    discountType: c.discount_type,
    discountValue: String(c.discount_value ?? ''),
    minOrderAmount: String(c.min_order_amount ?? 0),
    maxDiscountAmount:
      c.max_discount_amount != null ? String(c.max_discount_amount) : '',
    startsAt: c.starts_at ?? '',
    endsAt: c.ends_at ?? '',
    isActive: c.is_active === true || c.is_active === 1,
    usageLimit: c.usage_limit != null ? String(c.usage_limit) : '',
    usageLimitPerUser:
      c.usage_limit_per_user != null ? String(c.usage_limit_per_user) : '',
    appliesTo,
    selectedCategoryIds: parseRelationIds(c.category_ids, (c as { categories?: unknown }).categories, [
      'id',
      'category_id',
    ]),
    selectedServiceIds: parseRelationIds(c.service_ids, (c as { services?: unknown }).services, [
      'id',
      'service_id',
    ]),
  };
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  pickerError: { borderColor: COLORS.error },
  pickerText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  errorText: { color: COLORS.error, fontSize: FONT_SIZES.xs, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  hint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  switchTextWrap: { flex: 1, marginRight: SPACING.md },
  switchLabel: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  switchHint: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '50%',
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalOptionText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  scopeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  scopeColumn: { gap: SPACING.sm },
  scopeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },
  scopeOptionOn: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  scopeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeIconWrapOn: {
    backgroundColor: COLORS.primary,
  },
  scopeOptionText: { flex: 1 },
  scopeLabel: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  scopeLabelOn: { color: COLORS.primary },
  scopeDesc: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  scopeDescOn: { color: COLORS.primaryDark },
  dateRow: { flexDirection: 'row', gap: SPACING.sm },
  dateHalf: { flex: 1 },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  modalSheetTall: { maxHeight: '70%' },
  modalDoneBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalDoneText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
});

export default AdminCouponFormFields;
