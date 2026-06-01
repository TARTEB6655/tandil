import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/** Open client login from nested UserApp screens (root stack: Auth). */
export function navigateToClientAuth(navigation: NavigationProp<ParamListBase>): void {
  let nav: NavigationProp<ParamListBase> | undefined = navigation;
  for (let i = 0; i < 4 && nav; i++) {
    const state = nav.getState?.();
    const routeNames = state?.routeNames as string[] | undefined;
    if (routeNames?.includes('Auth')) {
      nav.navigate('Auth' as never, { role: 'client' } as never);
      return;
    }
    nav = nav.getParent?.() as NavigationProp<ParamListBase> | undefined;
  }
  navigation.navigate('Auth' as never, { role: 'client' } as never);
}

/** Guest browse: root UserApp (tabs). */
export function navigateToGuestUserApp(navigation: NavigationProp<ParamListBase>): void {
  navigation.reset({
    index: 0,
    routes: [{ name: 'UserApp' as never }],
  });
}
