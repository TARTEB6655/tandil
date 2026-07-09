import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../constants';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';

const { width, height } = Dimensions.get('window');

const RoleSelectionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  console.log('RoleSelectionScreen: Rendering...');

  useEffect(() => {
    console.log('RoleSelectionScreen: Component mounted successfully');
  }, []);

  const handleRoleSelection = (role: 'user' | 'technician' | 'supervisor' | 'areaManager' | 'hrManager' | 'admin' | 'vendor') => {
    if (isLoading) return; // Prevent multiple taps
    
    console.log('RoleSelectionScreen: Selected role:', role);
    console.log('RoleSelectionScreen: Current navigation state:', navigation.getState());
    setIsLoading(true);
    
    // Add a small delay to prevent accidental taps
    setTimeout(() => {
      switch (role) {
        case 'user':
          console.log('RoleSelectionScreen: Navigating to UserApp (guest browse)...');
          navigation.replace('UserApp');
          break;
        case 'technician':
          console.log('RoleSelectionScreen: Navigating to TechnicianApp (Field Worker)...');
          navigation.replace('TechnicianApp');
          break;
        case 'supervisor':
          console.log('RoleSelectionScreen: Navigating to Supervisor Panel...');
          navigation.replace('SupervisorApp');
          break;
        case 'areaManager':
          console.log('RoleSelectionScreen: Navigating to Area Manager Panel...');
          navigation.replace('AreaManagerApp');
          break;
        case 'hrManager':
          console.log('RoleSelectionScreen: Navigating to HR Manager Panel...');
          navigation.replace('HRManagerApp');
          break;
        case 'admin':
          console.log('RoleSelectionScreen: Navigating to Admin Panel...');
          navigation.replace('AdminApp');
          break;
        case 'vendor':
          console.log('RoleSelectionScreen: Navigating to Vendor Panel...');
          navigation.replace('VendorApp');
          break;
      }
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => setLanguageModalVisible(true)}
            >
              <Ionicons name="globe-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
          </View>
      
          <Text style={styles.subtitle}>{t('roleSelection.chooseRole')}</Text>
          <Text style={styles.statusText}>
            {isLoading ? t('roleSelection.loading') : t('roleSelection.active')}
          </Text>
        </View>

        {/* Role Selection Cards */}
        <View style={styles.roleContainer}>
        {/* Client/Customer Panel */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleRoleSelection('user')}
        >
          <View style={styles.roleIcon}>
            <Ionicons name="person-outline" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.roleContent}>
            <Text style={styles.roleTitle}>{t('roleSelection.client.title')}</Text>
            <Text style={styles.roleDescription}>{t('roleSelection.client.description')}</Text>
          </View>
        </TouchableOpacity>

        {/* Worker/Field Technician Panel */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleRoleSelection('technician')}
        >
          <View style={styles.roleIcon}>
            <Ionicons name="leaf-outline" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.roleContent}>
            <Text style={styles.roleTitle}>{t('roleSelection.worker.title')}</Text>
            <Text style={styles.roleDescription}>{t('roleSelection.worker.description')}</Text>
          </View>
        </TouchableOpacity>

        {/* Supervisor/Team Leader Panel */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleRoleSelection('supervisor')}
        >
          <View style={styles.roleIcon}>
            <Ionicons name="people-outline" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.roleContent}>
            <Text style={styles.roleTitle}>{t('roleSelection.supervisor.title')}</Text>
            <Text style={styles.roleDescription}>{t('roleSelection.supervisor.description')}</Text>
          </View>
        </TouchableOpacity>

        {/* Area Manager Panel */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleRoleSelection('areaManager')}
        >
          <View style={styles.roleIcon}>
            <Ionicons name="map-outline" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.roleContent}>
            <Text style={styles.roleTitle}>{t('roleSelection.areaManager.title')}</Text>
            <Text style={styles.roleDescription}>{t('roleSelection.areaManager.description')}</Text>
          </View>
        </TouchableOpacity>

        {/* HR Manager Panel */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleRoleSelection('hrManager')}
        >
          <View style={styles.roleIcon}>
            <Ionicons name="briefcase-outline" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.roleContent}>
            <Text style={styles.roleTitle}>{t('roleSelection.hrManager.title')}</Text>
            <Text style={styles.roleDescription}>{t('roleSelection.hrManager.description')}</Text>
          </View>
        </TouchableOpacity>

        {/* Admin Panel */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleRoleSelection('admin')}
        >
          <View style={styles.roleIcon}>
            <Ionicons name="shield-checkmark-outline" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.roleContent}>
            <Text style={styles.roleTitle}>{t('roleSelection.admin.title')}</Text>
            <Text style={styles.roleDescription}>{t('roleSelection.admin.description')}</Text>
          </View>
        </TouchableOpacity>

        {/* Vendor Panel */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => handleRoleSelection('vendor')}
        >
          <View style={styles.roleIcon}>
            <Ionicons name="storefront-outline" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.roleContent}>
            <Text style={styles.roleTitle}>{t('roleSelection.vendor.title')}</Text>
            <Text style={styles.roleDescription}>{t('roleSelection.vendor.description')}</Text>
          </View>
        </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
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
            <Text style={styles.modalTitle}>{t('common.language', 'Language')}</Text>
            <View style={styles.languageOptions}>
              {[
                { code: 'en', label: 'English' },
                { code: 'ar', label: 'العربية' },
                { code: 'ur', label: 'اردو' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    i18n.language === lang.code && styles.languageOptionActive,
                  ]}
                  onPress={async () => {
                    await setAppLanguage(lang.code as 'en' | 'ar' | 'ur');
                    setLanguageModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      i18n.language === lang.code && styles.languageOptionTextActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setLanguageModalVisible(false)}>
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
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  headerTopRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: SPACING.sm,
  },
  languageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 150,
    height: 150,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  logoImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  roleContainer: {
    gap: SPACING.md,
  },
  roleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  roleIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  roleDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  languageOptions: {
    gap: SPACING.sm,
  },
  languageOption: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  languageOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  languageOptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  languageOptionTextActive: {
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

export default RoleSelectionScreen; 