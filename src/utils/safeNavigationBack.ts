import type { ForgotPasswordRole } from '../services/forgotPasswordTypes';

type NavLike = {
  canGoBack?: () => boolean;
  goBack?: () => void;
  getParent?: () => NavLike | undefined;
  navigate?: (name: string, params?: object) => void;
};

export function getRootNavigation(navigation: NavLike): NavLike {
  let root: NavLike = navigation;
  while (root.getParent?.()) {
    root = root.getParent() as NavLike;
  }
  return root;
}

/** Avoid React Navigation "GO_BACK was not handled" when the stack has no prior screen. */
export function safeGoBack(
  navigation: NavLike,
  options?: { fallbackRoute?: string }
): void {
  if (navigation.canGoBack?.()) {
    navigation.goBack?.();
    return;
  }
  const parent = navigation.getParent?.();
  if (parent?.canGoBack?.()) {
    parent.goBack?.();
    return;
  }
  const root = getRootNavigation(navigation);
  if (root !== navigation && root.canGoBack?.()) {
    root.goBack?.();
    return;
  }
  const fallback = options?.fallbackRoute ?? 'RoleSelection';
  root.navigate?.(fallback);
}

function forgotPasswordPortalRoute(role: ForgotPasswordRole): {
  name: string;
  params?: object;
} {
  switch (role) {
    case 'client':
      return { name: 'Auth', params: { role: 'client' } };
    case 'vendor':
      return { name: 'VendorApp' };
    case 'admin':
      return { name: 'AdminApp' };
    case 'technician':
      return { name: 'TechnicianApp' };
    case 'supervisor':
      return { name: 'SupervisorApp' };
    case 'area_manager':
      return { name: 'AreaManagerApp' };
    case 'hr':
      return { name: 'HRManagerApp' };
    case 'delivery':
      return { name: 'DeliveryApp' };
    default:
      return { name: 'RoleSelection' };
  }
}

/**
 * Close the root ForgotPasswordFlow screen and return to the portal login.
 * Must pop the root stack — inner stack goBack() only returns to OTP / phone steps.
 */
export function exitForgotPasswordFlow(
  navigation: NavLike,
  role?: ForgotPasswordRole
): void {
  const root = getRootNavigation(navigation);

  if (root.canGoBack?.()) {
    root.goBack();
    return;
  }

  if (role) {
    const target = forgotPasswordPortalRoute(role);
    root.navigate?.(target.name, target.params);
    return;
  }

  root.navigate?.('RoleSelection');
}
