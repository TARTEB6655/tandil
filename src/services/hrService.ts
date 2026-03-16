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
};

