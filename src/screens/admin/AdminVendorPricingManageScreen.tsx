import React, { useCallback, useRef, useState } from 'react';
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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import Header from '../../components/common/Header';
import type { ServicePriceIncludes } from '../../services/servicePricingService';
import {
  DEFAULT_ADMIN_VENDOR_PRICE_INCLUDES,
  getAdminVendorPricingDraft,
} from '../../services/adminVendorPricingStore';
import {
  adminVendorPricingService,
  buildAdminVendorTreePalmPricingSaveBody,
} from '../../services/adminVendorPricingService';

type RouteParams = {
  vendorId: string;
  businessName?: string;
  contactName?: string;
  logoUrl?: string;
  currency?: string;
};

type PriceInclusionKey = keyof ServicePriceIncludes;

const PRICE_INCLUSIONS: { key: PriceInclusionKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'materials', icon: 'cube-outline' },
  { key: 'installation', icon: 'construct-outline' },
  { key: 'labor', icon: 'people-outline' },
  { key: 'transportation', icon: 'car-outline' },
  { key: 'delivery', icon: 'bicycle-outline' },
];

function onDecimalPriceChange(text: string, setter: (v: string) => void) {
  setter(text.replace(/[^0-9.,]/g, ''));
}

function parseDecimalInput(text: string): number | null {
  const normalized = text.replace(',', '.').trim();
  if (!normalized) return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const AdminVendorPricingManageScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const params = (route.params ?? {}) as RouteParams;
  const vendorId = String(params.vendorId ?? '');
  const [treePalmEnabled, setTreePalmEnabled] = useState(false);
  const [pricePerTree, setPricePerTree] = useState('');
  const [pricePerPalm, setPricePerPalm] = useState('');
  const [treeInclusions, setTreeInclusions] = useState<ServicePriceIncludes>(
    DEFAULT_ADMIN_VENDOR_PRICE_INCLUDES
  );
  const [loading, setLoading] = useState(true);
  const [savingTreePalm, setSavingTreePalm] = useState(false);

  const treePalmSectionBusy = loading || savingTreePalm;
  /** Ignore stale GET responses that finish after a newer load or save. */
  const pricingLoadSeqRef = useRef(0);

  const applyDraftFallback = useCallback(() => {
    const draft = getAdminVendorPricingDraft(vendorId);
    if (!draft) return;
    setTreePalmEnabled(draft.treePalmEnabled);
    setPricePerTree(draft.pricePerTree);
    setPricePerPalm(draft.pricePerPalm);
    setTreeInclusions(draft.treePalmPriceIncludes ?? DEFAULT_ADMIN_VENDOR_PRICE_INCLUDES);
  }, [vendorId]);

  const loadPricing = useCallback(async () => {
    if (!vendorId) return;
    const seq = ++pricingLoadSeqRef.current;
    setLoading(true);
    try {
      const treePart = await adminVendorPricingService.getVendorTreePalmPricing(vendorId);
      if (seq !== pricingLoadSeqRef.current) return;
      setTreePalmEnabled(treePart.treePalmShowOnClient);
      setPricePerTree(treePart.pricePerTree != null ? String(treePart.pricePerTree) : '');
      setPricePerPalm(treePart.pricePerPalm != null ? String(treePart.pricePerPalm) : '');
      setTreeInclusions(treePart.treePalmPriceIncludes);
    } catch {
      if (seq !== pricingLoadSeqRef.current) return;
      applyDraftFallback();
    } finally {
      if (seq === pricingLoadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [vendorId, applyDraftFallback]);

  useFocusEffect(
    useCallback(() => {
      void loadPricing();
      return () => {
        pricingLoadSeqRef.current += 1;
      };
    }, [loadPricing])
  );

  const logoUri = params.logoUrl
    ? params.logoUrl.startsWith('http')
      ? params.logoUrl
      : buildFullImageUrl(params.logoUrl)
    : null;

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
    <View style={disabled ? styles.blockDisabled : undefined}>
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

  const handleSaveTreePalmPricing = async () => {
    const parsedTree = parseDecimalInput(pricePerTree);
    const parsedPalm = parseDecimalInput(pricePerPalm);

    if (treePalmEnabled && parsedTree == null && parsedPalm == null) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('admin.settings.productSettings.treePalmPricing.needOnePrice', {
          defaultValue:
            'When customer display is enabled, enter at least one price (tree or palm).',
        })
      );
      return;
    }

    const savedShowOnClient = treePalmEnabled;
    pricingLoadSeqRef.current += 1;

    setSavingTreePalm(true);
    try {
      const treeRes = await adminVendorPricingService.updateTreePalmPricing(
        vendorId,
        buildAdminVendorTreePalmPricingSaveBody({
          show_on_client_products_services: savedShowOnClient,
          price_per_tree: parsedTree,
          price_per_palm_tree: parsedPalm,
          price_includes: treeInclusions,
        })
      );

      const treePart = await adminVendorPricingService.getVendorTreePalmPricing(vendorId);
      setTreePalmEnabled(savedShowOnClient);
      setPricePerTree(treePart.pricePerTree != null ? String(treePart.pricePerTree) : '');
      setPricePerPalm(treePart.pricePerPalm != null ? String(treePart.pricePerPalm) : '');
      setTreeInclusions(treePart.treePalmPriceIncludes);

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        treeRes.message ||
          t('admin.settings.productSettings.treePalmPricing.saved', {
            defaultValue: 'Tree & palm pricing saved.',
          })
      );
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : null) ||
        t('admin.settings.productSettings.areaBasedPricing.saveFailed', {
          defaultValue: 'Failed to save tree & palm pricing.',
        });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
    } finally {
      setSavingTreePalm(false);
    }
  };

  const renderSaveButton = (
    onPress: () => void,
    busy?: boolean,
    saving?: boolean
  ) => (
    <TouchableOpacity
      style={[styles.saveButton, styles.saveButtonInSection, busy && styles.saveButtonDisabled]}
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
        title={t('admin.settings.productSettings.vendorPricing.manageTitle', {
          defaultValue: 'Manage vendor pricing',
        })}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.vendorBanner}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={styles.logoFallback}>
              <Ionicons name="storefront-outline" size={24} color={COLORS.primary} />
            </View>
          )}
          <View style={styles.vendorMeta}>
            <Text style={styles.businessName}>{params.businessName || '—'}</Text>
            {params.contactName ? (
              <Text style={styles.contactName}>{params.contactName}</Text>
            ) : null}
            <Text style={styles.vendorId}>
              {t('admin.settings.productSettings.vendorPricing.vendorId', {
                defaultValue: 'Vendor ID: {{id}}',
                id: vendorId,
              })}
            </Text>
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
                'Tree and palm unit prices for this vendor. Fixed and m² rates are set per service listing.',
            })}
          </Text>
          <View style={styles.sectionCard}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  {t('vendorProfile.productSettingsShowOnClientTitle', {
                    defaultValue: 'Show on client products & services',
                  })}
                </Text>
                <Text style={styles.fieldHint}>
                  {t('vendorProfile.productSettingsShowOnClientSubtitle', {
                    defaultValue:
                      'When off, customers do not see this pricing on the shop app. You can still save prices for later.',
                  })}
                </Text>
              </View>
              <Switch
                value={treePalmEnabled}
                onValueChange={setTreePalmEnabled}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={treePalmEnabled ? COLORS.primary : COLORS.background}
                disabled={treePalmSectionBusy}
              />
            </View>

            <View style={styles.divider} />

            <View style={treePalmSectionBusy ? styles.blockDisabled : undefined}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.areaBasedPricing.pricePerTreeLabel', {
                  defaultValue: 'Price per tree',
                })}
              </Text>
              <View style={styles.priceInputRow}>
                <TextInput
                  style={styles.priceInput}
                  value={pricePerTree}
                  onChangeText={(text) => onDecimalPriceChange(text, setPricePerTree)}
                  keyboardType="decimal-pad"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={!treePalmSectionBusy}
                />
                <Text style={styles.priceSuffix}>
                  {t('admin.settings.productSettings.areaBasedPricing.aedPerTree', {
                    defaultValue: 'AED / tree',
                  })}
                </Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.areaBasedPricing.pricePerPalmLabel', {
                  defaultValue: 'Price per palm tree',
                })}
              </Text>
              <View style={styles.priceInputRow}>
                <TextInput
                  style={styles.priceInput}
                  value={pricePerPalm}
                  onChangeText={(text) => onDecimalPriceChange(text, setPricePerPalm)}
                  keyboardType="decimal-pad"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={!treePalmSectionBusy}
                />
                <Text style={styles.priceSuffix}>
                  {t('admin.settings.productSettings.areaBasedPricing.aedPerPalm', {
                    defaultValue: 'AED / palm',
                  })}
                </Text>
              </View>

              <View style={styles.divider} />

              {renderInclusions(
                treeInclusions,
                (key) => toggleInclusion(key, setTreeInclusions),
                treePalmSectionBusy
              )}

              <View style={styles.divider} />

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
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    backgroundColor: COLORS.background + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingBottom: SPACING.xxl },
  vendorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logo: { width: 56, height: 56, borderRadius: 14 },
  logoFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorMeta: { flex: 1, minWidth: 0 },
  businessName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  contactName: {
    marginTop: 2,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  vendorId: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  sectionHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionCard: {
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
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
  inputDisabled: { opacity: 0.45 },
  blockDisabled: { opacity: 0.55 },
  priceSuffix: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
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
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    minHeight: 48,
  },
  saveButtonInSection: {
    marginTop: SPACING.xs,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
});

export default AdminVendorPricingManageScreen;
