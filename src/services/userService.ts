/**
 * Customer (user) API. Uses apiClient so Authorization: Bearer <customer token> is sent.
 */
import apiClient from './api';
import { buildProfilePictureUrl } from '../config/api';

/** Profile data from GET /api/user/profile */
export interface UserProfileData {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  /** Some backends use phone_number instead of phone */
  phone_number?: string | null;
  mobile?: string | null;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  role?: string;
}

/** Get display phone from profile (checks phone, phone_number, mobile). */
export function getProfilePhone(p: UserProfileData | null): string | null {
  if (!p) return null;
  const raw = p.phone ?? p.phone_number ?? p.mobile ?? null;
  if (raw == null || String(raw).trim() === '') return null;
  return String(raw).trim();
}

/** Get displayable profile picture URL (full URL). Uses profile_picture_url when present, else builds from profile_picture. */
export function getProfilePictureUrl(p: UserProfileData | null): string | null {
  if (!p) return null;
  const url = p.profile_picture_url ?? null;
  if (url != null && String(url).trim() !== '' && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url.trim();
  }
  const path = p.profile_picture ?? null;
  if (path != null && String(path).trim() !== '') {
    return buildProfilePictureUrl(String(path).trim());
  }
  return null;
}

export interface UserProfileResponse {
  success?: boolean;
  message?: string;
  data?: UserProfileData;
}

/**
 * GET /api/user/profile
 * Returns the authenticated customer's profile. Requires Bearer token (customer token).
 */
export async function getUserProfile(): Promise<UserProfileData | null> {
  const response = await apiClient.get<UserProfileResponse>('/user/profile', {
    timeout: 15000,
  });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Params for POST /api/user/profile (form-data). Omit optional fields to leave unchanged. */
export interface UserProfileUpdateParams {
  name?: string;
  email?: string;
  phone?: string;
  profile_picture?: { uri: string; type?: string; name?: string };
}

/**
 * POST /api/user/profile (form-data)
 * Updates customer personal information. Requires Bearer token (customer token).
 * Sends: name, email, phone, profile_picture (file).
 * If your backend returns 405, it may expect PUT; we use POST to match common form-data update flows.
 */
export async function updateUserProfile(params: UserProfileUpdateParams): Promise<UserProfileData | null> {
  const formData = new FormData();
  if (params.name != null) formData.append('name', params.name);
  if (params.email != null) formData.append('email', params.email);
  if (params.phone != null) formData.append('phone', params.phone);
  if (params.profile_picture?.uri) {
    formData.append('profile_picture', {
      uri: params.profile_picture.uri,
      type: params.profile_picture.type || 'image/jpeg',
      name: params.profile_picture.name || 'profile.jpg',
    } as any);
  }
  const response = await apiClient.post<UserProfileResponse>('/user/profile', formData, {
    timeout: 30000,
  });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Address from GET /api/user/addresses */
export interface UserAddress {
  id: number;
  type: string;
  full_name?: string | null;
  phone_number?: string | null;
  street_address: string;
  city: string;
  state?: string | null;
  zip_code?: string | null;
  country: string;
  is_default?: boolean | number;
}

export interface UserAddressesResponse {
  success?: boolean;
  message?: string;
  data?: UserAddress[];
}

/**
 * GET /api/user/addresses
 * Returns the authenticated customer's saved addresses. Requires Bearer token.
 */
export async function getUserAddresses(): Promise<UserAddress[]> {
  const response = await apiClient.get<UserAddressesResponse>('/user/addresses', {
    timeout: 15000,
  });
  if (response.data?.success && Array.isArray(response.data?.data)) {
    return response.data.data;
  }
  return [];
}

/** Params for POST /api/user/addresses (create address). type: home | office | other. */
export interface CreateAddressParams {
  type?: string;
  full_name: string;
  phone_number: string;
  street_address: string;
  city: string;
  state?: string;
  zip_code?: string;
  country: string;
  is_default?: boolean | number;
}

export interface CreateAddressResponse {
  success?: boolean;
  message?: string;
  data?: UserAddress;
}

/**
 * POST /api/user/addresses
 * Create a new address. Requires Bearer token. Body: type, full_name, phone_number, street_address, city, state?, zip_code?, country, is_default (0|1).
 */
export async function createAddress(params: CreateAddressParams): Promise<UserAddress | null> {
  const body = {
    type: params.type || 'home',
    full_name: params.full_name,
    phone_number: params.phone_number,
    street_address: params.street_address,
    city: params.city,
    state: params.state ?? '',
    zip_code: params.zip_code ?? '',
    country: params.country,
    is_default: params.is_default === true || params.is_default === 1 ? 1 : 0,
  };
  const response = await apiClient.post<CreateAddressResponse>('/user/addresses', body, {
    timeout: 15000,
  });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/**
 * DELETE /api/user/addresses/:id
 * Delete an address. Requires Bearer token.
 */
export async function deleteAddress(addressId: number): Promise<boolean> {
  const response = await apiClient.delete<{ success?: boolean; message?: string }>(
    `/user/addresses/${addressId}`,
    { timeout: 15000 }
  );
  return response.data?.success === true;
}

/**
 * PUT /api/user/addresses/:id
 * Update an address. Requires Bearer token. Sends body as x-www-form-urlencoded (type, full_name, phone_number, street_address, city, state, zip_code, country, is_default).
 */
export async function updateAddress(
  addressId: number,
  params: CreateAddressParams
): Promise<UserAddress | null> {
  const isDefault = params.is_default === true || params.is_default === 1 ? 1 : 0;
  const form = new URLSearchParams({
    type: params.type || 'home',
    full_name: params.full_name,
    phone_number: params.phone_number,
    street_address: params.street_address,
    city: params.city,
    state: params.state ?? '',
    zip_code: params.zip_code ?? '',
    country: params.country,
    is_default: String(isDefault),
  });
  const response = await apiClient.put<CreateAddressResponse>(
    `/user/addresses/${addressId}`,
    form.toString(),
    {
      timeout: 15000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Single notification from GET /api/user/notifications */
export interface UserNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
}

/** Paginated notifications response */
export interface UserNotificationsResponse {
  success?: boolean;
  message?: string;
  data?: {
    current_page: number;
    data: UserNotification[];
    first_page_url: string;
    from: number | null;
    last_page: number;
    last_page_url: string;
    links: Array<{ url: string | null; label: string; page: number | null; active: boolean }>;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number | null;
    total: number;
  };
}

export interface GetNotificationsResult {
  list: UserNotification[];
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  nextPageUrl: string | null;
}

/**
 * GET /api/user/notifications
 * Returns the authenticated user's notifications (paginated). Requires Bearer token.
 * Optional ?page= for pagination.
 */
export async function getNotifications(page: number = 1): Promise<GetNotificationsResult> {
  const response = await apiClient.get<UserNotificationsResponse>('/user/notifications', {
    params: { page },
    timeout: 15000,
  });
  const d = response.data?.data;
  if (!response.data?.success || !d) {
    return { list: [], currentPage: 1, lastPage: 1, total: 0, perPage: 20, nextPageUrl: null };
  }
  return {
    list: Array.isArray(d.data) ? d.data : [],
    currentPage: d.current_page ?? 1,
    lastPage: d.last_page ?? 1,
    total: d.total ?? 0,
    perPage: d.per_page ?? 20,
    nextPageUrl: d.next_page_url ?? null,
  };
}

export {
  getClientNotifications,
  markClientNotificationAsRead,
  markAllClientNotificationsAsRead,
  deleteClientNotification,
  clearAllClientNotifications,
  type ClientNotificationItem,
  type ClientNotificationsListResponse,
  type GetClientNotificationsResult,
  type ClientNotificationActionResponse,
} from './clientNotificationService';
