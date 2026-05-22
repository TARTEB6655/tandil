import * as Location from 'expo-location';
import { fetchWeather, fetchWeatherByPlaceName, WeatherData } from '../services/weatherService';
import type { UserAddress } from '../services/userService';

export type DashboardWeatherResult = {
  weather: WeatherData | null;
  permissionGranted: boolean;
};

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

  let position: Location.LocationObject | null = null;
  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 300_000 });
    position = last;
  }
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
 */
export async function loadDashboardWeather(isAuthenticated: boolean): Promise<DashboardWeatherResult> {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  const permissionGranted = status === 'granted';

  if (permissionGranted) {
    try {
      const gpsWeather = await weatherFromGps();
      if (gpsWeather) {
        return { weather: gpsWeather, permissionGranted: true };
      }
    } catch {
      // try saved address below
    }
  }

  if (isAuthenticated) {
    try {
      const saved = await weatherFromSavedAddress();
      if (saved) {
        return { weather: saved, permissionGranted };
      }
    } catch {
      // ignore
    }
  }

  return { weather: null, permissionGranted };
}
