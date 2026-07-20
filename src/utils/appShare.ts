import { Alert, Linking, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import type { TFunction } from 'i18next';

const IOS_APP_STORE_URL = 'https://apps.apple.com/au/app/tandilapp/id6757382373';
const IOS_APP_STORE_ID = '6757382373';

function getShareUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromConfig = typeof extra?.shareAppUrl === 'string' ? extra.shareAppUrl.trim() : '';
  if (fromConfig) return fromConfig;
  if (Platform.OS === 'android') {
    return 'https://play.google.com/store/apps/details?id=com.tandilapp.tandil';
  }
  const iosId =
    (typeof extra?.iosAppStoreId === 'string' ? extra.iosAppStoreId.trim() : '') ||
    IOS_APP_STORE_ID;
  return `https://apps.apple.com/app/id${iosId}`;
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
      await Linking.openURL(IOS_APP_STORE_URL);
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
    try {
      await Linking.openURL(
        Platform.OS === 'ios'
          ? IOS_APP_STORE_URL
          : 'https://play.google.com/store/apps/details?id=com.tandilapp.tandil'
      );
    } catch {
      Alert.alert(
        t('common.error', 'Error'),
        t('profile.rateApp.failed', {
          defaultValue: 'Could not open the app store. Please try again later.',
        }),
        [{ text: t('common.ok', 'OK') }]
      );
    }
  }
}
