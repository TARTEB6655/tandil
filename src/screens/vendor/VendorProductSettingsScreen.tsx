import React, { useCallback, useState } from 'react';
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
import { vendorServicePricingService } from '../../services/vendorServicePricingService';

type PriceInclusionKey = keyof ServicePriceIncludes;

const PRICE_INCLUSIONS: { key: PriceInclusionKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'materials', icon: 'cube-outline' },
  { key: 'installation', icon: 'construct-outline' },
  { key: 'labor', icon: 'people-outline' },
  { key: 'transportation', icon: 'car-outline' },
  { key: 'delivery', icon: 'bicycle-outline' },
];

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

  const [loadingTreePalm, setLoadingTreePalm] = useState(true);
  const [savingTreePalm, setSavingTreePalm] = useState(false);

  const [treePalmPricingEnabled, setTreePalmPricingEnabled] = useState(false);
  const [pricePerTree, setPricePerTree] = useState('');
  const [pricePerPalm, setPricePerPalm] = useState('');
  const [treeInclusions, setTreeInclusions] = useState<ServicePriceIncludes>(DEFAULT_INCLUSIONS);

  const parsedPricePerTree = parseDecimalInput(pricePerTree);
  const parsedPricePerPalm = parseDecimalInput(pricePerPalm);

  const treePalmSectionBusy = loadingTreePalm || savingTreePalm;

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
      void loadTreePalmPricing();
    }, [loadTreePalmPricing])
  );

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
