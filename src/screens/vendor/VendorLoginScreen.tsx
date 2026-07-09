import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { authService } from '../../services/authService';
import { useAppStore } from '../../store';
import { roleMatchesPortal } from '../../utils/sessionRestore';

const VendorLoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { setUser, setAuthenticated } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('vendorLogin.fillAllFields'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        email: email.trim(),
        password,
        roles: 'vendor',
      });

      const userRole =
        response.data?.role ||
        response.data?.user?.role ||
        response.data?.user?.roles?.[0]?.name;

      if (!roleMatchesPortal(userRole, 'vendor')) {
        await authService.clearLocalSession();
        Alert.alert(t('vendorLogin.accessDenied'), t('vendorLogin.notVendorAccount'));
        return;
      }

      const appUser = await authService.getStoredUser();
      if (appUser) {
        setUser(appUser);
        setAuthenticated(true);
        navigation.replace('Main');
        return;
      }

      throw new Error('Failed to retrieve user data after login');
    } catch (err: unknown) {
      console.error('Vendor login error:', err);
      const axiosErr = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const errorMessage =
        axiosErr.response?.data?.message ||
        axiosErr.response?.data?.error ||
        axiosErr.message ||
        t('vendorLogin.loginFailed');

      setError(errorMessage);
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    const root = navigation.getParent();
    if (root?.canGoBack?.()) {
      root.goBack();
      return;
    }
    root?.navigate?.('RoleSelection');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('vendorLogin.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <View style={styles.logoContainer}>
                <Ionicons name="storefront" size={40} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.heroTitle}>{t('vendorLogin.welcome')}</Text>
            <Text style={styles.subtitle}>{t('vendorLogin.subtitle')}</Text>
          </View>

          <View style={styles.formCard}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label={t('auth.emailLabel')}
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
            />

            <Input
              label={t('auth.passwordLabel')}
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              secureTextEntry
              leftIcon="lock-closed-outline"
            />

            <Button title={t('auth.login')} onPress={handleLogin} loading={isLoading} />

            <TouchableOpacity
              style={styles.signupLink}
              onPress={() => navigation.navigate('VendorSignup')}
            >
              <Text style={styles.signupText}>
                {t('vendorLogin.noAccount')}{' '}
                <Text style={styles.signupTextBold}>{t('vendorSignup.title')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surfaceLight },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  content: { flexGrow: 1, padding: SPACING.lg, paddingBottom: SPACING.xxl },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingTop: SPACING.md,
  },
  logoRing: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primary + '18',
    marginBottom: SPACING.md,
  },
  logoContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  formCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  errorContainer: {
    backgroundColor: COLORS.error + '15',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  errorText: { color: COLORS.error, fontSize: FONT_SIZES.sm },
  signupLink: { alignItems: 'center', marginTop: SPACING.xs },
  signupText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  signupTextBold: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
});

export default VendorLoginScreen;
