import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Expo inlines only static process.env.EXPO_PUBLIC_* references (not dynamic keys). */
const ENV = {
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleExpoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ?? '',
};

function trim(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readExtra(key: string): string {
  try {
    const v =
      Constants.expoConfig?.extra?.[key] ??
      Constants.manifest?.extra?.[key] ??
      Constants.manifest2?.extra?.expoConfig?.extra?.[key];
    return trim(v != null ? String(v) : '');
  } catch {
    return '';
  }
}

export interface GoogleAuthConfig {
  clientId: string;
  expoClientId: string;
  iosClientId: string;
  androidClientId: string;
  webClientId: string;
}

export function getGoogleAuthConfig(): GoogleAuthConfig {
  const clientId = readExtra('googleClientId') || trim(ENV.googleClientId);
  return {
    clientId,
    expoClientId: readExtra('googleExpoClientId') || trim(ENV.googleExpoClientId) || clientId,
    iosClientId: readExtra('googleIosClientId') || trim(ENV.googleIosClientId) || clientId,
    androidClientId:
      readExtra('googleAndroidClientId') || trim(ENV.googleAndroidClientId) || clientId,
    webClientId: readExtra('googleWebClientId') || trim(ENV.googleWebClientId) || clientId,
  };
}

/** Client id required by expo-auth-session on the current platform. */
export function getGoogleClientIdForPlatform(): string {
  const c = getGoogleAuthConfig();
  const fallback = c.expoClientId || c.webClientId || c.clientId;

  if (Platform.OS === 'ios') {
    return c.iosClientId || fallback;
  }
  if (Platform.OS === 'android') {
    return c.androidClientId || fallback;
  }
  return c.webClientId || fallback;
}

export function isGoogleAuthConfigured(): boolean {
  return getGoogleClientIdForPlatform().length > 0;
}

export function buildGoogleAuthRequestConfig(): {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
} | null {
  const c = getGoogleAuthConfig();
  const platformId = getGoogleClientIdForPlatform();
  if (!platformId) return null;

  const fallback = c.expoClientId || c.webClientId || c.clientId || platformId;
  return {
    webClientId: c.webClientId || fallback || platformId,
    iosClientId: c.iosClientId || fallback || platformId,
    androidClientId: c.androidClientId || fallback || platformId,
  };
}
