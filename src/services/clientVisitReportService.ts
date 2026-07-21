/**
 * Client visit / service reports (finalized by supervisor and sent to client).
 */
import apiClient from './api';
import { buildFullImageUrl } from '../config/api';
import { getOrderTrack } from './orderService';

export interface ClientVisitReportPhoto {
  id: number | string;
  photo_url: string;
  type?: string;
}

export interface ClientVisitReport {
  id: number | string;
  visit_id?: number | string;
  order_id?: number | string;
  status?: string;
  order_status?: string;
  can_mark_delivered?: boolean;
  technician_name?: string;
  employee_id?: string;
  location?: string;
  service?: string;
  submitted_at?: string;
  technician_notes?: string | null;
  supervisor_notes?: string | null;
  recommendations?: string[];
  before_photos: ClientVisitReportPhoto[];
  after_photos: ClientVisitReportPhoto[];
  visit?: {
    id?: number | string;
    status?: string;
    scheduled_at?: string | null;
    client_name?: string | null;
    area_name?: string | null;
  };
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

function resolvePhotoUrl(raw: unknown): string {
  const value = pickString(raw);
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return buildFullImageUrl(value) || value;
}

function mapPhoto(value: unknown, index: number): ClientVisitReportPhoto | null {
  if (typeof value === 'string' && value.trim()) {
    return { id: index, photo_url: resolvePhotoUrl(value) };
  }
  const row = asRecord(value);
  if (!row) return null;
  const url = resolvePhotoUrl(
    row.photo_url ?? row.url ?? row.path ?? row.image_url ?? row.image
  );
  if (!url) return null;
  return {
    id: pickString(row.id) || index,
    photo_url: url,
    type: pickString(row.type) || undefined,
  };
}

function mapPhotos(...sources: unknown[]): ClientVisitReportPhoto[] {
  const out: ClientVisitReportPhoto[] = [];
  sources.forEach((source) => {
    if (!Array.isArray(source)) return;
    source.forEach((item, index) => {
      const photo = mapPhoto(item, out.length + index);
      if (photo) out.push(photo);
    });
  });
  return out;
}

function mapRecommendations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const row = asRecord(item);
      return pickString(row?.label, row?.name, row?.title, row?.recommendation);
    })
    .filter(Boolean);
}

/** True when the linked order/report has already been marked delivered by the client. */
export function isClientVisitReportDelivered(
  report: ClientVisitReport | null | undefined
): boolean {
  if (!report) return false;

  const statusValues = [report.order_status, report.status, report.visit?.status].map((value) =>
    String(value || '').toLowerCase()
  );

  return statusValues.some((status) => status === 'delivered' || status.includes('delivered'));
}

async function enrichReportWithOrderTrack(
  orderId: string | number,
  report: ClientVisitReport
): Promise<ClientVisitReport> {
  try {
    const { data } = await getOrderTrack(orderId);
    if (!data) {
      return { ...report, order_id: report.order_id ?? orderId };
    }

    const serviceReport = (data as { service_report?: { can_mark_delivered?: boolean } })
      .service_report;
    const trackingStatus = String(data.tracking?.status || '').toLowerCase();
    const orderStatus = String(
      data.current_status || data.order?.order_status || data.tracking?.status || ''
    ).toLowerCase();

    return {
      ...report,
      order_id: report.order_id ?? orderId,
      order_status: orderStatus || trackingStatus || report.order_status,
      can_mark_delivered:
        typeof serviceReport?.can_mark_delivered === 'boolean'
          ? serviceReport.can_mark_delivered
          : report.can_mark_delivered,
      visit: {
        ...report.visit,
        status: trackingStatus || report.visit?.status,
      },
    };
  } catch {
    return { ...report, order_id: report.order_id ?? orderId };
  }
}

export function parseClientVisitReport(payload: unknown): ClientVisitReport | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  const report =
    asRecord(data.visit_report) ??
    asRecord(data.service_report) ??
    asRecord(data.report) ??
    data;

  const fieldWorker = asRecord(report.field_worker) ?? asRecord(report.worker) ?? null;
  const visitInformation = asRecord(report.visit_information) ?? null;
  const serviceReportMeta = asRecord(data.service_report) ?? asRecord(report.service_report);
  const tracking = asRecord(data.tracking);
  const id = pickString(report.id, report.report_id);
  if (!id && !pickString(report.visit_id) && !pickString(report.supervisor_notes)) {
    // Not enough signal that this is a report object
    if (!Array.isArray(report.before_photos) && !Array.isArray(report.after_photos)) {
      return null;
    }
  }

  const visit = asRecord(report.visit);
  const before = mapPhotos(
    report.before_photos,
    report.before_photo ? [report.before_photo] : undefined
  );
  const after = mapPhotos(
    report.after_photos,
    report.after_photo ? [report.after_photo] : undefined
  );

  return {
    id: id || pickString(report.visit_id, '0') || '0',
    visit_id: pickString(report.visit_id, visit?.id) || undefined,
    order_id: pickString(report.order_id, data.order_id) || undefined,
    status: pickString(report.status) || undefined,
    order_status: pickString(
      data.order_status,
      data.current_status,
      tracking?.status,
      report.order_status
    ) || undefined,
    can_mark_delivered:
      typeof serviceReportMeta?.can_mark_delivered === 'boolean'
        ? serviceReportMeta.can_mark_delivered
        : typeof report.can_mark_delivered === 'boolean'
          ? report.can_mark_delivered
          : undefined,
    technician_name:
      pickString(report.technician_name, report.technician, fieldWorker?.name) || undefined,
    employee_id:
      pickString(report.employee_id, fieldWorker?.id, fieldWorker?.phone) || undefined,
    location:
      pickString(
        report.location,
        visit?.client_name,
        visit?.area_name,
        visitInformation?.location
      ) || undefined,
    service:
      pickString(report.service, report.service_name, visitInformation?.service_name) ||
      undefined,
    submitted_at: pickString(report.submitted_at, report.finalized_at, report.created_at) || undefined,
    technician_notes: pickString(report.technician_notes, report.field_notes) || null,
    supervisor_notes: pickString(report.supervisor_notes, report.notes) || null,
    recommendations: mapRecommendations(report.recommendations),
    before_photos: before,
    after_photos: after,
    visit: visit
      ? {
          id: pickString(visit.id) || undefined,
          status: pickString(visit.status) || undefined,
          scheduled_at: pickString(visit.scheduled_at) || null,
          client_name: pickString(visit.client_name) || null,
          area_name: pickString(visit.area_name) || null,
        }
      : undefined,
  };
}

async function tryGetReport(path: string): Promise<ClientVisitReport | null> {
  try {
    const response = await apiClient.get(path, { timeout: 20000 });
    const body = asRecord(response.data) ?? {};
    if (body.success === false) return null;
    return parseClientVisitReport(response.data);
  } catch {
    return null;
  }
}

/**
 * Fetch a finalized visit report for the authenticated client.
 * Tries common backend routes until one succeeds.
 */
export async function getClientVisitReport(params: {
  reportId?: number | string | null;
  visitId?: number | string | null;
  orderId?: number | string | null;
}): Promise<ClientVisitReport | null> {
  const reportId = params.reportId != null ? String(params.reportId) : '';
  const visitId = params.visitId != null ? String(params.visitId) : '';
  const orderId = params.orderId != null ? String(params.orderId) : '';

  const paths: string[] = [];
  if (reportId) {
    paths.push(`/client/reports/${encodeURIComponent(reportId)}`);
    paths.push(`/client/visit-reports/${encodeURIComponent(reportId)}`);
  }
  if (visitId) {
    paths.push(`/client/visits/${encodeURIComponent(visitId)}/report`);
    paths.push(`/client/reports/visit/${encodeURIComponent(visitId)}`);
  }
  if (orderId) {
    paths.push(`/orders/${encodeURIComponent(orderId)}/report`);
    paths.push(`/client/orders/${encodeURIComponent(orderId)}/report`);
  }

  for (const path of paths) {
    const report = await tryGetReport(path);
    if (report) {
      const resolvedOrderId = orderId || report.order_id;
      if (resolvedOrderId) {
        return enrichReportWithOrderTrack(resolvedOrderId, report);
      }
      return report;
    }
  }
  return null;
}

/** Extract report (or ids) from order track payload if backend embeds it. */
export function extractReportFromOrderTrack(track: unknown): {
  report: ClientVisitReport | null;
  reportId?: string;
  visitId?: string;
} {
  const row = asRecord(track);
  if (!row) return { report: null };

  const nested =
    parseClientVisitReport(row.visit_report) ||
    parseClientVisitReport(row.service_report) ||
    parseClientVisitReport(row.report);

  const reportId = pickString(
    row.report_id,
    asRecord(row.report)?.id,
    asRecord(row.visit_report)?.id
  );
  const visitId = pickString(
    row.visit_id,
    asRecord(row.visit)?.id,
    asRecord(row.report)?.visit_id,
    asRecord(row.visit_report)?.visit_id
  );

  return {
    report: nested,
    reportId: reportId || undefined,
    visitId: visitId || undefined,
  };
}

/**
 * POST mark report as delivered by the client.
 * Tries common backend routes until one succeeds.
 * UI is ready — backend can implement one of these endpoints.
 */
export async function markClientVisitReportDelivered(params: {
  reportId?: number | string | null;
  visitId?: number | string | null;
  orderId?: number | string | null;
}): Promise<{ message: string; status?: string }> {
  const reportId = params.reportId != null ? String(params.reportId) : '';
  const visitId = params.visitId != null ? String(params.visitId) : '';
  const orderId = params.orderId != null ? String(params.orderId) : '';

  const attempts: Array<{ path: string; body: Record<string, unknown> }> = [];
  if (orderId) {
    attempts.push({
      path: `/orders/${encodeURIComponent(orderId)}/mark-delivered`,
      body: {},
    });
  }
  if (reportId) {
    attempts.push({
      path: `/client/reports/${encodeURIComponent(reportId)}/mark-delivered`,
      body: { status: 'delivered' },
    });
    attempts.push({
      path: `/client/reports/${encodeURIComponent(reportId)}/deliver`,
      body: { status: 'delivered' },
    });
  }
  if (visitId) {
    attempts.push({
      path: `/client/visits/${encodeURIComponent(visitId)}/report/mark-delivered`,
      body: { status: 'delivered' },
    });
  }
  if (orderId) {
    attempts.push({
      path: `/orders/${encodeURIComponent(orderId)}/report/mark-delivered`,
      body: { status: 'delivered' },
    });
  }

  let lastError = 'Could not mark this report as delivered.';
  for (const attempt of attempts) {
    try {
      const response = await apiClient.post(attempt.path, attempt.body, { timeout: 20000 });
      const body = asRecord(response.data) ?? {};
      if (body.success === false) {
        lastError = pickString(body.message) || lastError;
        continue;
      }
      const data = asRecord(body.data) ?? {};
      const tracking = asRecord(data.tracking) ?? {};
      return {
        message: pickString(body.message) || 'Report marked as delivered.',
        status:
          pickString(
            tracking.status,
            data.status,
            data.order_status,
            data.current_status,
            body.status
          ) || 'delivered',
      };
    } catch (error: unknown) {
      const ax = error as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      if (ax.response?.status === 404 || ax.response?.status === 405) {
        lastError = ax.response?.data?.message || lastError;
        continue;
      }
      throw new Error(ax.response?.data?.message || ax.message || lastError);
    }
  }

  throw new Error(lastError);
}
