import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { StripeAppShell } from './src/components/common/StripeAppShell';
import './src/i18n';

function AppContent() {
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
