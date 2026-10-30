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
import { adminService } from '../../services/adminService';
import { safeGoBack } from '../../utils/safeNavigationBack';

const EXAMPLE_CART_SUBTOTAL = 200;

function parseFeeAmount(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const AdminProductSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [instantOrderFeeEnabled, setInstantOrderFeeEnabled] = useState(false);
  const [instantOrderExtraFee, setInstantOrderExtraFee] = useState('0');
  const [loadingInstantFee, setLoadingInstantFee] = useState(true);
  const [savingInstantFee, setSavingInstantFee] = useState(false);

  const parseAmount = (value: string) => {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const parsedInstantFee = useMemo(
    () => parseAmount(instantOrderExtraFee),
    [instantOrderExtraFee]
  );

  const instantFeePreviewAmount =
    instantOrderFeeEnabled && parsedInstantFee != null ? parsedInstantFee : 0;
  const instantFeePreviewTotal = EXAMPLE_CART_SUBTOTAL + instantFeePreviewAmount;

  const applyInstantFeeFromApi = useCallback((amountRaw: unknown) => {
    const amount = parseFeeAmount(amountRaw) ?? 0;
    setInstantOrderExtraFee(String(amount));
    setInstantOrderFeeEnabled(amount > 0);
  }, []);

  const loadInstantOrderFee = useCallback(async () => {
    setLoadingInstantFee(true);
    try {
      const res = await adminService.getInstantOrderFee();
      if (res?.success === false) {
        throw new Error(res.message || 'Failed to load instant order fee.');
      }
      const data =
        (res as { data?: Record<string, unknown> })?.data ?? (res as Record<string, unknown>);
      applyInstantFeeFromApi(
        data?.instant_order_fee_amount ?? data?.amount ?? (data as { fee?: unknown })?.fee
      );
    } catch {
      // Keep local values if GET fails; PUT may still work.
    } finally {
      setLoadingInstantFee(false);
    }
  }, [applyInstantFeeFromApi]);

  useFocusEffect(
    useCallback(() => {
      loadInstantOrderFee();
    }, [loadInstantOrderFee])
  );

  const onDecimalAmountChange = (text: string, setter: (v: string) => void) => {
    setter(text.replace(/[^0-9.,]/g, ''));
  };

  const handleSaveInstantOrderFee = async () => {
    const amountToSave = instantOrderFeeEnabled ? parsedInstantFee : 0;
    if (amountToSave == null) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('admin.settings.productSettings.instantOrderFee.invalid')
      );
      return;
    }

    setSavingInstantFee(true);
    try {
      const res = await adminService.updateInstantOrderFee({
        instant_order_fee_amount: amountToSave,
      });
      if (res?.success === false) {
        throw new Error(res.message || t('admin.settings.productSettings.instantOrderFee.saveFailed'));
      }
      const saved =
        res?.data?.instant_order_fee_amount != null
          ? res.data.instant_order_fee_amount
          : amountToSave;
      applyInstantFeeFromApi(saved);
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        res.message || t('admin.settings.productSettings.instantOrderFee.saved')
      );
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } }; message?: string })?.response
          ?.data?.message ||
        (error instanceof Error ? error.message : null) ||
        t('admin.settings.productSettings.instantOrderFee.saveFailed');
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
    } finally {
      setSavingInstantFee(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.settings.productSettings.title')}
        showBack
        showLanguage={false}
        onBackPress={() => safeGoBack(navigation)}
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="options-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>
              {t('admin.settings.productSettings.storefrontDefaults.title')}
            </Text>
            <Text style={styles.heroSubtitle}>
              {t('admin.settings.productSettings.storefrontDefaults.subtitle')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>
            {t('admin.settings.productSettings.displaySection')}
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

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>
            {t('admin.settings.productSettings.vendorPricing.section')}
          </Text>
          <Text style={styles.sectionHint}>
            {t('admin.settings.productSettings.vendorPricing.sectionHint')}
          </Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={[styles.settingItem, styles.settingItemLast]}
              onPress={() => navigation.navigate('AdminVendorPricingList')}
              activeOpacity={0.7}
            >
              <View style={styles.settingIcon}>
                <Ionicons name="home-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.vendorPricing.rowTitle')}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('admin.settings.productSettings.vendorPricing.rowSubtitle')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>
            {t('admin.settings.productSettings.instantOrderFee.section')}
          </Text>
          <Text style={styles.sectionHint}>
            {t('admin.settings.productSettings.instantOrderFee.hint')}
          </Text>
          <View style={styles.sectionContent}>
            {loadingInstantFee ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>{t('admin.settings.loading')}</Text>
              </View>
            ) : null}

            <View style={[styles.settingItem, loadingInstantFee && styles.sectionDisabled]}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.instantOrderFee.enableTitle')}
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
                {t('admin.settings.productSettings.instantOrderFee.feeLabel')}
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
                  placeholder="10"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={instantOrderFeeEnabled && !loadingInstantFee && !savingInstantFee}
                />
                <Text style={styles.priceSuffix}>
                  {t('admin.settings.productSettings.areaBasedPricing.aed')}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={[styles.pricingBlock, styles.exampleBlock]}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.productSettings.instantOrderFee.previewTitle')}
              </Text>
              <View style={styles.previewRow}>
                <Text style={styles.exampleLine}>
                  {t('admin.settings.productSettings.instantOrderFee.previewSubtotal')}
                </Text>
                <Text style={styles.exampleLine}>AED {EXAMPLE_CART_SUBTOTAL.toFixed(2)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.exampleLine}>
                  {t('admin.settings.productSettings.instantOrderFee.previewFeeLabel')}
                </Text>
                <Text style={styles.exampleLine}>
                  {instantFeePreviewAmount > 0
                    ? `AED ${instantFeePreviewAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : t('admin.settings.productSettings.instantOrderFee.previewFeeOff')}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.exampleTotal}>
                  {t('admin.settings.productSettings.instantOrderFee.previewTotal')}
                </Text>
                <Text style={styles.exampleTotal}>
                  AED{' '}
                  {instantFeePreviewTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
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
                    <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.background} />
                    <Text style={styles.saveButtonText}>
                      {t('admin.settings.productSettings.instantOrderFee.saveButton')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>
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
    paddingTop: SPACING.sm,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary + '22',
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionEyebrow: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
    marginBottom: SPACING.sm,
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
