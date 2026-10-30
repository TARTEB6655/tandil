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

/** Leave forgot-password flow (root modal) and return to login / role picker. */
export function exitForgotPasswordFlow(navigation: NavLike): void {
  safeGoBack(navigation, { fallbackRoute: 'RoleSelection' });
}
