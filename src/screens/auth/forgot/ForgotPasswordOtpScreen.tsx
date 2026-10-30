import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ForgotPasswordShell } from '../../../components/auth/ForgotPasswordShell';
import { OtpCodeInput } from '../../../components/auth/OtpCodeInput';
import { Button } from '../../../components/common/Button';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS } from '../../../constants';
import { forgotPasswordService } from '../../../services/forgotPasswordService';
import {
  FORGOT_PASSWORD_OTP_LENGTH,
  FORGOT_PASSWORD_RESEND_SECONDS,
} from '../../../services/forgotPasswordTypes';
import { safeGoBack } from '../../../utils/safeNavigationBack';
import type { ForgotPasswordStackParamList } from '../../../navigation/ForgotPasswordNavigator';
import { getForgotPasswordRoleTheme } from '../../../utils/forgotPasswordRoleTheme';
import { maskPhoneForDisplay } from '../../../utils/phoneValidation';
import {
  FORGOT_PASSWORD_UI_PREVIEW,
  FORGOT_PASSWORD_UI_PREVIEW_RESET_TOKEN,
} from '../../../config/forgotPassword';
import { useForgotPasswordPortalLabel } from '../../../hooks/useForgotPasswordPortalLabel';

const ForgotPasswordOtpScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ForgotPasswordStackParamList, 'ForgotPasswordOtp'>>();
  const { role, accent: accentParam, phone, maskedPhone, resendAfterSeconds } = route.params;
  const theme = getForgotPasswordRoleTheme(role);
  const accent = accentParam ?? theme.accent;
  const { t } = useTranslation();
  const portalLabel = useForgotPasswordPortalLabel(role);

  const initialCooldown = FORGOT_PASSWORD_UI_PREVIEW
    ? 0
    : typeof resendAfterSeconds === 'number' && resendAfterSeconds > 0
      ? resendAfterSeconds
      : FORGOT_PASSWORD_RESEND_SECONDS;

  const [otp, setOtp] = useState(FORGOT_PASSWORD_UI_PREVIEW ? '123456' : '');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(initialCooldown);
  const verifyInFlight = useRef(false);
  const lastAutoVerifiedOtp = useRef('');

  const goToNewPassword = useCallback(
    (resetToken: string) => {
      navigation.navigate('ForgotPasswordNewPassword', {
        role,
        accent,
        phone,
        resetToken,
      });
    },
    [accent, navigation, phone, role]
  );

  const submitVerify = useCallback(
    async (code: string) => {
      if (verifyInFlight.current) return;

      if (FORGOT_PASSWORD_UI_PREVIEW) {
        goToNewPassword(FORGOT_PASSWORD_UI_PREVIEW_RESET_TOKEN);
        return;
      }

      const digits = code.replace(/\D/g, '');
      if (digits.length < FORGOT_PASSWORD_OTP_LENGTH) {
        setError(t('auth.forgotReset.errorOtpIncomplete'));
        return;
      }

      setError(null);
      verifyInFlight.current = true;
      setLoading(true);
      try {
        const res = await forgotPasswordService.verifyOtp({ phone, role, otp: digits });
        const token = res.data?.reset_token;
        if (!token) {
          setError(t('auth.forgotReset.errorOtpInvalid'));
          return;
        }
        goToNewPassword(token);
      } catch (e) {
        const msg = e instanceof Error ? e.message : t('auth.forgotReset.errorOtpInvalid');
        setError(msg);
      } finally {
        setLoading(false);
        verifyInFlight.current = false;
      }
    },
    [goToNewPassword, phone, role, t]
  );

  useEffect(() => {
    if (FORGOT_PASSWORD_UI_PREVIEW) return;
    const digits = otp.replace(/\D/g, '');
    if (digits.length < FORGOT_PASSWORD_OTP_LENGTH) {
      lastAutoVerifiedOtp.current = '';
      return;
    }
    if (
      digits.length === FORGOT_PASSWORD_OTP_LENGTH &&
      digits !== lastAutoVerifiedOtp.current &&
      !loading &&
      !verifyInFlight.current
    ) {
      lastAutoVerifiedOtp.current = digits;
      void submitVerify(digits);
    }
  }, [otp, loading, submitVerify]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const displayPhone = maskedPhone || maskPhoneForDisplay(phone);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resendLoading) return;

    if (FORGOT_PASSWORD_UI_PREVIEW) {
      setOtp('');
      setCooldown(FORGOT_PASSWORD_RESEND_SECONDS);
      return;
    }

    setError(null);
    setResendLoading(true);
    try {
      const res = await forgotPasswordService.requestOtp({ phone, role });
      setOtp('');
      const next =
        res.data?.resend_after_seconds && res.data.resend_after_seconds > 0
          ? res.data.resend_after_seconds
          : FORGOT_PASSWORD_RESEND_SECONDS;
      setCooldown(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('auth.forgotReset.errorSendOtp');
      setError(msg);
    } finally {
      setResendLoading(false);
    }
  }, [cooldown, phone, resendLoading, role, t]);

  const handleVerify = () => {
    void submitVerify(otp);
  };

  const canVerify = FORGOT_PASSWORD_UI_PREVIEW || otp.length >= FORGOT_PASSWORD_OTP_LENGTH;

  return (
    <ForgotPasswordShell
      accent={accent}
      icon={theme.icon}
      step={2}
      title={t('auth.forgotReset.otpTitle')}
      subtitle={t('auth.forgotReset.otpSubtitle', { phone: displayPhone })}
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

      <OtpCodeInput
        length={FORGOT_PASSWORD_OTP_LENGTH}
        value={otp}
        onChange={(code) => {
          setOtp(code);
          setError(null);
        }}
        accent={accent}
        disabled={loading}
      />

      <View style={styles.resendRow}>
        <Text style={styles.resendLabel}>{t('auth.forgotReset.didNotReceive')}</Text>
        {cooldown > 0 ? (
          <Text style={styles.cooldown}>
            {t('auth.forgotReset.resendIn', { seconds: cooldown })}
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
            <Text style={[styles.resendLink, { color: accent }]}>
              {resendLoading
                ? t('common.loading', { defaultValue: 'Loading…' })
                : t('auth.forgotReset.resendCode')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Button
        title={t('auth.forgotReset.verifyCode')}
        onPress={handleVerify}
        loading={loading}
        disabled={loading || !canVerify}
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
    marginBottom: SPACING.sm,
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
  },
  resendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
    marginTop: SPACING.xs,
  },
  resendLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  cooldown: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
  },
  resendLink: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  button: {
    marginTop: SPACING.xs,
  },
});

export default ForgotPasswordOtpScreen;
