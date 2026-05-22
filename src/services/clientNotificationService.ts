/**
 * Client notification API (GET /client/notifications). Separate module avoids circular imports with dashboard weather.
 */
import apiClient from './api';

/** Item from GET /api/client/notifications (Laravel database notifications) */
export interface ClientNotificationItem {
  id: string;
  type: string;
  notifiable_type?: string;
  notifiable_id?: number;
  data?: {
    title?: string;
    message?: string;
    type?: string;
    report_id?: number;
    visit_id?: number;
    meta?: Record<string, unknown> | unknown[] | null;
  };
  read_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ClientNotificationsListResponse {
  success?: boolean;
  message?: string;
  data?: {
    notifications?: {
      current_page?: number;
      data?: ClientNotificationItem[] | Record<string, ClientNotificationItem> | null;
      last_page?: number;
      total?: number;
      per_page?: number;
    } | ClientNotificationItem[] | null;
    unread_count?: number;
  };
}

function coerceClientNotificationRows(raw: unknown): ClientNotificationItem[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (row): row is ClientNotificationItem =>
        Boolean(row) && typeof row === 'object' && (row as ClientNotificationItem).id != null
    );
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).filter(
      (v): v is ClientNotificationItem =>
        Boolean(v) && typeof v === 'object' && (v as ClientNotificationItem).id != null
    );
  }
  return [];
}

export interface GetClientNotificationsResult {
  list: ClientNotificationItem[];
  unreadCount: number;
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
}

/**
 * GET /api/client/notifications?per_page=&page=
 * Paginated notifications plus unread_count. Requires Bearer token (client).
 */
export async function getClientNotifications(params?: {
  per_page?: number;
  page?: number;
}): Promise<GetClientNotificationsResult> {
  const response = await apiClient.get<ClientNotificationsListResponse>('/client/notifications', {
    params: { per_page: params?.per_page ?? 20, page: params?.page ?? 1 },
    timeout: 15000,
  });
  const payload = response.data?.data;
  const notifications = payload?.notifications;
  if (notifications == null) {
    return { list: [], unreadCount: 0, currentPage: 1, lastPage: 1, total: 0, perPage: 20 };
  }

  let list: ClientNotificationItem[] = [];
  let currentPage = 1;
  let lastPage = 1;
  let total = 0;
  let perPage = 20;

  if (Array.isArray(notifications)) {
    list = coerceClientNotificationRows(notifications);
    total = list.length;
  } else if (typeof notifications === 'object') {
    const paginator = notifications as {
      data?: unknown;
      current_page?: number;
      last_page?: number;
      total?: number;
      per_page?: number;
    };
    list = coerceClientNotificationRows(paginator.data);
    currentPage = paginator.current_page ?? 1;
    lastPage = paginator.last_page ?? 1;
    total = paginator.total ?? list.length;
    perPage = paginator.per_page ?? 20;
  }

  return {
    list,
    unreadCount: payload?.unread_count ?? 0,
    currentPage,
    lastPage,
    total,
    perPage,
  };
}

export interface ClientNotificationActionResponse {
  success?: boolean;
  message?: string;
}

export async function markClientNotificationAsRead(
  notificationId: string
): Promise<ClientNotificationActionResponse> {
  const response = await apiClient.post<ClientNotificationActionResponse>(
    `/client/notifications/${notificationId}/mark-read`,
    null,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

export async function markAllClientNotificationsAsRead(): Promise<ClientNotificationActionResponse> {
  const response = await apiClient.post<ClientNotificationActionResponse>(
    '/client/notifications/mark-all-read',
    null,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

export async function deleteClientNotification(
  notificationId: string
): Promise<ClientNotificationActionResponse> {
  const response = await apiClient.delete<ClientNotificationActionResponse>(
    `/client/notifications/${notificationId}`,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

export async function clearAllClientNotifications(): Promise<ClientNotificationActionResponse> {
  const response = await apiClient.post<ClientNotificationActionResponse>(
    '/client/notifications/clear-all',
    null,
    { timeout: 15000 }
  );
  return response.data ?? {};
}
