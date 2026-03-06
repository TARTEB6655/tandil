/**
 * Supervisor API. Uses apiClient so Authorization: Bearer <supervisor token> is sent.
 * Support tickets list/chat/reply use same endpoints as technician (/support/tickets) with supervisor token.
 */
import apiClient from './api';

/** GET /api/supervisor/profile – supervisor profile response data */
export interface SupervisorProfileData {
  id: number;
  name: string;
  email: string;
  phone: string;
  profile_picture: string | null;
  profile_picture_url: string | null;
  role: string;
  jobs_completed: number;
  total_earnings: number;
  total_earnings_display: string;
  member_since: string;
  rating: number;
  rating_jobs: number;
}

export interface SupervisorProfileResponse {
  success?: boolean;
  data?: SupervisorProfileData;
}

/**
 * GET /api/supervisor/profile
 * Returns supervisor profile. Requires Bearer token.
 */
export async function getSupervisorProfile(): Promise<SupervisorProfileData | null> {
  const response = await apiClient.get<SupervisorProfileResponse>('/supervisor/profile', {
    timeout: 15000,
  });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** GET /api/supervisor/dashboard/summary – dashboard header and stats */
export interface SupervisorDashboardSummaryData {
  profile_picture: string | null;
  profile_picture_url: string | null;
  name: string;
  id: string;
  team_members: number;
  active_visits: number;
  completed_visits: number;
}

export interface SupervisorDashboardSummaryResponse {
  success?: boolean;
  data?: SupervisorDashboardSummaryData;
}

/**
 * GET /api/supervisor/dashboard/summary
 * Returns supervisor dashboard summary (profile, team_members, active_visits, completed_visits). Requires Bearer token.
 */
export async function getSupervisorDashboardSummary(): Promise<SupervisorDashboardSummaryData | null> {
  const response = await apiClient.get<SupervisorDashboardSummaryResponse>('/supervisor/dashboard/summary', {
    timeout: 15000,
  });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Team member from GET /api/supervisor/team */
export interface SupervisorTeamMember {
  id: number;
  name: string;
  employee_id: string;
  profile_picture_url: string | null;
  status: string;
  current_activity: string;
  tasks_completed: number;
  tasks_total: number;
  tasks_display: string;
}

export interface SupervisorTeamResponse {
  success?: boolean;
  data?: SupervisorTeamMember[];
}

/**
 * GET /api/supervisor/team
 * Returns the current supervisor's team members. Requires Bearer token.
 */
export async function getSupervisorTeam(): Promise<SupervisorTeamMember[]> {
  const response = await apiClient.get<SupervisorTeamResponse>('/supervisor/team', { timeout: 15000 });
  if (response.data?.success && Array.isArray(response.data?.data)) {
    return response.data.data;
  }
  return [];
}

/** Team member detail from GET /api/supervisor/team/:technician_id */
export interface SupervisorTeamMemberDetail extends SupervisorTeamMember {
  email?: string;
  phone?: string;
}

export interface SupervisorTeamMemberDetailResponse {
  success?: boolean;
  data?: SupervisorTeamMemberDetail;
}

/**
 * GET /api/supervisor/team/:technician_id
 * Returns a single team member's detail. Requires Bearer token.
 */
export async function getSupervisorTeamMember(technicianId: number): Promise<SupervisorTeamMemberDetail | null> {
  const response = await apiClient.get<SupervisorTeamMemberDetailResponse>(
    `/supervisor/team/${technicianId}`,
    { timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Assignment/job from GET /api/supervisor/assignments */
export interface SupervisorAssignment {
  id: number;
  technician_id: number | null;
  supervisor_id: number;
  scheduled_date: string;
  completed_date: string | null;
  status: string;
  title: string;
  service_name: string;
  location: string;
  address?: string;
  duration_minutes: number;
  price: string;
  price_display: string;
  job_time: string;
  supervisor_name?: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Customer on assignment detail GET /api/supervisor/assignments/:id */
export interface SupervisorAssignmentCustomer {
  id: number;
  name: string;
  email: string;
  phone: string;
  profile_picture_url: string | null;
}

/** Technician on assignment detail (when assigned) */
export interface SupervisorAssignmentTechnician {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  employee_id?: string;
  profile_picture_url?: string | null;
}

/** Assignment detail response includes customer and technician */
export interface SupervisorAssignmentDetail extends SupervisorAssignment {
  customer?: SupervisorAssignmentCustomer | null;
  technician?: SupervisorAssignmentTechnician | null;
}

export interface SupervisorAssignmentsResponse {
  success?: boolean;
  data?: {
    data: SupervisorAssignment[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from?: number;
    to?: number;
  };
}

/**
 * GET /api/supervisor/assignments?page=1&per_page=20
 * Returns paginated list of assignments/jobs for the supervisor. Requires Bearer token.
 */
export async function getSupervisorAssignments(params?: {
  page?: number;
  per_page?: number;
}): Promise<{ list: SupervisorAssignment[]; total: number; lastPage: number }> {
  const response = await apiClient.get<SupervisorAssignmentsResponse>('/supervisor/assignments', {
    params: { per_page: 20, ...params },
    timeout: 15000,
  });
  const data = response.data?.data;
  if (!response.data?.success || !data || !Array.isArray(data.data)) {
    return { list: [], total: 0, lastPage: 1 };
  }
  return {
    list: data.data,
    total: data.total ?? data.data.length,
    lastPage: data.last_page ?? 1,
  };
}

export interface SupervisorAssignmentDetailResponse {
  success?: boolean;
  data?: SupervisorAssignmentDetail;
}

/**
 * GET /api/supervisor/assignments/:id
 * Returns a single assignment/job detail (includes customer, technician). Requires Bearer token.
 */
export async function getSupervisorAssignmentDetail(
  assignmentId: number
): Promise<SupervisorAssignmentDetail | null> {
  const response = await apiClient.get<SupervisorAssignmentDetailResponse>(
    `/supervisor/assignments/${assignmentId}`,
    { timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/**
 * POST /api/supervisor/assignments/:visit_id
 * Assign a task to a technician. Body: form-data technician_id (required), scheduled_date (optional, YYYY-MM-DD).
 */
export async function assignSupervisorAssignment(
  assignmentId: number,
  technicianId: number,
  scheduledDate?: Date
): Promise<{ success: boolean; message?: string }> {
  const form = new FormData();
  form.append('technician_id', String(technicianId));
  if (scheduledDate) {
    const yyyy = scheduledDate.getFullYear();
    const mm = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const dd = String(scheduledDate.getDate()).padStart(2, '0');
    form.append('scheduled_date', `${yyyy}-${mm}-${dd}`);
  }
  const response = await apiClient.post<{ success?: boolean; message?: string }>(
    `/supervisor/assignments/${assignmentId}`,
    form,
    { timeout: 15000 }
  );
  return {
    success: response.data?.success === true,
    message: response.data?.message,
  };
}

/** Photo item in report before/after_photos */
export interface SupervisorReportPhoto {
  id: number;
  photo_url: string;
  type: string;
}

/** Single report item from GET /api/supervisor/reports */
export interface SupervisorReportItem {
  id: number;
  visit_id: number;
  technician_name: string;
  employee_id: string;
  location: string;
  service: string;
  submitted_at: string;
  has_photos: boolean;
  before_photos?: SupervisorReportPhoto[];
  after_photos?: SupervisorReportPhoto[];
  technician_notes?: string | null;
}

export interface SupervisorReportsResponse {
  success?: boolean;
  data?: SupervisorReportItem[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links?: { first: string; last: string; prev: string | null; next: string | null };
}

/**
 * GET /api/supervisor/reports?page=1&per_page=20
 * Returns paginated list of pending field reports. Requires Bearer token.
 */
export async function getSupervisorReports(
  page: number = 1,
  per_page: number = 20
): Promise<{ list: SupervisorReportItem[]; total: number; lastPage: number }> {
  const response = await apiClient.get<SupervisorReportsResponse>('/supervisor/reports', {
    params: { page, per_page },
    timeout: 15000,
  });
  if (!response.data?.success || !Array.isArray(response.data?.data)) {
    return { list: [], total: 0, lastPage: 1 };
  }
  const meta = response.data.meta;
  return {
    list: response.data.data,
    total: meta?.total ?? response.data.data.length,
    lastPage: meta?.last_page ?? 1,
  };
}

/**
 * POST /api/supervisor/support/tickets
 * Submit a support ticket as supervisor. Body: JSON { subject, email, description }. Requires Bearer token.
 */
export async function submitSupervisorSupportTicket(params: {
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
    '/supervisor/support/tickets',
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
