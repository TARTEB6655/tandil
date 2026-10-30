import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ForgotPasswordShell } from '../../../components/auth/ForgotPasswordShell';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { COLORS, SPACING, FONT_SIZES } from '../../../constants';
import { forgotPasswordService } from '../../../services/forgotPasswordService';
import type { ForgotPasswordStackParamList } from '../../../navigation/ForgotPasswordNavigator';
import { getForgotPasswordRoleTheme } from '../../../utils/forgotPasswordRoleTheme';
import {
  isValidPhoneForAuth,
  maskPhoneForDisplay,
  normalizePhoneForApi,
} from '../../../utils/phoneValidation';
import { FORGOT_PASSWORD_UI_PREVIEW } from '../../../config/forgotPassword';
import { FORGOT_PASSWORD_RESEND_SECONDS } from '../../../services/forgotPasswordTypes';
import { useForgotPasswordPortalLabel } from '../../../hooks/useForgotPasswordPortalLabel';
import { exitForgotPasswordFlow } from '../../../utils/safeNavigationBack';

const DEMO_PHONE = '+971 50 123 4567';

const ForgotPasswordPhoneScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ForgotPasswordStackParamList, 'ForgotPasswordPhone'>>();
  const { role, accent: accentParam } = route.params;
  const theme = getForgotPasswordRoleTheme(role);
  const accent = accentParam ?? theme.accent;
  const { t } = useTranslation();
  const portalLabel = useForgotPasswordPortalLabel(role);

  const [phone, setPhone] = useState(FORGOT_PASSWORD_UI_PREVIEW ? DEMO_PHONE : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    exitForgotPasswordFlow(navigation);
  };

  const goToOtp = (phoneValue: string, maskedPhone?: string, resendAfterSeconds?: number) => {
    navigation.navigate('ForgotPasswordOtp', {
      role,
      accent,
      phone: phoneValue,
      maskedPhone,
      resendAfterSeconds,
    });
  };

  const handleContinue = async () => {
    const trimmed = phone.trim() || (FORGOT_PASSWORD_UI_PREVIEW ? DEMO_PHONE : '');

    if (FORGOT_PASSWORD_UI_PREVIEW) {
      goToOtp(trimmed, maskPhoneForDisplay(trimmed), FORGOT_PASSWORD_RESEND_SECONDS);
      return;
    }

    if (!trimmed) {
      setError(t('auth.forgotReset.errorPhoneRequired'));
      return;
    }

    if (!isValidPhoneForAuth(trimmed)) {
      setError(t('auth.errorPhoneInvalid'));
      return;
    }

    const normalizedPhone = normalizePhoneForApi(trimmed);

    setLoading(true);
    try {
      const res = await forgotPasswordService.requestOtp({ phone: normalizedPhone, role });
      goToOtp(normalizedPhone, res.data?.masked_phone, res.data?.resend_after_seconds);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('auth.forgotReset.errorSendOtp');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ForgotPasswordShell
      accent={accent}
      icon={theme.icon}
      step={1}
      title={t('auth.forgotReset.phoneTitle')}
      subtitle={t('auth.forgotReset.phoneSubtitle')}
      onBack={handleBack}
      backLabel={t('auth.forgotReset.backToLogin')}
      portalLabel={portalLabel}
    >
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Input
        label={t('auth.phoneLabel')}
        placeholder={t('auth.completePhone.placeholder')}
        value={phone}
        onChangeText={(text) => {
          setPhone(text);
          setError(null);
        }}
        keyboardType="phone-pad"
        leftIcon="call-outline"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={20}
      />

      <Text style={styles.hint}>{t('auth.forgotReset.phoneHint')}</Text>

      <Button
        title={t('auth.forgotReset.sendCode')}
        onPress={handleContinue}
        loading={loading}
        disabled={loading}
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

export default ForgotPasswordPhoneScreen;
