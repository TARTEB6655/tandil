import type { ForgotPasswordRole } from '../services/forgotPasswordTypes';
import { getForgotPasswordRoleTheme } from './forgotPasswordRoleTheme';

/** Open root-level forgot-password flow from any nested login screen. */
export function navigateToForgotPassword(
  navigation: { getParent?: () => unknown; navigate?: (name: string, params?: object) => void },
  role: ForgotPasswordRole,
  options?: { accent?: string }
): void {
  let root: { getParent?: () => unknown; navigate?: (name: string, params?: object) => void } =
    navigation;
  while (root.getParent?.()) {
    root = root.getParent() as typeof root;
  }
  const accent = options?.accent ?? getForgotPasswordRoleTheme(role).accent;
  root.navigate?.('ForgotPasswordFlow', { role, accent });
}
