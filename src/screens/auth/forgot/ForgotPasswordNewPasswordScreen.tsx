import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ForgotPasswordShell } from '../../../components/auth/ForgotPasswordShell';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { COLORS, SPACING, FONT_SIZES } from '../../../constants';
import { forgotPasswordService } from '../../../services/forgotPasswordService';
import { FORGOT_PASSWORD_MIN_PASSWORD_LENGTH } from '../../../services/forgotPasswordTypes';
import type { ForgotPasswordStackParamList } from '../../../navigation/ForgotPasswordNavigator';
import { getForgotPasswordRoleTheme } from '../../../utils/forgotPasswordRoleTheme';
import { FORGOT_PASSWORD_UI_PREVIEW } from '../../../config/forgotPassword';
import { exitForgotPasswordFlow, safeGoBack } from '../../../utils/safeNavigationBack';
import { useForgotPasswordPortalLabel } from '../../../hooks/useForgotPasswordPortalLabel';

const ForgotPasswordNewPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ForgotPasswordStackParamList, 'ForgotPasswordNewPassword'>>();
  const { role, accent: accentParam, resetToken } = route.params;
  const theme = getForgotPasswordRoleTheme(role);
  const accent = accentParam ?? theme.accent;
  const { t } = useTranslation();
  const portalLabel = useForgotPasswordPortalLabel(role);

  const [password, setPassword] = useState(FORGOT_PASSWORD_UI_PREVIEW ? 'demo1234' : '');
  const [confirmPassword, setConfirmPassword] = useState(FORGOT_PASSWORD_UI_PREVIEW ? 'demo1234' : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenReady =
    FORGOT_PASSWORD_UI_PREVIEW ||
    (typeof resetToken === 'string' && resetToken.trim().length > 0);

  useEffect(() => {
    if (!FORGOT_PASSWORD_UI_PREVIEW && !resetToken?.trim()) {
      setError(t('auth.forgotReset.errorResetTokenMissing'));
    }
  }, [resetToken, t]);

  const finishAndReturnToLogin = () => {
    exitForgotPasswordFlow(navigation, role);
  };

  const showSuccess = () => {
    finishAndReturnToLogin();
    Alert.alert(t('auth.forgotReset.successTitle'), t('auth.forgotReset.successMessage'), [
      { text: t('common.ok', { defaultValue: 'OK' }) },
    ]);
  };

  const handleSubmit = async () => {
    if (FORGOT_PASSWORD_UI_PREVIEW) {
      showSuccess();
      return;
    }

    if (!resetToken?.trim()) {
      setError(t('auth.forgotReset.errorResetTokenMissing'));
      return;
    }

    setError(null);
    if (password.length < FORGOT_PASSWORD_MIN_PASSWORD_LENGTH) {
      setError(t('auth.errorPasswordShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.errorPasswordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPasswordService.resetPassword({
        reset_token: resetToken,
        password,
        password_confirmation: confirmPassword,
      });
      finishAndReturnToLogin();
      Alert.alert(
        t('auth.forgotReset.successTitle'),
        res.message || t('auth.forgotReset.successMessage'),
        [{ text: t('common.ok', { defaultValue: 'OK' }) }]
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('auth.forgotReset.errorReset');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ForgotPasswordShell
      accent={accent}
      icon={theme.icon}
      step={3}
      title={t('auth.forgotReset.newPasswordTitle')}
      subtitle={t('auth.forgotReset.newPasswordSubtitle')}
      onBack={() => safeGoBack(navigation)}
      backLabel={t('common.back', { defaultValue: 'Back' })}
      portalLabel={portalLabel}
    >
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
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
        textContentType="newPassword"
        autoComplete="new-password"
      />

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
        textContentType="newPassword"
        autoComplete="new-password"
      />

      <Text style={styles.hint}>{t('auth.forgotReset.passwordHint')}</Text>

      <Button
        title={t('auth.forgotReset.savePassword')}
        onPress={handleSubmit}
        loading={loading}
        disabled={loading || !tokenReady}
        style={styles.button}
      />
    </ForgotPasswordShell>
  );
};

const styles = StyleSheet.create({
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.error + '12',
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
  },
  hint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },
  button: {
    marginTop: SPACING.xs,
  },
});

export default ForgotPasswordNewPasswordScreen;
