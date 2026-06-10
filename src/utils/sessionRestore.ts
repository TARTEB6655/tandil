import type { RootStackParamList } from '../types';
import type { LoginApiRole } from '../services/authTypes';
import { authService } from '../services/authService';
import type { User } from '../types';

export type RootAppRoute = keyof RootStackParamList;

/** Normalize backend role strings for comparison. */
export function normalizeAuthRole(role: string | null | undefined): string | null {
  if (role == null || String(role).trim() === '') return null;
  return String(role).trim().toLowerCase().replace(/\s+/g, '_');
}

const ROLE_TO_ROOT_ROUTE: Record<string, RootAppRoute> = {
  client: 'UserApp',
  admin: 'AdminApp',
  technician: 'TechnicianApp',
  supervisor: 'SupervisorApp',
  hr: 'HRManagerApp',
  hr_manager: 'HRManagerApp',
  area_manager: 'AreaManagerApp',
};

export function rootRouteForRole(role: string | null | undefined): RootAppRoute | null {
  const normalized = normalizeAuthRole(role);
  if (!normalized) return null;
  return ROLE_TO_ROOT_ROUTE[normalized] ?? null;
}

export function roleMatchesPortal(
  storedRole: string | null | undefined,
  expectedRole: LoginApiRole
): boolean {
  const stored = normalizeAuthRole(storedRole);
  const expected = normalizeAuthRole(expectedRole);
  if (!stored || !expected) return false;
  if (stored === expected) return true;
  if (expected === 'hr' && (stored === 'hr' || stored === 'hr_manager')) return true;
  return false;
}

/** Restore user session into the store and return the root route to open. */
export async function restoreSessionAndGetRoute(
  setUser: (user: User | null) => void,
  setAuthenticated: (value: boolean) => void
): Promise<RootAppRoute> {
  try {
    const token = await authService.getStoredToken();
    const storedRole = await authService.getStoredRole();
    const user = await authService.getStoredUser();
    const rootRoute = rootRouteForRole(storedRole);

    if (token && user && rootRoute) {
      setUser(user);
      setAuthenticated(true);
      return rootRoute;
    }

    await authService.clearLocalSession();
    setUser(null);
    setAuthenticated(false);
  } catch (error) {
    console.error('Session restore failed:', error);
    setUser(null);
    setAuthenticated(false);
  }

  return 'RoleSelection';
}
