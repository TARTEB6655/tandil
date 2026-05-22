import React from 'react';
import type { NotificationAlertFetcher } from '../../types/notificationAlert';
import { useNotificationAlerts } from '../../hooks/useNotificationAlerts';

type Props = {
  children: React.ReactNode;
  fetchNotifications: NotificationAlertFetcher;
};

/**
 * Polls notifications for the current role and plays the system alert sound on new unread items.
 */
export function NotificationAlertProvider({ children, fetchNotifications }: Props) {
  useNotificationAlerts(true, fetchNotifications);
  return <>{children}</>;
}
