/**
 * Weather by current location using Open-Meteo (free, no API key).
 * Uses expo-location for coordinates; Open-Meteo for weather; Nominatim for location name.
 */
import i18n from '../i18n';
import { appLanguageToAcceptLanguage } from '../utils/localizedReverseGeocode';

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  condition: string;
  humidity?: number;
  locationName: string;
  /** Fallback when reverse geocode fails: e.g. "12.34, 56.78" */
  coordinates?: string;
}

/** Open-Meteo WMO weather codes to short labels */
const WEATHER_LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light rain showers',
  81: 'Rain showers',
  82: 'Heavy rain showers',
  85: 'Light snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
};

function getWeatherCondition(code: number): string {
  return WEATHER_LABELS[code] ?? 'Unknown';
}

/**
 * Fetch current weather for lat/lon from Open-Meteo (no API key).
 */
export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code`;
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json();
    const current = data?.current;
    if (!current) return null;
    const weatherCode = Number(current.weather_code) || 0;
    const locationName = await fetchLocationName(
      latitude,
      longitude,
      appLanguageToAcceptLanguage(i18n.language)
    );
    const coordinates = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    return {
      temperature: Number(current.temperature_2m) ?? 0,
      weatherCode,
      condition: getWeatherCondition(weatherCode),
      humidity: current.relative_humidity_2m != null ? Number(current.relative_humidity_2m) : undefined,
      locationName: locationName || 'Current location',
      coordinates,
    };
  } catch (_) {
    return null;
  }
}

/**
 * Reverse geocode lat/lon to a place name (Nominatim, free).
 * Uses multiple address fields so we get a name in more regions.
 */
async function fetchLocationName(
  latitude: number,
  longitude: number,
  acceptLanguage = 'en'
): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Language': acceptLanguage,
        'User-Agent': 'Tandil/1.0 (https://tandilapp.com; contact@tandilapp.com)',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address;
    if (!addr) return null;
    const city =
      addr.city ??
      addr.town ??
      addr.village ??
      addr.municipality ??
      addr.county ??
      addr.state_district ??
      addr.suburb ??
      addr.neighbourhood ??
      addr.state ??
      addr.region;
    const country = addr.country;
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Geocode a city/place name (Open-Meteo) and return current weather — fallback when GPS is off.
 */
export async function fetchWeatherByPlaceName(
  city: string,
  country?: string | null
): Promise<WeatherData | null> {
  const query = [city?.trim(), country?.trim()].filter(Boolean).join(', ');
  if (!query) return null;
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, { method: 'GET' });
    const geoData = await geoRes.json();
    const hit = geoData?.results?.[0];
    if (!hit?.latitude || !hit?.longitude) return null;

    const weather = await fetchWeather(Number(hit.latitude), Number(hit.longitude));
    if (!weather) return null;

    const label =
      hit.name && hit.country ? `${hit.name}, ${hit.country}` : hit.name || query;
    return { ...weather, locationName: label };
  } catch {
    return null;
  }
}
