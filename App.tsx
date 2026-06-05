import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';
import { useAppStore } from './src/store';
import { restoreSessionAndGetRoute } from './src/utils/sessionRestore';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { StripeAppShell } from './src/components/common/StripeAppShell';
import { captureException } from './src/utils/sentry';
import './src/i18n';

function AppContent() {
  const { setUser, setAuthenticated } = useAppStore();

  useEffect(() => {
    restoreSessionAndGetRoute(setUser, setAuthenticated).catch((error) => {
      console.error('Error initializing auth:', error);
      captureException(error, { tags: { area: 'auth_init' } });
    });
    console.log('Tandil App Initialized');
  }, [setUser, setAuthenticated]);

  return (
    <StripeAppShell>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StripeAppShell>
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
