/**
 * Area Manager API. Uses apiClient so Authorization: Bearer <token> is sent.
 */
import apiClient from './api';

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
