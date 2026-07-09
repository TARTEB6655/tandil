import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  VendorPageHeader,
  VENDOR_SCREEN_BG,
} from '../../components/vendor/VendorUi';
import {
  vendorProfileService,
  VendorProfileData,
} from '../../services/vendorProfileService';
import { useAppStore } from '../../store';

function vendorTypeLabel(type?: string, label?: string): string {
  if (label?.trim()) return label.trim();
  if (!type?.trim()) return '';
  const labels: Record<string, string> = {
    fruits: 'Fruits',
    vegetables: 'Vegetables',
    poultry: 'Poultry',
    seafood: 'Seafood',
    meat: 'Meat',
    honey: 'Honey',
    nuts: 'Nuts',
    rest: 'Restaurant / Other',
  };
  return labels[type.toLowerCase()] ?? type;
}

function DetailRow({
  icon,
  label,
  value,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | number | null;
  isLast?: boolean;
}) {
  if (value == null || value === '') return null;

  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon} size={17} color={COLORS.primary} />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} selectable>
          {String(value)}
        </Text>
      </View>
    </View>
  );
}

const VendorBusinessInfoScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const user = useAppStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<VendorProfileData | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await vendorProfileService.getProfile();
      if (data) {
        setProfile(data);
      } else {
        setProfile({
          business_name: user?.name || '',
          authorized_person_name: user?.name || '',
          email: user?.email || '',
          phone: user?.phone || '',
        });
        setLoadError(
          t('vendorBusinessInfo.loadPartial', {
            defaultValue: 'Some business details could not be loaded.',
          })
        );
      }
    } catch (err: unknown) {
      setProfile({
        business_name: user?.name || '',
        authorized_person_name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
      });
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('vendorBusinessInfo.loadFailed', { defaultValue: 'Failed to load business information.' });
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [t, user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const rows: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string | null;
  }> = [
    {
      icon: 'business-outline',
      label: t('vendorEditProfile.businessName', { defaultValue: 'Business name' }),
      value: profile?.business_name || null,
    },
    {
      icon: 'leaf-outline',
      label: t('vendorSignup.vendorType', { defaultValue: 'Vendor type' }),
      value: vendorTypeLabel(profile?.vendor_type, profile?.vendor_type_label) || null,
    },
    {
      icon: 'document-text-outline',
      label: t('vendorSignup.tradeLicenseNumber', { defaultValue: 'Trade license number' }),
      value: profile?.trade_license_number || null,
    },
    {
      icon: 'receipt-outline',
      label: t('vendorSignup.vatNumber', { defaultValue: 'VAT number (optional)' }),
      value: profile?.vat_number || null,
    },
    {
      icon: 'time-outline',
      label: t('vendorBusinessInfo.operatingHours', { defaultValue: 'Operating hours' }),
      value: profile?.operating_hours || (profile?.opens_at && profile?.closes_at
        ? `${profile.opens_at} - ${profile.closes_at}`
        : null),
    },
    {
      icon: 'cash-outline',
      label: t('vendorEditProfile.minOrder', { defaultValue: 'Min. order (AED)' }),
      value:
        profile?.minimum_order_amount != null ? String(profile.minimum_order_amount) : null,
    },
    {
      icon: 'calendar-outline',
      label: t('vendorBusinessInfo.yearsInBusiness', { defaultValue: 'Years in business' }),
      value: profile?.years_in_business || null,
    },
  ];

  const visibleRows = rows.filter((row) => row.value != null && row.value !== '');

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <VendorPageHeader
          title={t('vendorBusinessInfo.title', { defaultValue: 'Business Information' })}
          subtitle={t('vendorBusinessInfo.subtitle', {
            defaultValue: 'Registration business details',
          })}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <VendorPageHeader
        title={t('vendorBusinessInfo.title', { defaultValue: 'Business Information' })}
        subtitle={t('vendorBusinessInfo.subtitle', {
          defaultValue: 'Registration business details',
        })}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loadError ? (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.warning} />
            <Text style={styles.infoBannerText}>{loadError}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="leaf-outline" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionHeading}>
              {t('vendorBusinessInfo.sectionTitle', { defaultValue: 'Business details' })}
            </Text>
          </View>

          <View style={styles.sectionBody}>
            {visibleRows.length > 0 ? (
              visibleRows.map((row, index) => (
                <DetailRow
                  key={`${row.label}-${index}`}
                  icon={row.icon}
                  label={row.label}
                  value={row.value}
                  isLast={index === visibleRows.length - 1}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="business-outline" size={28} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>
                  {t('vendorBusinessInfo.empty', {
                    defaultValue: 'No business details available yet.',
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.hint}>
          {t('vendorBusinessInfo.readOnlyHint', {
            defaultValue:
              'These details were submitted during registration. Contact support to request changes.',
          })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VENDOR_SCREEN_BG },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xl },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.warning + '14',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
  },
  infoBannerText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  sectionBody: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBody: { flex: 1, minWidth: 0 },
  detailLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  hint: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default VendorBusinessInfoScreen;
