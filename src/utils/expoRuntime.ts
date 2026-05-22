import Constants from 'expo-constants';

/** True when running inside the Expo Go app (not a dev/production build). */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}
