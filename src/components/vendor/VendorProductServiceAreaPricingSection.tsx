import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import type { ServicePriceIncludes } from '../../services/servicePricingService';
import {
  buildVendorProductAreaPricingSaveBody,
  parseVendorProductAreaPricing,
  vendorProductAreaPricingService,
} from '../../services/vendorProductAreaPricingService';
import { DEFAULT_VENDOR_PRODUCT_AREA_INCLUDES } from '../../types/vendorProductAreaPricing';

type PriceInclusionKey = keyof ServicePriceIncludes;

const PRICE_INCLUSIONS: { key: PriceInclusionKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'materials', icon: 'cube-outline' },
  { key: 'installation', icon: 'construct-outline' },
  { key: 'labor', icon: 'people-outline' },
  { key: 'transportation', icon: 'car-outline' },
  { key: 'delivery', icon: 'bicycle-outline' },
];

const EXAMPLE_AREA_M2 = 100;

function onDecimalPriceChange(text: string, setter: (v: string) => void) {
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  setter(cleaned);
}

function parseDecimalInput(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type VendorProductServiceAreaPricingSectionProps = {
  portal: 'admin' | 'vendor';
  vendorId?: string;
  vendorProductId: string | null;
  /** When false, show “save listing first” hint (add flow). */
  canEdit?: boolean;
  currency?: string;
};

const VendorProductServiceAreaPricingSection: React.FC<
  VendorProductServiceAreaPricingSectionProps
> = ({ portal, vendorId, vendorProductId, canEdit = true, currency = 'AED' }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const [showOnClient, setShowOnClient] = useState(true);
  const [enablePerM2, setEnablePerM2] = useState(true);
  const [pricePerM2, setPricePerM2] = useState('');
  const [enableFixed, setEnableFixed] = useState(false);
  const [fixedPrice, setFixedPrice] = useState('');
  const [requiresArea, setRequiresArea] = useState(false);
  const [inclusions, setInclusions] = useState<ServicePriceIncludes>({
    ...DEFAULT_VENDOR_PRODUCT_AREA_INCLUDES,
  });

  const busy = loading || saving;
  const hasProductId = Boolean(vendorProductId?.trim());

  const applyParsed = useCallback((parsed: ReturnType<typeof parseVendorProductAreaPricing>) => {
    if (!parsed) {
      setShowOnClient(true);
      setEnablePerM2(true);
      setPricePerM2('');
      setEnableFixed(false);
      setFixedPrice('');
      setRequiresArea(false);
      setInclusions({ ...DEFAULT_VENDOR_PRODUCT_AREA_INCLUDES });
      return;
    }
    setShowOnClient(parsed.show_on_client);
    setEnablePerM2(parsed.enable_per_m2);
    setPricePerM2(parsed.price_per_m2 != null ? String(parsed.price_per_m2) : '');
    setEnableFixed(parsed.enable_fixed_price);
    setFixedPrice(parsed.fixed_price != null ? String(parsed.fixed_price) : '');
    setRequiresArea(parsed.requires_area);
    setInclusions(parsed.price_includes);
  }, []);

  const load = useCallback(async () => {
    if (!hasProductId || !canEdit) return;
    if (portal === 'admin' && !vendorId?.trim()) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const parsed =
        portal === 'admin'
          ? await vendorProductAreaPricingService.getForAdmin(vendorId!, vendorProductId!)
          : await vendorProductAreaPricingService.getForVendor(vendorProductId!);
      applyParsed(parsed);
    } catch {
      setLoadFailed(true);
      applyParsed(null);
    } finally {
      setLoading(false);
    }
  }, [applyParsed, canEdit, hasProductId, portal, vendorId, vendorProductId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const previewPerM2Total = useMemo(() => {
    const rate = parseDecimalInput(pricePerM2);
    if (rate == null || !enablePerM2) return null;
    return Math.round(rate * EXAMPLE_AREA_M2 * 100) / 100;
  }, [enablePerM2, pricePerM2]);

  const handleSave = async () => {
    if (!hasProductId || !canEdit) return;
    if (portal === 'admin' && !vendorId?.trim()) return;

    if (enablePerM2 && parseDecimalInput(pricePerM2) == null) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('vendorProductAreaPricing.errorPerM2Required', {
          defaultValue: 'Enter price per m² for this service, or turn off “Price per m²”.',
        })
      );
      return;
    }
    if (enableFixed && parseDecimalInput(fixedPrice) == null) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('vendorProductAreaPricing.errorFixedRequired', {
          defaultValue: 'Enter fixed checkout price, or turn off “Fixed price”.',
        })
      );
      return;
    }
    if (!enablePerM2 && !enableFixed) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('vendorProductAreaPricing.errorModeRequired', {
          defaultValue: 'Enable at least one of fixed price or price per m².',
        })
      );
      return;
    }

    const body = buildVendorProductAreaPricingSaveBody({
      showOnClient,
      enablePerM2,
      pricePerM2: parseDecimalInput(pricePerM2),
      enableFixed,
      fixedPrice: parseDecimalInput(fixedPrice),
      requiresArea: enablePerM2 && requiresArea,
      priceIncludes: inclusions,
    });

    setSaving(true);
    try {
      const res =
        portal === 'admin'
          ? await vendorProductAreaPricingService.saveForAdmin(vendorId!, vendorProductId!, body)
          : await vendorProductAreaPricingService.saveForVendor(vendorProductId!, body);
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        res.message ||
          t('vendorProductAreaPricing.saved', {
            defaultValue: 'Area pricing saved for this service listing.',
          })
      );
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        ax.response?.data?.message ||
          ax.message ||
          t('vendorProductAreaPricing.saveFailed', {
            defaultValue: 'Failed to save area pricing. Backend route may not be ready yet.',
          })
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit || !hasProductId) {
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Ionicons name="resize-outline" size={20} color={COLORS.primary} />
          <Text style={styles.title}>
            {t('vendorProductAreaPricing.sectionTitle', {
              defaultValue: 'Area pricing for this service',
            })}
          </Text>
        </View>
        <Text style={styles.hint}>
          {t('vendorProductAreaPricing.saveListingFirst', {
            defaultValue:
              'Save this service listing first. Then set its own price per m² (and optional fixed price) for the customer product detail page.',
          })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="resize-outline" size={20} color={COLORS.primary} />
        <Text style={styles.title}>
          {t('vendorProductAreaPricing.sectionTitle', {
            defaultValue: 'Area pricing for this service',
          })}
        </Text>
      </View>
      <Text style={styles.hint}>
        {t('vendorProductAreaPricing.sectionHint', {
          defaultValue:
            'Set this service’s m² rate (and optional fixed price). Shown on the customer product detail when “Show on client” is on.',
        })}
      </Text>

      {loadFailed ? (
        <TouchableOpacity style={styles.retryRow} onPress={() => void load()} disabled={busy}>
          <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
          <Text style={styles.retryText}>
            {t('vendorProductAreaPricing.loadFailed', {
              defaultValue: 'Could not load saved pricing. Tap to retry (API may be pending).',
            })}
          </Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
      ) : (
        <>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>
                {t('vendorProfile.productSettingsShowOnClientTitle', {
                  defaultValue: 'Show on client product detail',
                })}
              </Text>
            </View>
            <Switch
              value={showOnClient}
              onValueChange={setShowOnClient}
              disabled={busy}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
              thumbColor={showOnClient ? COLORS.primary : COLORS.background}
            />
          </View>

          <View style={busy ? styles.blockDisabled : undefined}>
            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.areaBasedPricing.pricePerM2', {
                  defaultValue: 'Price per m²',
                })}
              </Text>
              <Switch
                value={enablePerM2}
                onValueChange={setEnablePerM2}
                disabled={busy}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={enablePerM2 ? COLORS.primary : COLORS.background}
              />
            </View>
            {enablePerM2 ? (
              <>
                <View style={styles.priceInputRow}>
                  <TextInput
                    style={styles.priceInput}
                    value={pricePerM2}
                    onChangeText={(text) => onDecimalPriceChange(text, setPricePerM2)}
                    keyboardType="decimal-pad"
                    placeholder="20"
                    placeholderTextColor={COLORS.textSecondary}
                    editable={!busy}
                  />
                  <Text style={styles.priceSuffix}>
                    {currency}{' '}
                    {t('vendorProductAreaPricing.aedPerM2Suffix', { defaultValue: '/ m²' })}
                  </Text>
                </View>
                {previewPerM2Total != null ? (
                  <Text style={styles.previewText}>
                    {t('vendorProductAreaPricing.previewPerM2', {
                      defaultValue: 'Example: {{area}} m² × {{currency}} {{rate}} = {{currency}} {{total}}',
                      area: EXAMPLE_AREA_M2,
                      currency,
                      rate: parseDecimalInput(pricePerM2)?.toFixed(2),
                      total: previewPerM2Total.toFixed(2),
                    })}
                  </Text>
                ) : null}
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      {t('vendorProductAreaPricing.requiresAreaTitle', {
                        defaultValue: 'Require area (m²) before checkout',
                      })}
                    </Text>
                  </View>
                  <Switch
                    value={requiresArea}
                    onValueChange={setRequiresArea}
                    disabled={busy}
                    trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                    thumbColor={requiresArea ? COLORS.primary : COLORS.background}
                  />
                </View>
              </>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.areaBasedPricing.fixedPrice', {
                  defaultValue: 'Fixed price',
                })}
              </Text>
              <Switch
                value={enableFixed}
                onValueChange={setEnableFixed}
                disabled={busy}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={enableFixed ? COLORS.primary : COLORS.background}
              />
            </View>
            {enableFixed ? (
              <View style={styles.priceInputRow}>
                <TextInput
                  style={styles.priceInput}
                  value={fixedPrice}
                  onChangeText={(text) => onDecimalPriceChange(text, setFixedPrice)}
                  keyboardType="decimal-pad"
                  placeholder="600"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={!busy}
                />
                <Text style={styles.priceSuffix}>{currency}</Text>
              </View>
            ) : null}

            <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>
              {t('product.priceIncludes', { defaultValue: 'Price includes' })}
            </Text>
            <View style={styles.chipsRow}>
              {PRICE_INCLUSIONS.map(({ key, icon }) => {
                const on = inclusions[key];
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() =>
                      setInclusions((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    disabled={busy}
                  >
                    <Ionicons
                      name={icon}
                      size={14}
                      color={on ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {t(`product.includes.${key}`, { defaultValue: key })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, busy && styles.saveBtnDisabled]}
            onPress={() => void handleSave()}
            disabled={busy}
            activeOpacity={0.88}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {t('vendorProductAreaPricing.saveButton', {
                    defaultValue: 'Save area pricing for this service',
                  })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    flex: 1,
  },
  hint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  fieldHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  priceInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.sm,
  },
  priceSuffix: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
  },
  previewText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  blockDisabled: {
    opacity: 0.55,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipOn: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
  },
  chipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  chipTextOn: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  retryText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    flex: 1,
  },
});

export default VendorProductServiceAreaPricingSection;
