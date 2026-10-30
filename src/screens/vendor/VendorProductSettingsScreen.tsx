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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import type { ServicePriceIncludes, ServicePricingSettings } from '../../services/servicePricingService';
import {
  buildVendorServicePricingSaveBody,
  vendorServicePricingService,
} from '../../services/vendorServicePricingService';

type PriceInclusionKey = keyof ServicePriceIncludes;
type AreaPricingType = 'fixed' | 'per_m2';

const PRICE_INCLUSIONS: { key: PriceInclusionKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'materials', icon: 'cube-outline' },
  { key: 'installation', icon: 'construct-outline' },
  { key: 'labor', icon: 'people-outline' },
  { key: 'transportation', icon: 'car-outline' },
  { key: 'delivery', icon: 'bicycle-outline' },
];

const EXAMPLE_AREA_M2 = 100;

const DEFAULT_INCLUSIONS: ServicePriceIncludes = {
  materials: true,
  installation: true,
  labor: true,
  transportation: false,
  delivery: false,
};

function unitPriceInputValue(amount: number | null | undefined): string {
  return amount != null && amount >= 0 ? String(amount) : '';
}

function treeShowOnClientFromSettings(settings: ServicePricingSettings): boolean {
  if (settings.show_on_client_products_services === false) return false;
  if (settings.show_on_client_products_services === true) return true;
  if (settings.tree_palm_pricing_enabled === false) return false;
  if (settings.tree_palm_pricing_enabled === true) return true;
  return true;
}

function applySettingsToTreePalmForm(settings: ServicePricingSettings): {
  enabled: boolean;
  pricePerTree: string;
  pricePerPalm: string;
  inclusions: ServicePriceIncludes;
} {
  return {
    enabled: treeShowOnClientFromSettings(settings),
    pricePerTree: unitPriceInputValue(settings.price_per_tree),
    pricePerPalm: unitPriceInputValue(settings.price_per_palm),
    inclusions:
      settings.tree_palm_price_includes ??
      settings.price_includes ??
      DEFAULT_INCLUSIONS,
  };
}

function areaShowOnCustomerFromSettings(settings: ServicePricingSettings): boolean {
  if (settings.show_on_client_products_services === false) return false;
  if (settings.show_on_client_products_services === true) return true;
  if (settings.service_pricing_enabled === false) return false;
  if (settings.service_pricing_enabled === true) return true;
  return true;
}

function applySettingsToAreaForm(settings: ServicePricingSettings): {
  showOnCustomer: boolean;
  areaPricingType: AreaPricingType;
  fixedPrice: string;
  pricePerM2: string;
  inclusions: ServicePriceIncludes;
} {
  const enableFixed = settings.enable_fixed_price === true;
  const enableM2 = settings.enable_per_m2 === true || settings.enable_price_per_m2 === true;
  const hasEnableFlags =
    settings.enable_fixed_price != null || settings.enable_per_m2 != null;

  const type: AreaPricingType =
    settings.pricing_type === 'fixed' || settings.pricing_type === 'per_m2'
      ? settings.pricing_type
      : enableFixed && !enableM2
        ? 'fixed'
        : enableM2
          ? 'per_m2'
          : 'per_m2';

  let fixedAmount: number | null = settings.fixed_price ?? null;
  let m2Amount: number | null = settings.per_m2_price ?? settings.price_per_m2 ?? null;

  if (hasEnableFlags) {
    if (!enableFixed) fixedAmount = null;
    if (!enableM2) m2Amount = null;
  } else {
    if (fixedAmount == null && settings.pricing_type === 'fixed') {
      fixedAmount = settings.price;
    }
    if (m2Amount == null && settings.pricing_type === 'per_m2') {
      m2Amount = settings.price;
    }
  }

  return {
    showOnCustomer: areaShowOnCustomerFromSettings(settings),
    areaPricingType: type,
    fixedPrice: unitPriceInputValue(fixedAmount),
    pricePerM2: unitPriceInputValue(m2Amount),
    inclusions: settings.price_includes ?? DEFAULT_INCLUSIONS,
  };
}

function parseDecimalInput(text: string): number | null {
  const normalized = text.replace(',', '.').trim();
  if (!normalized) return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function onDecimalPriceChange(text: string, setter: (v: string) => void) {
  setter(text.replace(/[^0-9.,]/g, ''));
}

const VendorProductSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [loadingAreaPricing, setLoadingAreaPricing] = useState(true);
  const [savingAreaPricing, setSavingAreaPricing] = useState(false);
  const [loadingTreePalm, setLoadingTreePalm] = useState(true);
  const [savingTreePalm, setSavingTreePalm] = useState(false);

  const [areaShowOnCustomer, setAreaShowOnCustomer] = useState(true);
  const [areaPricingType, setAreaPricingType] = useState<AreaPricingType>('per_m2');
  const [fixedPrice, setFixedPrice] = useState('');
  const [pricePerM2, setPricePerM2] = useState('');
  const [areaInclusions, setAreaInclusions] = useState<ServicePriceIncludes>(DEFAULT_INCLUSIONS);

  const [treePalmPricingEnabled, setTreePalmPricingEnabled] = useState(false);
  const [pricePerTree, setPricePerTree] = useState('');
  const [pricePerPalm, setPricePerPalm] = useState('');
  const [treeInclusions, setTreeInclusions] = useState<ServicePriceIncludes>(DEFAULT_INCLUSIONS);

  const parsedFixedPrice = parseDecimalInput(fixedPrice);
  const parsedPricePerM2 = parseDecimalInput(pricePerM2);
  const parsedPricePerTree = parseDecimalInput(pricePerTree);
  const parsedPricePerPalm = parseDecimalInput(pricePerPalm);

  const exampleAreaTotal = useMemo(() => {
    if (parsedPricePerM2 == null) return null;
    return parsedPricePerM2 * EXAMPLE_AREA_M2;
  }, [parsedPricePerM2]);

  const areaSectionBusy = loadingAreaPricing || savingAreaPricing;
  const treePalmSectionBusy = loadingTreePalm || savingTreePalm;

  const loadAreaPricing = useCallback(async () => {
    setLoadingAreaPricing(true);
    try {
      const settings = await vendorServicePricingService.getServicePricing();
      if (settings) {
        const next = applySettingsToAreaForm(settings);
        setAreaShowOnCustomer(next.showOnCustomer);
        setAreaPricingType(next.areaPricingType);
        setFixedPrice(next.fixedPrice);
        setPricePerM2(next.pricePerM2);
        setAreaInclusions(next.inclusions);
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) return;
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        t('vendorProfile.productSettingsLoadFailed', {
          defaultValue: 'Failed to load service pricing settings.',
        });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
    } finally {
      setLoadingAreaPricing(false);
    }
  }, [t]);

  const loadTreePalmPricing = useCallback(async () => {
    setLoadingTreePalm(true);
    try {
      const settings = await vendorServicePricingService.getTreePalmPricing();
      if (settings) {
        const next = applySettingsToTreePalmForm(settings);
        setTreePalmPricingEnabled(next.enabled);
        setPricePerTree(next.pricePerTree);
        setPricePerPalm(next.pricePerPalm);
        setTreeInclusions(next.inclusions);
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) return;
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        t('vendorProfile.productSettingsTreePalmLoadFailed', {
          defaultValue: 'Failed to load tree/palm pricing settings.',
        });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
    } finally {
      setLoadingTreePalm(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void loadAreaPricing();
      void loadTreePalmPricing();
    }, [loadAreaPricing, loadTreePalmPricing])
  );

  const handleSaveAreaPricing = async () => {
    if (areaShowOnCustomer && parsedFixedPrice == null && parsedPricePerM2 == null) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('vendorProfile.productSettingsNeedFixedOrM2', {
          defaultValue: 'Enter a fixed price and/or a price per m² (at least one).',
        })
      );
      return;
    }
    setSavingAreaPricing(true);
    try {
      const saveBody = buildVendorServicePricingSaveBody({
        show_on_client_products_services: areaShowOnCustomer,
        activeEditorTab: areaPricingType,
        fixedPrice: parsedFixedPrice,
        pricePerM2: parsedPricePerM2,
        price_includes: areaInclusions,
      });
      const res = await vendorServicePricingService.updateServicePricing(saveBody);
      if (res?.success === false) {
        throw new Error(
          res.message ||
            t('admin.settings.productSettings.areaBasedPricing.saveFailed', {
              defaultValue: 'Failed to save service pricing settings.',
            })
        );
      }
      const refreshed = await vendorServicePricingService.getServicePricing();
      if (refreshed) {
        const next = applySettingsToAreaForm(refreshed);
        setAreaShowOnCustomer(next.showOnCustomer);
        setAreaPricingType(next.areaPricingType);
        setFixedPrice(
          parsedFixedPrice != null
            ? unitPriceInputValue(parsedFixedPrice)
            : next.fixedPrice
        );
        setPricePerM2(
          parsedPricePerM2 != null
            ? unitPriceInputValue(parsedPricePerM2)
            : next.pricePerM2
        );
        setAreaInclusions(next.inclusions);
      } else if (parsedFixedPrice != null || parsedPricePerM2 != null) {
        if (parsedFixedPrice != null) {
          setFixedPrice(unitPriceInputValue(parsedFixedPrice));
        }
        if (parsedPricePerM2 != null) {
          setPricePerM2(unitPriceInputValue(parsedPricePerM2));
        }
      }
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        res.message ||
          t('admin.settings.productSettings.areaBasedPricing.saved', {
            defaultValue: 'Service pricing settings saved.',
          })
      );
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        t('admin.settings.productSettings.areaBasedPricing.saveFailed', {
          defaultValue: 'Failed to save service pricing settings.',
        });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
    } finally {
      setSavingAreaPricing(false);
    }
  };

  const handleSaveTreePalmPricing = async () => {
    const treePrice = pricePerTree.trim() === '' ? null : parsedPricePerTree;
    const palmPrice = pricePerPalm.trim() === '' ? null : parsedPricePerPalm;

    if (treePalmPricingEnabled && treePrice == null && palmPrice == null) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('admin.settings.productSettings.treePalmPricing.needOnePrice', {
          defaultValue:
            'When customer display is enabled, enter at least one price (tree or palm).',
        })
      );
      return;
    }
    if (treePrice != null && treePrice < 0) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('admin.settings.productSettings.treePricing.invalidPrice', {
          defaultValue: 'Enter a valid price per tree (≥ 0).',
        })
      );
      return;
    }
    if (palmPrice != null && palmPrice < 0) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('admin.settings.productSettings.palmPricing.invalidPrice', {
          defaultValue: 'Enter a valid price per palm (≥ 0).',
        })
      );
      return;
    }

    setSavingTreePalm(true);
    try {
      const res = await vendorServicePricingService.updateTreePalmPricing({
        show_on_client_products_services: treePalmPricingEnabled,
        price_per_tree: treePrice ?? 0,
        price_per_palm_tree: palmPrice ?? 0,
        price_includes: treeInclusions,
      });
      if (res?.success === false) {
        throw new Error(
          res.message ||
            t('admin.settings.productSettings.areaBasedPricing.saveFailed', {
              defaultValue: 'Failed to save tree/palm pricing settings.',
            })
        );
      }
      const refreshed = await vendorServicePricingService.getTreePalmPricing();
      if (refreshed) {
        const next = applySettingsToTreePalmForm(refreshed);
        setTreePalmPricingEnabled(next.enabled);
        setPricePerTree(next.pricePerTree);
        setPricePerPalm(next.pricePerPalm);
        setTreeInclusions(next.inclusions);
      }
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        res.message ||
          t('admin.settings.productSettings.areaBasedPricing.saved', {
            defaultValue: 'Tree and palm pricing saved.',
          })
      );
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        t('admin.settings.productSettings.areaBasedPricing.saveFailed', {
          defaultValue: 'Failed to save tree/palm pricing settings.',
        });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
    } finally {
      setSavingTreePalm(false);
    }
  };

  const toggleInclusion = (
    key: PriceInclusionKey,
    setter: React.Dispatch<React.SetStateAction<ServicePriceIncludes>>
  ) => {
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderInclusions = (
    inclusions: ServicePriceIncludes,
    onToggle: (key: PriceInclusionKey) => void,
    disabled?: boolean
  ) => (
    <View style={[styles.pricingBlock, disabled && styles.sectionDisabled]}>
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
            onPress={() => onToggle(item.key)}
            activeOpacity={0.7}
            disabled={disabled}
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

  const renderClientVisibilityToggle = (
    enabled: boolean,
    onChange: (v: boolean) => void,
    icon: keyof typeof Ionicons.glyphMap,
    disabled?: boolean
  ) => (
    <View style={[styles.settingItem, disabled && styles.sectionDisabled]}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={24} color={COLORS.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>
          {t('vendorProfile.productSettingsShowOnClientTitle', {
            defaultValue: 'Show on client products & services',
          })}
        </Text>
        <Text style={styles.settingSubtitle}>
          {t('vendorProfile.productSettingsShowOnClientSubtitle', {
            defaultValue:
              'When off, customers do not see this pricing on the shop app. You can still save prices for later.',
          })}
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onChange}
        trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
        thumbColor={enabled ? COLORS.primary : COLORS.background}
        disabled={disabled}
      />
    </View>
  );

  const renderSaveButton = (onPress: () => void, busy?: boolean, saving?: boolean) => (
    <TouchableOpacity
      style={[styles.saveButton, busy && styles.saveButtonDisabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={busy}
    >
      {saving ? (
        <ActivityIndicator size="small" color={COLORS.background} />
      ) : (
        <Text style={styles.saveButtonText}>
          {t('admin.settings.productSettings.save', { defaultValue: 'Save' })}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header
        title={t('vendorProfile.productSettings', { defaultValue: 'Product Settings' })}
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
            {t('admin.settings.productSettings.areaBasedPricing.section')}
          </Text>
          <Text style={styles.sectionHint}>
            {t('admin.settings.productSettings.areaBasedPricing.hint', {
              defaultValue:
                'Applies to all services. Choose Fixed Price or Price per m² (e.g. Interlock & Outdoor Paving).',
            })}
          </Text>
          <View style={styles.sectionContent}>
            {loadingAreaPricing ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>
                  {t('admin.settings.loading', { defaultValue: 'Loading…' })}
                </Text>
              </View>
            ) : null}

            {renderClientVisibilityToggle(
              areaShowOnCustomer,
              setAreaShowOnCustomer,
              'eye-outline',
              areaSectionBusy
            )}

            <View style={styles.divider} />

            <View style={[styles.pricingBlock, areaSectionBusy && styles.sectionDisabled]}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.areaBasedPricing.pricingType')}
              </Text>
              <Text style={styles.fieldHint}>
                {t('vendorProfile.productSettingsTabBothSavedHint', {
                  defaultValue:
                    'Use each tab to set that price. Switch tabs anytime — both values are saved together.',
                })}
              </Text>
              <View style={styles.pricingTypeRow}>
                {(
                  [
                    ['fixed', 'pricetag-outline', 'admin.settings.productSettings.areaBasedPricing.fixedPrice'] as const,
                    ['per_m2', 'resize-outline', 'admin.settings.productSettings.areaBasedPricing.pricePerM2'] as const,
                  ] as const
                ).map(([type, icon, labelKey]) => {
                  const tabHasValue =
                    type === 'fixed' ? parsedFixedPrice != null : parsedPricePerM2 != null;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pricingTypeOption,
                        areaPricingType === type && styles.pricingTypeOptionActive,
                      ]}
                      onPress={() => setAreaPricingType(type)}
                      activeOpacity={0.8}
                      disabled={areaSectionBusy}
                    >
                      <Ionicons
                        name={icon}
                        size={18}
                        color={
                          areaPricingType === type ? COLORS.primary : COLORS.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.pricingTypeText,
                          areaPricingType === type && styles.pricingTypeTextActive,
                        ]}
                      >
                        {t(labelKey)}
                      </Text>
                      {tabHasValue ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={COLORS.success}
                          style={styles.pricingTypeTabCheck}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {areaPricingType === 'fixed' ? (
              <>
                <View style={styles.divider} />
                <View style={[styles.pricingBlock, areaSectionBusy && styles.sectionDisabled]}>
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
                      onChangeText={(text) => onDecimalPriceChange(text, setFixedPrice)}
                      keyboardType="decimal-pad"
                      placeholder="800"
                      placeholderTextColor={COLORS.textSecondary}
                      editable={!areaSectionBusy}
                    />
                    <Text style={styles.priceSuffix}>
                      {t('admin.settings.productSettings.areaBasedPricing.aed')}
                    </Text>
                  </View>
                  {parsedPricePerM2 != null ? (
                    <Text style={styles.fieldHint}>
                      {t('vendorProfile.productSettingsOtherTabSetM2', {
                        defaultValue: 'Price per m² is also set (AED {{rate}}/m²). Open the m² tab to edit.',
                        rate: parsedPricePerM2.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        }),
                      })}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.divider} />
                {renderInclusions(
                  areaInclusions,
                  (key) => toggleInclusion(key, setAreaInclusions),
                  areaSectionBusy
                )}
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
                <View style={[styles.pricingBlock, areaSectionBusy && styles.sectionDisabled]}>
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
                      onChangeText={(text) => onDecimalPriceChange(text, setPricePerM2)}
                      keyboardType="decimal-pad"
                      placeholder="70"
                      placeholderTextColor={COLORS.textSecondary}
                      editable={!areaSectionBusy}
                    />
                    <Text style={styles.priceSuffix}>
                      {t('admin.settings.productSettings.areaBasedPricing.aedPerM2')}
                    </Text>
                  </View>
                  {parsedFixedPrice != null ? (
                    <Text style={styles.fieldHint}>
                      {t('vendorProfile.productSettingsOtherTabSetFixed', {
                        defaultValue:
                          'Fixed price is also set (AED {{price}}). Open the Fixed tab to edit.',
                        price: parsedFixedPrice.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        }),
                      })}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.divider} />
                {renderInclusions(
                  areaInclusions,
                  (key) => toggleInclusion(key, setAreaInclusions),
                  areaSectionBusy
                )}
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
                        exampleAreaTotal != null
                          ? exampleAreaTotal.toLocaleString(undefined, {
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
              {renderSaveButton(
                () => void handleSaveAreaPricing(),
                areaSectionBusy,
                savingAreaPricing
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('admin.settings.productSettings.treePalmPricing.section', {
              defaultValue: 'Price per Tree & Palm',
            })}
          </Text>
          <Text style={styles.sectionHint}>
            {t('admin.settings.productSettings.treePalmPricing.hint', {
              defaultValue:
                'Set unit prices for trees and/or palm trees. Leave a field empty to hide that counter on the customer app.',
            })}
          </Text>
          <View style={styles.sectionContent}>
            {loadingTreePalm ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>
                  {t('admin.settings.loading', { defaultValue: 'Loading…' })}
                </Text>
              </View>
            ) : null}

            {renderClientVisibilityToggle(
              treePalmPricingEnabled,
              setTreePalmPricingEnabled,
              'leaf-outline',
              treePalmSectionBusy
            )}

            <View style={styles.divider} />
            <View style={[styles.pricingBlock, treePalmSectionBusy && styles.sectionDisabled]}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.areaBasedPricing.pricePerTreeLabel', {
                  defaultValue: 'Price per tree',
                })}
              </Text>
              <Text style={styles.fieldHint}>
                {t('admin.settings.productSettings.areaBasedPricing.pricePerTreeHint', {
                  defaultValue:
                    'Unit price for each tree. Customers choose quantity (number of trees) on the service product.',
                })}
              </Text>
              <View style={styles.priceInputRow}>
                <TextInput
                  style={styles.priceInput}
                  value={pricePerTree}
                  onChangeText={(text) => onDecimalPriceChange(text, setPricePerTree)}
                  keyboardType="decimal-pad"
                  placeholder="50"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={!treePalmSectionBusy}
                />
                <Text style={styles.priceSuffix}>
                  {t('admin.settings.productSettings.areaBasedPricing.aedPerTree', {
                    defaultValue: 'AED / tree',
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />
            <View style={[styles.pricingBlock, treePalmSectionBusy && styles.sectionDisabled]}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.areaBasedPricing.pricePerPalmLabel', {
                  defaultValue: 'Price per palm tree',
                })}
              </Text>
              <Text style={styles.fieldHint}>
                {t('admin.settings.productSettings.areaBasedPricing.pricePerPalmHint', {
                  defaultValue:
                    'Unit price for each palm. Customers choose quantity (number of palms) on the service product.',
                })}
              </Text>
              <View style={styles.priceInputRow}>
                <TextInput
                  style={styles.priceInput}
                  value={pricePerPalm}
                  onChangeText={(text) => onDecimalPriceChange(text, setPricePerPalm)}
                  keyboardType="decimal-pad"
                  placeholder="50"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={!treePalmSectionBusy}
                />
                <Text style={styles.priceSuffix}>
                  {t('admin.settings.productSettings.areaBasedPricing.aedPerPalm', {
                    defaultValue: 'AED / palm',
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />
            {renderInclusions(
              treeInclusions,
              (key) => toggleInclusion(key, setTreeInclusions),
              treePalmSectionBusy
            )}
            <View style={styles.divider} />
            <View style={[styles.pricingBlock, styles.exampleBlock]}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.areaBasedPricing.exampleTitle')}
              </Text>
              {parsedPricePerTree != null ? (
                <Text style={styles.exampleLine}>
                  {t('admin.settings.productSettings.areaBasedPricing.exampleTreeUnit', {
                    defaultValue: 'Price per tree: AED {{price}}',
                    price: parsedPricePerTree.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    }),
                  })}
                </Text>
              ) : null}
              {parsedPricePerPalm != null ? (
                <Text style={styles.exampleLine}>
                  {t('admin.settings.productSettings.areaBasedPricing.examplePalmUnit', {
                    defaultValue: 'Price per palm: AED {{price}}',
                    price: parsedPricePerPalm.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    }),
                  })}
                </Text>
              ) : null}
              <Text style={styles.exampleNote}>
                {t('admin.settings.productSettings.treePalmPricing.customerNote', {
                  defaultValue:
                    'Customer app shows only counters that have a price. Section hidden if toggle is off or both prices are empty.',
                })}
              </Text>
            </View>

            <View style={styles.divider} />
            <View style={styles.pricingBlock}>
              {renderSaveButton(
                () => void handleSaveTreePalmPricing(),
                treePalmSectionBusy,
                savingTreePalm
              )}
            </View>
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
    marginRight: SPACING.sm,
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
  activePricingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '18',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  activePricingBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
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
  pricingTypeTabCheck: {
    marginLeft: 2,
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
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  saveButtonDisabled: {
    opacity: 0.7,
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

export default VendorProductSettingsScreen;
