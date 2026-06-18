/**
 * Get address fields from current device location (GPS + localized reverse geocode).
 * Used to pre-fill Address and City on Add/Edit Address forms and checkout.
 */
import i18n from '../i18n';
import {
  ensureForegroundLocationPermission,
  getDevicePositionForUserAction,
} from './deviceLocation';
import { reverseGeocodeForApp } from './localizedReverseGeocode';

export interface AddressFromLocation {
  street_address: string;
  city: string;
  state: string;
  country: string;
  zip_code: string;
}

export type AddressFromLocationResult =
  | { ok: true; address: AddressFromLocation }
  | { ok: false; error: string };

function partsToAddress(
  parts: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  },
  fallbackStreet: string
): AddressFromLocation {
  return {
    street_address: parts.street.trim() || fallbackStreet,
    city: parts.city.trim(),
    state: parts.state.trim(),
    country: parts.country.trim() || 'UAE',
    zip_code: parts.zipCode.trim(),
  };
}

/**
 * Request location permission, get current position, reverse geocode to address parts.
 * Returns address fields in the app's selected language when possible.
 */
export async function getAddressFromCurrentLocation(
  languageCode?: string
): Promise<AddressFromLocationResult> {
  try {
    const permission = await ensureForegroundLocationPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'Location permission denied' };
    }

    const position = await getDevicePositionForUserAction();
    if (!position) {
      return { ok: false, error: 'Failed to get location' };
    }
    return getAddressFromCoordinates(
      position.coords.latitude,
      position.coords.longitude,
      languageCode
    );
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message ?? 'Failed to get location',
    };
  }
}

/**
 * Reverse geocode given coordinates (e.g. when user picks a point on the map).
 * Uses the app language unless languageCode is passed explicitly.
 */
export async function getAddressFromCoordinates(
  latitude: number,
  longitude: number,
  languageCode?: string
): Promise<AddressFromLocationResult> {
  try {
    const lang = languageCode ?? i18n.language;
    const parts = await reverseGeocodeForApp(latitude, longitude, lang);
    if (!parts) {
      return { ok: false, error: 'Could not get address for this location' };
    }
    return {
      ok: true,
      address: partsToAddress(parts, 'Selected location'),
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message ?? 'Failed to get address',
    };
  }
}
