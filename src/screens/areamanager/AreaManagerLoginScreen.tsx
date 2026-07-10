import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { StaffLoginShell } from '../../components/auth/StaffLoginShell';
import { authService } from '../../services/authService';
import { useAppStore } from '../../store';

function goToRoleSelection(navigation: any) {
  let rootNavigator = navigation;
  while (rootNavigator.getParent()) {
    rootNavigator = rootNavigator.getParent();
  }
  rootNavigator.navigate('RoleSelection');
}

const AreaManagerLoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { setUser, setAuthenticated } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('admin.areaManagerLogin.errorEnterCredentials'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        email: email.trim(),
        password,
        roles: 'area_manager',
      });

      const userRole =
        response.data?.role ||
        response.data?.user?.role ||
        response.data?.user?.roles?.[0]?.name;
      if (userRole !== 'area_manager') {
        Alert.alert(
          t('admin.areaManagerLogin.accessDenied'),
          t('admin.areaManagerLogin.accessDeniedMessage')
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
        err.response?.data?.message || err.message || t('admin.areaManagerLogin.loginFailed');
      setError(errorMessage);
      Alert.alert(t('admin.areaManagerLogin.loginError'), errorMessage, [
        { text: t('common.ok') },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StaffLoginShell
      icon="map"
      accent="#5B7C5A"
      badge="Area Manager"
      title={t('admin.areaManagerLogin.title')}
      subtitle={t('admin.areaManagerLogin.subtitle')}
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
      emailLabel={t('admin.areaManagerLogin.email')}
      emailPlaceholder={t('admin.areaManagerLogin.emailPlaceholder')}
      passwordLabel={t('admin.areaManagerLogin.password')}
      passwordPlaceholder={t('admin.areaManagerLogin.passwordPlaceholder')}
      forgotPasswordLabel={t('admin.areaManagerLogin.forgotPassword')}
      onForgotPassword={() => {}}
      signInLabel={t('admin.areaManagerLogin.signIn')}
      signingInLabel={t('admin.areaManagerLogin.signingIn')}
      backLabel={t('admin.areaManagerLogin.backToRoles')}
      infoText={t('admin.areaManagerLogin.infoText')}
    />
  );
};

export default AreaManagerLoginScreen;
