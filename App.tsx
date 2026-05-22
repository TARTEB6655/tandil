import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';
import { useAppStore } from './src/store';
import { authService } from './src/services/authService';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { StripeAppShell } from './src/components/common/StripeAppShell';
import { captureException, initSentryDeferred } from './src/utils/sentry';
import { COLORS } from './src/constants';
import './src/i18n';

function AppContent() {
  const { setUser, setAuthenticated } = useAppStore();
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    initSentryDeferred();
  }, []);

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

    const boot = initializeAuth();
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1200));
    Promise.race([boot, timeout]).finally(() => setReady(true));
    console.log('Tandil App Initialized');
  }, [setUser, setAuthenticated]);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

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

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
});

function RootApp() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default RootApp;
