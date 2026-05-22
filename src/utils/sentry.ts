/**
 * Sentry runs only in staging/production builds (when __DEV__ is false).
 *
 * In development (npx expo start), we do NOT load sentry-expo at all. Loading it causes:
 *   TypeError: Cannot read property '__extends' of undefined
 * (known sentry-expo + Hermes/Expo Go issue). So in dev, init/capture are no-ops.
 *
 * To see errors in Sentry: use an EAS build (preview or production), install it, then
 * errors and the "Send test error" buttons in Settings will report to Sentry.
 *
 * initSentry() is called from index.ts before any app code runs.
 */

import Constants from 'expo-constants';

let _sentry: typeof import('sentry-expo') | null = null;

function getSentry() {
  if (__DEV__) return null;
  if (_sentry == null) {
    try {
      _sentry = require('sentry-expo');
    } catch (e) {
      console.warn('sentry-expo load failed:', e);
      return null;
    }
  }
  return _sentry;
}

function getSentryEnvironment(): 'staging' | 'production' {
  try {
    const profile =
      Constants.expoConfig?.extra?.easBuildProfile ??
      (Constants as any).manifest?.extra?.easBuildProfile ??
      (Constants as any).manifest2?.extra?.expoConfig?.extra?.easBuildProfile;
    return profile === 'preview' ? 'staging' : 'production';
  } catch {
    return 'production';
  }
}

const SENTRY_DSN =
  'https://153e5ed50614a93604c7331d8ca788c0@o4510877188685824.ingest.us.sentry.io/4510877220929536';

export function initSentry() {
  if (__DEV__) return;
  try {
    const Sentry = getSentry();
    if (Sentry) {
      Sentry.init({
        dsn: SENTRY_DSN,
        enableInExpoDevelopment: false,
        debug: false,
        environment: getSentryEnvironment(),
        tracesSampleRate: 0.2,
        enableAutoSessionTracking: true,
        enableNative: false,
      });
    }
  } catch (e) {
    console.warn('Sentry init failed:', e);
  }
}

/** Run after first paint so a broken sentry-expo load cannot block app registration. */
export function initSentryDeferred(): void {
  if (__DEV__) return;
  const run = () => {
    try {
      initSentry();
    } catch (e) {
      console.warn('Sentry deferred init failed:', e);
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

export function captureException(error: unknown, options?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) {
  if (__DEV__) return;
  try {
    const Sentry = getSentry();
    if (Sentry?.React?.captureException) {
      Sentry.React.captureException(error, options);
    }
  } catch (e) {
    console.warn('Sentry captureException failed:', e);
  }
}

/** Send a test error to Sentry. Only sends in staging/production builds. */
export function captureTestEvent(): boolean {
  if (__DEV__) return false;
  try {
    const Sentry = getSentry();
    if (Sentry?.React?.captureException) {
      Sentry.React.captureException(new Error('Tandil Sentry test event'), { tags: { test: 'true' } });
      return true;
    }
  } catch (e) {
    console.warn('Sentry test event failed:', e);
  }
  return false;
}
