import * as Location from 'expo-location';

const DEFAULT_GPS_TIMEOUT_MS = 8000;
const USER_ACTION_GPS_TIMEOUT_MS = 15000;
const DEFAULT_LAST_KNOWN_MAX_AGE_MS = 300_000;
const USER_ACTION_LAST_KNOWN_MAX_AGE_MS = 600_000;

export type ForegroundLocationPermission = 'granted' | 'denied';

/**
 * Check or request foreground location permission.
 * Does not re-prompt when the user already denied — returns `denied` so UI can open Settings.
 */
export async function ensureForegroundLocationPermission(): Promise<ForegroundLocationPermission> {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.status === 'granted' ? 'granted' : 'denied';
}

/**
 * Fast device position: last-known first, then GPS with a timeout so UI does not hang.
 */
export async function getDevicePositionWithTimeout(options?: {
  timeoutMs?: number;
  maxLastKnownAgeMs?: number;
}): Promise<Location.LocationObject | null> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_GPS_TIMEOUT_MS;
  const maxAge = options?.maxLastKnownAgeMs ?? DEFAULT_LAST_KNOWN_MAX_AGE_MS;

  const last = await Location.getLastKnownPositionAsync({ maxAge });
  if (last) return last;

  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS timeout')), timeoutMs)
      ),
    ]);
  } catch {
    return null;
  }
}

/**
 * When the user taps "Use my location", prefer a fresh GPS fix with a longer timeout.
 */
export async function getDevicePositionForUserAction(): Promise<Location.LocationObject | null> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return null;

  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS timeout')), USER_ACTION_GPS_TIMEOUT_MS)
      ),
    ]);
    if (fresh) return fresh;
  } catch {
    // fall through
  }

  const balanced = await getDevicePositionWithTimeout({
    timeoutMs: 12000,
    maxLastKnownAgeMs: USER_ACTION_LAST_KNOWN_MAX_AGE_MS,
  });
  if (balanced) return balanced;

  return Location.getLastKnownPositionAsync({ maxAge: USER_ACTION_LAST_KNOWN_MAX_AGE_MS });
}
