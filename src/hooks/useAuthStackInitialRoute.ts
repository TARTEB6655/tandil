import { useEffect, useState } from 'react';
import type { LoginApiRole } from '../services/authTypes';
import { authService } from '../services/authService';
import { roleMatchesPortal } from '../utils/sessionRestore';

type StaffStackRoute = 'Login' | 'Main';

/** Pick Login vs Main for staff app stacks when session already exists. */
export function useAuthStackInitialRoute(expectedRole: LoginApiRole): StaffStackRoute | null {
  const [initialRoute, setInitialRoute] = useState<StaffStackRoute | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await authService.getStoredToken();
      const role = await authService.getStoredRole();
      const user = await authService.getStoredUser();
      const canEnterMain =
        Boolean(token && user && roleMatchesPortal(role, expectedRole));

      if (!cancelled) {
        setInitialRoute(canEnterMain ? 'Main' : 'Login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expectedRole]);

  return initialRoute;
}
