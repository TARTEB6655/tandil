import React from 'react';
import { fetchClientNotificationsForAlert } from '../../services/roleNotificationAlerts';
import { NotificationAlertProvider } from './NotificationAlertProvider';

type Props = {
  children: React.ReactNode;
};

/** @deprecated Use NotificationAlertProvider with fetchClientNotificationsForAlert */
export function ClientNotificationAlertProvider({ children }: Props) {
  return (
    <NotificationAlertProvider fetchNotifications={fetchClientNotificationsForAlert}>
      {children}
    </NotificationAlertProvider>
  );
}
