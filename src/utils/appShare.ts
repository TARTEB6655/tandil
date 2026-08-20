import { Alert, Linking, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import type { TFunction } from 'i18next';

const IOS_APP_STORE_URL = 'https://apps.apple.com/au/app/tandil/id6757382373';

function getShareUrl(): string {
  if (Platform.OS === 'ios') return IOS_APP_STORE_URL;
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromConfig = typeof extra?.shareAppUrl === 'string' ? extra.shareAppUrl.trim() : '';
  if (fromConfig) return fromConfig;
  return 'https://play.google.com/store/apps/details?id=com.tandilapp.tandil';
}

/** Opens the native share sheet (Mail, WhatsApp, Messages, etc.). */
export async function shareApp(t: TFunction): Promise<void> {
  const url = getShareUrl();
  const message = t('profile.shareApp.message', {
    url,
    defaultValue:
      '🌿 Tandil is now available on the App Store 🇦🇪\n\nOne platform for all your garden and farm needs:\nInspection, Design, Execution, Products, and Equipment.\n\nDownload Tandil, try it, and share your feedback and rating with us 🤍👇\n\nApp Link: {{url}}',
  });
  const title = t('profile.shareApp.title', { defaultValue: 'Share Tandil' });

  try {
    // iOS ignores `message` when `url` is a local image file, so share text + store link only.
    // The App Store link still shows the official Tandil icon as a preview in Messages / WhatsApp.
    await Share.share({ title, message });
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
