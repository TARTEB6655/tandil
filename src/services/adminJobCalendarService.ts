/**
 * Admin — job scheduling calendar API.
 *
 * GET /api/admin/job-scheduling/calendar?view=day|week|month&date=YYYY-MM-DD
 */
import apiClient from './api';
import type { AxiosError } from 'axios';
import type { CalendarViewMode, ScheduledJob, ScheduledJobStatus } from '../types/scheduling';

export interface GetAdminCalendarParams {
  view: CalendarViewMode;
  date: string; // YYYY-MM-DD
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

function normalizeHHmm(raw: unknown, fallback = '09:00'): string {
  const v = String(raw ?? '').trim();
  const match = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return fallback;
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function normalizeIsoDate(raw: unknown): string {
  const v = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return '';
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function pickName(obj: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeStatus(raw: unknown): ScheduledJobStatus {
  const s = String(raw ?? 'pending')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const allowed: ScheduledJobStatus[] = [
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'delivered',
    'cancelled',
    'rescheduled',
    'rejected',
  ];
  // Common aliases from backend / shop orders
  if (s === 'reject' || s === 'declined') return 'rejected';
  if (s === 'cancel' || s === 'canceled') return 'cancelled';
  if (s === 'inprogress' || s === 'progress') return 'in_progress';
  if (s === 'complete' || s === 'done' || s === 'fulfilled') return 'completed';
  if (s === 'deliver' || s === 'delivery_completed') return 'delivered';
  if (s === 'shipped' || s === 'out_for_delivery') return 'in_progress';
  if (s === 'processing' || s === 'accepted' || s === 'assigned') return 'confirmed';
  return (allowed.includes(s as ScheduledJobStatus) ? s : 'pending') as ScheduledJobStatus;
}

function looksLikeDayGroup(row: Record<string, unknown>): boolean {
  return (
    Array.isArray(row.jobs) ||
    Array.isArray(row.bookings) ||
    Array.isArray(row.items) ||
    Array.isArray(row.rejected) ||
    Array.isArray(row.rejected_jobs) ||
    Array.isArray(row.rejectedJobs)
  );
}

function flattenDayGroup(dayObj: Record<string, unknown>): Record<string, unknown>[] {
  const dayDate = normalizeIsoDate(dayObj.date ?? dayObj.day ?? dayObj.job_date);
  const out: Record<string, unknown>[] = [];

  const buckets: Array<{ key: string; forceStatus?: string }> = [
    { key: 'jobs' },
    { key: 'bookings' },
    { key: 'items' },
    { key: 'scheduled_jobs' },
    { key: 'rejected', forceStatus: 'rejected' },
    { key: 'rejected_jobs', forceStatus: 'rejected' },
    { key: 'rejectedJobs', forceStatus: 'rejected' },
  ];

  for (const { key, forceStatus } of buckets) {
    const jobs = dayObj[key];
    if (!Array.isArray(jobs)) continue;
    for (const j of jobs) {
      const row = asRecord(j);
      if (!row) continue;
      const next: Record<string, unknown> = {
        ...row,
        ...(dayDate && !normalizeIsoDate(row.date ?? row.scheduled_date ?? row.job_date)
          ? { date: dayDate }
          : {}),
      };
      if (forceStatus && row.status == null && row.booking_status == null && row.job_status == null) {
        next.status = forceStatus;
      }
      out.push(next);
    }
  }

  return out;
}

/** Flatten possible calendar response shapes into a job row list. */
function extractJobRows(body: unknown): Record<string, unknown>[] {
  if (!body) return [];

  const flattenMaybeDayArray = (arr: unknown[]): Record<string, unknown>[] => {
    if (!arr.length) return [];
    const first = asRecord(arr[0]);
    // Month/week often returns [{ date, jobs: [...] }, ...]
    if (first && looksLikeDayGroup(first)) {
      return arr.flatMap((day) => {
        const dayObj = asRecord(day);
        return dayObj ? flattenDayGroup(dayObj) : [];
      });
    }
    return arr as Record<string, unknown>[];
  };

  if (Array.isArray(body)) return flattenMaybeDayArray(body);

  const root = asRecord(body);
  if (!root) return [];

  const data = root.data;
  if (Array.isArray(data)) return flattenMaybeDayArray(data);

  const dataObj = asRecord(data);
  if (dataObj) {
    // Prefer day/group collections first (month view)
    for (const key of ['days', 'dates', 'groups', 'calendar_days', 'calendar']) {
      const days = dataObj[key];
      if (Array.isArray(days)) {
        const flattened = flattenMaybeDayArray(days);
        if (flattened.length) return flattened;
      }
    }

    // Flat job lists + optional rejected lists
    const out: Record<string, unknown>[] = [];
    for (const key of ['jobs', 'bookings', 'items', 'entries', 'scheduled_jobs']) {
      const arr = dataObj[key];
      if (Array.isArray(arr)) out.push(...(arr as Record<string, unknown>[]));
    }
    for (const key of ['rejected', 'rejected_jobs', 'rejectedJobs']) {
      const arr = dataObj[key];
      if (Array.isArray(arr)) {
        for (const j of arr) {
          const row = asRecord(j);
          if (!row) continue;
          out.push(
            row.status == null && row.booking_status == null && row.job_status == null
              ? { ...row, status: 'rejected' }
              : row
          );
        }
      }
    }
    if (out.length) return out;
  }

  for (const key of ['jobs', 'bookings', 'items']) {
    if (Array.isArray(root[key])) return flattenMaybeDayArray(root[key] as unknown[]);
  }

  return [];
}

export function mapApiCalendarJobToScheduledJob(row: Record<string, unknown>): ScheduledJob | null {
  // Skip day-wrapper objects if they slipped through
  if (looksLikeDayGroup(row) && row.id == null && row.job_id == null && row.booking_id == null) {
    return null;
  }

  const customerObj = asRecord(row.customer ?? row.client ?? row.user);
  const technicianObj = asRecord(row.technician ?? row.tech ?? row.assignee);
  const serviceObj = asRecord(row.service ?? row.product);

  const date =
    normalizeIsoDate(
      row.date ??
        row.scheduled_date ??
        row.job_date ??
        row.booking_date ??
        row.appointment_date ??
        row.visit_date ??
        row.preferred_date
    ) || '';
  if (!date) return null;

  const startTime = normalizeHHmm(
    row.start_time ??
      row.scheduled_time ??
      row.startTime ??
      row.start ??
      row.time_from ??
      row.from_time ??
      row.time ??
      row.slot_start,
    '09:00'
  );
  const endTime = normalizeHHmm(
    row.end_time ??
      row.scheduled_end_time ??
      row.endTime ??
      row.end ??
      row.time_to ??
      row.to_time ??
      row.slot_end,
    startTime
  );

  const idRaw =
    row.id ??
    row.job_id ??
    row.booking_id ??
    row.scheduled_job_id ??
    row.visit_id ??
    `${date}_${startTime}_${row.status ?? 'job'}`;

  const serviceName =
    pickName(row, [
      'service_name',
      'serviceName',
      'product_name',
      'title',
      'service_title',
      'job_title',
    ]) ||
    pickName(serviceObj, ['name', 'title']) ||
    'Service job';

  const customerName =
    pickName(row, ['customer_name', 'customerName', 'client_name', 'user_name']) ||
    pickName(customerObj, ['name', 'full_name', 'fullName']) ||
    'Customer';

  const technicianName =
    pickName(row, [
      'technician_name',
      'technicianName',
      'tech_name',
      'assigned_to',
      'supervisor_name',
    ]) ||
    pickName(technicianObj, ['name', 'full_name', 'fullName']) ||
    null;

  const technicianIdRaw =
    row.technician_id ?? row.technicianId ?? technicianObj?.id ?? null;

  const overlapRaw =
    row.overlaps_technician ??
    row.overlapsTechnician ??
    row.technician_overlap ??
    row.has_overlap ??
    row.overlap;

  const qty = Number(row.quantity);
  const titleBase = serviceName;
  const serviceWithQty =
    Number.isFinite(qty) && qty > 1 ? `${titleBase} × ${qty}` : titleBase;

  const statusRaw =
    row.status ??
    row.order_status ??
    row.booking_status ??
    row.job_status ??
    row.vendor_order_status;
  const status = normalizeStatus(statusRaw);
  const statusLabel =
    pickName(row, ['status_label', 'order_status_label', 'vendor_order_status_label']) ||
    undefined;

  return {
    id: String(idRaw),
    serviceName: serviceWithQty,
    customerName,
    customerPhone:
      pickName(row, ['customer_phone', 'phone', 'client_phone']) ||
      pickName(customerObj, ['phone', 'mobile']) ||
      undefined,
    technicianId: technicianIdRaw != null ? String(technicianIdRaw) : null,
    technicianName,
    date,
    startTime,
    endTime,
    status,
    statusLabel,
    orderNumber: pickName(row, ['order_number', 'orderNumber', 'order_no']) || undefined,
    jobSource: pickName(row, ['job_source', 'fulfillment_type', 'source']) || undefined,
    address: pickName(row, ['address', 'location', 'service_address']) || undefined,
    notes: pickName(row, ['notes', 'internal_notes', 'remark', 'remarks']) || undefined,
    overlapsTechnician:
      overlapRaw == null
        ? undefined
        : Boolean(overlapRaw === true || overlapRaw === 1 || overlapRaw === '1'),
  };
}

/** Flag overlapping jobs for the same technician on the same day (client-side). */
export function markTechnicianOverlaps(jobs: ScheduledJob[]): ScheduledJob[] {
  return jobs.map((job) => {
    if (!job.technicianId && !job.technicianName) {
      return { ...job, overlapsTechnician: job.overlapsTechnician ?? false };
    }
    const overlaps = jobs.some((other) => {
      if (other.id === job.id) return false;
      if (other.date !== job.date) return false;
      if (
        other.status === 'cancelled' ||
        other.status === 'rejected' ||
        other.status === 'completed' ||
        other.status === 'delivered'
      ) {
        return false;
      }
      if (
        job.status === 'cancelled' ||
        job.status === 'rejected' ||
        job.status === 'completed' ||
        job.status === 'delivered'
      ) {
        return false;
      }
      const sameTech =
        (job.technicianId && other.technicianId && job.technicianId === other.technicianId) ||
        (!!job.technicianName &&
          !!other.technicianName &&
          job.technicianName === other.technicianName);
      if (!sameTech) return false;
      return job.startTime < other.endTime && job.endTime > other.startTime;
    });
    return {
      ...job,
      overlapsTechnician: job.overlapsTechnician === true ? true : overlaps,
    };
  });
}

/**
 * GET /admin/job-scheduling/calendar?view=&date=
 */
export async function getAdminJobCalendar(
  params: GetAdminCalendarParams
): Promise<ScheduledJob[]> {
  try {
    const response = await apiClient.get('/admin/job-scheduling/calendar', {
      timeout: 25000,
      headers: { Accept: 'application/json' },
      params: {
        view: params.view,
        date: params.date,
      },
    });
    const body = response.data as Record<string, unknown> | undefined;

    if (body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to load calendar.');
    }

    const rows = extractJobRows(body);
    const mapped = rows
      .map((row) => mapApiCalendarJobToScheduledJob(row))
      .filter((j): j is ScheduledJob => Boolean(j));

    const withOverlap = markTechnicianOverlaps(mapped);
    return withOverlap.sort((a, b) =>
      a.date === b.date
        ? a.startTime.localeCompare(b.startTime)
        : a.date.localeCompare(b.date)
    );
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to load calendar.';
    throw new Error(msg);
  }
}

/**
 * PUT /admin/job-scheduling/jobs/{visit_id} (form-data)
 * Optional fields: date, start, end, technician_id, internal_notes
 */
export interface UpdateAdminJobPayload {
  date?: string; // YYYY-MM-DD
  start?: string; // HH:mm
  end?: string; // HH:mm
  technician_id?: string | number | null;
  internal_notes?: string;
}

export async function updateAdminJobBooking(
  visitId: string | number,
  payload: UpdateAdminJobPayload
): Promise<ScheduledJob | null> {
  try {
    const form = new FormData();
    if (payload.date) form.append('date', payload.date);
    if (payload.start) form.append('start', payload.start);
    if (payload.end) form.append('end', payload.end);
    if (payload.technician_id != null && String(payload.technician_id).trim() !== '') {
      form.append('technician_id', String(payload.technician_id));
    }
    if (payload.internal_notes != null) {
      form.append('internal_notes', payload.internal_notes);
    }

    const response = await apiClient.put(`/admin/job-scheduling/jobs/${visitId}`, form, {
      timeout: 30000,
    });
    const body = response.data as Record<string, unknown> | undefined;

    if (body?.success === false) {
      throw new Error(extractFirstMessage(body) || 'Failed to update booking.');
    }

    const dataObj =
      body?.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : null;

    if (dataObj) {
      return mapApiCalendarJobToScheduledJob(dataObj);
    }
    return null;
  } catch (e: unknown) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const msg =
      extractFirstMessage(ax.response?.data) ||
      (typeof ax.response?.data?.message === 'string' ? ax.response.data.message : undefined) ||
      ax.message ||
      'Failed to update booking.';
    throw new Error(msg);
  }
}

export const adminJobCalendarService = {
  getAdminJobCalendar,
  updateAdminJobBooking,
  mapApiCalendarJobToScheduledJob,
  markTechnicianOverlaps,
};

export default adminJobCalendarService;
