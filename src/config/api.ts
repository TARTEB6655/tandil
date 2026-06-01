// API Configuration using expo-constants
import Constants from 'expo-constants';
import { ENABLE_APPLE_PAY } from './payments';

// Get API base URL from app.json extra config
// Works in both development and production builds
function getApiBaseUrl(): string {
  const fallback = 'https://phpstack-1180784-6050385.cloudwaysapps.com/api';
  
  try {
    // Try expoConfig first (works in development and some production builds)
    if (Constants.expoConfig?.extra?.apiBaseUrl) {
      return Constants.expoConfig.extra.apiBaseUrl as string;
    }
    
    // Try manifest.extra (works in production builds)
    if (Constants.manifest?.extra?.apiBaseUrl) {
      return Constants.manifest.extra.apiBaseUrl as string;
    }
    
    // Try manifest2 (newer Expo SDK)
    if (Constants.manifest2?.extra?.expoConfig?.extra?.apiBaseUrl) {
      return Constants.manifest2.extra.expoConfig.extra.apiBaseUrl as string;
    }
  } catch (error) {
    console.error('Error reading API config from Constants:', error);
  }
  
  return fallback;
}

export const API_BASE_URL = getApiBaseUrl();

/** Stripe publishable key (pk_test_… / pk_live_…) from app config, then EXPO_PUBLIC (inlined at EAS/Metro build). */
export function getStripePublishableKey(): string {
  try {
    if (Constants.expoConfig?.extra?.stripePublishableKey != null && Constants.expoConfig.extra.stripePublishableKey !== '') {
      return String(Constants.expoConfig.extra.stripePublishableKey).trim();
    }
    if (Constants.manifest?.extra?.stripePublishableKey != null && Constants.manifest.extra.stripePublishableKey !== '') {
      return String(Constants.manifest.extra.stripePublishableKey).trim();
    }
    if (Constants.manifest2?.extra?.expoConfig?.extra?.stripePublishableKey != null) {
      const v = Constants.manifest2.extra.expoConfig.extra.stripePublishableKey;
      if (v !== '') return String(v).trim();
    }
  } catch {
    // ignore
  }
  const fromEnv = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }
  // Last resort for release builds if Constants.extra was not embedded (avoids Stripe white screen).
  const fromAppJson = 'pk_live_51TObSk0dvmhfzUoqeXMFztTOzAQ366Y0ZaNvM6us9fvjswiUh80L13EtFAwgjwkH1klyZcagiYZ6MGcFYK7HrYAT00lH8Jrade';
  return fromAppJson;
}

/** Stripe Apple Pay merchant identifier — empty when Apple Pay is disabled for App Store. */
export function getStripeMerchantIdentifier(): string {
  if (!ENABLE_APPLE_PAY) {
    return '';
  }
  try {
    if (
      Constants.expoConfig?.extra?.stripeMerchantIdentifier != null &&
      Constants.expoConfig.extra.stripeMerchantIdentifier !== ''
    ) {
      return String(Constants.expoConfig.extra.stripeMerchantIdentifier).trim();
    }
    if (
      Constants.manifest?.extra?.stripeMerchantIdentifier != null &&
      Constants.manifest.extra.stripeMerchantIdentifier !== ''
    ) {
      return String(Constants.manifest.extra.stripeMerchantIdentifier).trim();
    }
    if (Constants.manifest2?.extra?.expoConfig?.extra?.stripeMerchantIdentifier != null) {
      const v = Constants.manifest2.extra.expoConfig.extra.stripeMerchantIdentifier;
      if (v !== '') return String(v).trim();
    }
  } catch {
    // ignore
  }
  const fromEnv = process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }
  return '';
}

// For development, you can also use:
// export const API_BASE_URL = __DEV__ 
//   ? Constants.expoConfig?.extra?.apiBaseUrlDev || 'http://192.168.1.100:8000/api'
//   : Constants.expoConfig?.extra?.apiBaseUrl || 'https://phpstack-1180784-6050385.cloudwaysapps.com/api';

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

/** Build full image URL from API relative path (e.g. /media/products/xxx.jpg or products/xxx.jpg). */
export function buildFullImageUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  const path = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const fullPath =
    path.startsWith('media/') ? path
    : path.startsWith('storage/') ? path
    : `storage/${path}`;
  return `${origin}/${fullPath}`;
}

/** Build full URL for profile picture. API often returns path like "profiles/xxx.png" served under /media/. */
export function buildProfilePictureUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  const path = trimmed.startsWith('media/') ? trimmed : `media/${trimmed}`;
  return `${origin}/${path}`;
}
