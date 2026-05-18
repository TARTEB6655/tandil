import { Alert, Linking, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import type { TFunction } from 'i18next';

function getShareUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromConfig = typeof extra?.shareAppUrl === 'string' ? extra.shareAppUrl.trim() : '';
  if (fromConfig) return fromConfig;
  if (Platform.OS === 'android') {
    return 'https://play.google.com/store/apps/details?id=com.tandilapp.tandil';
  }
  const iosId = typeof extra?.iosAppStoreId === 'string' ? extra.iosAppStoreId.trim() : '';
  if (iosId) return `https://apps.apple.com/app/id${iosId}`;
  return 'https://tandil.app';
}

function getIosAppStoreId(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  return typeof extra?.iosAppStoreId === 'string' ? extra.iosAppStoreId.trim() : '';
}

/** Opens the native share sheet (Mail, WhatsApp, Messages, etc. on iOS). */
export async function shareApp(t: TFunction): Promise<void> {
  const url = getShareUrl();
  const message = t('profile.shareApp.message', {
    defaultValue: 'Check out Tandil — services and shop in one app.',
  });
  const title = t('profile.shareApp.title', { defaultValue: 'Share Tandil' });

  try {
    if (Platform.OS === 'ios') {
      await Share.share({ message: `${message}\n${url}`, url, title });
    } else {
      await Share.share({ message: `${message}\n${url}`, title });
    }
  } catch {
    // user dismissed
  }
}

/** Opens App Store / Play Store review or listing page. */
export async function rateApp(t: TFunction): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      const appId = getIosAppStoreId();
      if (appId) {
        const reviewUrl = `https://apps.apple.com/app/id${appId}?action=write-review`;
        const canOpen = await Linking.canOpenURL(reviewUrl);
        if (canOpen) {
          await Linking.openURL(reviewUrl);
          return;
        }
      }
      Alert.alert(
        t('profile.rateApp.title', { defaultValue: 'Rate the App' }),
        t('profile.rateApp.iosFallback', {
          defaultValue:
            'Thank you for using Tandil! Once the app is on the App Store, you can rate us from the store listing.',
        }),
        [{ text: t('common.ok', 'OK') }]
      );
      return;
    }

    const playUrl = 'market://details?id=com.tandilapp.tandil';
    const webPlay = 'https://play.google.com/store/apps/details?id=com.tandilapp.tandil';
    if (await Linking.canOpenURL(playUrl)) {
      await Linking.openURL(playUrl);
    } else {
      await Linking.openURL(webPlay);
    }
  } catch {
    Alert.alert(
      t('common.error', 'Error'),
      t('profile.rateApp.failed', { defaultValue: 'Could not open the app store. Please try again later.' }),
      [{ text: t('common.ok', 'OK') }]
    );
  }
}
