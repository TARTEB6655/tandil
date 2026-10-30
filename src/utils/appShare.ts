import { Alert, Linking, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import type { TFunction } from 'i18next';

const IOS_APP_STORE_URL = 'https://apps.apple.com/au/app/tandil/id6757382373';

/** Bundled promo graphic sent with “Share the App” (Profile → About). */
const SHARE_APP_PROMO_ASSET = require('../../assets/share-app-promo.png');

let cachedSharePromoUri: string | null = null;

function getShareUrl(): string {
  if (Platform.OS === 'ios') return IOS_APP_STORE_URL;
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromConfig = typeof extra?.shareAppUrl === 'string' ? extra.shareAppUrl.trim() : '';
  if (fromConfig) return fromConfig;
  return 'https://play.google.com/store/apps/details?id=com.tandilapp.tandil';
}

/** Local file URI for the share promo PNG (cached under app cache). */
async function getShareAppPromoFileUri(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (cachedSharePromoUri) return cachedSharePromoUri;

  try {
    const asset = Asset.fromModule(SHARE_APP_PROMO_ASSET);
    await asset.downloadAsync();
    const sourceUri = asset.localUri ?? asset.uri;
    if (!sourceUri) return null;

    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      cachedSharePromoUri = sourceUri;
      return sourceUri;
    }

    const dest = `${cacheDir}share-app-promo.png`;
    const info = await FileSystem.getInfoAsync(dest);
    if (!info.exists) {
      await FileSystem.copyAsync({ from: sourceUri, to: dest });
    }
    const destInfo = await FileSystem.getInfoAsync(dest);
    const shareUri = destInfo.uri || dest;
    cachedSharePromoUri = shareUri;
    return shareUri;
  } catch {
    return null;
  }
}

/** Opens the native share sheet (Mail, WhatsApp, Messages, etc.) with promo image + text. */
export async function shareApp(t: TFunction): Promise<void> {
  const url = getShareUrl();
  const message = t('profile.shareApp.message', {
    url,
    defaultValue:
      '🌿 Tandil is now available on the App Store 🇦🇪\n\nOne platform for all your garden and farm needs:\nInspection, Design, Execution, Products, and Equipment.\n\nDownload Tandil, try it, and share your feedback and rating with us 🤍👇\n\nApp Link: {{url}}',
  });
  const title = t('profile.shareApp.title', { defaultValue: 'Share Tandil' });

  try {
    const promoUri = await getShareAppPromoFileUri();

    if (promoUri) {
      try {
        await Share.share({
          title,
          message,
          url: promoUri,
        });
        return;
      } catch {
        // Some targets reject file shares — still send the text + store link.
      }
    }

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
