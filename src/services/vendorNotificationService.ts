import apiClient from './api';

/** Item from GET /api/vendor/notifications (Laravel database notifications) */
export interface VendorNotification {
  id: string;
  type: string;
  notifiable_type?: string;
  notifiable_id?: number;
  data?: {
    title?: string;
    message?: string;
    type?: string;
    meta?: Record<string, unknown> | unknown[] | null;
  };
  read_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface VendorNotificationsListResponse {
  success?: boolean;
  message?: string;
  data?: {
    /** Laravel paginator object, or in some builds a plain array of rows */
    notifications?:
      | {
          current_page?: number;
          data?: VendorNotification[] | Record<string, VendorNotification> | null;
          last_page?: number;
          total?: number;
          per_page?: number;
        }
      | VendorNotification[]
      | null;
    unread_count?: number;
  };
}

/** Normalize paginator `data` (array or keyed object) into a list of notification rows */
function coerceVendorNotificationRows(raw: unknown): VendorNotification[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (row): row is VendorNotification =>
        Boolean(row) && typeof row === 'object' && (row as VendorNotification).id != null
    );
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).filter(
      (v): v is VendorNotification =>
        Boolean(v) && typeof v === 'object' && (v as VendorNotification).id != null
    );
  }
  return [];
}

export interface GetVendorNotificationsResult {
  list: VendorNotification[];
  unreadCount: number;
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
}

/**
 * GET /api/vendor/notifications?per_page=&page=
 * Returns paginated notifications and unread_count. Requires Bearer token.
 */
export async function getVendorNotifications(params?: {
  per_page?: number;
  page?: number;
}): Promise<GetVendorNotificationsResult> {
  const response = await apiClient.get<VendorNotificationsListResponse>('/vendor/notifications', {
    params: { per_page: params?.per_page ?? 20, page: params?.page ?? 1 },
    timeout: 15000,
  });
  const payload = response.data?.data;
  const notifications = payload?.notifications;
  if (notifications == null) {
    return { list: [], unreadCount: 0, currentPage: 1, lastPage: 1, total: 0, perPage: 20 };
  }

  let list: VendorNotification[] = [];
  let currentPage = 1;
  let lastPage = 1;
  let total = 0;
  let perPage = 20;

  if (Array.isArray(notifications)) {
    list = coerceVendorNotificationRows(notifications);
    total = list.length;
  } else if (typeof notifications === 'object') {
    const paginator = notifications as {
      data?: unknown;
      current_page?: number;
      last_page?: number;
      total?: number;
      per_page?: number;
    };
    list = coerceVendorNotificationRows(paginator.data);
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

export interface VendorNotificationActionResponse {
  success?: boolean;
  message?: string;
}

/**
 * POST /api/vendor/notifications/clear-all
 * Clear all notifications for the vendor. Requires Bearer token.
 */
export async function clearVendorNotifications(): Promise<VendorNotificationActionResponse> {
  const response = await apiClient.post<VendorNotificationActionResponse>(
    '/vendor/notifications/clear-all',
    null,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

/**
 * POST /api/vendor/notifications/:notification_id/mark-read
 * Mark a single notification as read. Requires Bearer token.
 */
export async function markVendorNotificationRead(
  notificationId: string | number
): Promise<VendorNotificationActionResponse> {
  const response = await apiClient.post<VendorNotificationActionResponse>(
    `/vendor/notifications/${notificationId}/mark-read`,
    null,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

/**
 * POST /api/vendor/notifications/mark-all-read
 * Mark all notifications as read. Requires Bearer token.
 */
export async function markVendorNotificationsReadAll(): Promise<VendorNotificationActionResponse> {
  const response = await apiClient.post<VendorNotificationActionResponse>(
    '/vendor/notifications/mark-all-read',
    null,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

/**
 * DELETE /api/vendor/notifications/:notification_id
 * Delete a single notification. Requires Bearer token.
 */
export async function deleteVendorNotification(
  notificationId: string
): Promise<VendorNotificationActionResponse> {
  const response = await apiClient.delete<VendorNotificationActionResponse>(
    `/vendor/notifications/${notificationId}`,
    { timeout: 15000 }
  );
  return response.data ?? {};
}
