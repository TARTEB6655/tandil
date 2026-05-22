import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { isExpoGo } from './src/utils/expoRuntime';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';
import { useAppStore } from './src/store';
import { authService } from './src/services/authService';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { captureException } from './src/utils/sentry';
import './src/i18n';
import { StripeProvider } from '@stripe/stripe-react-native';
import { getStripeMerchantIdentifier, getStripePublishableKey } from './src/config/api';
import { getStripeUrlScheme } from './src/config/stripeLinking';

/** SDK 53+: expo-notifications is limited in Expo Go; polling + vibration fallback instead. */
if (isExpoGo()) {
  LogBox.ignoreLogs([
    'expo-notifications',
    'Android Push notifications',
    'not fully supported in Expo Go',
    'development build',
  ]);
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const text = args.map(String).join(' ');
    if (
      text.includes('expo-notifications') &&
      (text.includes('Expo Go') ||
        text.includes('development build') ||
        text.includes('Android Push'))
    ) {
      return;
    }
    originalWarn(...args);
  };
}

function AppContent() {
  const { setUser, setAuthenticated } = useAppStore();
  const stripePublishableKey = getStripePublishableKey();
  const stripeMerchantIdentifier = getStripeMerchantIdentifier();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = await authService.getStoredToken();
        const user = await authService.getStoredUser();
        
        if (token && user) {
          setUser(user);
          setAuthenticated(true);
          console.log('Auth restored from storage');
        } else {
          console.log('No stored auth found');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        captureException(error, { tags: { area: 'auth_init' } });
      }
    };

    initializeAuth();
    console.log('Tandil App Initialized');
  }, []);

  return (
    <StripeProvider
      publishableKey={stripePublishableKey}
      merchantIdentifier={stripeMerchantIdentifier || undefined}
      urlScheme={getStripeUrlScheme()}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StripeProvider>
  );
}

function RootApp() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default RootApp;
