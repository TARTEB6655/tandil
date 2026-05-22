import { useMemo } from 'react';
import type { NavigationState } from '@react-navigation/native';
import { useNotificationAlerts } from '../../hooks/useNotificationAlerts';
import { useAppStore } from '../../store';
import {
  getFetcherForRoleApp,
  parseActiveRoleNotificationContext,
} from '../../navigation/notificationRouteUtils';

type Props = {
  navigationState: NavigationState | undefined;
};

const noopFetch = async () => [];

/**
 * Plays notification sound only for the role app currently open (e.g. UserApp = client),
 * after login — not for other roles or login screens.
 */
export function ActiveRoleNotificationSound({ navigationState }: Props) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { roleApp, isOnLoginScreen } = parseActiveRoleNotificationContext(navigationState);

  const fetcher = useMemo(
    () => getFetcherForRoleApp(roleApp) ?? noopFetch,
    [roleApp]
  );

  const enabled = Boolean(isAuthenticated && roleApp && !isOnLoginScreen);

  useNotificationAlerts(enabled, fetcher);

  return null;
}
