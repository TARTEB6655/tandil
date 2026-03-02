import apiClient from './api';

export interface TechnicianWeeklyKpis {
  earnings: number;
  visits_done: number;
  rating: number;
}

/** Task as returned by GET /api/technician/dashboard today_tasks */
export interface TechnicianTodayTask {
  id: number | string;
  scheduled_date?: string;
  scheduled_time?: string;
  status?: string;
  farm_name?: string;
  service_name?: string;
  location?: string;
  duration_minutes?: number;
  client_name?: string;
  client_id?: number;
  area?: string;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  /** Legacy field names */
  customer_name?: string;
  customerName?: string;
  service?: string;
  address?: string;
  scheduledTime?: string;
  estimated_duration?: string;
  estimatedDuration?: string;
  task_type?: string;
  taskType?: string;
  [key: string]: unknown;
}

/** Recent visit as returned by GET /api/technician/dashboard recent_visits */
export interface TechnicianRecentVisit {
  id: number | string;
  farm_name: string;
  service_name: string;
  date: string;
  price: number;
  price_display?: string;
  rating: number;
}

export interface TechnicianDashboardData {
  name: string;
  email: string;
  employee_id: string;
  is_online: boolean;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  designation?: string;
  weekly_kpis: TechnicianWeeklyKpis;
  today_tasks: TechnicianTodayTask[];
  recent_visits?: TechnicianRecentVisit[];
}

export interface TechnicianDashboardResponse {
  success?: boolean;
  data?: TechnicianDashboardData;
}

/**
 * GET /api/technician/dashboard
 * Returns technician profile, weekly KPIs, and today's tasks. Requires Bearer token.
 */
export async function getTechnicianDashboard(): Promise<TechnicianDashboardData | null> {
  const response = await apiClient.get<TechnicianDashboardResponse>('/technician/dashboard', {
    timeout: 15000,
  });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Filter for GET /api/technician/tasks */
export type TechnicianTasksFilter = 'today' | 'upcoming' | 'completed' | 'all';

export interface TechnicianTasksResponse {
  success?: boolean;
  data?: {
    current_page: number;
    data: TechnicianTodayTask[];
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

export interface GetTechnicianTasksResult {
  list: TechnicianTodayTask[];
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  nextPageUrl: string | null;
}

/** Job from GET /api/technician/jobs (recent/completed/cancelled) */
export interface TechnicianJob {
  id: number | string;
  scheduled_date?: string;
  scheduled_time?: string;
  status?: string;
  farm_name?: string;
  service_name?: string;
  location?: string;
  duration_minutes?: number;
  client_name?: string;
  client_id?: number;
  area?: string;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  /** Optional from API */
  date?: string;
  price?: number;
  price_display?: string;
  rating?: number;
  [key: string]: unknown;
}

export type TechnicianJobsPeriod = 'week' | 'month' | 'year';

export interface TechnicianJobsSummary {
  total_earnings?: number;
  jobs_completed?: number;
  avg_rating?: number;
}

export interface TechnicianJobsResponse {
  success?: boolean;
  data?: {
    summary?: TechnicianJobsSummary;
    jobs?: {
      data: TechnicianJob[];
      current_page?: number;
      last_page?: number;
      total?: number;
      per_page?: number;
    };
  };
}

/**
 * GET /api/technician/jobs?period=week|month|year&per_page=15&page=1
 * Returns recent/completed/cancelled jobs. Requires Bearer token.
 * API response: { success, data: { summary: {...}, jobs: { data: [...], total, ... } } }
 */
export async function getTechnicianJobs(
  period: TechnicianJobsPeriod = 'month',
  per_page: number = 15,
  page: number = 1
): Promise<{ list: TechnicianJob[]; total: number; summary?: TechnicianJobsSummary }> {
  const response = await apiClient.get<TechnicianJobsResponse>('/technician/jobs', {
    params: { period, per_page, page },
    timeout: 15000,
  });
  if (!response.data?.success || !response.data?.data) {
    return { list: [], total: 0 };
  }
  const data = response.data.data;
  const jobsPayload = data.jobs;
  if (jobsPayload && Array.isArray(jobsPayload.data)) {
    return {
      list: jobsPayload.data,
      total: jobsPayload.total ?? jobsPayload.data.length,
      summary: data.summary,
    };
  }
  return { list: [], total: 0, summary: data.summary };
}

/** Paginated response for GET /api/technician/jobs/accepted */
export interface TechnicianAcceptedJobsResponse {
  success?: boolean;
  message?: string;
  data?: {
    current_page: number;
    data: TechnicianTodayTask[];
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

export interface GetTechnicianAcceptedJobsResult {
  list: TechnicianTodayTask[];
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  nextPageUrl: string | null;
}

/**
 * GET /api/technician/jobs/accepted?period=week|month|year&per_page=15&page=1
 * Returns accepted and in-progress jobs. Requires Bearer token.
 */
export async function getTechnicianAcceptedJobs(
  period: TechnicianJobsPeriod = 'month',
  per_page: number = 15,
  page: number = 1
): Promise<GetTechnicianAcceptedJobsResult> {
  const response = await apiClient.get<TechnicianAcceptedJobsResponse>('/technician/jobs/accepted', {
    params: { period, per_page, page },
    timeout: 15000,
  });
  const d = response.data?.data;
  if (!response.data?.success || !d) {
    return { list: [], currentPage: 1, lastPage: 1, total: 0, perPage: per_page, nextPageUrl: null };
  }
  return {
    list: Array.isArray(d.data) ? d.data : [],
    currentPage: d.current_page ?? 1,
    lastPage: d.last_page ?? 1,
    total: d.total ?? 0,
    perPage: d.per_page ?? per_page,
    nextPageUrl: d.next_page_url ?? null,
  };
}

/**
 * GET /api/technician/jobs/rejected?period=week|month|year&per_page=15&page=1
 * Returns rejected jobs. Requires Bearer token.
 */
export async function getTechnicianRejectedJobs(
  period: TechnicianJobsPeriod = 'month',
  per_page: number = 15,
  page: number = 1
): Promise<GetTechnicianAcceptedJobsResult> {
  const response = await apiClient.get<TechnicianAcceptedJobsResponse>('/technician/jobs/rejected', {
    params: { period, per_page, page },
    timeout: 15000,
  });
  const d = response.data?.data;
  if (!response.data?.success || !d) {
    return { list: [], currentPage: 1, lastPage: 1, total: 0, perPage: per_page, nextPageUrl: null };
  }
  return {
    list: Array.isArray(d.data) ? d.data : [],
    currentPage: d.current_page ?? 1,
    lastPage: d.last_page ?? 1,
    total: d.total ?? 0,
    perPage: d.per_page ?? per_page,
    nextPageUrl: d.next_page_url ?? null,
  };
}

/**
 * GET /api/technician/tasks?filter=today|upcoming|completed|all&page=1&per_page=15
 * Returns paginated tasks. Requires Bearer token.
 */
export async function getTechnicianTasks(
  filter: TechnicianTasksFilter = 'today',
  page: number = 1,
  per_page: number = 15
): Promise<GetTechnicianTasksResult> {
  const response = await apiClient.get<TechnicianTasksResponse>('/technician/tasks', {
    params: { filter, page, per_page },
    timeout: 15000,
  });
  const d = response.data?.data;
  if (!response.data?.success || !d) {
    return { list: [], currentPage: 1, lastPage: 1, total: 0, perPage: per_page, nextPageUrl: null };
  }
  return {
    list: Array.isArray(d.data) ? d.data : [],
    currentPage: d.current_page ?? 1,
    lastPage: d.last_page ?? 1,
    total: d.total ?? 0,
    perPage: d.per_page ?? per_page,
    nextPageUrl: d.next_page_url ?? null,
  };
}

/**
 * POST /api/technician/tasks/:visit_id/accept
 * Accept a task. Requires Bearer token.
 */
export async function acceptTechnicianTask(visitId: number | string): Promise<{ success: boolean; message?: string }> {
  const response = await apiClient.post<{ success?: boolean; message?: string }>(
    `/technician/tasks/${visitId}/accept`,
    {},
    { timeout: 15000 }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to accept task.',
  };
}

/**
 * POST /api/technician/tasks/:visit_id/reject
 * Body: form-data with reason. Requires Bearer token.
 */
export async function rejectTechnicianTask(
  visitId: number | string,
  reason: string = 'Not available'
): Promise<{ success: boolean; message?: string }> {
  const formData = new FormData();
  formData.append('reason', reason.trim() || 'Not available');
  const response = await apiClient.post<{ success?: boolean; message?: string }>(
    `/technician/tasks/${visitId}/reject`,
    formData,
    { timeout: 15000 }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to reject task.',
  };
}

/** Profile response from GET /api/technician/profile */
export interface TechnicianNotificationPreferences {
  push_enabled?: boolean;
  email_enabled?: boolean;
}

export interface TechnicianProfileData {
  name: string;
  email: string;
  phone?: string | null;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  employee_id?: string;
  rating: number;
  jobs_completed: number;
  total_earnings: number;
  member_since: string;
  specializations: string[];
  service_area?: string | null;
  notification_preferences?: TechnicianNotificationPreferences | null;
  availability?: unknown;
}

export interface TechnicianProfileResponse {
  success?: boolean;
  data?: TechnicianProfileData;
}

/**
 * GET /api/technician/profile
 * Returns full technician profile. Requires Bearer token.
 */
export async function getTechnicianProfile(): Promise<TechnicianProfileData | null> {
  const response = await apiClient.get<TechnicianProfileResponse>('/technician/profile', {
    timeout: 15000,
  });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/**
 * GET /api/technician/specializations
 * Returns { success, data: { specializations: string[] } }. Requires Bearer token.
 */
export async function getTechnicianSpecializations(): Promise<string[]> {
  const response = await apiClient.get<{ success?: boolean; data?: { specializations?: string[] } }>(
    '/technician/specializations',
    { timeout: 15000 }
  );
  if (response.data?.success && Array.isArray(response.data?.data?.specializations)) {
    return response.data.data.specializations;
  }
  return [];
}

/**
 * POST /api/technician/specializations (form-data)
 * Body: specializations = JSON array of strings e.g. ["AC", "Plumbing", "Electrical"].
 * Requires Bearer token.
 */
export async function updateTechnicianSpecializations(
  specializations: string[]
): Promise<{ success: boolean; message?: string }> {
  const formData = new FormData();
  formData.append('specializations', JSON.stringify(specializations));
  const response = await apiClient.post<{ success?: boolean; message?: string }>(
    '/technician/specializations',
    formData as any,
    { timeout: 15000 }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to save specializations.',
  };
}

/** Response of GET /api/technician/service-areas */
export interface TechnicianServiceAreasData {
  service_area?: string;
  service_areas?: string[];
}

/**
 * GET /api/technician/service-areas
 * Returns { success, data: { service_area?, service_areas[] } }. Requires Bearer token.
 */
export async function getTechnicianServiceAreas(): Promise<TechnicianServiceAreasData> {
  const response = await apiClient.get<{
    success?: boolean;
    data?: { service_area?: string; service_areas?: string[] };
  }>('/technician/service-areas', { timeout: 15000 });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return {};
}

/**
 * PUT /api/technician/service-areas (form-data)
 * Body: service_area (primary, optional), service_areas (JSON array e.g. ["Dubai", "Al Ain", "Abu Dhabi"]).
 * Requires Bearer token.
 */
export async function updateTechnicianServiceAreas(params: {
  service_area?: string;
  service_areas?: string[];
}): Promise<{ success: boolean; message?: string }> {
  const formData = new FormData();
  if (params.service_area != null) formData.append('service_area', params.service_area);
  if (params.service_areas != null) formData.append('service_areas', JSON.stringify(params.service_areas));
  const response = await apiClient.put<{ success?: boolean; message?: string }>(
    '/technician/service-areas',
    formData as any,
    { timeout: 15000 }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to save service areas.',
  };
}

/** Params for POST /api/technician/profile (form-data). Only these params are sent. */
export interface TechnicianProfileUpdateParams {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  password_confirmation?: string;
  profile_picture?: { uri: string; type?: string; name?: string };
}

/**
 * POST /api/technician/profile (form-data)
 * Params: name, email, phone, password, password_confirmation, profile_picture.
 */
export async function updateTechnicianProfile(params: TechnicianProfileUpdateParams): Promise<TechnicianProfileData | null> {
  const formData = new FormData();
  if (params.name != null) formData.append('name', params.name);
  if (params.email != null) formData.append('email', params.email);
  if (params.phone != null) formData.append('phone', params.phone);
  if (params.password != null) formData.append('password', params.password);
  if (params.password_confirmation != null) formData.append('password_confirmation', params.password_confirmation);
  if (params.profile_picture?.uri) {
    formData.append('profile_picture', {
      uri: params.profile_picture.uri,
      type: params.profile_picture.type || 'image/jpeg',
      name: params.profile_picture.name || 'profile.jpg',
    } as any);
  }
  const response = await apiClient.post<TechnicianProfileResponse>('/technician/profile', formData, {
    timeout: 30000,
  });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Working hours slot for PUT /api/technician/availability */
export interface TechnicianWorkingHoursSlot {
  slot: string;
  start: string;
  end: string;
}

/** Break as returned by GET /api/technician/availability */
export interface TechnicianAvailabilityBreak {
  id?: number;
  date: string;
  start_time: string;
  end_time: string;
  reason?: string;
}

/** Vacation as returned by GET /api/technician/availability */
export interface TechnicianAvailabilityVacation {
  id?: number;
  start_date: string;
  end_date: string;
  leave_type?: string;
  reason?: string | null;
}

/** Map app leave_type value to API label (saved format: "Sick leave", "Other", etc.) */
export const LEAVE_TYPE_VALUE_TO_API_LABEL: Record<string, string> = {
  sick_leave: 'Sick leave',
  annual_leave: 'Annual Leave',
  unpaid_leave: 'Unpaid leave',
  paternity_leave: 'Paternity Leave',
  other: 'Other',
};

/** Map API leave_type label back to app value for dropdown/display */
export const API_LABEL_TO_LEAVE_TYPE_VALUE: Record<string, string> = {
  'Sick leave': 'sick_leave',
  'Annual Leave': 'annual_leave',
  'Unpaid leave': 'unpaid_leave',
  'Paternity Leave': 'paternity_leave',
  'Other': 'other',
  'Other leaves': 'other',
};

/** Format vacations for PUT body: leave_type as API label, reason as null when empty */
export function formatVacationsForApi(
  vacations: Array<{ id?: number; start_date: string; end_date: string; leave_type?: string; reason?: string }>
): Array<{ id?: number; start_date: string; end_date: string; leave_type?: string; reason: string | null }> {
  return vacations.map((v) => ({
    ...(v.id != null && { id: v.id }),
    start_date: v.start_date,
    end_date: v.end_date,
    ...(v.leave_type && { leave_type: LEAVE_TYPE_VALUE_TO_API_LABEL[v.leave_type] ?? v.leave_type }),
    reason: v.reason?.trim() ? v.reason.trim() : null,
  }));
}

/** Response of GET /api/technician/availability */
export interface TechnicianAvailabilityData {
  is_online: boolean;
  auto_accept_jobs: boolean;
  working_days: string[];
  working_hours_slots: TechnicianWorkingHoursSlot[];
  service_area?: string;
  service_areas?: string[];
  breaks?: TechnicianAvailabilityBreak[];
  vacations?: TechnicianAvailabilityVacation[];
}

/**
 * GET /api/technician/availability
 * Returns the technician's saved availability schedule. Requires Bearer token.
 */
export async function getTechnicianAvailability(): Promise<TechnicianAvailabilityData | null> {
  const response = await apiClient.get<{ success?: boolean; data?: TechnicianAvailabilityData }>(
    '/technician/availability',
    { timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Params for PUT /api/technician/availability (form-data) */
export interface TechnicianAvailabilityParams {
  is_online: boolean;
  auto_accept_jobs: boolean;
  working_days: string[];
  working_hours_slots: TechnicianWorkingHoursSlot[];
  service_area?: string;
  service_areas?: string[];
  breaks?: Array<{ date: string; start_time: string; end_time: string; reason?: string }>;
  vacations?: TechnicianAvailabilityVacation[];
}

/**
 * PUT /api/technician/availability
 * Body: form-data (is_online, auto_accept_jobs, working_days JSON, working_hours_slots JSON, optional service_area, service_areas, breaks, vacations).
 * Requires Bearer token.
 */
export async function updateTechnicianAvailability(
  params: TechnicianAvailabilityParams
): Promise<{ success: boolean; message?: string }> {
  const formData = new FormData();
  formData.append('is_online', params.is_online ? 'true' : 'false');
  formData.append('auto_accept_jobs', params.auto_accept_jobs ? 'true' : 'false');
  formData.append('working_days', JSON.stringify(params.working_days));
  formData.append('working_hours_slots', JSON.stringify(params.working_hours_slots));
  if (params.service_area != null) formData.append('service_area', params.service_area);
  if (params.service_areas != null) {
    formData.append('service_areas', JSON.stringify(params.service_areas));
  }
  if (params.breaks != null && params.breaks.length > 0) {
    formData.append('breaks', JSON.stringify(params.breaks));
  }
  if (params.vacations != null && params.vacations.length > 0) {
    formData.append('vacations', JSON.stringify(formatVacationsForApi(params.vacations)));
  }
  const response = await apiClient.put<{ success?: boolean; message?: string }>(
    '/technician/availability',
    formData as any,
    { timeout: 15000 }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to save availability.',
  };
}

/** Notification from GET /api/technician/notifications */
export interface TechnicianNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
}

export interface GetTechnicianNotificationsResult {
  list: TechnicianNotification[];
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
}

/**
 * GET /api/technician/notifications?per_page=20&page=1
 * Returns technician notifications. Requires Bearer token.
 */
export async function getTechnicianNotifications(params?: {
  per_page?: number;
  page?: number;
}): Promise<GetTechnicianNotificationsResult> {
  const response = await apiClient.get<{
    success: boolean;
    message?: string;
    data: {
      current_page: number;
      data: TechnicianNotification[];
      last_page?: number;
      total?: number;
      per_page?: number;
    };
  }>('/technician/notifications', {
    params: { per_page: params?.per_page ?? 20, page: params?.page ?? 1 },
    timeout: 15000,
  });
  const d = response.data?.data;
  if (!response.data?.success || !d) {
    return { list: [], currentPage: 1, lastPage: 1, total: 0, perPage: 20 };
  }
  return {
    list: Array.isArray(d.data) ? d.data : [],
    currentPage: d.current_page ?? 1,
    lastPage: d.last_page ?? 1,
    total: d.total ?? 0,
    perPage: d.per_page ?? 20,
  };
}

/**
 * POST /api/technician/notifications/clear-all
 * Clear all notifications for the technician. Requires Bearer token.
 */
export async function clearTechnicianNotifications(): Promise<{ success: boolean; message?: string }> {
  const response = await apiClient.post<{ success?: boolean; message?: string }>(
    '/technician/notifications/clear-all',
    {},
    { timeout: 15000 }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to clear notifications.',
  };
}

/**
 * POST /api/technician/notifications/:notification_id/read
 * Mark a single notification as read. Requires Bearer token.
 */
export async function markTechnicianNotificationRead(
  notificationId: number | string
): Promise<{ success: boolean; message?: string }> {
  const response = await apiClient.post<{ success?: boolean; message?: string }>(
    `/technician/notifications/${notificationId}/read`,
    {},
    { timeout: 15000 }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to mark as read.',
  };
}

/**
 * POST /api/technician/notifications/read-all
 * Mark all notifications as read. Requires Bearer token.
 */
export async function markTechnicianNotificationsReadAll(): Promise<{ success: boolean; message?: string }> {
  const response = await apiClient.post<{ success?: boolean; message?: string }>(
    '/technician/notifications/read-all',
    {},
    { timeout: 15000 }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to mark all as read.',
  };
}

/**
 * POST /api/technician/support/tickets
 * Submit a support ticket as technician. Body: JSON { subject, email, description }. Requires Bearer token.
 */
export async function submitTechnicianSupportTicket(params: {
  subject: string;
  email: string;
  description: string;
}): Promise<{ success: boolean; message?: string }> {
  const body = {
    subject: params.subject.trim(),
    email: params.email.trim(),
    description: params.description.trim(),
  };
  const response = await apiClient.post<{ success?: boolean; message?: string }>(
    '/technician/support/tickets',
    body,
    { timeout: 15000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to submit ticket.',
  };
}
