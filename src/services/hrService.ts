import apiClient from './api';

/** Pending leave request from GET /hr/dashboard/summary */
export interface HRPendingLeaveRequest {
  id: number;
  applicant_name: string;
  applicant_id: string;
  leave_type: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
}

/** Leave request item from GET /hr/leave-requests (Manage Leaves list) */
export interface HRLeaveRequest {
  id: number;
  applicant_name: string;
  applicant_id: string;
  applicant_role?: string;
  profile_picture_url?: string | null;
  leave_type: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
}

export interface HRLeaveRequestsResponse {
  success: boolean;
  data: HRLeaveRequest[];
  counts?: {
    pending: number;
    approved: number;
    rejected: number;
  };
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/** Profile data from GET /hr/profile */
export interface HRProfileData {
  name: string;
  email: string;
  phone: string;
  id: string;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  rating: number;
  jobs_completed: number;
  total_earnings: number;
  member_since: string;
  specializations?: string[];
  service_area?: string | null;
}

export interface HRProfileResponse {
  success: boolean;
  data: HRProfileData;
}

/** Dashboard summary from GET /hr/dashboard/summary */
export interface HRDashboardSummary {
  name: string;
  id: string;
  role: string;
  profile_picture?: string;
  profile_picture_url?: string | null;
  total_staff: number;
  new_hires: number;
  leave_requests: number;
  pending_leave_requests: HRPendingLeaveRequest[];
}

export interface HRDashboardSummaryResponse {
  success: boolean;
  data: HRDashboardSummary;
}

/** Visit assignments from GET /hr/dashboard/visit-assignments */
export interface HRVisitAssignmentsDay {
  total: number;
  assigned: number;
  unassigned: number;
}

export interface HRVisitAssignmentsData {
  today: HRVisitAssignmentsDay;
  tomorrow: HRVisitAssignmentsDay;
}

export interface HRVisitAssignmentsResponse {
  success: boolean;
  data: HRVisitAssignmentsData;
}

/** Summary from GET /hr/visit-assignments/summary */
export interface HRVisitAssignmentSummaryData {
  total_jobs: number;
  unassigned: number;
  pending_acceptance: number;
}

export interface HRVisitAssignmentSummaryResponse {
  success: boolean;
  data: HRVisitAssignmentSummaryData;
}

export interface HRVisitAssignmentListItem {
  id: number;
  scheduled_date: string;
  status: string;
  accept_by?: string | null;
  title?: string;
  service_name?: string;
  location?: string;
  price?: number;
  notes_preview?: string;
  client?: { id: number; name: string } | null;
  area?: { id: number; name: string } | null;
  supervisor?: { id: number; name: string } | null;
  technician?: { id: number; name: string } | null;
  flags?: {
    is_unassigned?: boolean;
    is_escalated?: boolean;
    is_pending_acceptance?: boolean;
  };
}

export interface HRVisitAssignmentListResponse {
  success: boolean;
  data: HRVisitAssignmentListItem[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface HRVisitAssignmentTeamMember {
  id: number;
  name: string;
  employee_id?: string;
  profile_picture_url?: string | null;
  on_leave_today?: boolean;
}

export interface HRVisitAssignmentsAssignScreenResponse {
  success: boolean;
  data: {
    team_members: HRVisitAssignmentTeamMember[];
    available_tasks: HRVisitAssignmentListItem[];
  };
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface HROfferVisitToTechnicianPayload {
  technician_id: number;
  scheduled_date: string;
  note?: string;
}

export interface HRTechnicianMonthlyPreviewParams {
  technician_id: number;
  year: number;
  month: number;
}

export interface HRGeneratedReportItem {
  id: number | string;
  status?: 'pending' | 'generated' | 'failed' | string;
  type?: string;
  generated_at?: string | null;
  created_at?: string | null;
  file_url?: string | null;
  download_url?: string | null;
  technician_name?: string | null;
  technician?: { id: number; name: string } | null;
  month?: number | string | null;
  year?: number | string | null;
}

export interface HRGeneratedReportsResponse {
  success?: boolean;
  data?: HRGeneratedReportItem[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  message?: string;
}

export interface HRGenerateReportPayload {
  technician_id: number;
  year: number;
  month: number;
  format?: 'pdf' | string;
}

export interface HRNotificationItem {
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

export interface HRNotificationsResult {
  success: boolean;
  message?: string;
  data?: {
    notifications?: {
      current_page: number;
      data: HRNotificationItem[];
      last_page: number;
      total: number;
      per_page: number;
    };
    unread_count?: number;
  };
}

export interface HRNotificationActionResponse {
  success?: boolean;
  message?: string;
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  user_id: number | null;
  employee_id: string;
  designation: string;
  region: string;
  joining_date: string;
  status?: string;
  leave_balance?: number;
  leave_remaining_days?: number | null;
  leave_days?: number | null;
  leave_end_date?: string | null;
  created_at: string;
  updated_at: string;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  initial?: string | null;
  user?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    role: string;
    profile_picture?: string | null;
    profile_picture_url?: string | null;
    initial?: string | null;
  } | null;
}

export interface EmployeesResponse {
  success?: boolean;
  message?: string;
  data: Employee[];
  total?: number;
  meta?: { current_page: number; last_page: number; per_page: number };
}

export interface CreateEmployeeData {
  name: string;
  email: string;
  phone: string;
  user_id?: number | null;
  employee_id?: string;
  designation: string;
  region: string;
  joining_date: string;
}

export const hrService = {
  /** GET /hr/profile – HR manager profile */
  getProfile: async (): Promise<HRProfileResponse> => {
    const response = await apiClient.get<HRProfileResponse>('/hr/profile');
    return response.data;
  },

  /** PUT /hr/profile – update HR manager profile. Body: form-data name, email, phone, profile_picture (optional file). */
  updateProfile: async (params: {
    name: string;
    email: string;
    phone: string;
    profile_picture?: { uri: string; type?: string; name?: string };
  }): Promise<HRProfileData | null> => {
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
    const response = await apiClient.put<HRProfileResponse>('/hr/profile', formData, {
      timeout: 30000,
    });
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    return null;
  },

  /** GET /hr/dashboard/summary – HR manager profile and dashboard stats */
  getDashboardSummary: async (): Promise<HRDashboardSummaryResponse> => {
    const response = await apiClient.get<HRDashboardSummaryResponse>('/hr/dashboard/summary');
    return response.data;
  },

  /** GET /hr/dashboard/visit-assignments – today and tomorrow visit stats */
  getVisitAssignments: async (): Promise<HRVisitAssignmentsResponse> => {
    const response = await apiClient.get<HRVisitAssignmentsResponse>('/hr/dashboard/visit-assignments');
    return response.data;
  },

  /** GET /hr/visit-assignments/summary?scope=&date_from=&date_to=&status= */
  getVisitAssignmentsSummary: async (params?: {
    scope?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
  }): Promise<HRVisitAssignmentSummaryResponse> => {
    const response = await apiClient.get<HRVisitAssignmentSummaryResponse>('/hr/visit-assignments/summary', {
      params,
    });
    return response.data;
  },

  /** GET /hr/visit-assignments?scope=&date_from=&date_to=&status=&per_page= */
  getVisitAssignmentsList: async (params?: {
    scope?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    per_page?: number;
    page?: number;
  }): Promise<HRVisitAssignmentListResponse> => {
    const response = await apiClient.get<HRVisitAssignmentListResponse>('/hr/visit-assignments', {
      params,
    });
    return response.data;
  },

  /** GET /hr/visit-assignments/assign-screen?scope=&date_from=&date_to=&status=&per_page= */
  getVisitAssignmentsAssignScreen: async (params?: {
    scope?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    per_page?: number;
    page?: number;
  }): Promise<HRVisitAssignmentsAssignScreenResponse> => {
    const response = await apiClient.get<HRVisitAssignmentsAssignScreenResponse>(
      '/hr/visit-assignments/assign-screen',
      {
        params,
      }
    );
    return response.data;
  },

  /** POST /hr/visit-assignments/:visit_id */
  offerVisitToTechnician: async (
    visitId: number,
    payload: HROfferVisitToTechnicianPayload
  ): Promise<{ success?: boolean; message?: string }> => {
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/hr/visit-assignments/${visitId}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    return response.data;
  },

  /** GET /hr/reports/technician-monthly?technician_id=&year=&month= */
  getTechnicianMonthlyPreview: async (
    params: HRTechnicianMonthlyPreviewParams
  ): Promise<{ success?: boolean; data?: any; message?: string }> => {
    const response = await apiClient.get<{ success?: boolean; data?: any; message?: string }>(
      '/hr/reports/technician-monthly',
      {
        params,
      }
    );
    return response.data;
  },

  /** GET /hr/reports?per_page=&status=&type=&page= */
  getGeneratedReports: async (params?: {
    per_page?: number;
    status?: 'pending' | 'generated' | 'failed' | string;
    type?: string;
    page?: number;
  }): Promise<HRGeneratedReportsResponse> => {
    const response = await apiClient.get<HRGeneratedReportsResponse>('/hr/reports', {
      params,
    });
    return response.data;
  },

  /** POST /hr/reports/generate */
  generateReport: async (
    payload: HRGenerateReportPayload
  ): Promise<{ success?: boolean; message?: string; data?: HRGeneratedReportItem }> => {
    const response = await apiClient.post<{ success?: boolean; message?: string; data?: HRGeneratedReportItem }>(
      '/hr/reports/generate',
      {
        parameters: {
          technician_id: payload.technician_id,
          year: payload.year,
          month: payload.month,
          format: payload.format || 'pdf',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    return response.data;
  },

  /** DELETE /hr/reports/:report_id */
  deleteGeneratedReport: async (
    reportId: number | string
  ): Promise<{ success?: boolean; message?: string }> => {
    const response = await apiClient.delete<{ success?: boolean; message?: string }>(
      `/hr/reports/${reportId}`
    );
    return response.data;
  },

  getEmployees: async (params?: { page?: number; per_page?: number }): Promise<EmployeesResponse> => {
    const response = await apiClient.get<EmployeesResponse>('/admin/hr/employees', { params });
    return response.data;
  },

  createEmployee: async (employeeData: CreateEmployeeData): Promise<{ status: boolean; data: Employee; message?: string }> => {
    const response = await apiClient.post('/admin/hr/employees', employeeData);
    return response.data;
  },

  updateEmployee: async (employeeId: number, employeeData: Partial<CreateEmployeeData>): Promise<{ status: boolean; data: Employee; message?: string }> => {
    const response = await apiClient.put(`/admin/hr/employees/${employeeId}`, employeeData);
    return response.data;
  },

  deleteEmployee: async (employeeId: number): Promise<{ status: boolean; message?: string }> => {
    const response = await apiClient.delete(`/admin/hr/employees/${employeeId}`);
    return response.data;
  },

  /** GET /hr/leave-requests?status=pending|approved|rejected&per_page=20&page=1 */
  getLeaveRequests: async (params?: {
    status?: 'pending' | 'approved' | 'rejected';
    page?: number;
    per_page?: number;
  }): Promise<HRLeaveRequestsResponse> => {
    const response = await apiClient.get<HRLeaveRequestsResponse>('/hr/leave-requests', {
      params: { per_page: 20, ...params },
    });
    return response.data;
  },

  /** POST /hr/leave-requests/:id/approve – approve a pending leave request */
  approveLeaveRequest: async (leaveRequestId: number): Promise<{ success?: boolean; message?: string }> => {
    const response = await apiClient.post(`/hr/leave-requests/${leaveRequestId}/approve`);
    return response.data;
  },

  /** POST /hr/leave-requests/:id/reject – reject a pending leave request */
  rejectLeaveRequest: async (leaveRequestId: number): Promise<{ success?: boolean; message?: string }> => {
    const response = await apiClient.post(`/hr/leave-requests/${leaveRequestId}/reject`);
    return response.data;
  },

  /** POST /hr/support/tickets – submit a support ticket. Body: JSON { subject, email, description }. */
  submitSupportTicket: async (params: {
    subject: string;
    email: string;
    description: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const body = {
      subject: params.subject.trim(),
      email: params.email.trim(),
      description: params.description.trim(),
    };
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      '/hr/support/tickets',
      body,
      { timeout: 15000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );
    const data = response.data;
    if (data?.success) return { success: true, message: data.message };
    return { success: false, message: (data as any)?.message ?? 'Failed to submit ticket.' };
  },

  /** GET /hr/notifications?per_page=&page= */
  getNotifications: async (params?: {
    per_page?: number;
    page?: number;
  }): Promise<{
    list: HRNotificationItem[];
    unreadCount: number;
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
  }> => {
    const response = await apiClient.get<HRNotificationsResult>('/hr/notifications', {
      params: { per_page: params?.per_page ?? 20, page: params?.page ?? 1 },
      timeout: 15000,
    });
    const payload = response.data?.data;
    const notifications = payload?.notifications;
    const list = Array.isArray(notifications?.data) ? notifications!.data : [];
    return {
      list,
      unreadCount: payload?.unread_count ?? 0,
      currentPage: notifications?.current_page ?? 1,
      lastPage: notifications?.last_page ?? 1,
      total: notifications?.total ?? 0,
      perPage: notifications?.per_page ?? 20,
    };
  },

  /** POST /hr/notifications/:notification_id/mark-read */
  markNotificationAsRead: async (
    notificationId: string
  ): Promise<HRNotificationActionResponse> => {
    const response = await apiClient.post<HRNotificationActionResponse>(
      `/hr/notifications/${notificationId}/mark-read`,
      null,
      { timeout: 15000 }
    );
    return response.data ?? {};
  },

  /** POST /hr/notifications/mark-all-read */
  markAllNotificationsAsRead: async (): Promise<HRNotificationActionResponse> => {
    const response = await apiClient.post<HRNotificationActionResponse>(
      '/hr/notifications/mark-all-read',
      null,
      { timeout: 15000 }
    );
    return response.data ?? {};
  },

  /** DELETE /hr/notifications/:notification_id */
  deleteNotification: async (
    notificationId: string
  ): Promise<HRNotificationActionResponse> => {
    const response = await apiClient.delete<HRNotificationActionResponse>(
      `/hr/notifications/${notificationId}`,
      { timeout: 15000 }
    );
    return response.data ?? {};
  },

  /** POST /hr/notifications/clear-all */
  clearAllNotifications: async (): Promise<HRNotificationActionResponse> => {
    const response = await apiClient.post<HRNotificationActionResponse>(
      '/hr/notifications/clear-all',
      null,
      { timeout: 15000 }
    );
    return response.data ?? {};
  },
};

