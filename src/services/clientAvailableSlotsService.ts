/**
 * Client — available visit slots.
 * GET /api/visits/available-slots?date=YYYY-MM-DD
 */
import type { AxiosError } from 'axios';
import apiClient, { publicApiClient } from './api';
import type { AvailableSlot } from '../types/scheduling';
import { formatTimeOptionLabel } from '../utils/schedulingTimeOptions';

export interface ClientBlockedDate {
  date: string;
  dateBlocked: boolean;
  reason?: string;
}

export interface ClientScheduleDay {
  date: string; // YYYY-MM-DD
  workingDay: boolean;
  dateBlocked: boolean;
  /** Can be tapped (not past, working day, not blocked). */
  selectable: boolean;
  slots: AvailableSlot[];
}

export interface ClientAvailableSlotsData {
  date: string;
  workingDay: boolean;
  dateBlocked: boolean;
  weekStart?: string;
  weekEnd?: string;
  blockedDates: ClientBlockedDate[];
  slots: AvailableSlot[];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return toIsoDate(d);
}

/** Sunday–Saturday dates for the week containing `anchorIso`. */
export function getWeekDatesSunToSat(anchorIso?: string): string[] {
  const base = anchorIso ? new Date(anchorIso + 'T12:00:00') : new Date();
  base.setHours(12, 0, 0, 0);
  const start = new Date(base);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toIsoDate(d);
  });
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

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function normalizeIsoDate(raw: unknown): string {
  const v = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return '';
}

function parseBool(raw: unknown, fallback = false): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return fallback;
}

function mapSlot(row: Record<string, unknown>, date: string): AvailableSlot {
  const startTime = String(row.start_time ?? row.startTime ?? '').slice(0, 5);
  const endTime = String(row.end_time ?? row.endTime ?? '').slice(0, 5);
  const remaining = Number(row.remaining);
  const bookedCount = Number(row.booked_count ?? row.bookedCount ?? 0);
  const blocked = parseBool(row.blocked, false);
  const available = parseBool(row.available, !blocked && remaining > 0);
  const remainingSafe = Number.isFinite(remaining) ? remaining : 0;

  let status: AvailableSlot['status'] = 'available';
  if (blocked || (!available && remainingSafe > 0)) status = 'blocked';
  else if (!available || remainingSafe <= 0) status = 'full';

  return {
    id: String(row.id ?? `${date}_${startTime}`),
    date,
    label: formatTimeOptionLabel(startTime),
    startTime,
    endTime,
    status,
    bookedCount: Number.isFinite(bookedCount) ? bookedCount : 0,
    maxBookings: remainingSafe + (Number.isFinite(bookedCount) ? bookedCount : 0),
    remaining: remainingSafe,
  };
}

function parsePayload(body: unknown, fallbackDate: string): ClientAvailableSlotsData {
  const root = asRecord(body) ?? {};
  const data = asRecord(root.data) ?? root;
  const date = normalizeIsoDate(data.date) || fallbackDate;
  const week = asRecord(data.week);

  const blockedDates: ClientBlockedDate[] = [];
  const rawBlocked = Array.isArray(data.blocked_dates) ? data.blocked_dates : [];
  for (const item of rawBlocked) {
    const row = asRecord(item);
    if (!row) continue;
    const blockedDate = normalizeIsoDate(row.date);
    if (!blockedDate) continue;
    const blocks = Array.isArray(row.blocks) ? row.blocks : [];
    const reasonRow = blocks.map((b) => asRecord(b)?.reason).find((r) => typeof r === 'string');
    blockedDates.push({
      date: blockedDate,
      dateBlocked: parseBool(row.date_blocked, true),
      reason: typeof reasonRow === 'string' ? reasonRow : undefined,
    });
  }

  const rawSlots = Array.isArray(data.slots) ? data.slots : [];
  const slots = rawSlots
    .map((s) => asRecord(s))
    .filter((s): s is Record<string, unknown> => Boolean(s))
    .map((s) => mapSlot(s, date));

  return {
    date,
    workingDay: parseBool(data.working_day, true),
    dateBlocked: parseBool(data.date_blocked, false),
    weekStart: week ? normalizeIsoDate(week.start) : undefined,
    weekEnd: week ? normalizeIsoDate(week.end) : undefined,
    blockedDates,
    slots,
  };
}

async function requestAvailableSlots(date: string) {
  const params = { date };
  const headers = { Accept: 'application/json' };
  try {
    return await apiClient.get('/visits/available-slots', {
      params,
      timeout: 20000,
      headers,
    });
  } catch (e: unknown) {
    const ax = e as AxiosError;
    if (ax.response?.status === 401) {
      return publicApiClient.get('/visits/available-slots', {
        params,
        timeout: 20000,
        headers,
      });
    }
    throw e;
  }
}

/**
 * GET /visits/available-slots?date=
 */
export async function getClientAvailableSlots(date: string): Promise<ClientAvailableSlotsData> {
  try {
    const response = await requestAvailableSlots(date);
    const body = response.data as Record<string, unknown> | undefined;
    if (body?.status === false || body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to load available slots.');
    }
    return parsePayload(body, date);
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to load available slots.';
    throw new Error(msg);
  }
}

function isPastDate(iso: string, today = todayIso()): boolean {
  return iso < today;
}

export function buildScheduleDay(
  iso: string,
  payload?: ClientAvailableSlotsData | null,
  extraBlocked?: ClientBlockedDate[]
): ClientScheduleDay {
  const blockedFromList = (extraBlocked || payload?.blockedDates || []).some(
    (b) => b.date === iso && b.dateBlocked
  );
  const workingDay = payload?.date === iso ? payload.workingDay : true;
  const dateBlocked =
    (payload?.date === iso && payload.dateBlocked) || blockedFromList;
  const past = isPastDate(iso);
  return {
    date: iso,
    workingDay,
    dateBlocked,
    selectable: !past && workingDay && !dateBlocked,
    slots: payload?.date === iso ? payload.slots : [],
  };
}

/**
 * Load Sun–Sat week around the given date (defaults to today).
 * Fetches each day so working_day / blocked / slots are accurate.
 */
export async function getClientScheduleWeek(anchorIso?: string): Promise<ClientScheduleDay[]> {
  const dates = getWeekDatesSunToSat(anchorIso || todayIso());
  const results = await Promise.all(
    dates.map(async (iso) => {
      try {
        const data = await getClientAvailableSlots(iso);
        return { iso, data };
      } catch {
        return { iso, data: null as ClientAvailableSlotsData | null };
      }
    })
  );

  const extraBlocked = results.flatMap((r) => r.data?.blockedDates ?? []);

  return results.map(({ iso, data }) => {
    if (!data) {
      return {
        date: iso,
        workingDay: false,
        dateBlocked: true,
        selectable: false,
        slots: [],
      };
    }
    return buildScheduleDay(iso, data, extraBlocked);
  });
}
