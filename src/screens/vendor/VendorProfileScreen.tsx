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
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useAppStore } from '../../store';
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

function partnershipLabel(profile: VendorProfileData | null): string {
  if (!profile) return '';
  if (profile.partnership_badge_label?.trim()) return profile.partnership_badge_label.trim();
  if (profile.partnership_tier?.trim()) {
    const tier = profile.partnership_tier.trim();
    return /partner/i.test(tier) ? tier : `${tier} Partner`;
  }
  return '';
}

const MENU_ICON_MAP: Record<string, string> = {
  person: 'person-outline',
  business: 'business-outline',
  location: 'location-outline',
  payment: 'card-outline',
  diamond: 'diamond-outline',
  analytics: 'analytics-outline',
  document: 'document-text-outline',
  support: 'people-outline',
};

function menuIcon(icon?: string, fallback = 'chevron-forward-outline'): string {
  if (!icon) return fallback;
  return MENU_ICON_MAP[icon] ?? `${icon}-outline`;
}

function menuAction(id: string): string {
  switch (id) {
    case 'edit_profile':
      return 'editProfile';
    case 'business_information':
      return 'businessInfo';
    case 'location_address':
      return 'location';
    case 'payment_methods':
      return 'payment';
    case 'partnership_status':
      return 'partnership';
    case 'performance_analytics':
      return 'analytics';
    case 'partnership_documents':
      return 'documents';
    case 'support_team':
      return 'support';
    default:
      return id;
  }
}

const VendorProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<VendorProfileData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
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
  const badge = partnershipLabel(profile);
  const memberSince = profile?.member_since || '';
  const avatarUrl = profile?.profile_picture_url || profile?.logo_url;
  const products = profile?.stats_products ?? 0;
  const delivered = profile?.stats_delivered ?? 0;
  const rating = profile?.stats_rating ?? 0;
  const reviews = profile?.stats_reviews ?? 0;

  const profileSections = [
    {
      title: t('vendorProfile.accountSettings', { defaultValue: 'Account Settings' }),
      items:
        profile?.account_settings?.length
          ? profile.account_settings.map((item) => ({
              icon: menuIcon(item.icon, 'person-outline'),
              label: item.title,
              action: menuAction(item.id),
            }))
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
                icon: 'card-outline',
                label: t('vendorProfile.paymentMethods', { defaultValue: 'Payment Methods' }),
                action: 'payment',
              },
            ],
    },
    {
      title: t('vendorProfile.partnership', { defaultValue: 'Partnership' }),
      items:
        profile?.partnership_menu?.length
          ? profile.partnership_menu.map((item) => ({
              icon: menuIcon(item.icon, 'diamond-outline'),
              label: item.title,
              action: menuAction(item.id),
            }))
          : [
              {
                icon: 'diamond-outline',
                label: t('vendorProfile.partnershipStatus', { defaultValue: 'Partnership Status' }),
                action: 'partnership',
              },
              {
                icon: 'analytics-outline',
                label: t('vendorProfile.analytics', { defaultValue: 'Performance Analytics' }),
                action: 'analytics',
              },
              {
                icon: 'document-text-outline',
                label: t('vendorProfile.documents', { defaultValue: 'Partnership Documents' }),
                action: 'documents',
              },
              {
                icon: 'people-outline',
                label: t('vendorProfile.supportTeam', { defaultValue: 'Support Team' }),
                action: 'support',
              },
            ],
    },
    {
      title: t('vendorProfile.supportHelp', { defaultValue: 'Support & Help' }),
      items: [
        {
          icon: 'help-circle-outline',
          label: t('vendorProfile.helpCenter', { defaultValue: 'Help Center' }),
          action: 'help',
        },
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
      case 'payment':
        Alert.alert(
          t('vendorProfile.paymentMethods', { defaultValue: 'Payment Methods' }),
          t('vendorProfile.comingSoon', { defaultValue: 'Coming soon!' })
        );
        break;
      case 'partnership':
        navigation.navigate('Partnership');
        break;
      case 'analytics':
        navigation.navigate('Analytics');
        break;
      case 'documents':
        Alert.alert(
          t('vendorProfile.documents', { defaultValue: 'Partnership Documents' }),
          t('vendorProfile.comingSoon', { defaultValue: 'Coming soon!' })
        );
        break;
      case 'support':
        Alert.alert(
          t('vendorProfile.supportTeam', { defaultValue: 'Support Team' }),
          t('vendorProfile.comingSoon', { defaultValue: 'Coming soon!' })
        );
        break;
      case 'help':
        Alert.alert(
          t('vendorProfile.helpCenter', { defaultValue: 'Help Center' }),
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
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.profileImage} contentFit="cover" />
              ) : (
                <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                  <Ionicons name="person" size={32} color={COLORS.textSecondary} />
                </View>
              )}
              <View style={styles.profileMeta}>
                {category ? <Text style={styles.businessType}>{category}</Text> : null}
                {badge ? (
                  <View style={styles.partnershipBadge}>
                    <Ionicons name="leaf-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.partnershipText}>{badge}</Text>
                  </View>
                ) : null}
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
  },
  profileImagePlaceholder: {
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMeta: { flex: 1 },
  businessType: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  partnershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.xs,
    gap: 4,
  },
  partnershipText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
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
});

export default VendorProfileScreen;
