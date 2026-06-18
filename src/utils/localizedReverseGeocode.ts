/**
 * Reverse geocode coordinates using the app's selected language (en / ar / ur).
 * Uses Nominatim with Accept-Language + namedetails; falls back to expo-location.
 */
import * as Location from 'expo-location';
import i18n from '../i18n';
import {
  isArabicScript,
  isMostlyLatin,
  transliterateStreetLabel,
} from './latinToArabicStreet';

export type LocalizedAddressParts = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};

type NominatimAddress = Record<string, string | undefined>;

type NominatimResponse = {
  address?: NominatimAddress;
  display_name?: string;
  name?: string;
  namedetails?: Record<string, string | undefined>;
};

const NOMINATIM_USER_AGENT = 'Tandil/1.0 (https://tandilapp.com; contact@tandilapp.com)';
const NOMINATIM_TIMEOUT_MS = 4500;

export function appLanguageToAcceptLanguage(languageCode?: string): string {
  const code = (languageCode ?? i18n.language ?? 'en').split('-')[0]?.toLowerCase();
  if (code === 'ar') return 'ar';
  if (code === 'ur') return 'ur,ar,en';
  return 'en';
}

function appLanguageCode(languageCode?: string): 'en' | 'ar' | 'ur' {
  const code = (languageCode ?? i18n.language ?? 'en').split('-')[0]?.toLowerCase();
  if (code === 'ar') return 'ar';
  if (code === 'ur') return 'ur';
  return 'en';
}

function pickLocalizedName(
  namedetails: Record<string, string | undefined> | undefined,
  lang: 'en' | 'ar' | 'ur',
  topLevelName?: string
): string {
  if (!namedetails && !topLevelName) return '';

  const preferKeys =
    lang === 'ar'
      ? ['name:ar', 'alt_name:ar', 'name', 'name:en']
      : lang === 'ur'
        ? ['name:ur', 'name:ar', 'alt_name:ar', 'name', 'name:en']
        : ['name:en', 'name'];

  for (const key of preferKeys) {
    const value = namedetails?.[key]?.trim();
    if (value) {
      if (lang === 'en' || isArabicScript(value) || !isMostlyLatin(value)) return value;
    }
  }

  if (topLevelName?.trim()) {
    const value = topLevelName.trim();
    if (lang === 'en' || isArabicScript(value) || !isMostlyLatin(value)) return value;
  }

  return namedetails?.name?.trim() || topLevelName?.trim() || '';
}

function pickStreetFromAddress(
  addr: NominatimAddress,
  displayName: string | undefined,
  localizedName: string
): string {
  if (localizedName) return localizedName;

  const candidates = [
    addr.road,
    addr.pedestrian,
    addr.residential,
    addr.footway,
    addr.neighbourhood,
    addr.suburb,
    addr.quarter,
    addr.hamlet,
  ].filter((v): v is string => Boolean(v?.trim()));

  const arabicCandidate = candidates.find((v) => isArabicScript(v));
  if (arabicCandidate) return arabicCandidate;

  if (addr.house_number && addr.road) {
    return `${addr.road} ${addr.house_number}`.trim();
  }

  const named = candidates[0];
  if (named) return named;

  if (displayName) {
    const first = displayName.split(',')[0]?.trim();
    if (first) return first;
  }

  return '';
}

function pickCity(addr: NominatimAddress): string {
  const candidates = [
    addr.city,
    addr.town,
    addr.village,
    addr.municipality,
    addr.county,
    addr.state_district,
    addr.suburb,
  ].filter((v): v is string => Boolean(v?.trim()));

  return candidates.find((v) => isArabicScript(v)) ?? candidates[0] ?? '';
}

function pickState(addr: NominatimAddress): string {
  const candidates = [addr.state, addr.region, addr.province].filter(
    (v): v is string => Boolean(v?.trim())
  );
  return candidates.find((v) => isArabicScript(v)) ?? candidates[0] ?? '';
}

function localizeStreetIfNeeded(
  street: string,
  lang: 'en' | 'ar' | 'ur',
  expoStreet?: string | null
): string {
  if (!street.trim() && expoStreet?.trim()) return expoStreet.trim();
  if (lang === 'en') return street;

  if (street.trim() && isArabicScript(street)) return street;
  if (expoStreet?.trim() && isArabicScript(expoStreet)) return expoStreet.trim();

  if (street.trim() && isMostlyLatin(street)) {
    return transliterateStreetLabel(street, lang);
  }

  return street;
}

async function reverseGeocodeWithNominatim(
  latitude: number,
  longitude: number,
  acceptLanguage: string,
  lang: 'en' | 'ar' | 'ur'
): Promise<LocalizedAddressParts | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}` +
    `&format=json&addressdetails=1&namedetails=1&accept-language=${encodeURIComponent(acceptLanguage)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Language': acceptLanguage,
        'User-Agent': NOMINATIM_USER_AGENT,
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as NominatimResponse;
    const addr = data.address ?? {};
    const localizedName = pickLocalizedName(data.namedetails, lang, data.name);
    const streetRaw = pickStreetFromAddress(addr, data.display_name, localizedName);
    const city = pickCity(addr);
    const state = pickState(addr);
    const zipCode = addr.postcode ?? '';
    const country = addr.country ?? '';

    if (!streetRaw && !city && !state && !country) return null;

    return { street: streetRaw, city, state, zipCode, country };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function reverseGeocodeWithExpo(
  latitude: number,
  longitude: number
): Promise<LocalizedAddressParts | null> {
  const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
  if (!place) return null;

  const streetParts = [place.street, place.name, place.district].filter(Boolean);
  const street = streetParts.join(', ');
  return {
    street,
    city: place.city ?? place.subregion ?? '',
    state: place.region ?? place.subregion ?? '',
    zipCode: place.postalCode ?? '',
    country: place.country ?? '',
  };
}

function mergeLocalizedParts(
  nominatim: LocalizedAddressParts | null,
  expo: LocalizedAddressParts | null,
  lang: 'en' | 'ar' | 'ur'
): LocalizedAddressParts | null {
  if (nominatim) {
    return {
      ...nominatim,
      street: localizeStreetIfNeeded(nominatim.street, lang, expo?.street),
      city: nominatim.city || expo?.city || '',
      state: nominatim.state || expo?.state || '',
      zipCode: nominatim.zipCode || expo?.zipCode || '',
      country: nominatim.country || expo?.country || '',
    };
  }

  if (expo) {
    return {
      ...expo,
      street: localizeStreetIfNeeded(expo.street, lang, null),
    };
  }

  return null;
}

/** Reverse geocode for checkout / address forms in the user's app language. */
export async function reverseGeocodeForApp(
  latitude: number,
  longitude: number,
  languageCode?: string
): Promise<LocalizedAddressParts | null> {
  const acceptLanguage = appLanguageToAcceptLanguage(languageCode);
  const lang = appLanguageCode(languageCode);

  if (lang === 'en') {
    const expo = await reverseGeocodeWithExpo(latitude, longitude);
    if (expo && (expo.street || expo.city || expo.country)) {
      return expo;
    }
    return reverseGeocodeWithNominatim(latitude, longitude, acceptLanguage, lang);
  }

  const [nominatim, expo] = await Promise.all([
    reverseGeocodeWithNominatim(latitude, longitude, acceptLanguage, lang),
    reverseGeocodeWithExpo(latitude, longitude),
  ]);

  return mergeLocalizedParts(nominatim, expo, lang);
}

/** Short "City, Country" label for weather / dashboard. */
export async function reverseGeocodeLocationLabel(
  latitude: number,
  longitude: number,
  languageCode?: string
): Promise<string | null> {
  const parts = await reverseGeocodeForApp(latitude, longitude, languageCode);
  if (!parts) return null;
  if (parts.city && parts.country) return `${parts.city}, ${parts.country}`;
  if (parts.city) return parts.city;
  if (parts.country) return parts.country;
  if (parts.street) return parts.street;
  return null;
}
