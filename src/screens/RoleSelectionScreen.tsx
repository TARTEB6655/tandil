import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../constants';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';

type RoleKey =
  | 'user'
  | 'technician'
  | 'supervisor'
  | 'areaManager'
  | 'hrManager'
  | 'admin'
  | 'vendor';

type RoleCardConfig = {
  key: RoleKey;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  titleKey: string;
  descriptionKey: string;
};

const ROLES: RoleCardConfig[] = [
  {
    key: 'user',
    icon: 'person',
    accent: COLORS.primary,
    titleKey: 'roleSelection.client.title',
    descriptionKey: 'roleSelection.client.description',
  },
  {
    key: 'technician',
    icon: 'leaf',
    accent: '#2E7D4F',
    titleKey: 'roleSelection.worker.title',
    descriptionKey: 'roleSelection.worker.description',
  },
  {
    key: 'supervisor',
    icon: 'people',
    accent: '#3D6B4F',
    titleKey: 'roleSelection.supervisor.title',
    descriptionKey: 'roleSelection.supervisor.description',
  },
  {
    key: 'areaManager',
    icon: 'map',
    accent: '#5B7C5A',
    titleKey: 'roleSelection.areaManager.title',
    descriptionKey: 'roleSelection.areaManager.description',
  },
  {
    key: 'hrManager',
    icon: 'briefcase',
    accent: COLORS.secondary,
    titleKey: 'roleSelection.hrManager.title',
    descriptionKey: 'roleSelection.hrManager.description',
  },
  {
    key: 'admin',
    icon: 'shield-checkmark',
    accent: '#1A3A24',
    titleKey: 'roleSelection.admin.title',
    descriptionKey: 'roleSelection.admin.description',
  },
  {
    key: 'vendor',
    icon: 'storefront',
    accent: '#8B6914',
    titleKey: 'roleSelection.vendor.title',
    descriptionKey: 'roleSelection.vendor.description',
  },
];

const RoleSelectionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const handleRoleSelection = (role: RoleKey) => {
    if (isLoading) return;

    setSelectedRole(role);
    setIsLoading(true);

    setTimeout(() => {
      switch (role) {
        case 'user':
          navigation.replace('UserApp');
          break;
        case 'technician':
          navigation.replace('TechnicianApp');
          break;
        case 'supervisor':
          navigation.replace('SupervisorApp');
          break;
        case 'areaManager':
          navigation.replace('AreaManagerApp');
          break;
        case 'hrManager':
          navigation.replace('HRManagerApp');
          break;
        case 'admin':
          navigation.replace('AdminApp');
          break;
        case 'vendor':
          navigation.replace('VendorApp');
          break;
      }
    }, 120);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surfaceLight} />

      <View style={styles.bgDecorTop} />
      <View style={styles.bgDecorBottom} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topBar}>
          <View style={styles.welcomePill}>
            <Ionicons name="sparkles" size={14} color={COLORS.primary} />
            <Text style={styles.welcomePillText}>Welcome to Tandil</Text>
          </View>
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setLanguageModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="globe-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.logoGlow} />
          <View style={styles.logoCard}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
          </View>
          <Text style={styles.heroTitle}>{t('roleSelection.chooseRole')}</Text>
          <Text style={styles.heroSubtitle}>
            Select how you want to continue. You can switch roles anytime from logout.
          </Text>
        </View>

        <View style={styles.roleList}>
          {ROLES.map((role) => {
            const isActive = selectedRole === role.key && isLoading;
            return (
              <TouchableOpacity
                key={role.key}
                style={[styles.roleCard, isActive && styles.roleCardActive]}
                onPress={() => handleRoleSelection(role.key)}
                activeOpacity={0.9}
                disabled={isLoading}
              >
                <View style={[styles.roleAccent, { backgroundColor: role.accent }]} />
                <View style={[styles.roleIcon, { backgroundColor: role.accent + '18' }]}>
                  {isActive ? (
                    <ActivityIndicator size="small" color={role.accent} />
                  ) : (
                    <Ionicons name={role.icon} size={24} color={role.accent} />
                  )}
                </View>
                <View style={styles.roleContent}>
                  <Text style={styles.roleTitle}>{t(role.titleKey)}</Text>
                  <Text style={styles.roleDescription} numberOfLines={2}>
                    {t(role.descriptionKey)}
                  </Text>
                </View>
                <View style={[styles.chevronWrap, { backgroundColor: role.accent + '12' }]}>
                  <Ionicons name="chevron-forward" size={18} color={role.accent} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>{t('roleSelection.footer')}</Text>
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
              <Text style={styles.modalTitle}>{t('common.language', 'Language')}</Text>
            </View>
            <View style={styles.languageOptions}>
              {[
                { code: 'en', label: 'English', flag: 'EN' },
                { code: 'ar', label: 'العربية', flag: 'AR' },
                { code: 'ur', label: 'اردو', flag: 'UR' },
              ].map((lang) => {
                const active = i18n.language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.languageOption, active && styles.languageOptionActive]}
                    onPress={async () => {
                      await setAppLanguage(lang.code as 'en' | 'ar' | 'ur');
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
              <Text style={styles.modalCloseText}>{t('common.cancel', 'Cancel')}</Text>
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
    backgroundColor: COLORS.surfaceLight,
  },
  bgDecorTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.primary + '10',
  },
  bgDecorBottom: {
    position: 'absolute',
    bottom: 40,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.secondary + '0C',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  welcomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
  },
  welcomePillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  languageButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoGlow: {
    position: 'absolute',
    top: 10,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primary + '14',
  },
  logoCard: {
    width: 118,
    height: 118,
    borderRadius: 28,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  logoImage: {
    width: 96,
    height: 96,
    resizeMode: 'contain',
  },
  heroTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  roleList: {
    gap: SPACING.sm,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingRight: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  roleCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  roleAccent: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: SPACING.md,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  roleIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  roleContent: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  roleTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: 3,
  },
  roleDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingTop: SPACING.xl,
    alignItems: 'center',
  },
  footerDivider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary + '30',
    marginBottom: SPACING.md,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 37, 19, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '86%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
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
    backgroundColor: COLORS.surfaceLight,
  },
  languageOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  langBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langBadgeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  langBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textSecondary,
  },
  langBadgeTextActive: {
    color: '#fff',
  },
  languageOptionText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  languageOptionTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  modalClose: {
    alignSelf: 'center',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  modalCloseText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default RoleSelectionScreen;
