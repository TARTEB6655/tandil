import { authService } from '../services/authService';
import { useAppStore } from '../store';

/** Clear API tokens and in-memory auth so UI matches server (e.g. after 401). */
export async function invalidateClientSession(): Promise<void> {
  await authService.clearLocalSession();
  useAppStore.getState().setUser(null);
  useAppStore.getState().setAuthenticated(false);
}

export function isUnauthenticatedError(err: unknown): boolean {
  const ax = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
  const status = ax?.response?.status;
  const message = String(ax?.response?.data?.message ?? ax?.message ?? '');
  return status === 401 || /unauthenticated/i.test(message);
}
