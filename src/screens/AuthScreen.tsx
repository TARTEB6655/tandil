import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../constants';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';
import { authService, LoginResponse } from '../services/authService';
import ClientSocialLogin from '../components/auth/ClientSocialLogin';
import { navigateToGuestUserApp } from '../navigation/clientAuthNavigation';

const AuthScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { setUser, setAuthenticated } = useAppStore();
  const { t } = useTranslation();

  const selectedRole = route.params?.role || 'client';

  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishClientSession = useCallback(
    async (response: LoginResponse) => {
      const effectiveRole =
        response.data?.role ||
        response.data?.user?.role ||
        response.data?.user?.roles?.[0]?.name;
      if (effectiveRole && effectiveRole !== 'client') {
        await authService.clearLocalSession();
        const msg = t('auth.wrongPortalClient');
        setError(msg);
        Alert.alert(t('auth.login'), msg);
        return;
      }
      const appUser = await authService.getStoredUser();
      if (appUser) {
        setUser(appUser);
        setAuthenticated(true);
        navigation.reset({
          index: 0,
          routes: [{ name: 'UserApp' }],
        });
      }
    },
    [navigation, setAuthenticated, setUser, t]
  );

  const validateForm = (): boolean => {
    setError(null);

    if (!email.trim()) {
      setError(t('auth.errorEmailRequired', 'Email is required'));
      return false;
    }

    if (!password.trim()) {
      setError(t('auth.errorPasswordRequired', 'Password is required'));
      return false;
    }

    if (!isLogin) {
      if (!name.trim()) {
        setError(t('auth.errorNameRequired', 'Name is required'));
        return false;
      }
      if (!phone.trim()) {
        setError(t('auth.errorPhoneRequired', 'Phone number is required'));
        return false;
      }
      if (password !== confirmPassword) {
        setError(t('auth.errorPasswordMismatch', 'Passwords do not match'));
        return false;
      }
      if (password.length < 6) {
        setError(t('auth.errorPasswordShort', 'Password must be at least 6 characters'));
        return false;
      }
    }

    return true;
  };

  const handleAuth = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const response = await authService.login({
          email: email.trim(),
          password: password,
          roles: 'client',
        });
        await finishClientSession(response);
      } else {
        const response = await authService.register({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password: password,
          password_confirmation: confirmPassword,
          role: selectedRole,
        });

        const regRole =
          response.data?.role ||
          response.data?.user?.role ||
          response.data?.user?.roles?.[0]?.name;
        if (regRole && regRole !== 'client') {
          await authService.clearLocalSession();
          const msg = t('auth.wrongPortalClient');
          setError(msg);
          Alert.alert(t('auth.login'), msg);
          setLoading(false);
          return;
        }

        const appUser = await authService.getStoredUser();
        if (appUser) {
          setUser(appUser);
          setAuthenticated(true);
          navigation.navigate('UserApp');
        }
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        (isLogin
          ? t('auth.loginFailed', 'Login failed. Please try again.')
          : t('auth.signupFailed', 'Registration failed. Please try again.'));
      setError(errorMessage);
      Alert.alert(
        isLogin ? t('auth.loginError', 'Login Error') : t('auth.signupError', 'Registration Error'),
        errorMessage,
        [{ text: t('common.ok', 'OK') }]
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (login: boolean) => {
    setIsLogin(login);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surfaceLight} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'RoleSelection' }],
                })
              }
              accessibilityLabel={t('common.back', 'Back')}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
            </View>
            <Text style={styles.brandName}>Tandil</Text>
            <Text style={styles.heroSubtitle}>
              {isLogin ? t('auth.welcome') : t('auth.createAccount')}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segmentItem, isLogin && styles.segmentItemActive]}
                onPress={() => switchMode(true)}
                activeOpacity={0.9}
              >
                <Text style={[styles.segmentText, isLogin && styles.segmentTextActive]}>
                  {t('auth.login')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentItem, !isLogin && styles.segmentItemActive]}
                onPress={() => switchMode(false)}
                activeOpacity={0.9}
              >
                <Text style={[styles.segmentText, !isLogin && styles.segmentTextActive]}>
                  {t('auth.signup')}
                </Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {!isLogin ? (
              <Input
                label={t('auth.nameLabel')}
                placeholder={t('auth.namePlaceholder')}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError(null);
                }}
                leftIcon="person-outline"
              />
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

            {!isLogin ? (
              <Input
                label={t('auth.phoneLabel')}
                placeholder={t('auth.phonePlaceholder')}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setError(null);
                }}
                keyboardType="phone-pad"
                leftIcon="call-outline"
              />
            ) : null}

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

            {!isLogin ? (
              <Input
                label={t('auth.confirmPasswordLabel')}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setError(null);
                }}
                secureTextEntry
                leftIcon="lock-closed-outline"
              />
            ) : null}

            {!isLogin && selectedRole === 'client' ? (
              <View style={styles.walletTermsBlock}>
                <Text style={styles.walletTermsHeading}>
                  {t('wallet.termsHeading', 'Wallet terms')}
                </Text>
                <Text style={styles.walletTermsParagraph1}>{t('wallet.termsParagraph1')}</Text>
                <Text style={styles.walletTermsParagraph2}>{t('wallet.termsParagraph2')}</Text>
              </View>
            ) : null}

            <Button
              title={isLogin ? t('auth.login') : t('auth.signup')}
              onPress={handleAuth}
              loading={loading}
              size="medium"
              style={styles.authButton}
              textStyle={styles.authButtonText}
            />

            {selectedRole === 'client' ? (
              <TouchableOpacity
                style={styles.guestButton}
                onPress={() => navigateToGuestUserApp(navigation)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Ionicons name="storefront-outline" size={20} color={COLORS.primary} />
                <Text style={styles.guestButtonText}>
                  {t('auth.continueAsGuest', 'Continue without signing in')}
                </Text>
              </TouchableOpacity>
            ) : null}

            {selectedRole === 'client' ? (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>{t('auth.orContinueWith')}</Text>
                  <View style={styles.dividerLine} />
                </View>
                <ClientSocialLogin
                  disabled={loading}
                  onSuccess={finishClientSession}
                  onError={(msg) => {
                    setError(msg);
                    Alert.alert(isLogin ? t('auth.login') : t('auth.signup'), msg);
                  }}
                />
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  topBar: {
    paddingTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
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
  logoRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    borderWidth: 3,
    borderColor: COLORS.background,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  logoImage: {
    width: 88,
    height: 88,
    resizeMode: 'contain',
  },
  brandName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  segmentItemActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.background,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#FFF5F5',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  walletTermsBlock: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  walletTermsHeading: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  walletTermsParagraph1: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  walletTermsParagraph2: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  authButton: {
    marginTop: SPACING.sm,
    minHeight: 44,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
  },
  authButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  guestButton: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 44,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceLight,
  },
  guestButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerLabel: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

export default AuthScreen;
