const path = require('path');
const { load: loadEnv } = require('@expo/env');

// Ensure .env is loaded when evaluating app config (Google OAuth, Stripe, etc.)
loadEnv(path.resolve(__dirname));

const appJson = require('./app.json');
const { expo } = appJson;

// EAS Build sets EAS_BUILD_PROFILE (e.g. 'preview', 'production'). Use it for Sentry environment.
const easBuildProfile = process.env.EAS_BUILD_PROFILE || 'development';
const enableApplePay =
  process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY === 'true' ||
  process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY === '1';
const stripeMerchantIdentifier = enableApplePay
  ? process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER || expo.extra?.stripeMerchantIdentifier || ''
  : '';

const basePlugins = Array.isArray(expo.plugins) ? expo.plugins : [];
const pluginsWithoutStripe = basePlugins.filter((p) => {
  const name = Array.isArray(p) ? p[0] : p;
  return name !== '@stripe/stripe-react-native' && name !== 'sentry-expo';
});
const stripePlugin = [
  '@stripe/stripe-react-native',
  {
    enableGooglePay: true,
    ...(stripeMerchantIdentifier ? { merchantIdentifier: stripeMerchantIdentifier } : {}),
  },
];

module.exports = {
  ...appJson,
  expo: {
    ...expo,
    ios: {
      ...expo.ios,
      buildNumber: '31',
      usesAppleSignIn: true,
      entitlements: {
        ...(expo.ios?.entitlements || {}),
        ...(stripeMerchantIdentifier
          ? { 'com.apple.developer.in-app-payments': [stripeMerchantIdentifier] }
          : {}),
      },
      infoPlist: {
        ...expo.ios?.infoPlist,
        NSLocationWhenInUseUsageDescription:
          'We use your location to auto-fill your delivery address at checkout and show local weather on your dashboard.',
        LSApplicationQueriesSchemes: ['tel', 'mailto', ...(expo.ios?.infoPlist?.LSApplicationQueriesSchemes || [])],
      },
    },
    android: {
      ...expo.android,
      permissions: [
        ...(expo.android?.permissions || []),
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
      ],
    },
    extra: {
      ...expo.extra,
      easBuildProfile,
      enableApplePay,
      stripePublishableKey:
        process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || expo.extra?.stripePublishableKey || '',
      stripeMerchantIdentifier: enableApplePay ? stripeMerchantIdentifier : '',
      googleClientId:
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || expo.extra?.googleClientId || expo.extra?.googleIosClientId || '',
      googleExpoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || expo.extra?.googleExpoClientId || '',
      googleIosClientId:
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || expo.extra?.googleIosClientId || '',
      googleAndroidClientId:
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || expo.extra?.googleAndroidClientId || '',
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || expo.extra?.googleWebClientId || '',
      iosAppStoreId: process.env.EXPO_PUBLIC_IOS_APP_STORE_ID || expo.extra?.iosAppStoreId || '',
      shareAppUrl: process.env.EXPO_PUBLIC_SHARE_APP_URL || expo.extra?.shareAppUrl || '',
    },
    plugins: [
      ...pluginsWithoutStripe,
      stripePlugin,
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'We use your location to auto-fill your delivery address at checkout and show local weather on your dashboard.',
        },
      ],
      'expo-web-browser',
      'expo-apple-authentication',
      'expo-font',
    ],
  },
};
