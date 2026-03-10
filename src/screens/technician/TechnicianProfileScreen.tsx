import React, { useState, useEffect, useCallback } from 'react';
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
import { getTechnicianProfile, TechnicianProfileData } from '../../services/technicianService';

const TechnicianProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user, logout } = useAppStore();

  const formatMemberSince = (isoDate: string | null | undefined): string => {
    if (!isoDate) return '—';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '—';
    const now = new Date();
    const months = Math.max(0, (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth()));
    if (months < 1) return t('technician.lessThanMonth');
    if (months === 1) return '1 month';
    return `${months} months`;
  };

  const [profile, setProfile] = useState<TechnicianProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getTechnicianProfile();
      setProfile(data ?? null);
      const pictureUrl = data?.profile_picture_url ?? data?.profile_picture;
      if (typeof pictureUrl === 'string' && pictureUrl.trim()) {
        Image.prefetch([pictureUrl.trim()], { cachePolicy: 'disk' }).catch(() => {});
      }
    } catch (_) {
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile(false);
    }, [])
  );

  const technician = profile
    ? {
        name: profile.name || user?.name || '—',
        email: profile.email || user?.email || '—',
        phone: profile.phone || user?.phone || '—',
        profilePictureUrl: profile.profile_picture_url || profile.profile_picture || null,
        rating: profile.rating ?? 0,
        completedJobs: profile.jobs_completed ?? 0,
        totalEarnings: profile.total_earnings ?? 0,
        memberSince: formatMemberSince(profile.member_since),
        specializations: Array.isArray(profile.specializations) ? profile.specializations : [],
        serviceArea: profile.service_area || '—',
      }
    : {
        name: user?.name || '—',
        email: user?.email || '—',
        phone: user?.phone || '—',
        profilePictureUrl: null as string | null,
        rating: 0,
        completedJobs: 0,
        totalEarnings: 0,
        memberSince: '—',
        specializations: [] as string[],
        serviceArea: '—',
      };

  const handleLogout = () => {
    Alert.alert(
      t('technician.logout'),
      t('technician.logoutConfirm'),
      [
        { text: t('technician.cancel'), style: 'cancel' },
        { 
          text: t('technician.logout'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // Navigate to root navigator (RoleSelection)
              // Get root navigator by going up parent chain
              let rootNavigator = navigation;
              while (rootNavigator.getParent()) {
                rootNavigator = rootNavigator.getParent() as any;
              }
              
              // Reset to RoleSelection at root level
              rootNavigator.reset({
                index: 0,
                routes: [{ name: 'RoleSelection' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
              // Still navigate even if logout fails
              let rootNavigator = navigation;
              while (rootNavigator.getParent()) {
                rootNavigator = rootNavigator.getParent() as any;
              }
              rootNavigator.reset({
                index: 0,
                routes: [{ name: 'RoleSelection' }],
              });
            }
          }
        },
      ]
    );
  };

  const menuItems = [
    { icon: 'person-outline', title: t('technician.profileInfo'), onPress: () => navigation.navigate('TechnicianProfileEdit') },
    { icon: 'notifications-outline', title: t('technician.notifications'), onPress: () => navigation.navigate('Notifications') },
    { icon: 'help-circle-outline', title: t('technician.helpSupport'), onPress: () => navigation.navigate('HelpCenter') },
    { icon: 'log-out-outline', title: t('technician.logout'), onPress: handleLogout, color: COLORS.error },
  ];

  const renderMenuItem = (item: any) => (
    <TouchableOpacity
      key={item.title}
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
  );

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { marginBottom: 20 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('technician.tabs.profile')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { marginBottom: 20 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('technician.tabs.profile')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchProfile(true)} colors={[COLORS.primary]} />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {/* Always show letter placeholder so circle is never empty while image loads */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(technician.name || 'T').charAt(0).toUpperCase()}</Text>
            </View>
            {technician.profilePictureUrl ? (
              <Image
                source={{ uri: technician.profilePictureUrl }}
                style={[styles.avatarImage, styles.avatarImageOverlay]}
                contentFit="cover"
                cachePolicy="disk"
                transition={200}
              />
            ) : null}
            <View style={styles.onlineStatus}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
          
          <Text style={styles.technicianName}>{technician.name}</Text>
          <Text style={styles.technicianEmail}>{technician.email}</Text>
          {technician.phone ? (
            <Text style={styles.technicianPhone}>{technician.phone}</Text>
          ) : null}
          
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color={COLORS.warning} />
            <Text style={styles.ratingText}>
              {Number(technician.rating) ? Number(technician.rating).toFixed(1) : '0'}/5
            </Text>
            <Text style={styles.ratingLabel}>({technician.completedJobs} jobs)</Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.success} />
            <Text style={styles.statValue}>{technician.completedJobs}</Text>
            <Text style={styles.statLabel}>{t('technician.jobsCompleted')}</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statValue}>{t('orders.currency', { defaultValue: 'AED' })} {Number(technician.totalEarnings).toFixed(2)}</Text>
            <Text style={styles.statLabel}>{t('technician.totalEarnings')}</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={24} color={COLORS.info} />
            <Text style={styles.statValue}>{technician.memberSince}</Text>
            <Text style={styles.statLabel}>{t('technician.memberSince')}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.settings')}</Text>
          <View style={styles.menuContainer}>
            {menuItems.map(renderMenuItem)}
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.accountActions')}</Text>
          <View style={styles.accountActions}>
            <TouchableOpacity style={styles.accountAction}>
              <Ionicons name="download-outline" size={20} color={COLORS.primary} />
              <Text style={styles.accountActionText}>{t('technician.downloadData')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.accountAction}>
              <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              <Text style={[styles.accountActionText, { color: COLORS.error }]}>{t('technician.deleteAccount')}</Text>
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
  technicianName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  technicianEmail: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  technicianPhone: {
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
  },
  statValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
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
  accountActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  accountAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  accountActionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
});

export default TechnicianProfileScreen;
