import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS, BORDER_RADIUS } from '../../constants';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  showCart?: boolean;
  showNotifications?: boolean;
  notificationCount?: number;
  showLanguage?: boolean;
  onBackPress?: () => void;
  onCartPress?: () => void;
  onNotificationPress?: () => void;
  rightComponent?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBack = true,
  showCart = false,
  showNotifications = false,
  notificationCount = 0,
  showLanguage = true,
  onBackPress,
  onCartPress,
  onNotificationPress,
  rightComponent,
}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  const handleCartPress = () => {
    if (onCartPress) {
      onCartPress();
    } else {
      navigation.navigate('Cart');
    }
  };

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      navigation.navigate('Notifications');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={COLORS.background}
        translucent={true}
      />
      <View style={styles.header}>
        <View style={styles.leftSection}>
          {showBack && (
            <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        
        <View style={styles.rightSection}>
          {rightComponent}
          {showLanguage && (
            <TouchableOpacity style={styles.iconButton} onPress={() => setLanguageModalVisible(true)}>
              <Ionicons name="globe-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>
          )}
          {showNotifications && (
            <TouchableOpacity style={[styles.iconButton, styles.notificationIconWrap]} onPress={handleNotificationPress}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
              {notificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText} numberOfLines={1}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
          {showCart && (
            <TouchableOpacity style={styles.iconButton} onPress={handleCartPress}>
              <Ionicons name="cart-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Language Selector Modal */}
      <Modal visible={languageModalVisible} transparent animationType="fade" onRequestClose={() => setLanguageModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('common.language')}</Text>
            <View style={styles.languageOptions}>
              {[
                { code: 'en', label: 'English' },
                { code: 'ar', label: 'العربية' },
                { code: 'ur', label: 'اردو' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageButton,
                    i18n.language === lang.code && styles.languageButtonActive,
                  ]}
                  onPress={async () => {
                    await setAppLanguage(lang.code as 'en' | 'ar' | 'ur');
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
            <TouchableOpacity style={styles.modalClose} onPress={() => setLanguageModalVisible(false)}>
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
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    minHeight: 60,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  notificationIconWrap: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
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

export default Header;
