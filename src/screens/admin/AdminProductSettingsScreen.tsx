import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import {
  adminService,
  AdminServicePriceIncludes,
  AdminServicePricingSettings,
  AdminServicePricingType,
} from '../../services/adminService';

type PriceInclusionKey = keyof AdminServicePriceIncludes;

const PRICE_INCLUSIONS: { key: PriceInclusionKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'materials', icon: 'cube-outline' },
  { key: 'installation', icon: 'construct-outline' },
  { key: 'labor', icon: 'people-outline' },
  { key: 'transportation', icon: 'car-outline' },
  { key: 'delivery', icon: 'bicycle-outline' },
];

const EXAMPLE_AREA_M2 = 100;
const EXAMPLE_CART_SUBTOTAL = 200;

const DEFAULT_INCLUSIONS: AdminServicePriceIncludes = {
  materials: true,
  installation: true,
  labor: true,
  transportation: false,
  delivery: false,
};

function parseFeeAmount(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseBoolFlag(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }
  return false;
}

function parsePricingType(raw: unknown): AdminServicePricingType {
  return String(raw || '').toLowerCase() === 'per_m2' ? 'per_m2' : 'fixed';
}

function parseIncludesFromData(data: Record<string, unknown>): AdminServicePriceIncludes {
  const includesRaw =
    (data.price_includes && typeof data.price_includes === 'object'
      ? (data.price_includes as Record<string, unknown>)
      : null) || {};

  const fromObject: AdminServicePriceIncludes = {
    materials: parseBoolFlag(includesRaw.materials ?? DEFAULT_INCLUSIONS.materials),
    installation: parseBoolFlag(includesRaw.installation ?? DEFAULT_INCLUSIONS.installation),
    labor: parseBoolFlag(includesRaw.labor ?? DEFAULT_INCLUSIONS.labor),
    transportation: parseBoolFlag(
      includesRaw.transportation ?? DEFAULT_INCLUSIONS.transportation
    ),
    delivery: parseBoolFlag(includesRaw.delivery ?? DEFAULT_INCLUSIONS.delivery),
  };

  const options = data.price_includes_options;
  if (!Array.isArray(options) || options.length === 0) return fromObject;

  const next = { ...fromObject };
  options.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const item = row as Record<string, unknown>;
    const key = String(item.key || '').toLowerCase() as PriceInclusionKey;
    if (!(key in next)) return;
    next[key] = parseBoolFlag(item.selected);
  });
  return next;
}

/**
 * Parse GET /admin/settings/service-pricing response.
 * Uses separate `price` (fixed) and `price_per_m2` fields from the API.
 */
function parseServicePricingPayload(raw: unknown): AdminServicePricingSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const pricing_type = parsePricingType(data.pricing_type ?? data.pricingType);
  const fixedPrice = parseFeeAmount(data.price ?? data.amount);
  const perM2Price = parseFeeAmount(data.price_per_m2);

  // Accept payload when at least the active type has a value, or either field exists.
  if (pricing_type === 'fixed' && fixedPrice == null && perM2Price == null) return null;
  if (pricing_type === 'per_m2' && perM2Price == null && fixedPrice == null) return null;

  return {
    pricing_type,
    price: fixedPrice,
    price_per_m2: perM2Price,
    currency: typeof data.currency === 'string' ? data.currency : 'AED',
    requires_area: Boolean(data.requires_area ?? pricing_type === 'per_m2'),
    price_includes: parseIncludesFromData(data),
    price_includes_labels: Array.isArray(data.price_includes_labels)
      ? data.price_includes_labels.map(String)
      : undefined,
    applies_to: typeof data.applies_to === 'string' ? data.applies_to : undefined,
    note: data.note != null ? String(data.note) : null,
  };
}

const AdminProductSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [lowStockWarning, setLowStockWarning] = useState(true);
  const [allowBackorders, setAllowBackorders] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(true);

  const [pricingType, setPricingType] = useState<AdminServicePricingType>('fixed');
  const [fixedPrice, setFixedPrice] = useState('');
  const [pricePerM2, setPricePerM2] = useState('');
  const [inclusions, setInclusions] = useState<AdminServicePriceIncludes>(DEFAULT_INCLUSIONS);
  const [loadingServicePricing, setLoadingServicePricing] = useState(true);
  const [savingServicePricing, setSavingServicePricing] = useState(false);

  const [instantOrderFeeEnabled, setInstantOrderFeeEnabled] = useState(false);
  const [instantOrderExtraFee, setInstantOrderExtraFee] = useState('0');
  const [loadingInstantFee, setLoadingInstantFee] = useState(true);
  const [savingInstantFee, setSavingInstantFee] = useState(false);

  const parseAmount = (value: string) => {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const activePriceInput = pricingType === 'fixed' ? fixedPrice : pricePerM2;
  // Derived alias so any remaining UI refs to `price` use the selected tab value only.
  const price = activePriceInput;
  const parsedPrice = useMemo(() => parseAmount(price), [price]);
  const parsedFixedPrice = useMemo(() => parseAmount(fixedPrice), [fixedPrice]);
  const parsedPricePerM2 = useMemo(() => parseAmount(pricePerM2), [pricePerM2]);
  const parsedInstantFee = useMemo(
    () => parseAmount(instantOrderExtraFee),
    [instantOrderExtraFee]
  );

  const exampleTotal =
    parsedPricePerM2 != null ? EXAMPLE_AREA_M2 * parsedPricePerM2 : null;

  const instantFeePreviewAmount =
    instantOrderFeeEnabled && parsedInstantFee != null ? parsedInstantFee : 0;
  const instantFeePreviewTotal = EXAMPLE_CART_SUBTOTAL + instantFeePreviewAmount;

  const selectPricingType = (next: AdminServicePricingType) => {
    if (next === pricingType) return;
    // Keep both values in state; only the active tab's input is shown.
    setPricingType(next);
  };

  const setActivePrice = (text: string) => {
    const cleaned = text.replace(/[^0-9.,]/g, '');
    if (pricingType === 'fixed') {
      setFixedPrice(cleaned);
    } else {
      setPricePerM2(cleaned);
    }
  };

  const applyServicePricingFromApi = useCallback((settings: AdminServicePricingSettings) => {
    setPricingType(settings.pricing_type);
    // Keep separate fields from GET so switching tabs does not lose values.
    setFixedPrice(settings.price != null ? String(settings.price) : '');
    setPricePerM2(
      settings.price_per_m2 != null
        ? String(settings.price_per_m2)
        : settings.pricing_type === 'per_m2' && settings.price != null
          ? String(settings.price)
          : ''
    );
    setInclusions(settings.price_includes);
  }, []);

  const applyInstantFeeFromApi = useCallback((amountRaw: unknown) => {
    const amount = parseFeeAmount(amountRaw) ?? 0;
    setInstantOrderExtraFee(String(amount));
    setInstantOrderFeeEnabled(amount > 0);
  }, []);

  const loadServicePricing = useCallback(async () => {
    setLoadingServicePricing(true);
    try {
      const res = await adminService.getServicePricingSettings();
      if (res?.success === false) {
        throw new Error(res.message || 'Failed to load service pricing.');
      }
      const parsed = parseServicePricingPayload(res) ?? parseServicePricingPayload(res?.data);
      if (parsed) applyServicePricingFromApi(parsed);
    } catch {
      // Keep current local values if GET is unavailable; POST still works.
    } finally {
      setLoadingServicePricing(false);
    }
  }, [applyServicePricingFromApi]);

  const loadInstantOrderFee = useCallback(async () => {
    setLoadingInstantFee(true);
    try {
      const res = await adminService.getInstantOrderFee();
      if (res?.success === false) {
        throw new Error(res.message || 'Failed to load instant order fee.');
      }
      const data = (res as { data?: Record<string, unknown> })?.data ?? (res as Record<string, unknown>);
      applyInstantFeeFromApi(
        data?.instant_order_fee_amount ??
          data?.amount ??
          (data as { fee?: unknown })?.fee
      );
    } catch {
      // Keep current local values if GET is unavailable; PUT still works.
    } finally {
      setLoadingInstantFee(false);
    }
  }, [applyInstantFeeFromApi]);

  useFocusEffect(
    useCallback(() => {
      loadServicePricing();
      loadInstantOrderFee();
    }, [loadServicePricing, loadInstantOrderFee])
  );

  const toggleInclusion = (key: PriceInclusionKey) => {
    setInclusions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onDecimalAmountChange = (text: string, setter: (v: string) => void) => {
    setter(text.replace(/[^0-9.,]/g, ''));
  };

  const handleSaveServicePricing = async () => {
    if (parsedPrice == null) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('admin.settings.productSettings.areaBasedPricing.invalidPrice', {
          defaultValue: 'Enter a valid price (≥ 0).',
        })
      );
      return;
    }

    setSavingServicePricing(true);
    try {
      const res = await adminService.updateServicePricingSettings({
        pricing_type: pricingType,
        price: parsedPrice,
        price_includes: inclusions,
      });
      if (res?.success === false) {
        throw new Error(
          res.message ||
            t('admin.settings.productSettings.areaBasedPricing.saveFailed', {
              defaultValue: 'Failed to save service pricing settings.',
            })
        );
      }
      const parsed = parseServicePricingPayload(res) ?? parseServicePricingPayload(res?.data);
      if (parsed) {
        applyServicePricingFromApi(parsed);
      } else {
        applyServicePricingFromApi({
          pricing_type: pricingType,
          price: pricingType === 'fixed' ? parsedPrice : null,
          price_per_m2: pricingType === 'per_m2' ? parsedPrice : null,
          price_includes: inclusions,
        });
      }
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        res.message ||
          t('admin.settings.productSettings.areaBasedPricing.saved', {
            defaultValue: 'Service pricing settings saved for all services.',
          })
      );
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } }; message?: string })?.response
          ?.data?.message ||
        (error instanceof Error ? error.message : null) ||
        t('admin.settings.productSettings.areaBasedPricing.saveFailed', {
          defaultValue: 'Failed to save service pricing settings.',
        });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
    } finally {
      setSavingServicePricing(false);
    }
  };

  const handleSaveInstantOrderFee = async () => {
    const amountToSave = instantOrderFeeEnabled ? parsedInstantFee : 0;
    if (amountToSave == null) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('admin.settings.productSettings.instantOrderFee.invalid', {
          defaultValue: 'Enter a valid extra fee amount (≥ 0).',
        })
      );
      return;
    }

    setSavingInstantFee(true);
    try {
      const res = await adminService.updateInstantOrderFee({
        instant_order_fee_amount: amountToSave,
      });
      if (res?.success === false) {
        throw new Error(
          res.message ||
            t('admin.settings.productSettings.instantOrderFee.saveFailed', {
              defaultValue: 'Failed to save instant order fee.',
            })
        );
      }
      const saved =
        res?.data?.instant_order_fee_amount != null
          ? res.data.instant_order_fee_amount
          : amountToSave;
      applyInstantFeeFromApi(saved);
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        res.message ||
          t('admin.settings.productSettings.instantOrderFee.saved', {
            defaultValue:
              'Extra fee for instant orders saved. It will show on cart and checkout for category products.',
          })
      );
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } }; message?: string })?.response
          ?.data?.message ||
        (error instanceof Error ? error.message : null) ||
        t('admin.settings.productSettings.instantOrderFee.saveFailed', {
          defaultValue: 'Failed to save instant order fee.',
        });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
    } finally {
      setSavingInstantFee(false);
    }
  };

  const pricingBusy = loadingServicePricing || savingServicePricing;

  const renderInclusions = () => (
    <View style={[styles.pricingBlock, pricingBusy && styles.sectionDisabled]}>
      <Text style={styles.fieldLabel}>
        {t('admin.settings.productSettings.areaBasedPricing.priceIncludes')}
      </Text>
      <Text style={styles.fieldHint}>
        {t('admin.settings.productSettings.areaBasedPricing.priceIncludesHint')}
      </Text>
      {PRICE_INCLUSIONS.map((item, index) => {
        const checked = inclusions[item.key];
        const isLast = index === PRICE_INCLUSIONS.length - 1;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.inclusionRow, isLast && styles.inclusionRowLast]}
            onPress={() => toggleInclusion(item.key)}
            activeOpacity={0.7}
            disabled={pricingBusy}
          >
            <View style={styles.inclusionLeft}>
              <View style={styles.inclusionIcon}>
                <Ionicons name={item.icon} size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.inclusionLabel}>
                {t(`admin.settings.productSettings.areaBasedPricing.inclusions.${item.key}`)}
              </Text>
            </View>
            <View style={[styles.checkBox, checked && styles.checkBoxActive]}>
              {checked ? (
                <Ionicons name="checkmark" size={14} color={COLORS.background} />
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.settings.productSettings.title')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('admin.settings.productSettings.inventory')}
          </Text>
          <View style={styles.sectionContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="warning-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.lowStockWarning.title')}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('admin.settings.productSettings.lowStockWarning.subtitle')}
                </Text>
              </View>
              <Switch
                value={lowStockWarning}
                onValueChange={setLowStockWarning}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={lowStockWarning ? COLORS.primary : COLORS.background}
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="layers-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.allowBackorders.title')}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('admin.settings.productSettings.allowBackorders.subtitle')}
                </Text>
              </View>
              <Switch
                value={allowBackorders}
                onValueChange={setAllowBackorders}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={allowBackorders ? COLORS.primary : COLORS.background}
              />
            </View>
            <View style={[styles.settingItem, styles.settingItemLast]}>
              <View style={styles.settingIcon}>
                <Ionicons name="eye-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.showOutOfStock.title')}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('admin.settings.productSettings.showOutOfStock.subtitle')}
                </Text>
              </View>
              <Switch
                value={showOutOfStock}
                onValueChange={setShowOutOfStock}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={showOutOfStock ? COLORS.primary : COLORS.background}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('admin.settings.productSettings.display')}
          </Text>
          <View style={styles.sectionContent}>
            <View style={[styles.settingItem, styles.settingItemLast]}>
              <View style={styles.settingIcon}>
                <Ionicons name="cash-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.currency.title')}
                </Text>
                <Text style={styles.settingSubtitle}>AED</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Area-Based Pricing — POST /admin/settings/service-pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('admin.settings.productSettings.areaBasedPricing.section')}
          </Text>
          <Text style={styles.sectionHint}>
            {t('admin.settings.productSettings.areaBasedPricing.hint')}
          </Text>
          <View style={styles.sectionContent}>
            {loadingServicePricing ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>
                  {t('admin.settings.loading', { defaultValue: 'Loading…' })}
                </Text>
              </View>
            ) : null}

            <View style={[styles.pricingBlock, pricingBusy && styles.sectionDisabled]}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.areaBasedPricing.pricingType')}
              </Text>
              <View style={styles.pricingTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.pricingTypeOption,
                    pricingType === 'fixed' && styles.pricingTypeOptionActive,
                  ]}
                  onPress={() => selectPricingType('fixed')}
                  activeOpacity={0.8}
                  disabled={pricingBusy}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={18}
                    color={pricingType === 'fixed' ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.pricingTypeText,
                      pricingType === 'fixed' && styles.pricingTypeTextActive,
                    ]}
                  >
                    {t('admin.settings.productSettings.areaBasedPricing.fixedPrice')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pricingTypeOption,
                    pricingType === 'per_m2' && styles.pricingTypeOptionActive,
                  ]}
                  onPress={() => selectPricingType('per_m2')}
                  activeOpacity={0.8}
                  disabled={pricingBusy}
                >
                  <Ionicons
                    name="resize-outline"
                    size={18}
                    color={pricingType === 'per_m2' ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.pricingTypeText,
                      pricingType === 'per_m2' && styles.pricingTypeTextActive,
                    ]}
                  >
                    {t('admin.settings.productSettings.areaBasedPricing.pricePerM2')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {pricingType === 'fixed' ? (
              <>
                <View style={styles.divider} />
                <View style={[styles.pricingBlock, pricingBusy && styles.sectionDisabled]}>
                  <Text style={styles.fieldLabel}>
                    {t('admin.settings.productSettings.areaBasedPricing.fixedPriceLabel')}
                  </Text>
                  <Text style={styles.fieldHint}>
                    {t('admin.settings.productSettings.areaBasedPricing.fixedPriceHint')}
                  </Text>
                  <View style={styles.priceInputRow}>
                    <TextInput
                      style={styles.priceInput}
                      value={fixedPrice}
                      onChangeText={setActivePrice}
                      keyboardType="decimal-pad"
                      placeholder="800"
                      placeholderTextColor={COLORS.textSecondary}
                      editable={!pricingBusy}
                    />
                    <Text style={styles.priceSuffix}>
                      {t('admin.settings.productSettings.areaBasedPricing.aed')}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />
                {renderInclusions()}

                <View style={styles.divider} />
                <View style={[styles.pricingBlock, styles.exampleBlock]}>
                  <Text style={styles.fieldLabel}>
                    {t('admin.settings.productSettings.areaBasedPricing.fixedPreviewTitle')}
                  </Text>
                  <Text style={styles.exampleTotal}>
                    {t('admin.settings.productSettings.areaBasedPricing.fixedPreviewPrice', {
                      price:
                        parsedFixedPrice != null
                          ? parsedFixedPrice.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })
                          : '—',
                    })}
                  </Text>
                  <Text style={styles.exampleNote}>
                    {t('admin.settings.productSettings.areaBasedPricing.fixedCustomerNote')}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.divider} />
                <View style={[styles.pricingBlock, pricingBusy && styles.sectionDisabled]}>
                  <Text style={styles.fieldLabel}>
                    {t('admin.settings.productSettings.areaBasedPricing.pricePerM2Label')}
                  </Text>
                  <Text style={styles.fieldHint}>
                    {t('admin.settings.productSettings.areaBasedPricing.pricePerM2Hint')}
                  </Text>
                  <View style={styles.priceInputRow}>
                    <TextInput
                      style={styles.priceInput}
                      value={pricePerM2}
                      onChangeText={setActivePrice}
                      keyboardType="decimal-pad"
                      placeholder="70"
                      placeholderTextColor={COLORS.textSecondary}
                      editable={!pricingBusy}
                    />
                    <Text style={styles.priceSuffix}>
                      {t('admin.settings.productSettings.areaBasedPricing.aedPerM2')}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />
                {renderInclusions()}

                <View style={styles.divider} />
                <View style={[styles.pricingBlock, styles.exampleBlock]}>
                  <Text style={styles.fieldLabel}>
                    {t('admin.settings.productSettings.areaBasedPricing.exampleTitle')}
                  </Text>
                  <Text style={styles.exampleLine}>
                    {t('admin.settings.productSettings.areaBasedPricing.exampleArea', {
                      area: EXAMPLE_AREA_M2,
                    })}
                  </Text>
                  <Text style={styles.exampleLine}>
                    {t('admin.settings.productSettings.areaBasedPricing.exampleUnitPrice', {
                      price:
                        parsedPricePerM2 != null
                          ? parsedPricePerM2.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })
                          : '—',
                    })}
                  </Text>
                  <Text style={styles.exampleTotal}>
                    {t('admin.settings.productSettings.areaBasedPricing.exampleTotal', {
                      total:
                        exampleTotal != null
                          ? exampleTotal.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })
                          : '—',
                    })}
                  </Text>
                  <Text style={styles.exampleNote}>
                    {t('admin.settings.productSettings.areaBasedPricing.customerNote')}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.divider} />
            <View style={styles.pricingBlock}>
              <TouchableOpacity
                style={[styles.saveButton, pricingBusy && styles.saveButtonDisabled]}
                onPress={handleSaveServicePricing}
                disabled={pricingBusy}
                activeOpacity={0.85}
              >
                {savingServicePricing ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {t('admin.settings.productSettings.save', { defaultValue: 'Save' })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Extra fee for instant orders (category products) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('admin.settings.productSettings.instantOrderFee.section', {
              defaultValue: 'Instant Orders',
            })}
          </Text>
          <Text style={styles.sectionHint}>
            {t('admin.settings.productSettings.instantOrderFee.hint', {
              defaultValue:
                'Set an extra fee for instant category-product orders. When enabled, customers see this fee on cart and checkout.',
            })}
          </Text>
          <View style={styles.sectionContent}>
            {loadingInstantFee ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>
                  {t('admin.settings.loading', { defaultValue: 'Loading…' })}
                </Text>
              </View>
            ) : null}
            <View style={[styles.settingItem, loadingInstantFee && styles.sectionDisabled]}>
              <View style={styles.settingIcon}>
                <Ionicons name="flash-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.instantOrderFee.enableTitle', {
                    defaultValue: 'Extra fee for instant orders',
                  })}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('admin.settings.productSettings.instantOrderFee.enableSubtitle', {
                    defaultValue: 'Apply to category products booked as instant',
                  })}
                </Text>
              </View>
              <Switch
                value={instantOrderFeeEnabled}
                onValueChange={setInstantOrderFeeEnabled}
                disabled={loadingInstantFee || savingInstantFee}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={instantOrderFeeEnabled ? COLORS.primary : COLORS.background}
              />
            </View>

            <View style={styles.divider} />

            <View style={[styles.pricingBlock, loadingInstantFee && styles.sectionDisabled]}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.instantOrderFee.feeLabel', {
                  defaultValue: 'Extra fee amount',
                })}
              </Text>
              <Text style={styles.fieldHint}>
                {t('admin.settings.productSettings.instantOrderFee.feeHint', {
                  defaultValue:
                    'Added on cart and checkout when the customer chooses instant order for category products.',
                })}
              </Text>
              <View
                style={[
                  styles.priceInputRow,
                  !instantOrderFeeEnabled && styles.priceInputRowDisabled,
                ]}
              >
                <TextInput
                  style={styles.priceInput}
                  value={instantOrderExtraFee}
                  onChangeText={(text) => onDecimalAmountChange(text, setInstantOrderExtraFee)}
                  keyboardType="decimal-pad"
                  placeholder="15"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={instantOrderFeeEnabled && !loadingInstantFee && !savingInstantFee}
                />
                <Text style={styles.priceSuffix}>
                  {t('admin.settings.productSettings.areaBasedPricing.aed', {
                    defaultValue: 'AED',
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={[styles.pricingBlock, styles.exampleBlock]}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.instantOrderFee.previewTitle', {
                  defaultValue: 'Customer preview (cart / checkout)',
                })}
              </Text>
              <View style={styles.previewRow}>
                <Text style={styles.exampleLine}>
                  {t('admin.settings.productSettings.instantOrderFee.previewSubtotal', {
                    defaultValue: 'Subtotal',
                  })}
                </Text>
                <Text style={styles.exampleLine}>
                  AED {EXAMPLE_CART_SUBTOTAL.toFixed(2)}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.exampleLine}>
                  {t('admin.settings.productSettings.instantOrderFee.previewFeeLabel', {
                    defaultValue: 'Instant order fee',
                  })}
                </Text>
                <Text style={styles.exampleLine}>
                  {instantFeePreviewAmount > 0
                    ? `AED ${instantFeePreviewAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : t('admin.settings.productSettings.instantOrderFee.previewFeeOff', {
                        defaultValue: '—',
                      })}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.exampleTotal}>
                  {t('admin.settings.productSettings.instantOrderFee.previewTotal', {
                    defaultValue: 'Total',
                  })}
                </Text>
                <Text style={styles.exampleTotal}>
                  AED{' '}
                  {instantFeePreviewTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <Text style={styles.exampleNote}>
                {t('admin.settings.productSettings.instantOrderFee.customerNote', {
                  defaultValue:
                    'On the customer app this line appears under order summary on Cart and Checkout for category products with instant delivery.',
                })}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.pricingBlock}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (savingInstantFee || loadingInstantFee) && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveInstantOrderFee}
                disabled={savingInstantFee || loadingInstantFee}
                activeOpacity={0.85}
              >
                {savingInstantFee ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color={COLORS.background} />
                    <Text style={styles.saveButtonText}>
                      {t('admin.settings.productSettings.save', { defaultValue: 'Save' })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('admin.settings.productSettings.maintenancePhotosSection')}
          </Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={[styles.settingItem, styles.settingItemLast]}
              onPress={() => navigation.navigate('AdminMaintenancePhotos')}
              activeOpacity={0.7}
            >
              <View style={styles.settingIcon}>
                <Ionicons name="images-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.maintenancePhotos.title')}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('admin.settings.productSettings.maintenancePhotos.subtitle')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  sectionContent: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  pricingBlock: {
    padding: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  fieldHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  pricingTypeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  pricingTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pricingTypeOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
  },
  pricingTypeText: {
    flexShrink: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  pricingTypeTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  priceSuffix: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  inclusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  inclusionRowLast: {
    borderBottomWidth: 0,
  },
  inclusionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.md,
  },
  inclusionIcon: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  inclusionLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  checkBoxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  exampleBlock: {
    backgroundColor: COLORS.primary + '08',
  },
  exampleLine: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  exampleTotal: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  exampleNote: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  priceInputRowDisabled: {
    opacity: 0.45,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  sectionDisabled: {
    opacity: 0.55,
  },
});

export default AdminProductSettingsScreen;
