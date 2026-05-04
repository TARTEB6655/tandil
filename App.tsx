import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';
import { useAppStore } from './src/store';
import { authService } from './src/services/authService';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { captureException } from './src/utils/sentry';
import './src/i18n';
import { StripeProvider } from '@stripe/stripe-react-native';
import { getStripePublishableKey } from './src/config/api';

function AppContent() {
  const { setUser, setAuthenticated } = useAppStore();

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
    <StripeProvider publishableKey={getStripePublishableKey()}>
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
