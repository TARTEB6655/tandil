import * as Location from 'expo-location';
import { fetchWeather, fetchWeatherByPlaceName, WeatherData } from '../services/weatherService';
import type { UserAddress } from '../services/userService';
import {
  getDevicePositionWithTimeout,
  resolveLocationAccessForApp,
} from './deviceLocation';

export type DashboardWeatherPermission = 'granted' | 'denied' | 'undetermined';

export type DashboardWeatherResult = {
  weather: WeatherData | null;
  permissionStatus: DashboardWeatherPermission;
  /** @deprecated Use permissionStatus === 'granted' */
  permissionGranted: boolean;
};

const WEATHER_CACHE_MS = 15 * 60 * 1000;
let cachedWeather: {
  at: number;
  forAuthenticated: boolean;
  result: DashboardWeatherResult;
} | null = null;

export function getCachedDashboardWeather(isAuthenticated: boolean): DashboardWeatherResult | null {
  if (!cachedWeather) return null;
  if (cachedWeather.forAuthenticated !== isAuthenticated) return null;
  if (Date.now() - cachedWeather.at > WEATHER_CACHE_MS) {
    cachedWeather = null;
    return null;
  }
  return cachedWeather.result;
}

export function clearDashboardWeatherCache(): void {
  cachedWeather = null;
}

/** Drop stale cache when OS permission no longer matches what we cached. */
export async function reconcileWeatherCacheWithSystem(
  isAuthenticated: boolean
): Promise<DashboardWeatherPermission> {
  const live = await resolveLocationAccessForApp();
  if (!cachedWeather || cachedWeather.forAuthenticated !== isAuthenticated) {
    return live;
  }
  if (cachedWeather.result.permissionStatus !== live) {
    cachedWeather = null;
  }
  return live;
}

function formatExpoGeocode(place: Location.LocationGeocodedAddress): string | null {
  const city =
    place.city ??
    place.subregion ??
    place.district ??
    place.region ??
    place.name;
  const country = place.country;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  if (place.formattedAddress?.trim()) return place.formattedAddress.trim();
  return null;
}

function formatSavedAddressLabel(addr: UserAddress): string {
  const city = addr.city?.trim();
  const country = addr.country?.trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return addr.street_address?.trim() || '';
}

async function resolveLocationName(latitude: number, longitude: number): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (place) return formatExpoGeocode(place);
  } catch {
    // fall through — fetchWeather also tries Nominatim
  }
  return null;
}

async function weatherFromGps(): Promise<WeatherData | null> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return null;

  const position = await getDevicePositionWithTimeout();
  if (!position) return null;

  const { latitude, longitude } = position.coords;
  const data = await fetchWeather(latitude, longitude);
  if (!data) return null;

  const deviceName = await resolveLocationName(latitude, longitude);
  if (deviceName) {
    return { ...data, locationName: deviceName };
  }
  return data;
}

async function weatherFromSavedAddress(): Promise<WeatherData | null> {
  const { getUserAddresses } = await import('../services/userService');
  const addresses = await getUserAddresses();
  if (!addresses.length) return null;

  const preferred =
    addresses.find((a) => a.is_default === true || a.is_default === 1) ??
    addresses.find((a) => a.city?.trim()) ??
    addresses[0];
  const label = formatSavedAddressLabel(preferred);
  if (!label) return null;

  const fromPlace = await fetchWeatherByPlaceName(preferred.city || label, preferred.country);
  if (fromPlace) {
    return { ...fromPlace, locationName: label };
  }

  return {
    temperature: 0,
    weatherCode: 0,
    condition: '—',
    locationName: label,
  };
}

function toResult(
  weather: WeatherData | null,
  permissionStatus: DashboardWeatherPermission
): DashboardWeatherResult {
  return {
    weather,
    permissionStatus,
    permissionGranted: permissionStatus === 'granted',
  };
}

function maybeCacheResult(
  result: DashboardWeatherResult,
  isAuthenticated: boolean
): DashboardWeatherResult {
  if (result.permissionStatus === 'granted' && result.weather) {
    cachedWeather = { at: Date.now(), forAuthenticated: isAuthenticated, result };
  }
  return result;
}

/**
 * Load weather for the client home dashboard.
 * Denied / undetermined results are never cached so Settings changes apply immediately.
 */
export async function loadDashboardWeather(
  isAuthenticated: boolean,
  options?: { force?: boolean; requestPermission?: boolean }
): Promise<DashboardWeatherResult> {
  await reconcileWeatherCacheWithSystem(isAuthenticated);

  if (!options?.force && !options?.requestPermission) {
    const cached = getCachedDashboardWeather(isAuthenticated);
    if (cached) return cached;
  }

  const permissionStatus = await resolveLocationAccessForApp({
    requestIfNeeded: options?.requestPermission ?? false,
  });

  if (permissionStatus === 'denied') {
    return toResult(null, 'denied');
  }

  if (permissionStatus === 'granted') {
    try {
      const gpsWeather = await weatherFromGps();
      if (gpsWeather) {
        return maybeCacheResult(toResult(gpsWeather, 'granted'), isAuthenticated);
      }
    } catch {
      // try saved address below (logged-in only)
    }

    if (isAuthenticated) {
      try {
        const saved = await weatherFromSavedAddress();
        if (saved) {
          return maybeCacheResult(toResult(saved, 'granted'), isAuthenticated);
        }
      } catch {
        // ignore
      }
    }

    return toResult(null, 'granted');
  }

  return toResult(null, 'undetermined');
}
