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
  before_photos?: Array<{ id: number; photo_url: string; type: string }>;
  after_photos?: Array<{ id: number; photo_url: string; type: string }>;
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
