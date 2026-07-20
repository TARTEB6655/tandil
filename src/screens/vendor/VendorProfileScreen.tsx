import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useAppStore } from '../../store';
import { setAppLanguage } from '../../i18n';
import { authService } from '../../services/authService';
import {
  vendorProfileService,
  VendorProfileData,
} from '../../services/vendorProfileService';
import {
  VENDOR_SCREEN_BG,
  VendorHeroBanner,
  VendorCard,
  VendorMenuRow,
  VendorStatTile,
} from '../../components/vendor/VendorUi';

const LANGUAGES = [
  { code: 'en' as const, label: 'English', flag: 'EN' },
  { code: 'ar' as const, label: 'العربية', flag: 'AR' },
  { code: 'ur' as const, label: 'اردو', flag: 'UR' },
];

function languageLabel(code?: string): string {
  return LANGUAGES.find((lang) => lang.code === code)?.label || 'English';
}

function buildSubtitle(profile: VendorProfileData | null): string {
  if (!profile) return '';
  if (profile.header_subtitle?.trim()) return profile.header_subtitle.trim();
  if (profile.location_display?.trim()) {
    return profile.business_name
      ? `${profile.business_name} · ${profile.location_display}`
      : profile.location_display;
  }
  const locationBits = [profile.city, profile.emirate].filter(Boolean);
  const location = locationBits.join(', ');
  if (profile.business_name && location) return `${profile.business_name} · ${location}`;
  return profile.business_name || location || '';
}

function isPartnershipMenuId(id: string): boolean {
  const normalized = id.toLowerCase();
  return normalized.includes('partnership');
}

const MENU_ICON_MAP: Record<string, string> = {
  person: 'person-outline',
  business: 'business-outline',
  location: 'location-outline',
  payment: 'card-outline',
  analytics: 'analytics-outline',
  document: 'document-text-outline',
  support: 'people-outline',
};

function menuIcon(icon?: string, fallback = 'chevron-forward-outline'): string {
  if (!icon) return fallback;
  return MENU_ICON_MAP[icon] ?? `${icon}-outline`;
}

function menuLabelKey(id: string): string | null {
  switch (id) {
    case 'edit_profile':
      return 'vendorProfile.editProfile';
    case 'business_information':
      return 'vendorProfile.businessInfo';
    case 'location_address':
      return 'vendorProfile.locationAddress';
    case 'payment_methods':
      return 'vendorProfile.paymentMethods';
    case 'performance_analytics':
      return 'vendorProfile.analytics';
    case 'support_team':
      return 'vendorProfile.supportTeam';
    default:
      return null;
  }
}

function menuAction(id: string): string | null {
  if (isPartnershipMenuId(id)) return null;
  switch (id) {
    case 'edit_profile':
      return 'editProfile';
    case 'business_information':
      return 'businessInfo';
    case 'location_address':
      return 'location';
    case 'performance_analytics':
      return 'analytics';
    case 'support_team':
      return 'support';
    default:
      return id;
  }
}

const VendorProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const setLanguage = useAppStore((s) => s.setLanguage);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<VendorProfileData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setAvatarFailed(false);
    try {
      const data = await vendorProfileService.getProfile();
      setProfile(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load vendor profile.';
      console.error('Vendor profile load error:', err);
      setProfile(null);
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const displayName =
    profile?.header_name ||
    profile?.authorized_person_name ||
    user?.name ||
    t('vendorProfile.vendorFallback', { defaultValue: 'Vendor' });
  const subtitle = buildSubtitle(profile);
  const category =
    profile?.professional_category ||
    profile?.vendor_type_label ||
    profile?.vendor_type ||
    '';
  const memberSince = profile?.member_since || '';
  const avatarUrl =
    profile?.profile_picture_url || profile?.logo_url || user?.avatar || undefined;
  const showAvatar = Boolean(avatarUrl) && !avatarFailed;
  const products = profile?.stats_products ?? 0;
  const delivered = profile?.stats_delivered ?? 0;
  const rating = profile?.stats_rating ?? 0;
  const reviews = profile?.stats_reviews ?? 0;

  const accountMenuItems =
    profile?.account_settings?.length
      ? profile.account_settings
          .filter(
            (item) =>
              !isPartnershipMenuId(item.id) && item.id !== 'payment_methods'
          )
          .map((item) => {
            const action = menuAction(item.id);
            if (!action) return null;
            const labelKey = menuLabelKey(item.id);
            return {
              icon: menuIcon(item.icon, 'person-outline'),
              label: labelKey
                ? t(labelKey, { defaultValue: item.title })
                : item.title,
              action,
            };
          })
          .filter((item): item is { icon: string; label: string; action: string } => item != null)
      : [
          {
            icon: 'person-outline',
            label: t('vendorProfile.editProfile', { defaultValue: 'Edit Profile' }),
            action: 'editProfile',
          },
          {
            icon: 'business-outline',
            label: t('vendorProfile.businessInfo', { defaultValue: 'Business Information' }),
            action: 'businessInfo',
          },
          {
            icon: 'location-outline',
            label: t('vendorProfile.locationAddress', { defaultValue: 'Location & Address' }),
            action: 'location',
          },
          {
            icon: 'analytics-outline',
            label: t('vendorProfile.analytics', { defaultValue: 'Performance Analytics' }),
            action: 'analytics',
          },
        ];

  const profileSections = [
    {
      title: t('vendorProfile.accountSettings', { defaultValue: 'Account Settings' }),
      items: accountMenuItems,
    },
    {
      title: t('vendorProfile.preferences', { defaultValue: 'Preferences' }),
      items: [
        {
          icon: 'language-outline',
          label: t('settings.items.language.title', { defaultValue: 'Language' }),
          subtitle: languageLabel(i18n.language),
          action: 'language',
        },
      ],
    },
    {
      title: t('vendorProfile.supportHelp', { defaultValue: 'Support & Help' }),
      items: [
        {
          icon: 'chatbubble-outline',
          label: t('vendorProfile.liveChat', { defaultValue: 'Live Chat' }),
          action: 'chat',
        },
        {
          icon: 'call-outline',
          label: t('vendorProfile.contactUs', { defaultValue: 'Contact Us' }),
          action: 'contact',
        },
        {
          icon: 'document-outline',
          label: t('vendorProfile.terms', { defaultValue: 'Terms & Conditions' }),
          action: 'terms',
        },
        {
          icon: 'shield-outline',
          label: t('vendorProfile.privacy', { defaultValue: 'Privacy Policy' }),
          action: 'privacy',
        },
      ],
    },
  ];

  const handleProfileAction = (action: string) => {
    switch (action) {
      case 'editProfile':
        navigation.navigate('EditProfile');
        break;
      case 'businessInfo':
        navigation.navigate('BusinessInfo');
        break;
      case 'location':
        navigation.navigate('LocationAddress');
        break;
      case 'analytics':
        navigation.navigate('Analytics');
        break;
      case 'language':
        setLanguageModalVisible(true);
        break;
      case 'support':
        Alert.alert(
          t('vendorProfile.supportTeam', { defaultValue: 'Support Team' }),
          t('vendorProfile.comingSoon', { defaultValue: 'Coming soon!' })
        );
        break;
      case 'chat':
        navigation.navigate('LiveChat');
        break;
      case 'contact':
        navigation.navigate('ContactUs');
        break;
      case 'terms':
        navigation.navigate('LegalDocument', { document: 'terms' });
        break;
      case 'privacy':
        navigation.navigate('LegalDocument', { document: 'privacy' });
        break;
    }
  };

  const resetToRoleSelection = () => {
    let rootNavigator = navigation;
    while (rootNavigator.getParent()) {
      rootNavigator = rootNavigator.getParent() as typeof navigation;
    }
    rootNavigator.reset({
      index: 0,
      routes: [{ name: 'RoleSelection' }],
    });
  };

  const handleLogout = () => {
    Alert.alert(
      t('technician.logout', { defaultValue: 'Logout' }),
      t('technician.logoutConfirm', { defaultValue: 'Are you sure you want to logout?' }),
      [
        { text: t('technician.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('technician.logout', { defaultValue: 'Logout' }),
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Vendor logout error:', error);
              await authService.clearLocalSession();
            } finally {
              resetToRoleSelection();
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <VendorHeroBanner
          badge={t('vendorDashboard.vendorPortal')}
          title={displayName}
          subtitle={subtitle || undefined}
        />

        <View style={styles.profileCardWrap}>
          {loading && !profile ? (
            <View style={styles.cardLoading}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={28} color={COLORS.error} />
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadProfile}>
                <Text style={styles.retryBtnText}>
                  {t('common.retry', { defaultValue: 'Retry' })}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.avatarRow}>
              {showAvatar ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.profileImage}
                  contentFit="cover"
                  transition={200}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                  <Ionicons name="person" size={32} color={COLORS.textSecondary} />
                </View>
              )}
              <View style={styles.profileMeta}>
                {category ? <Text style={styles.businessType}>{category}</Text> : null}
                {memberSince ? (
                  <Text style={styles.memberSince}>
                    {t('vendorProfile.memberSince', {
                      defaultValue: 'Member since {{date}}',
                      date: memberSince,
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <VendorStatTile
            label={t('vendorProfile.products', { defaultValue: 'Products' })}
            value={products}
            icon="cube-outline"
            accent={COLORS.primary}
          />
          <VendorStatTile
            label={t('vendorProfile.delivered', { defaultValue: 'Delivered' })}
            value={delivered}
            icon="checkmark-done-outline"
            accent={COLORS.success}
          />
          <VendorStatTile
            label={t('vendorProfile.rating', { defaultValue: 'Rating' })}
            value={profile?.rating_available === false ? '—' : rating}
            icon="star-outline"
            accent="#D4A017"
          />
          <VendorStatTile
            label={t('vendorProfile.reviews', { defaultValue: 'Reviews' })}
            value={reviews}
            icon="chatbubbles-outline"
            accent={COLORS.info}
          />
        </View>

        {profileSections.map((section) => (
          <VendorCard key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item, index) => (
              <VendorMenuRow
                key={`${section.title}-${index}`}
                icon={item.icon}
                title={item.label}
                subtitle={'subtitle' in item ? item.subtitle : undefined}
                onPress={() => handleProfileAction(item.action)}
              />
            ))}
          </VendorCard>
        ))}

        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
            <Text style={styles.logoutText}>
              {t('technician.logout', { defaultValue: 'Logout' })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Tandil Vendor v1.0.0</Text>
        </View>
      </ScrollView>

      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="language" size={22} color={COLORS.primary} />
              <Text style={styles.modalTitle}>
                {t('common.language', { defaultValue: 'Language' })}
              </Text>
            </View>
            <Text style={styles.modalSubtitle}>
              {t('settings.items.language.subtitle', {
                defaultValue: 'Choose your preferred language',
              })}
            </Text>
            <View style={styles.languageOptions}>
              {LANGUAGES.map((lang) => {
                const active = i18n.language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.languageOption, active && styles.languageOptionActive]}
                    onPress={async () => {
                      await setAppLanguage(lang.code);
                      setLanguage(lang.code);
                      setLanguageModalVisible(false);
                    }}
                  >
                    <View style={[styles.langBadge, active && styles.langBadgeActive]}>
                      <Text style={[styles.langBadgeText, active && styles.langBadgeTextActive]}>
                        {lang.flag}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.languageOptionText,
                        active && styles.languageOptionTextActive,
                      ]}
                    >
                      {lang.label}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VENDOR_SCREEN_BG,
  },
  scrollView: {
    flex: 1,
  },
  profileCardWrap: {
    marginTop: -SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardLoading: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginRight: SPACING.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
  },
  profileImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMeta: { flex: 1 },
  businessType: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  memberSince: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionCard: {
    marginHorizontal: SPACING.lg,
    paddingHorizontal: 0,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  logoutSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '20',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.error,
    marginLeft: SPACING.sm,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  versionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  languageOptions: {
    gap: SPACING.sm,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  languageOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
  },
  langBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  langBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  langBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textSecondary,
  },
  langBadgeTextActive: {
    color: COLORS.background,
  },
  languageOptionText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  languageOptionTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  modalClose: {
    marginTop: SPACING.md,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  modalCloseText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
});

export default VendorProfileScreen;
