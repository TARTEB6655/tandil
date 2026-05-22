/**
 * In-app notification alerts — system sound + banner on dev builds;
 * vibration fallback in Expo Go (SDK 53+ limits expo-notifications there).
 */
import { Platform, Vibration } from 'react-native';
import type { NotificationAlertItem } from '../types/notificationAlert';
import { isExpoGo } from '../utils/expoRuntime';

const ANDROID_CHANNEL_ID = 'tandil-alerts';

let permissionsReady = false;
let notificationsModule: typeof import('expo-notifications') | null = null;
let handlerConfigured = false;

async function loadNotificationsModule(): Promise<
  typeof import('expo-notifications') | null
> {
  if (isExpoGo()) return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }
  if (!handlerConfigured && notificationsModule) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  }
  return notificationsModule;
}

export function notificationDisplayText(item: NotificationAlertItem): {
  title: string;
  body: string;
} {
  const title =
    item.data?.title?.trim() ||
    item.data?.type?.trim() ||
    'Tandil';
  const body =
    item.data?.message?.trim() ||
    'You have a new notification.';
  return { title, body };
}

function playExpoGoAlertFeedback(): void {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 280, 120, 280]);
    } else {
      Vibration.vibrate();
    }
  } catch {
    /* ignore */
  }
}

export async function initNotificationAlerts(): Promise<boolean> {
  if (isExpoGo()) {
    permissionsReady = true;
    return true;
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return false;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      status = requested.status;
    }
    permissionsReady = status === 'granted';

    if (Platform.OS === 'android' && permissionsReady) {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Tandil notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 220, 120, 220],
        enableVibrate: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    return permissionsReady;
  } catch (err) {
    console.warn('[notificationSound] init failed', err);
    return false;
  }
}

/**
 * Alert for a new notification — local notification + sound on dev builds;
 * short vibration in Expo Go.
 */
export async function playNotificationAlert(
  item: NotificationAlertItem
): Promise<void> {
  if (isExpoGo()) {
    playExpoGoAlertFeedback();
    return;
  }

  if (!permissionsReady) {
    await initNotificationAlerts();
  }
  if (!permissionsReady) return;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  const { title, body } = notificationDisplayText(item);

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: { notificationId: item.id, source: 'role_poll' },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[notificationSound] schedule failed', err);
    playExpoGoAlertFeedback();
  }
}
