import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useAppStore } from '../../store';
import { setAppLanguage } from '../../i18n';
import { adminService, AdminDashboardProfile } from '../../services/adminService';

const LANGUAGES = [
  { code: 'en' as const, label: 'English' },
  { code: 'ar' as const, label: 'العربية' },
  { code: 'ur' as const, label: 'اردو' },
];

const AdminSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const { logout, setLanguage } = useAppStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [profile, setProfile] = useState<AdminDashboardProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      const res = await adminService.getDashboardProfile();
      if (res.success && res.data) setProfile(res.data);
      else setProfile(null);
    } catch (_) {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const profileName = profile?.name?.trim() || '';
  const profileEmail = profile?.email?.trim() || '';
  const profileId = profile?.formatted_id?.trim() || '';
  const profilePictureUrl = profile?.profile_picture_url?.trim() || null;
  const avatarInitial = profileName ? profileName.charAt(0).toUpperCase() : 'A';

  const settingsSections = [
    {
      titleKey: 'admin.settings.systemSettings',
      items: [
        {
          icon: 'notifications',
          titleKey: 'admin.settings.pushNotifications.title',
          subtitleKey: 'admin.settings.pushNotifications.subtitle',
          type: 'toggle',
          value: notificationsEnabled,
          onToggle: setNotificationsEnabled,
        },
        {
          icon: 'person',
          titleKey: 'admin.settings.profileSetting.title',
          subtitleKey: 'admin.settings.profileSetting.subtitle',
          type: 'navigation',
          onPress: () => navigation.navigate('AdminProfileEdit'),
        },
        {
          icon: 'warning',
          titleKey: 'admin.settings.maintenanceMode.title',
          subtitleKey: 'admin.settings.maintenanceMode.subtitle',
          type: 'toggle',
          value: maintenanceMode,
          onToggle: setMaintenanceMode,
        },
      ],
    },
    {
      titleKey: 'admin.settings.appConfiguration',
      items: [
        {
          icon: 'color-palette',
          titleKey: 'admin.settings.themeSettings.title',
          subtitleKey: 'admin.settings.themeSettings.subtitle',
          type: 'navigation',
          onPress: () => navigation.navigate('AdminBanners'),
        },
        {
          icon: 'language',
          titleKey: 'admin.settings.languageRegion.title',
          subtitleKey: 'admin.settings.languageRegion.subtitle',
          type: 'navigation',
          onPress: () => setLanguageModalVisible(true),
        },
        {
          icon: 'card',
          titleKey: 'admin.settings.paymentSettings.title',
          subtitleKey: 'admin.settings.paymentSettings.subtitle',
          type: 'navigation',
          onPress: () => Alert.alert(t('admin.settings.paymentSettings.title'), t('admin.settings.paymentSettings.subtitle')),
        },
      ],
    },
    {
      titleKey: 'admin.settings.productSettingsSection',
      items: [
        {
          icon: 'cube',
          titleKey: 'admin.settings.productSettings.title',
          subtitleKey: 'admin.settings.productSettings.subtitle',
          type: 'navigation',
          onPress: () => navigation.navigate('AdminProductSettings'),
        },
      ],
    },
    {
      titleKey: 'admin.settings.zonesAndTeamsSection',
      items: [
        {
          icon: 'map',
          titleKey: 'admin.settings.zonesAndTeams.title',
          subtitleKey: 'admin.settings.zonesAndTeams.subtitle',
          type: 'navigation',
          onPress: () => navigation.navigate('AdminZones'),
        },
      ],
    },
    {
      titleKey: 'admin.settings.dataPrivacy',
      items: [
        {
          icon: 'shield-checkmark',
          titleKey: 'admin.settings.privacyPolicy.title',
          subtitleKey: 'admin.settings.privacyPolicy.subtitle',
          type: 'navigation',
          onPress: () => Alert.alert(t('admin.settings.privacyPolicy.title'), t('admin.settings.privacyPolicy.subtitle')),
        },
        {
          icon: 'document-text',
          titleKey: 'admin.settings.termsOfService.title',
          subtitleKey: 'admin.settings.termsOfService.subtitle',
          type: 'navigation',
          onPress: () => Alert.alert(t('admin.settings.termsOfService.title'), t('admin.settings.termsOfService.subtitle')),
        },
        {
          icon: 'trash',
          titleKey: 'admin.settings.clearCache.title',
          subtitleKey: 'admin.settings.clearCache.subtitle',
          type: 'navigation',
          onPress: () =>
            Alert.alert(t('admin.settings.clearCache.title'), t('admin.settings.clearCache.subtitle'), [
              { text: t('admin.settings.cancel'), style: 'cancel' },
              { text: t('admin.settings.clear'), onPress: () => Alert.alert(t('admin.settings.success'), t('admin.settings.cacheCleared')) },
            ]),
        },
      ],
    },
    {
      titleKey: 'admin.settings.advanced',
      items: [
        {
          icon: 'code',
          titleKey: 'admin.settings.developerOptions.title',
          subtitleKey: 'admin.settings.developerOptions.subtitle',
          type: 'navigation',
          onPress: () => Alert.alert(t('admin.settings.developerOptions.title'), t('admin.settings.developerOptions.subtitle')),
        },
        {
          icon: 'bug',
          titleKey: 'admin.settings.debugLogs.title',
          subtitleKey: 'admin.settings.debugLogs.subtitle',
          type: 'navigation',
          onPress: () => Alert.alert(t('admin.settings.debugLogs.title'), t('admin.settings.debugLogs.subtitle')),
        },
        {
          icon: 'download',
          titleKey: 'admin.settings.exportData.title',
          subtitleKey: 'admin.settings.exportData.subtitle',
          type: 'navigation',
          onPress: () => Alert.alert(t('admin.settings.exportData.title'), t('admin.settings.exportData.subtitle')),
        },
      ],
    },
  ];

  const renderSettingItem = (item: any) => {
    const title = t(item.titleKey);
    const subtitle = t(item.subtitleKey);
    if (item.type === 'toggle') {
      return (
        <View key={item.titleKey} style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name={item.icon as any} size={24} color={COLORS.primary} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>{title}</Text>
            <Text style={styles.settingSubtitle}>{subtitle}</Text>
          </View>
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
            thumbColor={item.value ? COLORS.primary : COLORS.background}
          />
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={item.titleKey}
        style={styles.settingItem}
        onPress={item.onPress}
      >
        <View style={styles.settingIcon}>
          <Ionicons name={item.icon as any} size={24} color={COLORS.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('admin.settings.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Admin Info Card – from GET /admin/dashboard/profile */}
        <View style={styles.adminCard}>
          {profilePictureUrl ? (
            <Image source={{ uri: profilePictureUrl }} style={styles.adminAvatarImage} contentFit="cover" />
          ) : (
            <View style={styles.adminAvatar}>
              <Text style={styles.adminAvatarText}>{avatarInitial}</Text>
            </View>
          )}
          <View style={styles.adminInfo}>
            {profileLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.profileLoading} />
            ) : (
              <>
                <Text style={styles.adminName}>{profileName || '—'}</Text>
                {profileEmail ? <Text style={styles.adminEmail}>{profileEmail}</Text> : null}
                {profileId ? <Text style={styles.adminId}>{profileId}</Text> : null}
              </>
            )}
          </View>
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <View key={section.titleKey} style={styles.section}>
            <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
            <View style={styles.sectionContent}>
              {section.items.map(renderSettingItem)}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert(
              t('admin.settings.logout'),
              t('admin.settings.logoutConfirm'),
              [
                { text: t('admin.settings.cancel'), style: 'cancel' },
                {
                  text: t('admin.settings.logout'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await logout();
                      // Navigate to root navigator (RoleSelection)
                      let rootNavigator = navigation;
                      while (rootNavigator.getParent()) {
                        rootNavigator = rootNavigator.getParent() as any;
                      }
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
          }}
        >
          <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
          <Text style={styles.logoutText}>{t('admin.settings.logout')}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('admin.settings.version')}</Text>
        </View>
      </ScrollView>

      {/* Language & Region Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('common.language')}</Text>
            <Text style={styles.modalSubtitle}>{t('settings.items.language.subtitle')}</Text>
            <View style={styles.languageOptions}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageButton,
                    i18n.language === lang.code && styles.languageButtonActive,
                  ]}
                  onPress={async () => {
                    await setAppLanguage(lang.code);
                    setLanguage(lang.code);
                    setLanguageModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.languageButtonText,
                      i18n.language === lang.code && styles.languageButtonTextActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  adminAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  adminAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: SPACING.md,
  },
  adminAvatarText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  profileLoading: {
    marginVertical: SPACING.sm,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  adminEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  adminId: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '10',
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  logoutText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.error,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  // Language modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  languageOptions: {
    gap: SPACING.sm,
  },
  languageButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  languageButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  languageButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  languageButtonTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  modalClose: {
    alignSelf: 'flex-end',
    marginTop: SPACING.md,
  },
  modalCloseText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
});

export default AdminSettingsScreen;








