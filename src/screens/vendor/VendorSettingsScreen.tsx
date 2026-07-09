import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useAppStore } from '../../store';
import { authService } from '../../services/authService';
import {
  VendorPageHeader,
  VendorCard,
  VENDOR_SCREEN_BG,
} from '../../components/vendor/VendorUi';

const VendorSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: false,
    pushNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
    autoSync: true,
    darkMode: false,
    language: 'English',
    currency: 'AED',
    timezone: 'Asia/Dubai',
  });

  const handleSettingToggle = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSettingAction = (action: string) => {
    switch (action) {
      case 'account':
        Alert.alert('Account Settings', 'Account management feature coming soon!');
        break;
      case 'security':
        Alert.alert('Security Settings', 'Security features coming soon!');
        break;
      case 'privacy':
        Alert.alert('Privacy Settings', 'Privacy controls coming soon!');
        break;
      case 'language':
        Alert.alert('Language Selection', 'Language selection feature coming soon!');
        break;
      case 'currency':
        Alert.alert('Currency Settings', 'Currency selection feature coming soon!');
        break;
      case 'timezone':
        Alert.alert('Timezone Settings', 'Timezone selection feature coming soon!');
        break;
      case 'backup':
        Alert.alert('Backup & Restore', 'Backup feature coming soon!');
        break;
      case 'export':
        Alert.alert('Export Data', 'Data export feature coming soon!');
        break;
      case 'clearCache':
        Alert.alert('Clear Cache', 'Cache cleared successfully!');
        break;
      case 'about':
        Alert.alert('About Tandil Vendor', 'Tandil Vendor App v1.0.0\n\nManage your agricultural products, orders, and store on the Tandil marketplace.');
        break;
      case 'terms':
        Alert.alert('Terms of Service', 'Terms of service document coming soon!');
        break;
      case 'privacyPolicy':
        Alert.alert('Privacy Policy', 'Privacy policy document coming soon!');
        break;
      case 'help':
        Alert.alert('Help & Support', 'Help center and support features coming soon!');
        break;
      case 'feedback':
        Alert.alert('Send Feedback', 'Feedback submission feature coming soon!');
        break;
      case 'rateApp':
        Alert.alert('Rate App', 'App rating feature coming soon!');
        break;
    }
  };

  const renderSettingItem = (setting: any) => (
    <TouchableOpacity
      key={setting.id}
      style={styles.settingItem}
      onPress={() => handleSettingAction(setting.action)}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: setting.iconColor + '20' }]}>
          <Ionicons name={setting.icon as any} size={20} color={setting.iconColor} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{setting.title}</Text>
          <Text style={styles.settingSubtitle}>{setting.subtitle}</Text>
        </View>
      </View>
      
      {setting.type === 'toggle' ? (
        <Switch
          value={settings[setting.key as keyof typeof settings] as boolean}
          onValueChange={(value) => handleSettingToggle(setting.key, value)}
          trackColor={{ false: COLORS.border, true: setting.iconColor + '40' }}
          thumbColor={settings[setting.key as keyof typeof settings] ? setting.iconColor : COLORS.textSecondary}
        />
      ) : (
        <View style={styles.settingRight}>
          {setting.value && (
            <Text style={styles.settingValue}>{setting.value}</Text>
          )}
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderSettingSection = (section: any) => (
    <View key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.sectionContainer}>
        {section.items.map(renderSettingItem)}
      </View>
    </View>
  );

  const settingsSections = [
    {
      title: 'Notifications',
      items: [
        {
          id: 'notifications',
          title: 'Push Notifications',
          subtitle: 'Receive push notifications for orders and updates',
          type: 'toggle',
          key: 'pushNotifications',
          icon: 'notifications-outline',
          iconColor: COLORS.primary,
        },
        {
          id: 'emailNotifications',
          title: 'Email Notifications',
          subtitle: 'Receive email notifications for important updates',
          type: 'toggle',
          key: 'emailNotifications',
          icon: 'mail-outline',
          iconColor: COLORS.info,
        },
        {
          id: 'soundEnabled',
          title: 'Sound',
          subtitle: 'Play sound for notifications',
          type: 'toggle',
          key: 'soundEnabled',
          icon: 'volume-high-outline',
          iconColor: COLORS.warning,
        },
        {
          id: 'vibrationEnabled',
          title: 'Vibration',
          subtitle: 'Vibrate for notifications',
          type: 'toggle',
          key: 'vibrationEnabled',
          icon: 'phone-portrait-outline',
          iconColor: COLORS.success,
        },
      ]
    },
    {
      title: 'Preferences',
      items: [
        {
          id: 'autoSync',
          title: 'Auto Sync',
          subtitle: 'Automatically sync data in background',
          type: 'toggle',
          key: 'autoSync',
          icon: 'sync-outline',
          iconColor: COLORS.primary,
        },
        {
          id: 'darkMode',
          title: 'Dark Mode',
          subtitle: 'Use dark theme for the app',
          type: 'toggle',
          key: 'darkMode',
          icon: 'moon-outline',
          iconColor: COLORS.warning,
        },
        {
          id: 'language',
          title: 'Language',
          subtitle: 'Choose your preferred language',
          type: 'action',
          action: 'language',
          value: settings.language,
          icon: 'language-outline',
          iconColor: COLORS.info,
        },
        {
          id: 'currency',
          title: 'Currency',
          subtitle: 'Select your preferred currency',
          type: 'action',
          action: 'currency',
          value: settings.currency,
          icon: 'cash-outline',
          iconColor: COLORS.success,
        },
        {
          id: 'timezone',
          title: 'Timezone',
          subtitle: 'Set your local timezone',
          type: 'action',
          action: 'timezone',
          value: settings.timezone,
          icon: 'time-outline',
          iconColor: COLORS.warning,
        },
      ]
    },
    {
      title: 'Account & Security',
      items: [
        {
          id: 'account',
          title: 'Account Settings',
          subtitle: 'Manage your account information',
          type: 'action',
          action: 'account',
          icon: 'person-outline',
          iconColor: COLORS.primary,
        },
        {
          id: 'security',
          title: 'Security',
          subtitle: 'Password, 2FA, and security settings',
          type: 'action',
          action: 'security',
          icon: 'shield-outline',
          iconColor: COLORS.error,
        },
        {
          id: 'privacy',
          title: 'Privacy',
          subtitle: 'Control your privacy settings',
          type: 'action',
          action: 'privacy',
          icon: 'lock-closed-outline',
          iconColor: COLORS.warning,
        },
      ]
    },
    {
      title: 'Data & Storage',
      items: [
        {
          id: 'backup',
          title: 'Backup & Restore',
          subtitle: 'Backup your data to cloud',
          type: 'action',
          action: 'backup',
          icon: 'cloud-upload-outline',
          iconColor: COLORS.info,
        },
        {
          id: 'export',
          title: 'Export Data',
          subtitle: 'Export your data and reports',
          type: 'action',
          action: 'export',
          icon: 'download-outline',
          iconColor: COLORS.success,
        },
        {
          id: 'clearCache',
          title: 'Clear Cache',
          subtitle: 'Free up storage space',
          type: 'action',
          action: 'clearCache',
          icon: 'trash-outline',
          iconColor: COLORS.error,
        },
      ]
    },
    {
      title: 'Support & Legal',
      items: [
        {
          id: 'help',
          title: 'Help & Support',
          subtitle: 'Get help and contact support',
          type: 'action',
          action: 'help',
          icon: 'help-circle-outline',
          iconColor: COLORS.info,
        },
        {
          id: 'feedback',
          title: 'Send Feedback',
          subtitle: 'Share your thoughts with us',
          type: 'action',
          action: 'feedback',
          icon: 'chatbubble-outline',
          iconColor: COLORS.primary,
        },
        {
          id: 'rateApp',
          title: 'Rate App',
          subtitle: 'Rate us on the app store',
          type: 'action',
          action: 'rateApp',
          icon: 'star-outline',
          iconColor: COLORS.warning,
        },
        {
          id: 'about',
          title: 'About',
          subtitle: 'App version and information',
          type: 'action',
          action: 'about',
          icon: 'information-circle-outline',
          iconColor: COLORS.textSecondary,
        },
        {
          id: 'terms',
          title: 'Terms of Service',
          subtitle: 'Read our terms and conditions',
          type: 'action',
          action: 'terms',
          icon: 'document-text-outline',
          iconColor: COLORS.textSecondary,
        },
        {
          id: 'privacyPolicy',
          title: 'Privacy Policy',
          subtitle: 'Read our privacy policy',
          type: 'action',
          action: 'privacyPolicy',
          icon: 'shield-checkmark-outline',
          iconColor: COLORS.textSecondary,
        },
      ]
    },
  ];

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
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <VendorPageHeader
        title={t('vendorDashboard.settings')}
        subtitle={t('vendorDashboard.settingsHint')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <VendorCard style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <View style={styles.profileAvatar}>
              <Ionicons name="leaf" size={28} color={COLORS.primary} />
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{user?.name || 'Green Fields Agro Supplies'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'khalid@greenfields.ae'}</Text>
              <Text style={styles.profileTier}>Silver Partner · Tandil</Text>
            </View>
          </View>
        </VendorCard>

        {settingsSections.map((section) => (
          <VendorCard key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.settingItem}
                onPress={() => item.type !== 'toggle' && handleSettingAction(item.action)}
                activeOpacity={item.type === 'toggle' ? 1 : 0.85}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: item.iconColor + '18' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>{item.title}</Text>
                    <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
                {item.type === 'toggle' ? (
                  <Switch
                    value={settings[item.key as keyof typeof settings] as boolean}
                    onValueChange={(value) => handleSettingToggle(item.key, value)}
                    trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                    thumbColor={COLORS.primary}
                  />
                ) : (
                  <View style={styles.settingRight}>
                    {'value' in item && item.value ? (
                      <Text style={styles.settingValue}>{item.value}</Text>
                    ) : null}
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </VendorCard>
        ))}

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
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
  profileCard: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  profileEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  profileTier: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  sectionCard: {
    paddingHorizontal: 0,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  settingSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  settingValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
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
    gap: SPACING.sm,
  },
  logoutText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.error,
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

export default VendorSettingsScreen;
