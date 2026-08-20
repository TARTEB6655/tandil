/**
 * Admin — job scheduling blocked dates & slots API.
 *
 * GET  /api/admin/job-scheduling/blocked-dates?from=&to=
 * POST /api/admin/job-scheduling/blocked-dates (form-data)
 * - Full day:  date, block_type=full_day, reason?
 * - Time slot: date, block_type=time_slot, time (HH:mm), reason?
 */
import apiClient from './api';
import type { AxiosError } from 'axios';
import type { BlockedPeriod } from '../types/scheduling';

export type ApiBlockType = 'full_day' | 'time_slot';

export interface AddBlockedDatePayload {
  date: string; // YYYY-MM-DD
  block_type: ApiBlockType;
  /** Required when block_type=time_slot */
  time?: string; // HH:mm
  reason?: string;
}

export interface ListBlockedDatesParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
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

function normalizeHHmm(raw: unknown): string | undefined {
  const v = String(raw ?? '').trim();
  if (!v) return undefined;
  const match = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return undefined;
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function normalizeIsoDate(raw: unknown, fallback = ''): string {
  const v = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return fallback;
}

function mapApiBlockToPeriod(
  row: Record<string, unknown>,
  fallback?: Partial<AddBlockedDatePayload>
): BlockedPeriod {
  const blockTypeRaw = String(
    row.block_type ?? row.type ?? fallback?.block_type ?? ''
  ).toLowerCase();
  const isSlot =
    blockTypeRaw === 'time_slot' ||
    blockTypeRaw === 'slot' ||
    fallback?.block_type === 'time_slot';

  const startTime =
    normalizeHHmm(row.time ?? row.start_time ?? row.startTime) ||
    (isSlot ? normalizeHHmm(fallback?.time) : undefined);

  const idRaw = row.id ?? row.blocked_date_id ?? row.block_id;
  const date = normalizeIsoDate(row.date, fallback?.date || '');

  return {
    id: idRaw != null ? String(idRaw) : `b_${date || Date.now()}`,
    type: isSlot ? 'slot' : 'date',
    date,
    startTime: isSlot ? startTime : undefined,
    reason:
      typeof row.reason === 'string'
        ? row.reason
        : fallback?.reason || undefined,
  };
}

/**
 * GET /admin/job-scheduling/blocked-dates?from=&to=
 */
export async function getAdminBlockedDates(
  params?: ListBlockedDatesParams
): Promise<BlockedPeriod[]> {
  try {
    const response = await apiClient.get('/admin/job-scheduling/blocked-dates', {
      timeout: 20000,
      headers: { Accept: 'application/json' },
      params: {
        ...(params?.from ? { from: params.from } : {}),
        ...(params?.to ? { to: params.to } : {}),
      },
    });
    const body = response.data as Record<string, unknown> | undefined;

    if (body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to load blocked dates.');
    }

    const rawList = Array.isArray(body?.data)
      ? body!.data
      : Array.isArray(body)
        ? body
        : [];

    return (rawList as Record<string, unknown>[])
      .map((row) => mapApiBlockToPeriod(row))
      .filter((b) => Boolean(b.date))
      .sort((a, b) =>
        a.date === b.date
          ? String(a.startTime || '').localeCompare(String(b.startTime || ''))
          : a.date.localeCompare(b.date)
      );
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to load blocked dates.';
    throw new Error(msg);
  }
}

/**
 * POST /admin/job-scheduling/blocked-dates (form-data)
 */
export async function addAdminBlockedDate(
  payload: AddBlockedDatePayload
): Promise<BlockedPeriod> {
  try {
    const form = new FormData();
    form.append('date', payload.date);
    form.append('block_type', payload.block_type);
    if (payload.block_type === 'time_slot') {
      if (!payload.time) {
        throw new Error('Time is required for time slot blocks.');
      }
      form.append('time', payload.time);
    }
    if (payload.reason && payload.reason.trim()) {
      form.append('reason', payload.reason.trim());
    }

    const response = await apiClient.post('/admin/job-scheduling/blocked-dates', form, {
      timeout: 30000,
    });
    const body = response.data as Record<string, unknown> | undefined;

    if (body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to add blocked date.');
    }

    const dataObj =
      body?.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};

    return mapApiBlockToPeriod(dataObj, payload);
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      (e instanceof Error ? e.message : undefined) ||
      ax.message ||
      'Failed to add blocked date.';
    throw new Error(msg);
  }
}

/**
 * DELETE /admin/job-scheduling/blocked-dates/{id}
 */
export async function deleteAdminBlockedDate(blockId: string | number): Promise<void> {
  try {
    const response = await apiClient.delete(`/admin/job-scheduling/blocked-dates/${blockId}`, {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });
    const body = response.data as Record<string, unknown> | undefined;

    if (body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to delete blocked date.');
    }
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to delete blocked date.';
    throw new Error(msg);
  }
}

export const adminBlockedDatesService = {
  getAdminBlockedDates,
  addAdminBlockedDate,
  deleteAdminBlockedDate,
};

export default adminBlockedDatesService;
