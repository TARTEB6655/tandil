import type { NavigationState } from '@react-navigation/native';
import type { NotificationAlertFetcher } from '../types/notificationAlert';
import {
  fetchAdminNotificationsForAlert,
  fetchAreaManagerNotificationsForAlert,
  fetchClientNotificationsForAlert,
  fetchHrNotificationsForAlert,
  fetchSupervisorNotificationsForAlert,
  fetchTechnicianNotificationsForAlert,
} from '../services/roleNotificationAlerts';

/** Root app routes that have a notifications API + alert sound. */
export const ROLE_APP_NOTIFICATION_FETCHERS: Record<string, NotificationAlertFetcher> = {
  UserApp: fetchClientNotificationsForAlert,
  TechnicianApp: fetchTechnicianNotificationsForAlert,
  SupervisorApp: fetchSupervisorNotificationsForAlert,
  AreaManagerApp: fetchAreaManagerNotificationsForAlert,
  HRManagerApp: fetchHrNotificationsForAlert,
  AdminApp: fetchAdminNotificationsForAlert,
};

const LOGIN_SCREEN_NAMES = new Set(['Login', 'TechnicianSignup']);

function collectRouteNames(state: NavigationState | undefined): string[] {
  const names: string[] = [];
  let current: NavigationState | undefined = state;
  while (current?.routes?.length) {
    const index = current.index ?? 0;
    const route = current.routes[index];
    if (!route) break;
    names.push(route.name);
    current = route.state as NavigationState | undefined;
  }
  return names;
}

export type ActiveRoleNotificationContext = {
  /** Root stack route, e.g. UserApp, TechnicianApp */
  roleApp: string | null;
  isOnLoginScreen: boolean;
};

/**
 * Only the role app the user opened (root route) — not other roles.
 */
export function parseActiveRoleNotificationContext(
  state: NavigationState | undefined
): ActiveRoleNotificationContext {
  const names = collectRouteNames(state);
  const root = names[0];
  const leaf = names[names.length - 1] ?? root;

  if (!root || !(root in ROLE_APP_NOTIFICATION_FETCHERS)) {
    return { roleApp: null, isOnLoginScreen: false };
  }

  return {
    roleApp: root,
    isOnLoginScreen: LOGIN_SCREEN_NAMES.has(leaf),
  };
}

export function getFetcherForRoleApp(
  roleApp: string | null
): NotificationAlertFetcher | null {
  if (!roleApp) return null;
  return ROLE_APP_NOTIFICATION_FETCHERS[roleApp] ?? null;
}
