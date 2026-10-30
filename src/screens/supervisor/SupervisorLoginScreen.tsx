import React, { useState } from 'react';
import { Alert, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { StaffLoginShell } from '../../components/auth/StaffLoginShell';
import { authService } from '../../services/authService';
import { navigateToForgotPassword } from '../../utils/navigateForgotPassword';
import { useAppStore } from '../../store';

function goToRoleSelection(navigation: any) {
  let rootNavigator = navigation;
  while (rootNavigator.getParent()) {
    rootNavigator = rootNavigator.getParent();
  }
  rootNavigator.reset({
    index: 0,
    routes: [{ name: 'RoleSelection' }],
  });
}

const SupervisorLoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { setUser, setAuthenticated } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('admin.supervisorLogin.errorEnterCredentials'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        email: email.trim(),
        password,
        roles: 'supervisor',
      });

      const userRole =
        response.data?.role ||
        response.data?.user?.role ||
        response.data?.user?.roles?.[0]?.name;
      if (userRole !== 'supervisor') {
        Alert.alert(
          t('admin.supervisorLogin.accessDenied'),
          t('admin.supervisorLogin.accessDeniedMessage')
        );
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
        err.response?.data?.message || err.message || t('admin.supervisorLogin.loginFailed');
      setError(errorMessage);
      Alert.alert(t('admin.supervisorLogin.loginError'), errorMessage, [
        { text: t('common.ok') },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StaffLoginShell
      icon="people"
      accent="#3D6B4F"
      badge={t('admin.supervisorLogin.badge')}
      title={t('admin.supervisorLogin.title')}
      subtitle={t('admin.supervisorLogin.subtitle')}
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
      onBack={() => goToRoleSelection(navigation)}
      isLoading={isLoading}
      error={error}
      emailLabel={t('admin.supervisorLogin.email')}
      emailPlaceholder={t('admin.supervisorLogin.emailPlaceholder')}
      passwordLabel={t('admin.supervisorLogin.password')}
      passwordPlaceholder={t('admin.supervisorLogin.passwordPlaceholder')}
      forgotPasswordLabel={t('admin.supervisorLogin.forgotPassword')}
      onForgotPassword={() => navigateToForgotPassword(navigation, 'supervisor')}
      signInLabel={t('admin.supervisorLogin.signIn')}
      signingInLabel={t('admin.supervisorLogin.signingIn')}
      backLabel={t('admin.supervisorLogin.backToRoles')}
      infoText={t('admin.supervisorLogin.infoText')}
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('supervisorSignup.noAccount')}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SupervisorSignup')}>
            <Text style={styles.signUpText}>{t('supervisorSignup.register')}</Text>
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
    flexWrap: 'wrap',
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

export default SupervisorLoginScreen;
