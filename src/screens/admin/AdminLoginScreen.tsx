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

const AdminLoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { setUser, setAuthenticated } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('admin.users.error'), t('admin.login.errorEnterCredentials'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        email: email.trim(),
        password,
        roles: 'admin',
      });

      const userRole =
        response.data?.role ||
        response.data?.user?.role ||
        response.data?.user?.roles?.[0]?.name;

      if (userRole !== 'admin') {
        Alert.alert('Access Denied', 'This account is not authorized for admin access.');
        return;
      }

      const appUser = await authService.getStoredUser();
      if (appUser) {
        setUser(appUser);
        setAuthenticated(true);
        navigation.replace('Main');
      } else {
        throw new Error('Failed to retrieve user data after login');
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        t('admin.login.loginFailed');
      setError(errorMessage);
      Alert.alert(t('admin.login.loginError'), errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StaffLoginShell
      icon="shield-checkmark"
      accent="#1A3A24"
      badge="Admin Portal"
      title={t('admin.login.title')}
      subtitle={t('admin.login.subtitle')}
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
      emailLabel={t('admin.login.email')}
      emailPlaceholder={t('admin.login.emailPlaceholder')}
      passwordLabel={t('admin.login.password')}
      passwordPlaceholder={t('admin.login.passwordPlaceholder')}
      forgotPasswordLabel={t('admin.login.forgotPassword')}
      onForgotPassword={() => {}}
      signInLabel={t('admin.login.signIn')}
      signingInLabel={t('admin.login.signingIn')}
      backLabel={t('admin.login.backToRoles')}
      infoText={t('admin.login.infoText')}
    />
  );
};

export default AdminLoginScreen;
