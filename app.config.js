const path = require('path');
const { load: loadEnv } = require('@expo/env');

// Ensure .env is loaded when evaluating app config (Google OAuth, Stripe, etc.)
loadEnv(path.resolve(__dirname));

const appJson = require('./app.json');
const { expo } = appJson;

// EAS Build sets EAS_BUILD_PROFILE (e.g. 'preview', 'production'). Use it for Sentry environment.
const easBuildProfile = process.env.EAS_BUILD_PROFILE || 'development';
const stripeMerchantIdentifier =
  process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER || expo.extra?.stripeMerchantIdentifier || '';

const basePlugins = Array.isArray(expo.plugins) ? expo.plugins : [];
const pluginsWithoutStripe = basePlugins.filter((p) =>
  Array.isArray(p) ? p[0] !== '@stripe/stripe-react-native' : p !== '@stripe/stripe-react-native'
);
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
      usesAppleSignIn: true,
      entitlements: {
        ...(expo.ios?.entitlements || {}),
        ...(stripeMerchantIdentifier
          ? { 'com.apple.developer.in-app-payments': [stripeMerchantIdentifier] }
          : {}),
      },
      infoPlist: {
        ...expo.ios?.infoPlist,
        NSLocationWhenInUseUsageDescription: 'We use your location to show local weather on your dashboard.',
        LSApplicationQueriesSchemes: ['tel', 'mailto', ...(expo.ios?.infoPlist?.LSApplicationQueriesSchemes || [])],
      },
    },
    android: {
      ...expo.android,
      permissions: [
        ...(expo.android?.permissions || []),
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'POST_NOTIFICATIONS',
      ],
    },
    extra: {
      ...expo.extra,
      easBuildProfile,
      stripePublishableKey:
        process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || expo.extra?.stripePublishableKey || '',
      stripeMerchantIdentifier,
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
            'We use your location to show local weather and delivery options on your dashboard.',
        },
      ],
      'expo-web-browser',
      'expo-apple-authentication',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#EEEADE',
        },
      ],
    ],
  },
};
