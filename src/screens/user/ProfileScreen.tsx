import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useAppStore } from '../../store';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { getUserProfile, UserProfileData, getProfilePhone, getProfilePictureUrl } from '../../services/userService';
import { getSupportTickets } from '../../services/supportService';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user, logout } = useAppStore();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportTicketsCount, setSupportTicketsCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getUserProfile()
        .then((data) => { if (!cancelled) setProfile(data ?? null); })
        .catch(() => { if (!cancelled) setProfile(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      getSupportTickets({ per_page: 1, page: 1 })
        .then((res) => {
          const total = res?.data?.pagination?.total ?? 0;
          setSupportTicketsCount(typeof total === 'number' ? total : 0);
        })
        .catch(() => setSupportTicketsCount(0));
    }, [])
  );

  const displayName = profile?.name ?? user?.name ?? t('profile.userNameDefault');
  const displayEmail = profile?.email ?? user?.email ?? t('profile.emailDefault');
  // Prefer phone from profile API (phone, phone_number, or mobile); fallback to store only when profile has none
  const displayPhone = getProfilePhone(profile) ?? user?.phone ?? null;
  // Resolve profile picture: use full URL from API or build from relative path (e.g. profiles/xxx -> /media/profiles/xxx)
  const profilePictureUrl = getProfilePictureUrl(profile);

  const handleLogout = async () => {
    try {
      await logout();
      // Navigate to RoleSelection screen after logout
      navigation.reset({
        index: 0,
        routes: [{ name: 'RoleSelection' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Still navigate even if logout fails
      navigation.reset({
        index: 0,
        routes: [{ name: 'RoleSelection' }],
      });
    }
  };

  const menuItems = [
    { icon: 'trophy-outline', title: t('profile.memberships'), onPress: () => {
      try {
        navigation.navigate('Memberships' as never);
      } catch (error) {
        console.error('ProfileScreen: Navigation error to Memberships:', error);
      }
    } },
    { icon: 'person-outline', title: t('profile.personalInformation'), onPress: () => {
      try { navigation.navigate('PersonalInfo'); } catch {}
    } },
    { icon: 'location-outline', title: t('profile.addresses'), onPress: () => {
      try { navigation.navigate('Addresses'); } catch {}
    } },
    { icon: 'card-outline', title: t('profile.paymentMethods'), onPress: () => {
      try { navigation.navigate('PaymentMethods'); } catch {}
    } },
    { icon: 'notifications-outline', title: t('profile.notifications'), onPress: () => {
      console.log('ProfileScreen: Navigating to Notifications');
      try {
        navigation.navigate('Notifications');
      } catch (error) {
        console.error('ProfileScreen: Navigation error to Notifications:', error);
      }
    } },
    { icon: 'help-circle-outline', title: t('profile.helpSupport'), onPress: () => {
      console.log('ProfileScreen: Navigating to HelpCenter');
      try {
        navigation.navigate('HelpCenter');
      } catch (error) {
        console.error('ProfileScreen: Navigation error to HelpCenter:', error);
      }
    } },
    { icon: 'log-out-outline', title: t('profile.logout'), onPress: handleLogout, color: COLORS.error },
  ];

  return (
    <View style={styles.container}>
      <Header 
        title={t('tabs.profile')} 
        showBack={false}
        showNotifications={true}
        notificationCount={supportTicketsCount}
        onNotificationPress={() => navigation.navigate('MyTickets')}
        showCart={true}
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
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>
          {displayPhone ? (
            <Text style={styles.userPhone}>{displayPhone}</Text>
          ) : null}
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
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
