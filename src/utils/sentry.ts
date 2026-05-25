/**
 * Crash reporting disabled — sentry-expo@7 bundles @sentry/react-native@5.x, which breaks
 * Expo SDK 53 / React Native 0.79 and caused white-screen launches on TestFlight.
 * Re-enable later with @sentry/react-native matching Expo's recommended version.
 */

export function initSentry(): void {
  /* no-op */
}

export function initSentryDeferred(): void {
  /* no-op */
}

export function captureException(
  _error: unknown,
  _options?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
): void {
  /* no-op */
}

export function captureTestEvent(): boolean {
  return false;
}
