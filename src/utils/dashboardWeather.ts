import * as Location from 'expo-location';
import { fetchWeather, fetchWeatherByPlaceName, WeatherData } from '../services/weatherService';
import type { UserAddress } from '../services/userService';
import { getDevicePositionWithTimeout } from './deviceLocation';

export type DashboardWeatherResult = {
  weather: WeatherData | null;
  permissionGranted: boolean;
};

const WEATHER_CACHE_MS = 15 * 60 * 1000;
let cachedWeather: { at: number; result: DashboardWeatherResult } | null = null;

export function getCachedDashboardWeather(): DashboardWeatherResult | null {
  if (!cachedWeather) return null;
  if (Date.now() - cachedWeather.at > WEATHER_CACHE_MS) {
    cachedWeather = null;
    return null;
  }
  return cachedWeather.result;
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

/**
 * Load weather for the client home dashboard: GPS first, then saved address when logged in.
 * Results are cached ~15 minutes unless `force` is true.
 */
export async function loadDashboardWeather(
  isAuthenticated: boolean,
  options?: { force?: boolean }
): Promise<DashboardWeatherResult> {
  if (!options?.force) {
    const cached = getCachedDashboardWeather();
    if (cached) return cached;
  }

  let { status } = await Location.getForegroundPermissionsAsync();
  if (status === 'undetermined') {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  const permissionGranted = status === 'granted';

  if (permissionGranted) {
    try {
      const gpsWeather = await weatherFromGps();
      if (gpsWeather) {
        const result = { weather: gpsWeather, permissionGranted: true };
        cachedWeather = { at: Date.now(), result };
        return result;
      }
    } catch {
      // try saved address below
    }
  }

  if (isAuthenticated) {
    try {
      const saved = await weatherFromSavedAddress();
      if (saved) {
        const result = { weather: saved, permissionGranted };
        cachedWeather = { at: Date.now(), result };
        return result;
      }
    } catch {
      // ignore
    }
  }

  const result = { weather: null, permissionGranted };
  cachedWeather = { at: Date.now(), result };
  return result;
}
