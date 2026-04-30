/**
 * Area Manager API. Uses apiClient so Authorization: Bearer <token> is sent.
 */
import apiClient from './api';

/** Profile data from GET /api/area-manager/profile (or dashboard summary fallback) */
export interface AreaManagerProfileData {
  name?: string;
  email?: string;
  phone?: string;
  employee_id?: string;
  member_since?: string | null;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
}

export interface AreaManagerProfileResponse {
  success?: boolean;
  data?: AreaManagerProfileData;
}

export interface AreaManagerNotificationItem {
  id: string;
  type: string;
  notifiable_type?: string;
  notifiable_id?: number;
  data?: {
    title?: string;
    message?: string;
    type?: string;
    report_id?: number;
    report_type?: string;
    generated_at?: string;
    meta?: Record<string, any>;
  };
  read_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AreaManagerNotificationsResponse {
  success?: boolean;
  message?: string;
  data?: {
    notifications?: {
      current_page?: number;
      data?: AreaManagerNotificationItem[];
      last_page?: number;
      total?: number;
      per_page?: number;
    };
    unread_count?: number;
  };
}

export interface AreaManagerNotificationActionResponse {
  success?: boolean;
  message?: string;
}

/**
 * GET /api/area-manager/profile
 * Returns area manager profile (name, email, phone, profile_picture_url). Requires Bearer token.
 */
export async function getAreaManagerProfile(): Promise<AreaManagerProfileData | null> {
  try {
    const response = await apiClient.get<AreaManagerProfileResponse>('/area-manager/profile', {
      timeout: 15000,
    });
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
  } catch (_) {
    // Backend may not have GET profile; caller can use dashboard summary
  }
  return null;
}

/**
 * PUT /api/area-manager/profile
 * Update profile. Body: form-data (name, email, phone, profile_picture optional). Requires Bearer token.
 */
export async function updateAreaManagerProfile(params: {
  name: string;
  email: string;
  phone: string;
  profile_picture?: { uri: string; type?: string; name?: string };
}): Promise<AreaManagerProfileData | null> {
  const formData = new FormData();
  formData.append('name', params.name.trim());
  formData.append('email', params.email.trim());
  formData.append('phone', (params.phone || '').trim());
  if (params.profile_picture?.uri) {
    formData.append('profile_picture', {
      uri: params.profile_picture.uri,
      type: params.profile_picture.type || 'image/jpeg',
      name: params.profile_picture.name || 'profile.jpg',
    } as any);
  }
  const response = await apiClient.put<AreaManagerProfileResponse>('/area-manager/profile', formData, {
    timeout: 30000,
  });
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/**
 * GET /api/area-manager/notifications?per_page=&page=
 * Returns area manager notifications list + unread_count. Requires Bearer token.
 */
export async function getAreaManagerNotifications(params?: {
  per_page?: number;
  page?: number;
}): Promise<{
  list: AreaManagerNotificationItem[];
  unreadCount: number;
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
}> {
  const response = await apiClient.get<AreaManagerNotificationsResponse>(
    '/area-manager/notifications',
    {
      params: { per_page: params?.per_page ?? 20, page: params?.page ?? 1 },
      timeout: 15000,
    }
  );
  const payload = response.data?.data;
  const notifications = payload?.notifications;
  return {
    list: Array.isArray(notifications?.data) ? notifications!.data : [],
    unreadCount: payload?.unread_count ?? 0,
    currentPage: notifications?.current_page ?? 1,
    lastPage: notifications?.last_page ?? 1,
    total: notifications?.total ?? 0,
    perPage: notifications?.per_page ?? 20,
  };
}

/**
 * POST /api/area-manager/notifications/:notification_id/mark-read
 */
export async function markAreaManagerNotificationAsRead(
  notificationId: string
): Promise<AreaManagerNotificationActionResponse> {
  const response = await apiClient.post<AreaManagerNotificationActionResponse>(
    `/area-manager/notifications/${notificationId}/mark-read`,
    null,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

/**
 * POST /api/area-manager/notifications/mark-all-read
 */
export async function markAllAreaManagerNotificationsAsRead(): Promise<AreaManagerNotificationActionResponse> {
  const response = await apiClient.post<AreaManagerNotificationActionResponse>(
    '/area-manager/notifications/mark-all-read',
    null,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

/**
 * DELETE /api/area-manager/notifications/:notification_id
 */
export async function deleteAreaManagerNotification(
  notificationId: string
): Promise<AreaManagerNotificationActionResponse> {
  const response = await apiClient.delete<AreaManagerNotificationActionResponse>(
    `/area-manager/notifications/${notificationId}`,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

/**
 * POST /api/area-manager/notifications/clear-all
 */
export async function clearAllAreaManagerNotifications(): Promise<AreaManagerNotificationActionResponse> {
  const response = await apiClient.post<AreaManagerNotificationActionResponse>(
    '/area-manager/notifications/clear-all',
    null,
    { timeout: 15000 }
  );
  return response.data ?? {};
}

/** Params for POST /api/area-manager/support/tickets */
export interface AreaManagerSubmitTicketParams {
  subject: string;
  email: string;
  description: string;
}

/** Response from POST /api/area-manager/support/tickets */
export interface AreaManagerSubmitTicketResponse {
  success?: boolean;
  message?: string;
  data?: { id?: number; [key: string]: unknown };
}

/**
 * POST /api/area-manager/support/tickets
 * Body: JSON { subject, email, description }. Requires Bearer token.
 */
export async function submitAreaManagerSupportTicket(
  params: AreaManagerSubmitTicketParams
): Promise<{ success: boolean; message?: string }> {
  const body = {
    subject: params.subject.trim(),
    email: params.email.trim(),
    description: params.description.trim(),
  };
  const response = await apiClient.post<AreaManagerSubmitTicketResponse>(
    '/area-manager/support/tickets',
    body,
    {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    }
  );
  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to submit ticket.',
  };
}

/** GET /api/area-manager/dashboard/summary – dashboard summary data */
export interface AreaManagerDashboardSummary {
  profile_picture: string | null;
  profile_picture_url: string | null;
  name: string;
  id: string;
  role: string;
  region: string | null;
  total_farms: number;
  active_subscriptions: number;
  monthly_revenue: number;
  team: number;
  active: number;
  done: number;
}

export interface AreaManagerDashboardSummaryResponse {
  success?: boolean;
  data?: AreaManagerDashboardSummary;
}

/**
 * GET /api/area-manager/dashboard/summary
 * Returns area manager dashboard summary (profile, total_farms, active_subscriptions, monthly_revenue, etc.). Requires Bearer token.
 */
export async function getAreaManagerDashboardSummary(): Promise<AreaManagerDashboardSummary | null> {
  const response = await apiClient.get<AreaManagerDashboardSummaryResponse>(
    '/area-manager/dashboard/summary',
    { timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Single alert from GET /api/area-manager/dashboard/alerts */
export interface AreaManagerDashboardAlert {
  type: string;
  message: string;
  timestamp: string;
}

export interface AreaManagerDashboardAlertsResponse {
  success?: boolean;
  data?: AreaManagerDashboardAlert[];
}

/**
 * GET /api/area-manager/dashboard/alerts
 * Returns list of region alerts. Requires Bearer token.
 */
export async function getAreaManagerDashboardAlerts(): Promise<AreaManagerDashboardAlert[]> {
  const response = await apiClient.get<AreaManagerDashboardAlertsResponse>(
    '/area-manager/dashboard/alerts',
    { timeout: 15000 }
  );
  if (response.data?.success && Array.isArray(response.data?.data)) {
    return response.data.data;
  }
  return [];
}

/** Single team leader from GET /api/area-manager/team-leaders */
export interface AreaManagerTeamLeader {
  id: number;
  name: string;
  employee_id: string;
  initial: string;
  location: string;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  performance_percent: number;
  team: number;
  active: number;
  done: number;
}

export interface AreaManagerTeamLeadersResponse {
  success?: boolean;
  data?: AreaManagerTeamLeader[];
  meta?: { total?: number };
}

/**
 * GET /api/area-manager/team-leaders
 * Returns list of team leaders (supervisors). Requires Bearer token.
 */
export async function getAreaManagerTeamLeaders(): Promise<AreaManagerTeamLeader[]> {
  const response = await apiClient.get<AreaManagerTeamLeadersResponse>(
    '/area-manager/team-leaders',
    { timeout: 15000 }
  );
  if (response.data?.success && Array.isArray(response.data?.data)) {
    return response.data.data;
  }
  return [];
}

/** Team leader detail from GET /api/area-manager/team-leaders/:id */
export interface AreaManagerTeamLeaderDetail extends AreaManagerTeamLeader {
  email?: string;
  phone?: string;
  profile_picture_url?: string | null;
}

export interface AreaManagerTeamLeaderDetailResponse {
  success?: boolean;
  data?: AreaManagerTeamLeaderDetail;
}

/**
 * GET /api/area-manager/team-leaders/:team_leader_id
 * Returns a single team leader's detail. Requires Bearer token.
 */
export async function getAreaManagerTeamLeaderDetail(
  teamLeaderId: number | string
): Promise<AreaManagerTeamLeaderDetail | null> {
  const response = await apiClient.get<AreaManagerTeamLeaderDetailResponse>(
    `/area-manager/team-leaders/${teamLeaderId}`,
    { timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Team leader summary in GET /api/area-manager/teams/:team_id/members */
export interface AreaManagerTeamLeaderSummary {
  id: number;
  name: string;
  employee_id: string;
  location: string;
}

/** Single member from GET /api/area-manager/teams/:team_id/members */
export interface AreaManagerTeamMember {
  id: number;
  name: string;
  employee_id: string;
  initial: string;
  profile_picture_url?: string | null;
  area_names: string[];
  area_ids: number[];
  linked_to: {
    supervisor_id: number;
    supervisor_name: string;
    supervisor_employee_id: string;
  };
  active: number;
  done: number;
  team_leader_id: number;
}

export interface AreaManagerTeamMembersData {
  team_leader: AreaManagerTeamLeaderSummary;
  members: AreaManagerTeamMember[];
}

export interface AreaManagerTeamMembersResponse {
  success?: boolean;
  data?: AreaManagerTeamMembersData;
  meta?: { total?: number };
}

/**
 * GET /api/area-manager/teams/:team_id/members
 * Returns team leader summary and list of members for that supervisor. Requires Bearer token.
 */
export async function getAreaManagerTeamMembers(
  teamId: number
): Promise<AreaManagerTeamMembersData | null> {
  const response = await apiClient.get<AreaManagerTeamMembersResponse>(
    `/area-manager/teams/${teamId}/members`,
    { timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Team member summary in GET /api/area-manager/teams/members/:member_id/jobs */
export interface AreaManagerTeamMemberSummary {
  id: number;
  name: string;
  employee_id: string;
  initial: string;
  profile_picture_url?: string | null;
}

/** Job item from GET /api/area-manager/teams/members/:member_id/jobs */
export interface AreaManagerMemberJob {
  id: number;
  title?: string;
  job_number?: string;
  location?: string;
  status?: string;
  service?: string;
  created_at?: string;
  updated_at?: string;
  scheduled_at?: string;
  completed_at?: string;
  [key: string]: unknown;
}

export interface AreaManagerMemberJobsData {
  team_member: AreaManagerTeamMemberSummary;
  jobs: AreaManagerMemberJob[];
}

export interface AreaManagerMemberJobsResponse {
  success?: boolean;
  data?: AreaManagerMemberJobsData;
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
}

export type AreaManagerMemberJobsStatus = 'processing' | 'all' | 'completed';

/**
 * GET /api/area-manager/teams/members/:member_id/jobs
 * Returns team member summary and paginated jobs. Query: status (processing|all|completed), per_page.
 */
export async function getAreaManagerMemberJobs(
  memberId: number | string,
  options?: { status?: AreaManagerMemberJobsStatus; per_page?: number; page?: number }
): Promise<AreaManagerMemberJobsData | null> {
  const params: Record<string, string | number> = {};
  if (options?.status) params.status = options.status;
  if (options?.per_page != null) params.per_page = options.per_page;
  if (options?.page != null) params.page = options.page;
  const response = await apiClient.get<AreaManagerMemberJobsResponse>(
    `/area-manager/teams/members/${memberId}/jobs`,
    { params, timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Report type for POST /api/area-manager/reports/generate */
export type AreaManagerReportType = 'weekly_summary' | 'team_performance' | 'customer_satisfaction';

export interface AreaManagerGenerateReportParams {
  type: AreaManagerReportType;
  date_from: string; // YYYY-MM-DD
  date_to: string;   // YYYY-MM-DD
}

export interface AreaManagerGenerateReportResponse {
  success?: boolean;
  message?: string;
  data?: { url?: string; file_path?: string; [key: string]: unknown };
}

/**
 * POST /api/area-manager/reports/generate?sync=1
 * Body: JSON { type, date_from, date_to }. Requires Bearer token.
 */
export async function generateAreaManagerReport(
  params: AreaManagerGenerateReportParams
): Promise<{ success: boolean; message?: string; url?: string }> {
  const response = await apiClient.post<AreaManagerGenerateReportResponse>(
    '/area-manager/reports/generate',
    {
      type: params.type,
      date_from: params.date_from,
      date_to: params.date_to,
    },
    {
      params: { sync: 1 },
      timeout: 60000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    }
  );
  if (response.data?.success) {
    return {
      success: true,
      message: response.data.message,
      url: response.data?.data?.url,
    };
  }
  return {
    success: false,
    message: (response.data as any)?.message ?? 'Failed to generate report.',
  };
}

/** Single report from GET /api/area-manager/generated-reports */
export interface AreaManagerGeneratedReport {
  id: number;
  title: string;
  report_type: string;
  type: string;
  period: string;
  file_size: string;
  generated_at: string;
  created_at: string;
  download_url: string;
  view_url: string;
}

export interface AreaManagerGeneratedReportsResponse {
  success?: boolean;
  data?: AreaManagerGeneratedReport[];
  meta?: { total?: number };
}

/**
 * GET /api/area-manager/generated-reports
 * Returns list of generated reports with download_url and view_url. Requires Bearer token.
 */
export async function getAreaManagerGeneratedReports(): Promise<AreaManagerGeneratedReport[]> {
  const response = await apiClient.get<AreaManagerGeneratedReportsResponse>(
    '/area-manager/generated-reports',
    { timeout: 15000 }
  );
  if (response.data?.success && Array.isArray(response.data?.data)) {
    return response.data.data;
  }
  return [];
}

/** Area from GET /api/area-manager/region-map */
export interface AreaManagerRegionMapArea {
  id: number;
  name: string;
  location: string | null;
  country: string;
  active: number;
  done: number;
}

/** Team leader pin from GET /api/area-manager/region-map */
export interface AreaManagerRegionMapTeamLeader {
  id: number;
  name: string;
  employee_id: string;
  location: string;
}

export interface AreaManagerRegionMapData {
  areas: AreaManagerRegionMapArea[];
  team_leaders: AreaManagerRegionMapTeamLeader[];
}

export interface AreaManagerRegionMapResponse {
  success?: boolean;
  data?: AreaManagerRegionMapData;
}

/**
 * GET /api/area-manager/region-map
 * Returns areas and team leaders with locations for the region map. Requires Bearer token.
 */
export async function getAreaManagerRegionMap(): Promise<AreaManagerRegionMapData | null> {
  const response = await apiClient.get<AreaManagerRegionMapResponse>(
    '/area-manager/region-map',
    { timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}

/** Analytics period: today | week | month */
export type AreaManagerAnalyticsPeriod = 'today' | 'week' | 'month';

/** Single point in weekly_trend from GET /api/area-manager/analytics */
export interface AreaManagerAnalyticsTrendPoint {
  date: string;
  count: number;
}

/** Top team from GET /api/area-manager/analytics */
export interface AreaManagerAnalyticsTopTeam {
  id: number;
  employee_id: string;
  name: string;
  visits: number;
  rating: number;
}

export interface AreaManagerAnalyticsData {
  period: AreaManagerAnalyticsPeriod;
  visits: number;
  completion_percent: number;
  avg_time_minutes: number;
  active_teams: number;
  weekly_trend: AreaManagerAnalyticsTrendPoint[];
  top_teams: AreaManagerAnalyticsTopTeam[];
}

export interface AreaManagerAnalyticsResponse {
  success?: boolean;
  data?: AreaManagerAnalyticsData;
}

/**
 * GET /api/area-manager/analytics?period=today|week|month
 * Returns analytics metrics, weekly trend, and top teams. Requires Bearer token.
 */
export async function getAreaManagerAnalytics(
  period: AreaManagerAnalyticsPeriod
): Promise<AreaManagerAnalyticsData | null> {
  const response = await apiClient.get<AreaManagerAnalyticsResponse>(
    '/area-manager/analytics',
    { params: { period }, timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) {
    return response.data.data;
  }
  return null;
}
