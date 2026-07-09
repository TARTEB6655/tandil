import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
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

function DetailRow({
  icon,
  label,
  value,
  onPress,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | number | null;
  onPress?: () => void;
  isLast?: boolean;
}) {
  if (value == null || value === '') return null;

  const row = (
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
      {onPress ? (
        <View style={styles.openLink}>
          <Ionicons name="open-outline" size={16} color={COLORS.primary} />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {row}
      </TouchableOpacity>
    );
  }
  return row;
}

function formatMapLocation(profile: VendorProfileData | null): string {
  if (!profile) return '';
  if (profile.google_maps_location?.trim()) return profile.google_maps_location.trim();
  if (profile.latitude != null && profile.longitude != null) {
    return `${profile.latitude},${profile.longitude}`;
  }
  return '';
}

const VendorLocationAddressScreen: React.FC = () => {
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
          t('vendorLocationAddress.loadPartial', {
            defaultValue: 'Some location details could not be loaded.',
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
        t('vendorLocationAddress.loadFailed', {
          defaultValue: 'Failed to load location & address.',
        });
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

  const openMap = async (location?: string) => {
    const target = location?.trim();
    if (!target) return;
    const url = /^https?:\/\//i.test(target)
      ? target
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('vendorLocationAddress.mapOpenFailed', {
            defaultValue: 'Could not open map location.',
          })
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('vendorLocationAddress.mapOpenFailed', {
          defaultValue: 'Could not open map location.',
        })
      );
    }
  };

  const mapLocation = formatMapLocation(profile);

  const rows: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string | null;
    onPress?: () => void;
  }> = [
    {
      icon: 'map-outline',
      label: t('vendorSignup.emirate', { defaultValue: 'Emirate' }),
      value: profile?.emirate || null,
    },
    {
      icon: 'business-outline',
      label: t('vendorSignup.city', { defaultValue: 'City' }),
      value: profile?.city || null,
    },
    {
      icon: 'location-outline',
      label: t('vendorSignup.address', { defaultValue: 'Address' }),
      value: profile?.address || null,
    },
    {
      icon: 'globe-outline',
      label: t('vendorLocationAddress.locationDisplay', { defaultValue: 'Location display' }),
      value: profile?.location_display || null,
    },
    {
      icon: 'navigate-outline',
      label: t('vendorSignup.mapLocation', { defaultValue: 'Map location' }),
      value: mapLocation || null,
      onPress: mapLocation ? () => openMap(mapLocation) : undefined,
    },
    {
      icon: 'radio-outline',
      label: t('vendorEditProfile.deliveryRadius', { defaultValue: 'Delivery radius (km)' }),
      value:
        profile?.delivery_radius_km != null ? String(profile.delivery_radius_km) : null,
    },
  ];

  const visibleRows = rows.filter((row) => row.value != null && row.value !== '');

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <VendorPageHeader
          title={t('vendorLocationAddress.title', { defaultValue: 'Location & Address' })}
          subtitle={t('vendorLocationAddress.subtitle', {
            defaultValue: 'Registered location details',
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
        title={t('vendorLocationAddress.title', { defaultValue: 'Location & Address' })}
        subtitle={t('vendorLocationAddress.subtitle', {
          defaultValue: 'Registered location details',
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
              <Ionicons name="location-outline" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionHeading}>
              {t('vendorLocationAddress.sectionTitle', { defaultValue: 'Location details' })}
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
                  onPress={row.onPress}
                  isLast={index === visibleRows.length - 1}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={28} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>
                  {t('vendorLocationAddress.empty', {
                    defaultValue: 'No location details available yet.',
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.hint}>
          {t('vendorLocationAddress.readOnlyHint', {
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
  openLink: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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

export default VendorLocationAddressScreen;
