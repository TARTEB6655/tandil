/**
 * Admin Job Scheduling — working hours & capacity.
 * GET/PUT /api/admin/job-scheduling/working-hours
 */
import apiClient from './api';
import type { AxiosError } from 'axios';
import type { SchedulingSettings, Weekday, WorkingHoursDay } from '../types/scheduling';

/** API day codes from Postman */
export type ApiWorkingDayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ApiWorkingHourRow {
  day: ApiWorkingDayCode | string;
  enabled: boolean;
  start: string;
  end: string;
}

export interface ApiWorkingHoursPayload {
  working_hours: ApiWorkingHourRow[];
  max_bookings_per_slot: number;
  max_bookings_per_day: number;
  buffer_minutes: number;
}

const DAY_TO_API: Record<Weekday, ApiWorkingDayCode> = {
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
};

const API_TO_DAY: Record<string, Weekday> = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday',
};

const DEFAULT_DAYS: WorkingHoursDay[] = (
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as Weekday[]
).map((day) => ({
  day,
  enabled: day !== 'friday',
  startTime: '09:00',
  endTime: '18:00',
}));

function firstLaravelErrorMessage(data: unknown): string | undefined {
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

function normalizeTime(raw: string | undefined | null, fallback: string): string {
  const v = String(raw || '').trim();
  if (/^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  return fallback;
}

function extractPayload(body: unknown): Partial<ApiWorkingHoursPayload> | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;

  // Postman GET shape: { success, message, data: { working_hours, max_bookings_*, buffer_minutes } }
  const data = root.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const inner = data as Record<string, unknown>;
    if (
      Array.isArray(inner.working_hours) ||
      inner.max_bookings_per_slot != null ||
      inner.max_bookings_per_day != null ||
      inner.buffer_minutes != null
    ) {
      return inner as Partial<ApiWorkingHoursPayload>;
    }
  }

  // Flat shape (no data wrapper)
  if (
    Array.isArray(root.working_hours) ||
    root.max_bookings_per_slot != null ||
    root.max_bookings_per_day != null ||
    root.buffer_minutes != null
  ) {
    return root as Partial<ApiWorkingHoursPayload>;
  }
  return null;
}

export function apiWorkingHoursToSettings(
  payload: Partial<ApiWorkingHoursPayload> | null | undefined
): SchedulingSettings {
  const byDay = new Map<Weekday, WorkingHoursDay>();
  DEFAULT_DAYS.forEach((d) => byDay.set(d.day, { ...d }));

  const rows = Array.isArray(payload?.working_hours) ? payload!.working_hours : [];
  rows.forEach((row) => {
    const day = API_TO_DAY[String(row.day || '').toLowerCase()];
    if (!day) return;
    byDay.set(day, {
      day,
      enabled: Boolean(row.enabled),
      startTime: normalizeTime(row.start, '09:00'),
      endTime: normalizeTime(row.end, '18:00'),
    });
  });

  const maxSlot = Number(payload?.max_bookings_per_slot);
  const maxDay = Number(payload?.max_bookings_per_day);
  const buffer = Number(payload?.buffer_minutes);

  return {
    workingDays: DEFAULT_DAYS.map((d) => byDay.get(d.day)!),
    slotDurationMinutes: 60,
    maxBookingsPerSlot: Number.isFinite(maxSlot) && maxSlot >= 1 ? maxSlot : 2,
    maxBookingsPerDay: Number.isFinite(maxDay) && maxDay >= 1 ? maxDay : 12,
    bufferMinutesBetweenJobs: Number.isFinite(buffer) && buffer >= 0 ? buffer : 15,
    timezone: 'Asia/Dubai',
  };
}

export function settingsToApiWorkingHours(settings: SchedulingSettings): ApiWorkingHoursPayload {
  return {
    working_hours: settings.workingDays.map((d) => ({
      day: DAY_TO_API[d.day],
      enabled: Boolean(d.enabled),
      start: normalizeTime(d.startTime, '09:00'),
      end: normalizeTime(d.endTime, '18:00'),
    })),
    max_bookings_per_slot: Math.max(1, Number(settings.maxBookingsPerSlot) || 1),
    max_bookings_per_day: Math.max(1, Number(settings.maxBookingsPerDay) || 1),
    buffer_minutes: Math.max(0, Number(settings.bufferMinutesBetweenJobs) || 0),
  };
}

export function getDefaultWorkingHoursSettings(): SchedulingSettings {
  return apiWorkingHoursToSettings({
    working_hours: DEFAULT_DAYS.map((d) => ({
      day: DAY_TO_API[d.day],
      enabled: d.enabled,
      start: d.startTime,
      end: d.endTime,
    })),
    max_bookings_per_slot: 2,
    max_bookings_per_day: 12,
    buffer_minutes: 15,
  });
}

/**
 * GET /admin/job-scheduling/working-hours
 * Expects: { success, message, data: { working_hours[], max_bookings_per_slot, max_bookings_per_day, buffer_minutes } }
 */
export async function getAdminWorkingHours(): Promise<SchedulingSettings> {
  try {
    const response = await apiClient.get('/admin/job-scheduling/working-hours', {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });
    const body = response.data as Record<string, unknown> | undefined;

    if (__DEV__) {
      console.log('[job-scheduling] GET working-hours', {
        success: body?.success,
        keys:
          body?.data && typeof body.data === 'object'
            ? Object.keys(body.data as object)
            : body
              ? Object.keys(body)
              : [],
      });
    }

    if (body?.success === false) {
      throw new Error(
        (typeof body.message === 'string' && body.message) ||
          firstLaravelErrorMessage(body) ||
          'Failed to load working hours.'
      );
    }

    const parsed = extractPayload(body);
    if (parsed && Array.isArray(parsed.working_hours) && parsed.working_hours.length > 0) {
      return apiWorkingHoursToSettings(parsed);
    }
    if (parsed) {
      return apiWorkingHoursToSettings(parsed);
    }

    return getDefaultWorkingHoursSettings();
  } catch (e) {
    const ax = e as AxiosError<Record<string, unknown>>;
    if (ax.response?.status === 404) {
      return getDefaultWorkingHoursSettings();
    }
    const msg =
      firstLaravelErrorMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      (e instanceof Error ? e.message : undefined) ||
      'Failed to load working hours.';
    throw new Error(msg);
  }
}

/**
 * PUT /admin/job-scheduling/working-hours
 * Falls back to POST if PUT is not allowed (405).
 */
export async function saveAdminWorkingHours(
  settings: SchedulingSettings
): Promise<{ success: boolean; message?: string; data: SchedulingSettings }> {
  const payload = settingsToApiWorkingHours(settings);

  if (__DEV__) {
    console.log('[job-scheduling] working-hours payload', payload);
  }

  const tryRequest = async (method: 'put' | 'post') => {
    const response =
      method === 'put'
        ? await apiClient.put('/admin/job-scheduling/working-hours', payload, { timeout: 30000 })
        : await apiClient.post('/admin/job-scheduling/working-hours', payload, { timeout: 30000 });
    return response.data;
  };

  try {
    let body: unknown;
    try {
      body = await tryRequest('put');
    } catch (e) {
      const ax = e as AxiosError;
      if (ax.response?.status === 405) {
        body = await tryRequest('post');
      } else {
        throw e;
      }
    }

    const root = body as Record<string, unknown> | undefined;
    if (root?.success === false) {
      throw new Error(
        (typeof root.message === 'string' && root.message) ||
          firstLaravelErrorMessage(root) ||
          'Failed to save working hours.'
      );
    }

    const parsed = extractPayload(body) || payload;
    return {
      success: true,
      message: typeof root?.message === 'string' ? root.message : undefined,
      data: apiWorkingHoursToSettings(parsed),
    };
  } catch (e) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      firstLaravelErrorMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to save working hours.';
    throw new Error(msg);
  }
}

export const adminJobSchedulingService = {
  getAdminWorkingHours,
  saveAdminWorkingHours,
  getDefaultWorkingHoursSettings,
  settingsToApiWorkingHours,
  apiWorkingHoursToSettings,
};

export default adminJobSchedulingService;
