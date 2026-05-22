/**
 * In-app notification alerts — short vibration when new unread items arrive while the app is open.
 * No push / local notification capability (avoids iOS aps-environment on App Store builds).
 */
import { Platform, Vibration } from 'react-native';
import type { NotificationAlertItem } from '../types/notificationAlert';

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

function playAlertFeedback(): void {
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

/** No-op init kept for callers that await permission setup. */
export async function initNotificationAlerts(): Promise<boolean> {
  return true;
}

/** Vibrate when a new in-app notification is detected. */
export async function playNotificationAlert(
  _item: NotificationAlertItem
): Promise<void> {
  playAlertFeedback();
}
