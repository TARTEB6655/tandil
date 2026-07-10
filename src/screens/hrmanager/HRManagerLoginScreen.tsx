import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { StaffLoginShell } from '../../components/auth/StaffLoginShell';
import { authService } from '../../services/authService';
import { useAppStore } from '../../store';
import { COLORS } from '../../constants';

function goToRoleSelection(navigation: any) {
  let rootNavigator = navigation;
  while (rootNavigator.getParent()) {
    rootNavigator = rootNavigator.getParent();
  }
  rootNavigator.navigate('RoleSelection');
}

const HRManagerLoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { setUser, setAuthenticated } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('admin.hrManagerLogin.errorEnterCredentials'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        email: email.trim(),
        password,
        roles: 'hr',
      });

      const userRole =
        response.data?.role ||
        response.data?.user?.role ||
        response.data?.user?.roles?.[0]?.name;
      if (userRole !== 'hr') {
        Alert.alert(
          t('admin.hrManagerLogin.accessDenied'),
          t('admin.hrManagerLogin.accessDeniedMessage')
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
        err.response?.data?.message || err.message || t('admin.hrManagerLogin.loginFailed');
      setError(errorMessage);
      Alert.alert(t('admin.hrManagerLogin.loginError'), errorMessage, [
        { text: t('common.ok') },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StaffLoginShell
      icon="briefcase"
      accent={COLORS.secondary}
      badge="HR Manager"
      title={t('admin.hrManagerLogin.title')}
      subtitle={t('admin.hrManagerLogin.subtitle')}
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
      emailLabel={t('admin.hrManagerLogin.email')}
      emailPlaceholder={t('admin.hrManagerLogin.emailPlaceholder')}
      passwordLabel={t('admin.hrManagerLogin.password')}
      passwordPlaceholder={t('admin.hrManagerLogin.passwordPlaceholder')}
      forgotPasswordLabel={t('admin.hrManagerLogin.forgotPassword')}
      onForgotPassword={() => {}}
      signInLabel={t('admin.hrManagerLogin.signIn')}
      signingInLabel={t('admin.hrManagerLogin.signingIn')}
      backLabel={t('admin.hrManagerLogin.backToRoles')}
      infoText={t('admin.hrManagerLogin.infoText')}
    />
  );
};

export default HRManagerLoginScreen;
