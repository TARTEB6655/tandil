import apiClient from './api';
import { buildFullImageUrl } from '../config/api';

export interface VendorSocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  website?: string;
  tiktok?: string;
}

export interface VendorProfileMenuItem {
  id: string;
  title: string;
  icon?: string;
}

export interface VendorProfileData {
  vendor_id?: number | string;
  business_name: string;
  authorized_person_name: string;
  email: string;
  phone: string;
  vendor_type?: string;
  vendor_type_label?: string;
  emirate?: string;
  city?: string;
  address?: string;
  description?: string;
  trade_license_number?: string;
  vat_number?: string;
  latitude?: number;
  longitude?: number;
  google_maps_location?: string;
  location_display?: string;
  bank_name?: string;
  iban?: string;
  account_holder_name?: string;
  delivery_radius_km?: number;
  minimum_order_amount?: number;
  opens_at?: string;
  closes_at?: string;
  logo_url?: string;
  profile_picture_url?: string;
  banner_url?: string;
  business_name_note?: string;
  bank_hint?: string;
  branding_hint?: string;
  profile_picture_upload_field?: string;
  operating_hours?: string;
  years_in_business?: string;
  social_links?: VendorSocialLinks;
  status?: string;
  status_label?: string;
  partnership_tier?: string;
  partnership_badge_label?: string;
  member_since?: string;
  /** Profile tab header / summary / stats from GET /vendor/profile */
  header_name?: string;
  header_subtitle?: string;
  professional_category?: string;
  stats_products?: number;
  stats_delivered?: number;
  stats_rating?: number;
  stats_reviews?: number;
  rating_available?: boolean;
  account_settings?: VendorProfileMenuItem[];
  partnership_menu?: VendorProfileMenuItem[];
  emirates?: string[];
  is_approved?: boolean;
}

export interface VendorProfileUpdateParams {
  business_name?: string;
  contact_person: string;
  phone: string;
  address?: string;
  city?: string;
  store_description?: string;
  bank_name?: string;
  iban?: string;
  account_holder_name?: string;
  delivery_radius_km?: number;
  minimum_order_amount?: number;
  opens_at?: string;
  closes_at?: string;
  logo?: { uri: string; type?: string; name?: string };
  profile_picture?: { uri: string; type?: string; name?: string };
  remove_logo?: boolean;
  remove_profile_picture?: boolean;
}

interface VendorProfileResponse {
  success?: boolean;
  status?: boolean;
  message?: string;
  data?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function resolveLogoUrl(...values: unknown[]): string | undefined {
  const raw = pickString(...values);
  if (!raw) return undefined;
  return raw.startsWith('http') ? raw : buildFullImageUrl(raw);
}

function parseMapCoords(location?: string): { latitude?: number; longitude?: number } {
  if (!location?.trim()) return {};
  const parts = location.split(',').map((p) => p.trim());
  if (parts.length < 2) return {};
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
  return { latitude, longitude };
}

function mapMenuItems(raw: unknown): VendorProfileMenuItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = asRecord(row);
      if (!item) return null;
      const id = pickString(item.id);
      const title = pickString(item.title);
      if (!id || !title) return null;
      return {
        id,
        title,
        icon: pickString(item.icon) || undefined,
      };
    })
    .filter((item): item is VendorProfileMenuItem => item != null);
}

function mapEmirates(raw: unknown): string[] {
  const options = asRecord(raw);
  if (!options || !Array.isArray(options.emirates)) return [];
  return options.emirates
    .map((value) => pickString(value))
    .filter((value) => value.length > 0);
}

/**
 * Maps GET /vendor/profile payload.
 * Prefer nested `data.profile.edit_profile` (+ business_information / location_address / payment_methods).
 */
function mapVendorProfileRow(raw: Record<string, unknown>): VendorProfileData {
  const profileRoot = asRecord(raw.profile) ?? raw;
  const header = asRecord(profileRoot.header) ?? {};
  const summary = asRecord(profileRoot.summary) ?? {};
  const edit = asRecord(profileRoot.edit_profile) ?? asRecord(raw.edit_profile) ?? {};
  const storeBranding = asRecord(edit.store_branding) ?? {};
  const businessContact = asRecord(edit.business_contact) ?? {};
  const businessHours = asRecord(edit.business_hours) ?? {};
  const bankAccount = asRecord(edit.bank_account) ?? {};
  const businessInfo = asRecord(profileRoot.business_information) ?? asRecord(raw.business_information) ?? {};
  const locationAddress = asRecord(profileRoot.location_address) ?? asRecord(raw.location_address) ?? {};
  const paymentMethods = asRecord(profileRoot.payment_methods) ?? asRecord(raw.payment_methods) ?? {};
  const readOnly = asRecord(profileRoot.read_only) ?? asRecord(raw.read_only) ?? {};
  const partnershipBadge = asRecord(summary.partnership_badge) ?? {};
  const stats = asRecord(profileRoot.stats) ?? asRecord(raw.stats) ?? {};

  // Legacy flat / nested shapes (fallback)
  const vendor = asRecord(raw.vendor) ?? {};
  const business = asRecord(raw.business) ?? {};
  const bank = asRecord(raw.bank) ?? {};
  const operations = asRecord(raw.operations) ?? {};
  const user = asRecord(raw.user) ?? {};
  const flatProfile = asRecord(raw.profile) && !asRecord(raw.profile)?.edit_profile
    ? (asRecord(raw.profile) ?? {})
    : {};

  const googleMaps = pickString(
    locationAddress.google_maps_location,
    raw.google_maps_location,
    flatProfile.google_maps_location
  );
  const coords = parseMapCoords(googleMaps);

  return {
    vendor_id: readOnly.vendor_id ?? raw.vendor_id ?? vendor.id ?? raw.id,
    business_name: pickString(
      businessContact.business_name,
      businessInfo.business_name,
      raw.business_name,
      raw.company_name,
      business.name,
      vendor.business_name,
      flatProfile.business_name
    ),
    authorized_person_name: pickString(
      businessContact.contact_person,
      header.name,
      raw.authorized_person_name,
      raw.owner_name,
      user.name,
      flatProfile.authorized_person_name,
      vendor.owner_name
    ),
    email: pickString(raw.email, user.email, flatProfile.email, vendor.email),
    phone: pickString(
      businessContact.phone,
      raw.phone,
      user.phone,
      flatProfile.phone,
      vendor.phone
    ),
    vendor_type: pickString(
      businessInfo.vendor_type,
      raw.vendor_type,
      flatProfile.vendor_type,
      vendor.vendor_type,
      business.vendor_type
    ),
    vendor_type_label: pickString(
      businessInfo.vendor_type_label,
      summary.professional_category,
      raw.vendor_type_label,
      flatProfile.vendor_type_label,
      business.vendor_type_label
    ),
    emirate: pickString(
      locationAddress.emirate,
      raw.emirate,
      flatProfile.emirate,
      business.emirate,
      vendor.emirate
    ),
    city: pickString(
      businessContact.city,
      locationAddress.city,
      raw.city,
      flatProfile.city,
      business.city,
      vendor.city
    ),
    address: pickString(
      businessContact.address,
      locationAddress.address,
      raw.address,
      flatProfile.address,
      business.address,
      vendor.address
    ),
    description: pickString(
      businessContact.store_description,
      businessInfo.description,
      raw.description,
      flatProfile.description,
      business.description
    ),
    trade_license_number: pickString(
      businessInfo.trade_license_number,
      raw.trade_license_number,
      flatProfile.trade_license_number,
      business.trade_license_number
    ),
    vat_number: pickString(
      businessInfo.tax_vat_number,
      businessInfo.vat_number,
      raw.vat_number,
      flatProfile.vat_number,
      business.vat_number
    ),
    latitude: pickNumber(coords.latitude, raw.latitude, flatProfile.latitude),
    longitude: pickNumber(coords.longitude, raw.longitude, flatProfile.longitude),
    google_maps_location: googleMaps,
    location_display: pickString(
      locationAddress.location_display,
      raw.location_display,
      flatProfile.location_display
    ),
    bank_name: pickString(
      bankAccount.bank_name,
      paymentMethods.bank_name,
      raw.bank_name,
      bank.bank_name,
      bank.name
    ),
    iban: pickString(bankAccount.iban, paymentMethods.iban, raw.iban, bank.iban),
    account_holder_name: pickString(
      bankAccount.account_holder_name,
      paymentMethods.account_holder_name,
      raw.account_holder_name,
      bank.account_holder_name,
      bank.holder_name
    ),
    delivery_radius_km: pickNumber(
      businessHours.delivery_radius_km,
      locationAddress.delivery_radius_km,
      raw.delivery_radius_km,
      raw.delivery_radius,
      operations.delivery_radius_km
    ),
    minimum_order_amount: pickNumber(
      businessHours.minimum_order_amount,
      businessInfo.minimum_order_amount,
      raw.minimum_order_amount,
      operations.minimum_order_amount
    ),
    opens_at: pickString(
      businessHours.opens_at,
      businessInfo.opens_at,
      raw.opens_at,
      operations.opens_at
    ),
    closes_at: pickString(
      businessHours.closes_at,
      businessInfo.closes_at,
      raw.closes_at,
      operations.closes_at
    ),
    profile_picture_url: resolveLogoUrl(
      storeBranding.profile_picture_url,
      summary.profile_picture_url,
      summary.profile_image_url,
      raw.profile_picture_url,
      flatProfile.profile_picture_url
    ),
    logo_url: resolveLogoUrl(
      storeBranding.logo_url,
      raw.logo_url,
      flatProfile.logo_url,
      vendor.logo_url,
      business.logo_url,
      raw.logo
    ),
    business_name_note: pickString(businessContact.business_name_note),
    bank_hint: pickString(bankAccount.subtitle),
    branding_hint: pickString(storeBranding.hint),
    profile_picture_upload_field: pickString(storeBranding.upload_field) || 'profile_picture',
    operating_hours: pickString(businessInfo.operating_hours),
    years_in_business:
      businessInfo.years_in_business != null && businessInfo.years_in_business !== ''
        ? String(businessInfo.years_in_business)
        : undefined,
    status: pickString(readOnly.status, raw.status, vendor.status, flatProfile.status),
    status_label: pickString(
      readOnly.status_label,
      raw.status_label,
      vendor.status_label,
      flatProfile.status_label
    ),
    partnership_tier: pickString(
      partnershipBadge.tier,
      partnershipBadge.label,
      raw.partnership_tier,
      vendor.partnership_tier,
      flatProfile.partnership_tier
    ),
    partnership_badge_label: pickString(partnershipBadge.label),
    member_since: pickString(
      summary.member_since,
      raw.member_since,
      vendor.member_since,
      flatProfile.member_since
    ),
    header_name: pickString(header.name, businessContact.contact_person, user.name),
    header_subtitle: pickString(header.subtitle, locationAddress.location_display),
    professional_category: pickString(
      summary.professional_category,
      businessInfo.vendor_type_label,
      flatProfile.vendor_type_label
    ),
    stats_products: pickNumber(stats.products, stats.total_products),
    stats_delivered: pickNumber(stats.delivered, stats.products_delivered),
    stats_rating: pickNumber(stats.rating),
    stats_reviews: pickNumber(stats.reviews),
    rating_available:
      typeof stats.rating_available === 'boolean' ? stats.rating_available : undefined,
    account_settings: mapMenuItems(profileRoot.account_settings),
    partnership_menu: mapMenuItems(profileRoot.partnership),
    emirates: mapEmirates(asRecord(raw.options)),
    is_approved:
      readOnly.is_approved === true ||
      pickString(readOnly.status).toLowerCase() === 'approved' ||
      undefined,
  };
}

function mapVendorProfileResponse(payload: unknown): VendorProfileData | null {
  const body = asRecord(payload);
  if (!body) return null;
  if (body.success === false || body.status === false) {
    throw new Error(pickString(body.message) || 'Failed to load profile.');
  }

  const data = body.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return mapVendorProfileRow(data as Record<string, unknown>);
  }

  if (pickString(body.business_name, body.company_name, body.email) || asRecord(body.profile)) {
    return mapVendorProfileRow(body);
  }

  return null;
}

function throwIfVendorProfileUpdateFailed(payload: unknown): VendorProfileData | null {
  const body = asRecord(payload);
  if (!body) throw new Error('Failed to update profile.');

  const message = pickString(body.message).toLowerCase();
  const looksSuccessful =
    body.success === true ||
    body.status === true ||
    /updated|success|saved/.test(message);

  if (body.success === false || body.status === false) {
    if (!looksSuccessful) {
      throw new Error(pickString(body.message) || 'Failed to update profile.');
    }
  }

  // Some responses only return { success, message } without nested profile data.
  try {
    return mapVendorProfileResponse(payload);
  } catch {
    if (looksSuccessful) return null;
    throw new Error(pickString(body.message) || 'Failed to update profile.');
  }
}

export const vendorProfileService = {
  /** GET /vendor/profile */
  async getProfile(): Promise<VendorProfileData | null> {
    const started = Date.now();
    try {
      const response = await apiClient.get<VendorProfileResponse>('/vendor/profile', {
        timeout: 30000,
      });
      if (__DEV__) {
        console.log(`[vendor/profile] ${response.status} in ${Date.now() - started}ms`);
      }
      return mapVendorProfileResponse(response.data);
    } catch (error: unknown) {
      const axiosErr = error as {
        code?: string;
        message?: string;
        response?: { status?: number; data?: { message?: string } };
      };
      const isTimeout =
        axiosErr.code === 'ECONNABORTED' || /timeout/i.test(axiosErr.message ?? '');
      if (__DEV__) {
        console.error('[vendor/profile] failed', {
          ms: Date.now() - started,
          isTimeout,
          status: axiosErr.response?.status,
          message: axiosErr.response?.data?.message ?? axiosErr.message,
        });
      }
      if (isTimeout) {
        throw new Error(
          'Vendor profile request timed out. Check your internet connection and try again.'
        );
      }
      throw new Error(
        axiosErr.response?.data?.message ||
          axiosErr.message ||
          'Failed to load vendor profile.'
      );
    }
  },

  /**
   * POST /vendor/profile — multipart form-data (matches Postman):
   * business_name, contact_person, phone, address, city, store_description,
   * opens_at, closes_at, delivery_radius_km, minimum_order_amount,
   * bank_name, iban, account_holder_name, logo (file), profile_picture (file)
   */
  async updateProfile(params: VendorProfileUpdateParams): Promise<VendorProfileData | null> {
    const formData = new FormData();

    if (params.business_name != null) {
      formData.append('business_name', params.business_name.trim());
    }
    formData.append('contact_person', params.contact_person.trim());
    formData.append('phone', params.phone.trim());
    if (params.address != null) formData.append('address', params.address.trim());
    if (params.city != null) formData.append('city', params.city.trim());
    if (params.store_description != null) {
      formData.append('store_description', params.store_description.trim());
    }
    if (params.opens_at != null) formData.append('opens_at', params.opens_at.trim());
    if (params.closes_at != null) formData.append('closes_at', params.closes_at.trim());
    if (params.delivery_radius_km != null) {
      formData.append('delivery_radius_km', String(params.delivery_radius_km));
    }
    if (params.minimum_order_amount != null) {
      formData.append('minimum_order_amount', String(params.minimum_order_amount));
    }
    if (params.bank_name != null) formData.append('bank_name', params.bank_name.trim());
    if (params.iban != null) formData.append('iban', params.iban.trim());
    if (params.account_holder_name != null) {
      formData.append('account_holder_name', params.account_holder_name.trim());
    }
    if (params.logo?.uri) {
      formData.append('logo', {
        uri: params.logo.uri,
        type: params.logo.type || 'image/jpeg',
        name: params.logo.name || 'logo.jpg',
      } as unknown as Blob);
    } else if (params.remove_logo) {
      formData.append('remove_logo', '1');
    }
    if (params.profile_picture?.uri) {
      formData.append('profile_picture', {
        uri: params.profile_picture.uri,
        type: params.profile_picture.type || 'image/jpeg',
        name: params.profile_picture.name || 'profile_picture.jpg',
      } as unknown as Blob);
    } else if (params.remove_profile_picture) {
      formData.append('remove_profile_picture', '1');
    }

    const response = await apiClient.post<VendorProfileResponse>('/vendor/profile', formData, {
      timeout: 60000,
    });
    return throwIfVendorProfileUpdateFailed(response.data);
  },
};
