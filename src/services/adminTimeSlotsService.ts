/**
 * Admin — job scheduling time slots API.
 *
 * GET  /api/admin/job-scheduling/time-slots
 * POST /api/admin/job-scheduling/time-slots (form-data)
 */
import apiClient from './api';
import type { AxiosError } from 'axios';
import type { TimeSlotConfig } from '../types/scheduling';
import { formatTimeOptionLabel } from '../utils/schedulingTimeOptions';

export interface AddTimeSlotPayload {
  start_time: string; // HH:mm
  duration_minutes: number;
  /** Optional; backend default is 1 (active). */
  is_active?: number;
}

/** API row from list / create responses. */
export interface ApiTimeSlotRow {
  id?: number | string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  is_active?: boolean | number | string;
  sort_order?: number;
  enabled?: boolean;
}

function normalizeHHmm(raw: unknown, fallback: string): string {
  const v = String(raw ?? '').trim();
  if (!v) return fallback;
  const match = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = match[2];
  if (!Number.isFinite(h)) return fallback;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function extractFirstMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.message === 'string' && d.message) return d.message;
  const err = d.errors;
  if (err && typeof err === 'object') {
    for (const v of Object.values(err as Record<string, unknown>)) {
      if (Array.isArray(v) && v[0] != null) return String(v[0]);
      if (typeof v === 'string') return v;
    }
  }
  return undefined;
}

function parseActiveFlag(raw: unknown, fallback = true): boolean {
  if (raw == null) return fallback;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  const s = String(raw).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return fallback;
}

export function mapApiTimeSlotToConfig(row: ApiTimeSlotRow, fallbackStart = '09:00'): TimeSlotConfig {
  const startTime = normalizeHHmm(row.start_time, fallbackStart);
  const durationMinutes = Number(row.duration_minutes);
  const id = row.id != null ? String(row.id) : `s_${startTime}`;

  return {
    id,
    label: formatTimeOptionLabel(startTime),
    startTime,
    durationMinutes:
      Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60,
    enabled:
      row.is_active != null
        ? parseActiveFlag(row.is_active, true)
        : row.enabled != null
          ? Boolean(row.enabled)
          : true,
  };
}

/**
 * GET /admin/job-scheduling/time-slots
 * Response: { success, message, data: [{ id, start_time, end_time, duration_minutes, is_active, sort_order }] }
 */
export async function getAdminTimeSlots(): Promise<TimeSlotConfig[]> {
  try {
    const response = await apiClient.get('/admin/job-scheduling/time-slots', {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });
    const body = response.data as Record<string, unknown> | undefined;

    if (body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to load time slots.');
    }

    const rawList = Array.isArray(body?.data)
      ? body!.data
      : Array.isArray(body)
        ? body
        : [];

    const mapped = (rawList as ApiTimeSlotRow[]).map((row) => mapApiTimeSlotToConfig(row));

    return mapped.sort((a, b) => a.startTime.localeCompare(b.startTime));
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to load time slots.';
    throw new Error(msg);
  }
}

/**
 * POST /admin/job-scheduling/time-slots (form-data)
 * Fields: start_time, duration_minutes, is_active
 */
export async function addAdminTimeSlot(payload: AddTimeSlotPayload): Promise<TimeSlotConfig> {
  try {
    const form = new FormData();
    form.append('start_time', payload.start_time);
    form.append('duration_minutes', String(payload.duration_minutes));
    form.append('is_active', String(payload.is_active ?? 1));

    const response = await apiClient.post('/admin/job-scheduling/time-slots', form, {
      timeout: 30000,
    });
    const body = response.data as Record<string, unknown> | undefined;

    if (body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to add time slot.');
    }

    const dataObj =
      body?.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as ApiTimeSlotRow)
        : ((body ?? {}) as ApiTimeSlotRow);

    return mapApiTimeSlotToConfig(dataObj, payload.start_time);
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to add time slot.';
    throw new Error(msg);
  }
}

/**
 * POST /admin/job-scheduling/time-slots/{id}/toggle
 * Toggles is_active on the server.
 */
export async function toggleAdminTimeSlot(slotId: string | number): Promise<TimeSlotConfig | null> {
  try {
    const response = await apiClient.post(
      `/admin/job-scheduling/time-slots/${slotId}/toggle`,
      {},
      { timeout: 20000, headers: { Accept: 'application/json' } }
    );
    const body = response.data as Record<string, unknown> | undefined;

    if (body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to toggle time slot.');
    }

    if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      return mapApiTimeSlotToConfig(body.data as ApiTimeSlotRow);
    }

    return null;
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to toggle time slot.';
    throw new Error(msg);
  }
}

/**
 * DELETE /admin/job-scheduling/time-slots/{id}
 */
export async function deleteAdminTimeSlot(slotId: string | number): Promise<void> {
  try {
    const response = await apiClient.delete(`/admin/job-scheduling/time-slots/${slotId}`, {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });
    const body = response.data as Record<string, unknown> | undefined;

    if (body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to delete time slot.');
    }
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to delete time slot.';
    throw new Error(msg);
  }
}

export const adminTimeSlotsService = {
  getAdminTimeSlots,
  addAdminTimeSlot,
  toggleAdminTimeSlot,
  deleteAdminTimeSlot,
  mapApiTimeSlotToConfig,
};

export default adminTimeSlotsService;
