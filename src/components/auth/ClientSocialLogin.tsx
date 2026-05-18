import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { authService, LoginResponse } from '../../services/authService';
import { buildGoogleAuthRequestConfig, isGoogleAuthConfigured } from '../../config/socialAuth';

WebBrowser.maybeCompleteAuthSession();

type SocialProvider = 'google' | 'apple';

interface ClientSocialLoginProps {
  onSuccess: (response: LoginResponse) => void | Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
}

interface GoogleSignInButtonProps {
  config: NonNullable<ReturnType<typeof buildGoogleAuthRequestConfig>>;
  onSuccess: (response: LoginResponse) => void | Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
  loadingProvider: SocialProvider | null;
  setLoadingProvider: (provider: SocialProvider | null) => void;
}

const SocialButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  busy: boolean;
  loading: boolean;
  loadingColor: string;
}> = ({ icon, label, onPress, busy, loading, loadingColor }) => (
  <TouchableOpacity
    style={[styles.socialButton, busy && styles.socialButtonDisabled]}
    onPress={onPress}
    disabled={busy}
    activeOpacity={0.85}
  >
    {loading ? <ActivityIndicator size="small" color={loadingColor} /> : icon}
    <Text style={styles.socialButtonText}>{label}</Text>
  </TouchableOpacity>
);

/** Mounts Google.useIdTokenAuthRequest only when client ids exist (avoids iOS crash). */
const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  config,
  onSuccess,
  onError,
  disabled,
  loadingProvider,
  setLoadingProvider,
}) => {
  const { t } = useTranslation();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    ...config,
    scopes: ['openid', 'profile', 'email'],
  });

  const extractApiMessage = (err: unknown): string => {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    return (
      e?.response?.data?.message ||
      e?.message ||
      t('auth.socialSignInFailed', { defaultValue: 'Social sign-in failed. Please try again.' })
    );
  };

  const handleGoogleToken = useCallback(
    async (idToken: string) => {
      setLoadingProvider('google');
      try {
        const res = await authService.loginWithGoogle(idToken);
        await onSuccess(res);
      } catch (err: unknown) {
        onError(extractApiMessage(err));
      } finally {
        setLoadingProvider(null);
      }
    },
    [onSuccess, onError, setLoadingProvider, t]
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken =
        response.authentication?.idToken ||
        (typeof response.params?.id_token === 'string' ? response.params.id_token : null);
      if (idToken) {
        void handleGoogleToken(idToken);
      } else {
        onError(
          t('auth.socialNoToken', {
            defaultValue: 'Sign-in completed but no token was returned. Check Google OAuth client setup.',
          })
        );
      }
    } else if (response.type === 'error') {
      const msg = response.error?.message || '';
      if (/cancel/i.test(msg)) return;
      onError(msg || t('auth.socialSignInFailed', { defaultValue: 'Social sign-in failed. Please try again.' }));
    } else if (response.type === 'dismiss') {
      setLoadingProvider(null);
    }
  }, [response, handleGoogleToken, onError, setLoadingProvider, t]);

  const onGooglePress = async () => {
    if (!request) {
      onError(t('auth.socialNotReady', { defaultValue: 'Google sign-in is still loading. Try again.' }));
      return;
    }
    setLoadingProvider('google');
    try {
      await promptAsync({ showInRecents: true });
    } catch (err: unknown) {
      onError(extractApiMessage(err));
    } finally {
      if (response?.type !== 'success') {
        setLoadingProvider(null);
      }
    }
  };

  const busy = disabled || loadingProvider !== null;
  const loading = loadingProvider === 'google';

  return (
    <SocialButton
      icon={<Ionicons name="logo-google" size={22} color={COLORS.error} />}
      label={t('auth.google')}
      onPress={onGooglePress}
      busy={busy}
      loading={loading}
      loadingColor={COLORS.error}
    />
  );
};

const ClientSocialLogin: React.FC<ClientSocialLoginProps> = ({ onSuccess, onError, disabled }) => {
  const { t } = useTranslation();
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');

  const googleRequestConfig = buildGoogleAuthRequestConfig();
  const googleConfigured = isGoogleAuthConfigured();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(true));
  }, []);

  const extractApiMessage = (err: unknown): string => {
    const e = err as { response?: { data?: { message?: string } }; message?: string; code?: string };
    if (e?.code === 'ERR_REQUEST_CANCELED') return '';
    return (
      e?.response?.data?.message ||
      e?.message ||
      t('auth.socialSignInFailed', { defaultValue: 'Social sign-in failed. Please try again.' })
    );
  };

  const mapAppleError = (err: unknown): string => {
    const e = err as { code?: string; message?: string };
    if (e?.code === 'ERR_REQUEST_CANCELED') return '';
    const msg = (e?.message || '').toLowerCase();
    if (msg.includes('unknown') || e?.code === 'ERR_REQUEST_UNKNOWN') {
      return t('auth.appleSignInFailed', {
        defaultValue:
          'Apple sign-in failed. On a simulator, sign in to an Apple ID in Settings, or use Google sign-in with your Google account.',
      });
    }
    return extractApiMessage(err);
  };

  const onGooglePlaceholderPress = () => {
    onError(
      t('auth.googleNotConfigured', {
        defaultValue:
          'Google sign-in is not configured. Add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (or EXPO_PUBLIC_GOOGLE_CLIENT_ID) to your .env file and restart the app.',
      })
    );
  };

  const onApplePress = async () => {
    setLoadingProvider('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = credential.identityToken;
      if (!idToken) {
        onError(
          t('auth.socialNoToken', {
            defaultValue: 'Sign-in completed but no token was returned.',
          })
        );
        return;
      }
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const res = await authService.loginWithApple({
        idToken,
        name: fullName || null,
        email: credential.email,
      });
      await onSuccess(res);
    } catch (err: unknown) {
      const message = mapAppleError(err);
      if (message) onError(message);
    } finally {
      setLoadingProvider(null);
    }
  };

  const busy = disabled || loadingProvider !== null;
  const showApple = Platform.OS === 'ios' && appleAvailable;

  return (
    <View style={styles.wrap}>
      <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
      <View style={styles.buttonsRow}>
        {googleRequestConfig ? (
          <GoogleSignInButton
            config={googleRequestConfig}
            onSuccess={onSuccess}
            onError={onError}
            disabled={disabled}
            loadingProvider={loadingProvider}
            setLoadingProvider={setLoadingProvider}
          />
        ) : (
          <SocialButton
            icon={<Ionicons name="logo-google" size={22} color={COLORS.error} />}
            label={t('auth.google')}
            onPress={onGooglePlaceholderPress}
            busy={busy}
            loading={false}
            loadingColor={COLORS.error}
          />
        )}

        {showApple ? (
          <SocialButton
            icon={<Ionicons name="logo-apple" size={22} color={COLORS.text} />}
            label={t('auth.apple')}
            onPress={onApplePress}
            busy={busy}
            loading={loadingProvider === 'apple'}
            loadingColor={COLORS.text}
          />
        ) : null}
      </View>
      {!googleConfigured ? (
        <Text style={styles.hintText}>
          {t('auth.googleSetupHint', {
            defaultValue: 'Use Google for Gmail accounts. Add Google OAuth keys in .env to enable.',
          })}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.lg,
  },
  dividerText: {
    textAlign: 'center',
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  hintText: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
    backgroundColor: COLORS.background,
  },
  socialButtonDisabled: {
    opacity: 0.55,
  },
  socialButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
});

export default ClientSocialLogin;
