import apiClient, { publicApiClient } from './api';
import { buildFullImageUrl } from '../config/api';
import type { AxiosInstance } from 'axios';

export interface MaintenancePhoto {
  id: number;
  title?: string | null;
  before_image?: string | null;
  before_image_url?: string | null;
  after_image?: string | null;
  after_image_url?: string | null;
  priority?: number;
  active?: boolean | number | null;
  is_active?: boolean;
}

function parseMaintenancePhotoList(body: unknown): MaintenancePhoto[] {
  if (!body || typeof body !== 'object') return [];
  const root = body as Record<string, unknown>;
  const rawData = root.data;
  if (Array.isArray(rawData)) return rawData as MaintenancePhoto[];
  if (rawData && typeof rawData === 'object' && Array.isArray((rawData as { data?: MaintenancePhoto[] }).data)) {
    return (rawData as { data: MaintenancePhoto[] }).data;
  }
  if (Array.isArray(root.maintenance_photos)) {
    return root.maintenance_photos as MaintenancePhoto[];
  }
  return [];
}

function isPhotoActive(photo: MaintenancePhoto): boolean {
  if (photo.active === 0 || photo.active === '0' || photo.active === false) return false;
  return photo.is_active !== false;
}

async function fetchMaintenancePhotoList(
  client: AxiosInstance,
  perPage: number
): Promise<MaintenancePhoto[]> {
  const response = await client.get('/maintenance-photos', {
    params: { per_page: perPage },
    timeout: 15000,
    headers: { Accept: 'application/json' },
  });
  const body = response?.data ?? response;
  const list = parseMaintenancePhotoList(body);
  return list
    .filter(isPhotoActive)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

/** GET /api/maintenance-photos?per_page=20 – client Home before/after gallery (Bearer when logged in). */
export async function getMaintenancePhotos(perPage = 20): Promise<MaintenancePhoto[]> {
  try {
    return await fetchMaintenancePhotoList(apiClient, perPage);
  } catch {
    try {
      return await fetchMaintenancePhotoList(publicApiClient, perPage);
    } catch {
      return [];
    }
  }
}

export function getMaintenancePhotoImageUrl(
  photo: MaintenancePhoto,
  kind: 'before' | 'after'
): string | null {
  const raw =
    kind === 'before'
      ? photo.before_image_url ?? photo.before_image ?? null
      : photo.after_image_url ?? photo.after_image ?? null;
  if (!raw) return null;
  return raw.startsWith('http') ? raw : buildFullImageUrl(raw);
}
