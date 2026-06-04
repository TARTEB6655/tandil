import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useAppStore, useIsAuthenticated } from '../../store';
import { navigateToClientAuth } from '../../navigation/clientAuthNavigation';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import {
  getUserProfile,
  UserProfileData,
  getProfilePhone,
  getProfilePictureUrl,
} from '../../services/userService';
import { getClientNotifications } from '../../services/clientNotificationService';
import { shareApp, rateApp } from '../../utils/appShare';
import type { AppInfoPageKey } from '../../types/appInfo';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';
import { authService } from '../../services/authService';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user, logout } = useAppStore();
  const isAuthenticated = useIsAuthenticated();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { count: cartItemCount } = useCartBadgeCount();

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        setProfile(null);
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      getUserProfile()
        .then((data) => { if (!cancelled) setProfile(data ?? null); })
        .catch(() => { if (!cancelled) setProfile(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [isAuthenticated])
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        setUnreadNotificationCount(0);
        return;
      }
      getClientNotifications({ per_page: 1, page: 1 })
        .then((res) => setUnreadNotificationCount(res.unreadCount ?? 0))
        .catch(() => setUnreadNotificationCount(0));
    }, [isAuthenticated])
  );

  const displayName = profile?.name ?? user?.name ?? t('profile.userNameDefault');
  const displayEmail = profile?.email ?? user?.email ?? t('profile.emailDefault');
  // Prefer phone from profile API (phone, phone_number, or mobile); fallback to store only when profile has none
  const displayPhone = getProfilePhone(profile) ?? user?.phone ?? null;
  // Resolve profile picture: use full URL from API or build from relative path (e.g. profiles/xxx -> /media/profiles/xxx)
  const profilePictureUrl = getProfilePictureUrl(profile);

  const resetToRoleSelection = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'RoleSelection' }],
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      resetToRoleSelection();
    } catch (error) {
      console.error('Logout error:', error);
      resetToRoleSelection();
    }
  };

  const openAppInfo = (pageKey: AppInfoPageKey) => {
    try {
      navigation.navigate('AppInfoContent', { pageKey });
    } catch (error) {
      console.error('ProfileScreen: AppInfoContent navigation error:', error);
    }
  };

  type MenuItem = {
    icon: string;
    title: string;
    onPress: () => void;
    color?: string;
  };

  const requiresAccount = (onPress: () => void) => () => {
    if (!isAuthenticated) {
      navigateToClientAuth(navigation);
      return;
    }
    onPress();
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      t('settings.alerts.deleteTitle'),
      t('settings.alerts.deleteBody'),
      [
        { text: t('settings.alerts.cancel'), style: 'cancel' },
        {
          text: t('settings.alerts.delete'),
          style: 'destructive',
          onPress: async () => {
            if (deletingAccount) return;
            setDeletingAccount(true);
            try {
              const result = await authService.deleteAccount();
              if (!result.success) {
                Alert.alert(
                  t('common.error'),
                  result.message || t('settings.alerts.deleteFailed')
                );
                return;
              }
              await logout({ skipApi: true });
              resetToRoleSelection();
              Alert.alert(
                t('settings.alerts.deletedTitle'),
                t('settings.alerts.deletedBody')
              );
            } catch (error: unknown) {
              const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                  ?.message ||
                (error instanceof Error ? error.message : null) ||
                t('settings.alerts.deleteFailed');
              Alert.alert(t('common.error'), message);
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const accountMenuItems: MenuItem[] = [
    {
      icon: 'trophy-outline',
      title: t('profile.memberships'),
      onPress: requiresAccount(() => {
        try {
          navigation.navigate('Memberships' as never);
        } catch (error) {
          console.error('ProfileScreen: Navigation error to Memberships:', error);
        }
      }),
    },
    {
      icon: 'person-outline',
      title: t('profile.personalInformation'),
      onPress: requiresAccount(() => {
        try {
          navigation.navigate('PersonalInfo');
        } catch {}
      }),
    },
    {
      icon: 'location-outline',
      title: t('profile.addresses'),
      onPress: requiresAccount(() => {
        try {
          navigation.navigate('Addresses');
        } catch {}
      }),
    },
    {
      icon: 'wallet-outline',
      title: t('profile.wallet', 'Wallet'),
      onPress: requiresAccount(() => {
        try {
          navigation.navigate('Wallet');
        } catch {}
      }),
    },
    {
      icon: 'notifications-outline',
      title: t('profile.notifications'),
      onPress: requiresAccount(() => {
        try {
          navigation.navigate('Notifications');
        } catch (error) {
          console.error('ProfileScreen: Navigation error to Notifications:', error);
        }
      }),
    },
  ];

  const publicMenuItems: MenuItem[] = [
    {
      icon: 'help-circle-outline',
      title: t('profile.helpSupport'),
      onPress: () => {
        try {
          navigation.navigate('HelpCenter');
        } catch (error) {
          console.error('ProfileScreen: Navigation error to HelpCenter:', error);
        }
      },
    },
    {
      icon: 'information-circle-outline',
      title: t('profile.about.whoWeAre'),
      onPress: () => openAppInfo('who_we_are'),
    },
    {
      icon: 'share-social-outline',
      title: t('profile.about.shareApp'),
      onPress: () => {
        shareApp(t).catch(() => {});
      },
    },
    {
      icon: 'star-outline',
      title: t('profile.about.rateApp'),
      onPress: () => {
        rateApp(t).catch(() => {});
      },
    },
    {
      icon: 'document-text-outline',
      title: t('profile.about.privacyPolicy'),
      onPress: () => openAppInfo('privacy_policy'),
    },
    {
      icon: 'document-text-outline',
      title: t('profile.about.termsConditions'),
      onPress: () => openAppInfo('terms_conditions'),
    },
  ];

  const menuItems: MenuItem[] = isAuthenticated
    ? [
        ...accountMenuItems,
        ...publicMenuItems,
        {
          icon: 'trash-outline',
          title: t('settings.items.deleteAccount.title'),
          onPress: requiresAccount(confirmDeleteAccount),
          color: COLORS.error,
        },
        {
          icon: 'log-out-outline',
          title: t('profile.logout'),
          onPress: handleLogout,
          color: COLORS.error,
        },
      ]
    : publicMenuItems;

  return (
    <View style={styles.container}>
      <Header 
        title={t('tabs.profile')} 
        showBack={false}
        showNotifications={isAuthenticated}
        notificationCount={unreadNotificationCount}
        onNotificationPress={() => navigation.navigate('Notifications')}
        showCart={true}
        cartItemCount={cartItemCount}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
          ) : null}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(displayName || 'U').charAt(0).toUpperCase()}</Text>
            </View>
            {profilePictureUrl ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={[styles.avatarImage, styles.avatarImageOverlay]}
                contentFit="cover"
                cachePolicy="disk"
                transition={200}
              />
            ) : null}
            <TouchableOpacity style={styles.editButton}>
              <Ionicons name="camera" size={16} color={COLORS.background} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>
            {isAuthenticated ? displayName : t('profile.guestTitle', 'Guest')}
          </Text>
          <Text style={styles.userEmail}>
            {isAuthenticated
              ? displayEmail
              : t('profile.guestSubtitle', 'Browse the shop and services without an account')}
          </Text>
          {isAuthenticated && displayPhone ? (
            <Text style={styles.userPhone}>{displayPhone}</Text>
          ) : null}
          {!isAuthenticated ? (
            <View style={styles.guestAuthRow}>
              <TouchableOpacity
                style={styles.guestAuthPrimary}
                onPress={() => navigateToClientAuth(navigation)}
              >
                <Text style={styles.guestAuthPrimaryText}>{t('auth.login', 'Log in')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.guestAuthSecondary}
                onPress={() => navigateToClientAuth(navigation)}
              >
                <Text style={styles.guestAuthSecondaryText}>{t('auth.signup', 'Sign up')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={`${item.title}-${index}`}
              style={styles.menuItem}
          onPress={item.onPress}
          disabled={deletingAccount}
        >
              <View style={styles.menuItemLeft}>
                <Ionicons 
                  name={item.icon as any} 
                  size={24} 
                  color={item.color || COLORS.textSecondary} 
                />
                <Text style={[styles.menuItemText, item.color && { color: item.color }]}>
                  {item.title}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
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
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  loader: {
    marginBottom: SPACING.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  userPhone: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  guestAuthRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  guestAuthPrimary: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  guestAuthPrimaryText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  guestAuthSecondary: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  guestAuthSecondaryText: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  menuContainer: {
    paddingHorizontal: SPACING.lg,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.md,
  },
});

export default ProfileScreen;
