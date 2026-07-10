import React, { useState } from 'react';
import { Alert, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { StaffLoginShell } from '../../components/auth/StaffLoginShell';
import { authService } from '../../services/authService';
import { useAppStore } from '../../store';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS } from '../../constants';

const TechnicianLoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { setUser, setAuthenticated } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        t('booking.missingTitle', { defaultValue: 'Missing Information' }),
        t('booking.missingBody', { defaultValue: 'Please fill in all fields' })
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        email: email.trim(),
        password,
        roles: 'technician',
      });

      const userRole =
        response.data?.role ||
        response.data?.user?.role ||
        response.data?.user?.roles?.[0]?.name;
      if (userRole !== 'technician') {
        Alert.alert(t('technician.accessDenied'), t('technician.notTechnicianAccount'));
        return;
      }

      const appUser = await authService.getStoredUser();
      if (appUser) {
        setUser(appUser);
        setAuthenticated(true);
        navigation.replace('Main');
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || err.message || t('technician.loginFailed');
      setError(errorMessage);
      Alert.alert(t('technician.loginError'), errorMessage, [{ text: t('technician.ok') }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StaffLoginShell
      icon="leaf"
      accent="#2E7D4F"
      badge="Field Technician"
      title={t('technicianLogin.title', { defaultValue: 'Technician Portal' })}
      subtitle={t('technicianLogin.subtitle', { defaultValue: 'Sign in to access your dashboard' })}
      email={email}
      password={password}
      onEmailChange={(text) => {
        setEmail(text);
        setError(null);
      }}
      onPasswordChange={(text) => {
        setPassword(text);
        setError(null);
      }}
      onSubmit={handleLogin}
      onBack={() => navigation.navigate('RoleSelection')}
      isLoading={isLoading}
      error={error}
      emailLabel={t('auth.emailLabel')}
      emailPlaceholder={t('auth.emailPlaceholder')}
      passwordLabel={t('auth.passwordLabel')}
      passwordPlaceholder={t('auth.passwordPlaceholder')}
      forgotPasswordLabel={t('auth.forgotPassword')}
      onForgotPassword={() => Alert.alert(t('auth.forgotPassword'), t('auth.emailPlaceholder'))}
      signInLabel={t('auth.login', { defaultValue: 'Sign In' })}
      signingInLabel={t('auth.login', { defaultValue: 'Signing In...' })}
      backLabel={t('splash.skip', { defaultValue: 'Back to roles' })}
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.dontHaveAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TechnicianSignup')}>
            <Text style={styles.signUpText}>{t('auth.signup', { defaultValue: 'Sign Up' })}</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  signUpText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginLeft: SPACING.xs,
  },
});

export default TechnicianLoginScreen;
