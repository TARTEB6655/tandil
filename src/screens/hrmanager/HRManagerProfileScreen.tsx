import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import { hrService, HRProfileData } from '../../services/hrService';

const HRManagerProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user, logout } = useAppStore();

  const [profile, setProfile] = useState<HRProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await hrService.getProfile();
      if (res?.success && res.data) {
        setProfile(res.data);
        if (res.data.profile_picture_url?.trim()) {
          Image.prefetch([res.data.profile_picture_url.trim()], { cachePolicy: 'disk' }).catch(() => {});
        }
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile(false);
    }, [fetchProfile])
  );

  const display = profile
    ? {
        name: profile.name || user?.name || '—',
        email: profile.email || user?.email || '—',
        phone: profile.phone || user?.phone || '—',
        profilePictureUrl: profile.profile_picture_url || profile.profile_picture || null,
        rating: profile.rating ?? 0,
        jobsCompleted: profile.jobs_completed ?? 0,
        totalEarningsDisplay: profile.total_earnings != null ? `AED ${Number(profile.total_earnings).toFixed(2)}` : 'AED 0.00',
        memberSince: profile.member_since
          ? new Date(profile.member_since).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '—',
      }
    : {
        name: user?.name || '—',
        email: user?.email || '—',
        phone: user?.phone || '—',
        profilePictureUrl: null as string | null,
        rating: 0,
        jobsCompleted: 0,
        totalEarningsDisplay: 'AED 0.00',
        memberSince: '—',
      };

  const handleLogout = () => {
    Alert.alert(
      t('technician.logout', 'Log out'),
      t('technician.logoutConfirm', 'Are you sure you want to log out?'),
      [
        { text: t('technician.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('technician.logout', 'Log out'),
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              let rootNavigator = navigation as any;
              while (rootNavigator.getParent?.()) {
                rootNavigator = rootNavigator.getParent();
              }
              rootNavigator.reset?.({ index: 0, routes: [{ name: 'RoleSelection' }] });
            } catch {
              let rootNavigator = navigation as any;
              while (rootNavigator.getParent?.()) {
                rootNavigator = rootNavigator.getParent();
              }
              rootNavigator.reset?.({ index: 0, routes: [{ name: 'RoleSelection' }] });
            }
          },
        },
      ]
    );
  };

  const menuItems = [
    { icon: 'person-outline' as const, title: t('technician.profileInfo', 'Profile information'), onPress: () => navigation.navigate('HRManagerProfileEdit') },
    { icon: 'notifications-outline' as const, title: t('technician.notifications', 'Notifications'), onPress: () => navigation.navigate('Notifications') },
    { icon: 'help-circle-outline' as const, title: t('technician.helpSupport', 'Help & Support'), onPress: () => navigation.navigate('HelpCenter') },
    { icon: 'log-out-outline' as const, title: t('technician.logout', 'Log out'), onPress: handleLogout, color: COLORS.error },
  ];

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { marginBottom: 20 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('tabs.profile', 'Profile')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginBottom: 20 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tabs.profile', 'Profile')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchProfile(true)} colors={[COLORS.primary]} />
        }
      >
        {/* Profile Header – from GET /api/hr/profile */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(display.name || 'H').charAt(0).toUpperCase()}</Text>
            </View>
            {display.profilePictureUrl ? (
              <Image
                source={{ uri: display.profilePictureUrl }}
                style={[styles.avatarImage, styles.avatarImageOverlay]}
                contentFit="cover"
                cachePolicy="disk"
                transition={200}
              />
            ) : null}
            <View style={styles.onlineStatus}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.statusText}>{t('technician.availability.onlineStatus', 'Online')}</Text>
            </View>
          </View>

          <Text style={styles.nameText}>{display.name}</Text>
          <Text style={styles.emailText}>{display.email}</Text>
          {display.phone ? <Text style={styles.phoneText}>{display.phone}</Text> : null}

          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color={COLORS.warning} />
            <Text style={styles.ratingText}>
              {Number(display.rating) ? Number(display.rating).toFixed(1) : '0'}/5
            </Text>
            <Text style={styles.ratingLabel}>
              ({t('technician.jobsCount', { count: display.jobsCompleted, defaultValue: `${display.jobsCompleted} jobs` })})
            </Text>
          </View>
        </View>

        {/* Stats – jobs_completed, total_earnings, member_since */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{display.jobsCompleted}</Text>
            <Text style={styles.statLabel}>{t('technician.jobsCompleted', 'Jobs Completed')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{display.totalEarningsDisplay}</Text>
            <Text style={styles.statLabel}>{t('technician.totalEarnings', 'Total Earnings')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color={COLORS.info} />
            <Text style={styles.statValue}>{display.memberSince}</Text>
            <Text style={styles.statLabel}>{t('technician.memberSince', 'Member since')}</Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.settings', 'Settings')}</Text>
          <View style={styles.menuContainer}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.title}
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name={item.icon} size={24} color={item.color ?? COLORS.textSecondary} />
                  <Text style={[styles.menuItemText, item.color ? { color: item.color } : undefined]}>
                    {item.title}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  onlineStatus: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.medium,
  },
  nameText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emailText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  phoneText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  ratingLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
    textAlign: 'center',
    width: '100%',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    width: '100%',
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  menuContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
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

export default HRManagerProfileScreen;
