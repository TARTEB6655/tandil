/** Normalized notification row for in-app alert polling (all roles). */
export interface NotificationAlertItem {
  id: string;
  read_at?: string | null;
  data?: {
    title?: string;
    message?: string;
    type?: string;
  };
}

export type NotificationAlertFetcher = () => Promise<NotificationAlertItem[]>;
