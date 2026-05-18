import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useAppStore } from '../../store';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/authService';
import { captureTestEvent, captureException } from '../../utils/sentry';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user, language, setLanguage, logout } = useAppStore();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [autoLoginEnabled, setAutoLoginEnabled] = useState(true);

  const handleLogout = () => {
    console.log('SettingsScreen: Logout pressed');
    Alert.alert(
      t('settings.alerts.logoutTitle'),
      t('settings.alerts.logoutBody'),
      [
        {
          text: t('settings.alerts.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.alerts.logout'),
          style: 'destructive',
          onPress: async () => {
            console.log('SettingsScreen: Logout confirmed');
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
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.alerts.deleteTitle'),
      t('settings.alerts.deleteBody'),
      [
        {
          text: t('settings.alerts.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.alerts.delete'),
          style: 'destructive',
          onPress: () => {
            // Handle account deletion
            Alert.alert(t('settings.alerts.deletedTitle'), t('settings.alerts.deletedBody'));
          },
        },
      ]
    );
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon as any} size={20} color={COLORS.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (onPress && (
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      ))}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header 
        title={t('settings.title')} 
        showBack={true}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.account')}</Text>
          <View style={styles.settingsCard}>
            {renderSettingItem(
              'person-outline',
              t('settings.items.personalInformation.title'),
              t('settings.items.personalInformation.subtitle'),
              () => {}
            )}
            {renderSettingItem(
              'location-outline',
              t('settings.items.addresses.title'),
              t('settings.items.addresses.subtitle'),
              () => {}
            )}
            {renderSettingItem(
              'card-outline',
              t('settings.items.paymentMethods.title'),
              t('settings.items.paymentMethods.subtitle'),
              () => {}
            )}
            {renderSettingItem(
              'shield-outline',
              t('settings.items.privacySecurity.title'),
              t('settings.items.privacySecurity.subtitle'),
              () => {}
            )}
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.app')}</Text>
          <View style={styles.settingsCard}>
            {renderSettingItem(
              'notifications-outline',
              t('settings.items.notifications.title'),
              t('settings.items.notifications.subtitle'),
              undefined,
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            )}
            {renderSettingItem(
              'location-outline',
              t('settings.items.location.title'),
              t('settings.items.location.subtitle'),
              undefined,
              <Switch
                value={locationEnabled}
                onValueChange={setLocationEnabled}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            )}
            {/* Dark Mode removed as requested */}
            {renderSettingItem(
              'language-outline',
              t('settings.items.language.title'),
              t('settings.items.language.subtitle'),
              () => setLanguage(language === 'en' ? 'ar' : 'en'),
              <View style={styles.languageIndicator}>
                <Text style={styles.languageText}>{language.toUpperCase()}</Text>
              </View>
            )}
            {renderSettingItem(
              'key-outline',
              t('settings.items.autoLogin.title'),
              t('settings.items.autoLogin.subtitle'),
              undefined,
              <Switch
                value={autoLoginEnabled}
                onValueChange={setAutoLoginEnabled}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            )}
          </View>
        </View>

        {/* Support & About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.support')}</Text>
          <View style={styles.settingsCard}>
            {renderSettingItem(
              'help-circle-outline',
              t('settings.items.helpSupport.title'),
              t('settings.items.helpSupport.subtitle'),
              () => navigation.navigate('HelpCenter')
            )}
            {renderSettingItem(
              'document-text-outline',
              t('settings.items.terms.title'),
              t('settings.items.terms.subtitle'),
              () => navigation.navigate('AppInfoContent', { pageKey: 'terms_conditions' })
            )}
            {renderSettingItem(
              'shield-checkmark-outline',
              t('settings.items.privacyPolicy.title'),
              t('settings.items.privacyPolicy.subtitle'),
              () => navigation.navigate('AppInfoContent', { pageKey: 'privacy_policy' })
            )}
            {renderSettingItem(
              'information-circle-outline',
              t('settings.items.aboutApp.title'),
              t('settings.items.aboutApp.subtitle'),
              () => navigation.navigate('AppInfoContent', { pageKey: 'who_we_are' })
            )}
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sections.actions')}</Text>
          <View style={styles.settingsCard}>
            {renderSettingItem(
              'log-out-outline',
              t('settings.items.logout.title'),
              t('settings.items.logout.subtitle'),
              handleLogout
            )}
            {renderSettingItem(
              'trash-outline',
              t('settings.items.deleteAccount.title'),
              t('settings.items.deleteAccount.subtitle'),
              handleDeleteAccount
            )}
          </View>
        </View>

        {/* Developer: Generate errors to view in Sentry (staging/production builds only) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <View style={styles.settingsCard}>
            {renderSettingItem(
              'bug-outline',
              'Send test error to Sentry',
              __DEV__ ? 'Only in staging/production builds' : 'Sends a test error to Sentry',
              () => {
                const sent = captureTestEvent();
                Alert.alert(
                  sent ? 'Test error sent' : 'Not sent',
                  sent
                    ? 'Check Sentry → Issues for "Tandil Sentry test event".'
                    : 'Sentry only runs in staging/production builds. Use EAS build to test.'
                );
              }
            )}
            {renderSettingItem(
              'warning-outline',
              'Send another test error (with context)',
              __DEV__ ? 'Only in staging/production builds' : 'Sends error with extra context to Sentry',
              () => {
                if (__DEV__) {
                  Alert.alert('Not sent', 'Sentry only runs in staging/production builds.');
                  return;
                }
                captureException(new Error('Sentry test: intentional error with context'), {
                  tags: { source: 'settings', type: 'manual_test' },
                  extra: { screen: 'Settings', timestamp: new Date().toISOString() },
                });
                Alert.alert('Error sent', 'Check Sentry → Issues for "intentional error with context".');
              }
            )}
            {renderSettingItem(
              'alert-circle-outline',
              'Throw unhandled error',
              __DEV__ ? 'Only in staging/production builds' : 'Throws an error so Sentry logs it as unhandled',
              () => {
                if (__DEV__) {
                  Alert.alert('Skipped', 'Use a staging/production build to test unhandled errors in Sentry.');
                  return;
                }
                Alert.alert(
                  'Throw error?',
                  'This will send an unhandled error to Sentry and may show the app error screen.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Throw',
                      style: 'destructive',
                      onPress: () => {
                        setTimeout(() => {
                          throw new Error('Sentry test: intentional unhandled error from Settings');
                        }, 100);
                      },
                    },
                  ]
                );
              }
            )}
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
  placeholder: {
    width: 40,
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
  settingsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
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
  },
  settingSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  themeIndicator: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  themeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  languageIndicator: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  languageText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
});

export default SettingsScreen;
