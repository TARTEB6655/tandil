import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Android MapView requires a Google Maps API key baked into the native binary.
 * Without it, mounting MapView hard-crashes the process (iOS Apple Maps is fine).
 * Expo Go already ships a Maps key, so native maps are safe there.
 */
export function canShowNativeMap(): boolean {
  if (Platform.OS !== 'android') return true;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return true;
  return Boolean(Constants.expoConfig?.extra?.googleMapsAndroidConfigured);
}
