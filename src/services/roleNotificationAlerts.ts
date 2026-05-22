/**
 * Per-role notification fetchers for alert polling + sound.
 */
import type { NotificationAlertItem } from '../types/notificationAlert';
import { getClientNotifications } from './clientNotificationService';
import { getTechnicianNotifications } from './technicianService';
import { getSupervisorNotifications } from './supervisorService';
import { getAreaManagerNotifications } from './areaManagerService';
import { hrService } from './hrService';
import { adminService } from './adminService';

function toAlertItem(row: {
  id: string | number;
  read_at?: string | null;
  data?: { title?: string; message?: string; type?: string };
  title?: string;
  message?: string;
}): NotificationAlertItem {
  return {
    id: String(row.id),
    read_at: row.read_at,
    data: {
      title: row.data?.title ?? row.title,
      message: row.data?.message ?? row.message,
      type: row.data?.type,
    },
  };
}

const POLL_PARAMS = { per_page: 15, page: 1 };

export async function fetchClientNotificationsForAlert(): Promise<NotificationAlertItem[]> {
  const res = await getClientNotifications(POLL_PARAMS);
  return res.list.map(toAlertItem);
}

export async function fetchTechnicianNotificationsForAlert(): Promise<NotificationAlertItem[]> {
  const res = await getTechnicianNotifications(POLL_PARAMS);
  return res.list.map(toAlertItem);
}

export async function fetchSupervisorNotificationsForAlert(): Promise<NotificationAlertItem[]> {
  const res = await getSupervisorNotifications(POLL_PARAMS);
  return res.list.map(toAlertItem);
}

export async function fetchAreaManagerNotificationsForAlert(): Promise<NotificationAlertItem[]> {
  const res = await getAreaManagerNotifications(POLL_PARAMS);
  return res.list.map(toAlertItem);
}

export async function fetchHrNotificationsForAlert(): Promise<NotificationAlertItem[]> {
  const res = await hrService.getNotifications(POLL_PARAMS);
  return res.list.map(toAlertItem);
}

export async function fetchAdminNotificationsForAlert(): Promise<NotificationAlertItem[]> {
  const res = await adminService.getNotifications(POLL_PARAMS);
  return res.list.map(toAlertItem);
}
