import apiClient from './api';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  roles?: Array<{
    id: number;
    name: string;
    guard_name?: string;
    created_at?: string;
    updated_at?: string;
    pivot?: {
      model_type: string;
      model_id: number;
    };
  }>;
}

export interface UsersResponse {
  message?: string;
  status?: boolean;
  data: AdminUser[] | {
    current_page?: number;
    data: AdminUser[];
    first_page_url?: string;
    from?: number;
    last_page?: number;
    last_page_url?: string;
    links?: Array<{
      url: string | null;
      label: string;
      active: boolean;
    }>;
    next_page_url?: string | null;
    path?: string;
    per_page?: number;
    prev_page_url?: string | null;
    to?: number;
    total?: number;
  };
}

/** Admin dashboard profile from GET /admin/dashboard/profile */
export interface AdminDashboardProfile {
  id: number;
  formatted_id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  role_display_name: string;
  status: string;
  greeting: string;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  created_at: string;
}

/** Support ticket from GET /admin/support-tickets */
export interface AdminSupportTicket {
  id: number;
  ticket_number: string;
  subject: string;
  message: string;
  email: string;
  status: string;
  priority?: string;
  category?: string;
  user_id?: number;
  user_name?: string;
  user_role?: string;
  created_at: string;
  updated_at: string;
}

/** Single reply in GET /admin/support-tickets/:id */
export interface SupportTicketReply {
  id: number;
  message: string;
  user_id?: number;
  user_name?: string;
  is_admin?: boolean;
  created_at: string;
}

/** Ticket detail from GET /admin/support-tickets/:id (includes replies) */
export interface AdminSupportTicketDetail extends AdminSupportTicket {
  replies: SupportTicketReply[];
}

/** Zone/supervisor assignment from GET /admin/technicians */
export interface AdminTechnicianZone {
  id: number;
  name: string;
}

export interface AdminTechnician {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  service_areas: string[];
  specializations: string[];
  zone: AdminTechnicianZone | null;
  supervisor: { id: number; name: string } | null;
}

export interface AdminTechniciansResponse {
  success: boolean;
  message?: string;
  data: AdminTechnician[];
  pagination: { current_page: number; last_page: number; per_page: number; total: number };
  search: string | null;
}

/** Supervisor from GET /admin/supervisors */
export interface AdminSupervisorZone {
  id: number;
  name: string;
}

export interface AdminSupervisor {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  service_areas: string[];
  specializations: string[];
  zone: AdminSupervisorZone | null;
  assigned_zones: AdminSupervisorZone[];
}

export interface AdminSupervisorsResponse {
  success: boolean;
  message?: string;
  data: AdminSupervisor[];
  pagination: { current_page: number; last_page: number; per_page: number; total: number };
  search: string | null;
}

export const adminService = {
  getUsers: async (params?: { 
    page?: number; 
    per_page?: number;
    search?: string;
    role?: string;
  }): Promise<UsersResponse> => {
    const response = await apiClient.get<UsersResponse>('/admin/users', { params });
    return response.data;
  },

  getUserById: async (userId: number): Promise<{ status: boolean; data: AdminUser }> => {
    const response = await apiClient.get(`/admin/users/${userId}`);
    return response.data;
  },

  createUser: async (userData: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirmation: string;
    role: string;
    status: string;
  }): Promise<{ status: boolean; data: AdminUser; message?: string }> => {
    const response = await apiClient.post('/admin/users', userData);
    return response.data;
  },

  updateUser: async (userId: number, userData: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    password_confirmation?: string;
    role?: string;
    status?: string;
  }): Promise<{ status: boolean; data: AdminUser; message?: string }> => {
    const response = await apiClient.put(`/admin/users/${userId}`, userData);
    return response.data;
  },

  deleteUser: async (userId: number): Promise<{ status: boolean; message?: string }> => {
    const response = await apiClient.delete(`/admin/users/${userId}`);
    return response.data;
  },

  getDashboardStatistics: async (params?: {
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  }): Promise<{
    success: boolean;
    data: {
      customers: {
        total: number;
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
        growth: {
          daily: string;
          weekly: string;
          monthly: string;
          yearly: string;
        };
      };
      technicians: {
        total: number;
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
        growth: {
          daily: string;
          weekly: string;
          monthly: string;
          yearly: string;
        };
      };
      employees?: {
        total: number;
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
        growth: {
          daily: string;
          weekly: string;
          monthly: string;
          yearly: string;
        };
      };
      total_users?: {
        total: number;
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
        growth: {
          daily: string;
          weekly: string;
          monthly: string;
          yearly: string;
        };
      };
      active_subscriptions?: {
        total: number;
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
        growth: {
          daily: string;
          weekly: string;
          monthly: string;
          yearly: string;
        };
      };
      monthly_revenue?: {
        total: number;
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
        growth: {
          daily: string;
          weekly: string;
          monthly: string;
          yearly: string;
        };
      };
    };
  }> => {
    const response = await apiClient.get('/admin/dashboard/statistics', { params });
    return response.data;
  },

  getUsersStatistics: async (): Promise<{
    success: boolean;
    data: {
      all_users: number;
      workers: number;
      supervisors: number;
      managers: number;
    };
  }> => {
    const response = await apiClient.get('/admin/users/statistics');
    return response.data;
  },

  getRecentActivities: async (params?: { limit?: number }): Promise<{ success: boolean; data: AdminActivity[] }> => {
    const response = await apiClient.get<{ success: boolean; data: AdminActivity[] }>(
      '/admin/dashboard/recent-activities',
      { params, timeout: 60000 }
    );
    return response.data;
  },

  /** GET /notifications - authenticated notifications list (admin token supported). */
  getNotifications: async (params?: { page?: number; per_page?: number }): Promise<{
    success: boolean;
    message?: string;
    list: AdminNotificationItem[];
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
  }> => {
    const response = await apiClient.get('/notifications', {
      params: params ?? {},
      timeout: 15000,
    });
    const body = response?.data ?? {};
    const notifications = body?.data?.notifications;
    const pageData = notifications?.data;
    const rawList = Array.isArray(pageData)
      ? pageData
      : Array.isArray(body?.data?.data)
        ? body.data.data
        : Array.isArray(body?.data)
          ? body.data
          : [];

    const list: AdminNotificationItem[] = rawList.map((item: any) => ({
      id: item?.id ?? String(Math.random()),
      type: item?.type,
      notifiable_type: item?.notifiable_type,
      notifiable_id: item?.notifiable_id,
      read_at: item?.read_at ?? null,
      created_at: item?.created_at,
      updated_at: item?.updated_at,
      title: String(item?.data?.title ?? item?.title ?? 'Notification'),
      message: String(item?.data?.message ?? item?.message ?? ''),
      action: item?.data?.meta?.action ?? item?.meta?.action ?? null,
      meta: item?.data?.meta ?? item?.meta ?? null,
    }));

    return {
      success: body?.success === true,
      message: body?.message,
      list,
      currentPage: Number(notifications?.current_page ?? body?.data?.current_page ?? 1),
      lastPage: Number(notifications?.last_page ?? body?.data?.last_page ?? 1),
      total: Number(notifications?.total ?? body?.data?.total ?? list.length),
      perPage: Number(notifications?.per_page ?? body?.data?.per_page ?? params?.per_page ?? 20),
    };
  },

  /** GET /admin/dashboard/profile – admin profile for dashboard header */
  getDashboardProfile: async (): Promise<{ success: boolean; data: AdminDashboardProfile }> => {
    const response = await apiClient.get<{ success: boolean; data: AdminDashboardProfile }>(
      '/admin/dashboard/profile',
      { timeout: 15000 }
    );
    return response.data;
  },

  /**
   * PUT /admin/dashboard/profile – update admin profile (form-data).
   * Body: name?, email?, phone?, profile_picture? (file), password?, password_confirmation? (required when password is set).
   */
  updateDashboardProfile: async (params: {
    name?: string;
    email?: string;
    phone?: string;
    profile_picture?: { uri: string; type?: string; name?: string };
    password?: string;
    password_confirmation?: string;
  }): Promise<{ success: boolean; data?: AdminDashboardProfile; message?: string }> => {
    const formData = new FormData();
    if (params.name != null) formData.append('name', params.name.trim());
    if (params.email != null) formData.append('email', params.email.trim());
    if (params.phone != null) formData.append('phone', params.phone.trim());
    if (params.password != null) formData.append('password', params.password);
    if (params.password_confirmation != null) formData.append('password_confirmation', params.password_confirmation);
    if (params.profile_picture?.uri) {
      formData.append('profile_picture', {
        uri: params.profile_picture.uri,
        type: params.profile_picture.type || 'image/jpeg',
        name: params.profile_picture.name || 'profile.jpg',
      } as any);
    }
    const response = await apiClient.put<{ success: boolean; data?: AdminDashboardProfile; message?: string }>(
      '/admin/dashboard/profile',
      formData,
      { timeout: 30000 }
    );
    return response.data ?? { success: false };
  },

  // Reports API
  getReports: async (params?: {
    page?: number;
    per_page?: number;
    status?: 'pending' | 'generated' | 'scheduled';
    type?: string;
  }): Promise<ReportsListResponse> => {
    const response = await apiClient.get<ReportsListResponse>('/admin/reports', { params });
    return response.data;
  },

  generateReport: async (body: {
    type: string;
    title: string;
    parameters: {
      start_date: string;
      end_date: string;
      format?: string;
      include_charts?: boolean;
      include_details?: boolean;
    };
  }): Promise<{ success: boolean; message: string; data: AdminReport }> => {
    const response = await apiClient.post<{ success: boolean; message: string; data: AdminReport }>(
      '/admin/reports/generate',
      body
    );
    return response.data;
  },

  scheduleReport: async (body: {
    type: string;
    title: string;
    scheduled_at: string; // "YYYY-MM-DD HH:MM:SS"
    recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
    parameters: {
      start_date: string;
      end_date: string;
      format?: string;
      include_charts?: boolean;
    };
  }): Promise<{ message: string; data: AdminReport }> => {
    const response = await apiClient.post<{ message: string; data: AdminReport }>(
      '/admin/reports/schedule',
      body
    );
    return response.data;
  },

  deleteReport: async (reportId: number): Promise<{ success?: boolean; message: string }> => {
    const response = await apiClient.delete<{ success?: boolean; message: string }>(
      `/admin/reports/${reportId}`
    );
    return response.data;
  },

  cancelScheduledReport: async (reportId: number): Promise<{ success?: boolean; message: string }> => {
    const response = await apiClient.delete<{ success?: boolean; message: string }>(
      `/admin/reports/${reportId}/cancel`
    );
    return response.data;
  },

  /** Admin support tickets: GET /admin/support-tickets?status=&per_page=&page=&search= */
  getSupportTickets: async (params?: {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    per_page?: number;
    page?: number;
    search?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    data: {
      data: AdminSupportTicket[];
      pagination: { current_page: number; last_page: number; per_page: number; total: number };
    };
  }> => {
    const response = await apiClient.get<{
      success: boolean;
      message?: string;
      data: {
        data: AdminSupportTicket[];
        pagination: { current_page: number; last_page: number; per_page: number; total: number };
      };
    }>('/admin/support-tickets', { params, timeout: 15000 });
    return response.data;
  },

  /** Admin support ticket by ID: GET /admin/support-tickets/:id (includes replies) */
  getSupportTicketById: async (ticketId: number): Promise<{
    success: boolean;
    message?: string;
    data: AdminSupportTicketDetail;
  }> => {
    const response = await apiClient.get<{
      success: boolean;
      message?: string;
      data: AdminSupportTicketDetail;
    }>(`/admin/support-tickets/${ticketId}`, { timeout: 15000 });
    return response.data;
  },

  /** Admin reply to support ticket: POST /admin/support-tickets/:id/reply */
  replyToSupportTicket: async (
    ticketId: number,
    message: string
  ): Promise<{ success: boolean; message?: string; data?: unknown }> => {
    const response = await apiClient.post<{ success: boolean; message?: string; data?: unknown }>(
      `/admin/support-tickets/${ticketId}/reply`,
      { message },
      { timeout: 15000 }
    );
    return response.data;
  },

  /** Admin update support ticket status: PUT /admin/support-tickets/:id/status */
  updateSupportTicketStatus: async (
    ticketId: number,
    status: string
  ): Promise<{ success: boolean; message?: string; data?: unknown }> => {
    const response = await apiClient.put<{ success: boolean; message?: string; data?: unknown }>(
      `/admin/support-tickets/${ticketId}/status`,
      { status },
      { timeout: 15000 }
    );
    return response.data;
  },

  /** All technicians with zone and supervisor: GET /admin/technicians?per_page=&search= */
  getTechnicians: async (params?: {
    per_page?: number;
    page?: number;
    search?: string;
  }): Promise<AdminTechniciansResponse> => {
    const response = await apiClient.get<AdminTechniciansResponse>('/admin/technicians', {
      params: params ?? {},
      timeout: 15000,
    });
    return response.data;
  },

  /** All supervisors with zone/assigned_zones: GET /admin/supervisors?per_page=&search= */
  getSupervisors: async (params?: {
    per_page?: number;
    page?: number;
    search?: string;
  }): Promise<AdminSupervisorsResponse> => {
    const response = await apiClient.get<AdminSupervisorsResponse>('/admin/supervisors', {
      params: params ?? {},
      timeout: 15000,
    });
    return response.data;
  },

  /** Supervisor team: GET /admin/supervisors/:supervisor_id/team */
  getSupervisorTeam: async (supervisorId: number): Promise<{
    success: boolean;
    data: {
      supervisor: {
        id: number;
        name: string;
        email: string;
        employee_id: string;
        assigned_zones: AdminSupervisorZone[];
      };
      team: Array<{
        id: number;
        name: string;
        email: string;
        employee_id: string;
        service_areas: string[];
        specializations: string[];
        assigned_zones: AdminSupervisorZone[];
      }>;
    };
  }> => {
    const response = await apiClient.get(`/admin/supervisors/${supervisorId}/team`, {
      timeout: 15000,
    });
    return response.data;
  },

  /** Add member to supervisor team: POST /admin/supervisors/:supervisor_id/team (form-data: technician_id) */
  addSupervisorTeamMember: async (
    supervisorId: number,
    technicianId: number
  ): Promise<{ success: boolean; message?: string }> => {
    const form = new FormData();
    form.append('technician_id', String(technicianId));
    const response = await apiClient.post(
      `/admin/supervisors/${supervisorId}/team`,
      form,
      { timeout: 15000 }
    );
    return response.data;
  },

  /** Remove member from supervisor team: DELETE /admin/supervisors/:supervisor_id/team?technician_id= */
  removeSupervisorTeamMember: async (
    supervisorId: number,
    technicianId: number
  ): Promise<{ success: boolean; message?: string }> => {
    const response = await apiClient.delete(
      `/admin/supervisors/${supervisorId}/team`,
      { params: { technician_id: technicianId }, timeout: 15000 }
    );
    return response.data;
  },

  /** Create area/zone: POST /admin/areas (form-data: location, supervisor_id) */
  createArea: async (
    location: string,
    supervisorId: number
  ): Promise<{ success: boolean; message?: string; data?: { id: number; name?: string; [k: string]: unknown } }> => {
    const form = new FormData();
    form.append('location', location);
    form.append('supervisor_id', String(supervisorId));
    const response = await apiClient.post('/admin/areas', form, { timeout: 15000 });
    return response.data;
  },

  /** Get all areas: GET /admin/areas?all=1&search= */
  getAreas: async (params?: { all?: number; search?: string }): Promise<{
    success: boolean;
    message?: string;
    data: Array<{ id: number; location: string | null; supervisor_id: number | null }>;
    total?: number;
  }> => {
    const response = await apiClient.get('/admin/areas', {
      params: { all: 1, ...params },
      timeout: 15000,
    });
    return response.data;
  },

  /** Get single area: GET /admin/areas/:area_id */
  getArea: async (areaId: number): Promise<{
    success: boolean;
    message?: string;
    data: { id: number; location: string | null; supervisor_id: number | null };
  }> => {
    const response = await apiClient.get(`/admin/areas/${areaId}`, { timeout: 15000 });
    return response.data;
  },

  /** Update area/zone: POST /admin/areas/:area_id (form-data: location, supervisor_id) */
  updateArea: async (
    areaId: number,
    location: string,
    supervisorId: number | null
  ): Promise<{ success: boolean; message?: string; data?: unknown }> => {
    const form = new FormData();
    form.append('location', location);
    if (supervisorId != null) form.append('supervisor_id', String(supervisorId));
    const response = await apiClient.post(`/admin/areas/${areaId}`, form, { timeout: 15000 });
    return response.data;
  },

  /** Delete area: DELETE /admin/areas/:area_id */
  deleteArea: async (areaId: number): Promise<{ success: boolean; message?: string }> => {
    const response = await apiClient.delete(`/admin/areas/${areaId}`, { timeout: 15000 });
    return response.data;
  },

  // Shop orders list (GET /shop/orders – Bearer token, for admin order list)
  getOrders: async (params?: {
    page?: number;
    per_page?: number;
    status?: string;
  }): Promise<OrdersListResponse> => {
    const response = await apiClient.get<OrdersListResponse>('/shop/orders', { params });
    return response.data;
  },

  // Admin products list (uses Bearer token)
  getProducts: async (params?: {
    search?: string;
    category_id?: string | number;
    filter?: string;
    per_page?: number;
    page?: number;
  }): Promise<{
    status: boolean;
    message?: string;
    data: AdminProduct[];
    pagination: { current_page: number; last_page: number; per_page: number; total: number };
  }> => {
    const response = await apiClient.get('/admin/products', { params });
    return response.data;
  },

  // Admin product details (GET /admin/products/:id)
  // Response shape can vary across backends, so we keep it flexible.
  getProductById: async (
    productId: number
  ): Promise<{ status?: boolean; success?: boolean; message?: string; data: AdminProduct }> => {
    const response = await apiClient.get(`/admin/products/${productId}`);
    return response.data;
  },

  // Create product (POST /admin/products, Bearer token) – JSON body
  createProduct: async (body: {
    name: string;
    description?: string;
    price: number;
    stock: number;
    status: string;
    category_id?: number | null;
    service_id?: number | null;
    weight_unit?: string;
    sku: string;
    handle: string;
    image_urls?: string[];
    is_featured?: number; // 0 = no, 1 = show in Featured Products
  }): Promise<{
    status: boolean;
    message?: string;
    data: AdminProductCreated;
  }> => {
    const response = await apiClient.post('/admin/products', body, { timeout: 60000 });
    return response.data;
  },

  // Create product with image files (multipart). API expects main_image (primary) + images[] (extra).
  createProductWithImages: async (params: {
    name: string;
    description?: string;
    price: number;
    stock: number;
    status: string;
    category_id?: number | null;
    weight_unit?: string;
    sku: string;
    handle: string;
    image_urls?: string[];
    is_featured?: number; // 0 = no, 1 = show in Featured Products
    mainImage: { uri: string };
    extraImages?: { uri: string }[];
  }): Promise<{ status: boolean; message?: string; data: AdminProductCreated }> => {
    const formData = new FormData();
    formData.append('name', params.name);
    if (params.description) formData.append('description', params.description);
    formData.append('price', String(params.price));
    formData.append('stock', String(params.stock));
    formData.append('status', params.status);
    formData.append('is_featured', String(params.is_featured ?? 0));
    if (params.category_id != null) formData.append('category_id', String(params.category_id));
    if (params.service_id != null) formData.append('service_id', String(params.service_id));
    if (params.weight_unit) formData.append('weight_unit', params.weight_unit);
    formData.append('sku', params.sku);
    formData.append('handle', params.handle);
    if (params.image_urls?.length) {
      formData.append('image_urls', JSON.stringify(params.image_urls));
    }
    formData.append('main_image', {
      uri: params.mainImage.uri,
      type: 'image/jpeg',
      name: 'main-image.jpg',
    } as any);
    (params.extraImages ?? []).forEach((file, index) => {
      formData.append('images[]', {
        uri: file.uri,
        type: 'image/jpeg',
        name: `image-${index}.jpg`,
      } as any);
    });
    const response = await apiClient.post('/admin/products', formData, { timeout: 300000 });
    return response.data;
  },

  // Update product (PUT /admin/products/:id, Bearer token) – JSON body
  updateProduct: async (
    productId: number,
    body: {
      name?: string;
      description?: string;
      price?: number;
      stock?: number;
      status?: string;
      category_id?: number | null;
      service_id?: number | null;
      weight_unit?: string;
      sku?: string;
      handle?: string;
      image_urls?: string[];
      image_ids_to_remove?: number[];
      is_featured?: number; // 0 = no, 1 = show in Featured Products
    }
  ): Promise<{ status: boolean; message?: string; updated_fields?: string[]; data: AdminProductCreated }> => {
    const response = await apiClient.put(`/admin/products/${productId}`, body, { timeout: 60000 });
    return response.data;
  },

  // Update product with image files (PUT /admin/products/:id, multipart). API: main_image (optional) + images[] + image_ids_to_remove.
  updateProductWithImages: async (
    productId: number,
    params: {
      name?: string;
      description?: string;
      price?: number;
      stock?: number;
      status?: string;
      category_id?: number | null;
      service_id?: number | null;
      weight_unit?: string;
      sku?: string;
      handle?: string;
      image_urls?: string[];
      image_ids_to_remove?: number[];
      is_featured?: number; // 0 = no, 1 = show in Featured Products
      mainImage?: { uri: string };
      extraImages?: { uri: string }[];
    }
  ): Promise<{ status: boolean; message?: string; updated_fields?: string[]; data: AdminProductCreated }> => {
    const formData = new FormData();
    if (params.name !== undefined) formData.append('name', params.name);
    if (params.description !== undefined) formData.append('description', params.description ?? '');
    if (params.price !== undefined) formData.append('price', String(params.price));
    if (params.stock !== undefined) formData.append('stock', String(params.stock));
    if (params.status !== undefined) formData.append('status', params.status);
    if (params.is_featured !== undefined) formData.append('is_featured', String(params.is_featured));
    if (params.category_id != null) formData.append('category_id', String(params.category_id));
    if (params.service_id != null) formData.append('service_id', String(params.service_id));
    if (params.weight_unit) formData.append('weight_unit', params.weight_unit);
    if (params.sku !== undefined) formData.append('sku', params.sku);
    if (params.handle !== undefined) formData.append('handle', params.handle);
    if (params.image_urls?.length) {
      formData.append('image_urls', JSON.stringify(params.image_urls));
    }
    if (params.image_ids_to_remove?.length) {
      formData.append('image_ids_to_remove', JSON.stringify(params.image_ids_to_remove));
    }
    if (params.mainImage) {
      formData.append('main_image', {
        uri: params.mainImage.uri,
        type: 'image/jpeg',
        name: 'main-image.jpg',
      } as any);
    }
    (params.extraImages ?? []).forEach((file, index) => {
      formData.append('images[]', {
        uri: file.uri,
        type: 'image/jpeg',
        name: `image-${index}.jpg`,
      } as any);
    });
    const response = await apiClient.put(`/admin/products/${productId}`, formData, { timeout: 300000 });
    return response.data;
  },

  // Delete product (DELETE /admin/products/:id, Bearer token)
  deleteProduct: async (productId: number): Promise<{ status: boolean; message?: string }> => {
    const response = await apiClient.delete(`/admin/products/${productId}`);
    return response.data;
  },

  // Categories (GET /admin/categories, Bearer token)
  getCategories: async (params?: { page?: number; per_page?: number }): Promise<AdminCategoriesResponse> => {
    const response = await apiClient.get<AdminCategoriesResponse>('/admin/categories', { params });
    return response.data;
  },

  /** GET /admin/services - list services (uses admin auth token from apiClient) */
  getServices: async (params?: { page?: number; per_page?: number }): Promise<AdminServicesResponse> => {
    const response = await apiClient.get<AdminServicesResponse>('/admin/services', { params });
    return response.data;
  },

  /**
   * GET /admin/services/:service_id - get service detail (Bearer token, Accept: application/json).
   */
  getServiceById: async (serviceId: number): Promise<{ success: boolean; message?: string; data: AdminService }> => {
    const response = await apiClient.get<{ success: boolean; message?: string; data: AdminService }>(`/admin/services/${serviceId}`);
    return response.data;
  },

  /**
   * POST /admin/services - create service (form-data).
   * Body: name (required), slug?, description?, image?, is_active? (1 = active, 0 = coming soon).
   */
  createService: async (params: {
    name: string;
    slug?: string;
    description?: string;
    image?: { uri: string };
    is_active?: boolean;
  }): Promise<{ success: boolean; message?: string; data: AdminService }> => {
    const formData = new FormData();
    formData.append('name', params.name.trim());
    if (params.slug != null && String(params.slug).trim()) {
      formData.append('slug', params.slug.trim());
    }
    if (params.description != null && String(params.description).trim()) {
      formData.append('description', params.description.trim());
    }
    if (params.is_active !== undefined) {
      formData.append('is_active', params.is_active ? '1' : '0');
    }
    if (params.image?.uri) {
      formData.append('image', {
        uri: params.image.uri,
        type: 'image/jpeg',
        name: 'service-image.jpg',
      } as any);
    }
    const response = await apiClient.post<{ success: boolean; message?: string; data: AdminService }>('/admin/services', formData, { timeout: 60000 });
    return response.data;
  },

  /**
   * POST /admin/services/:service_id - update service (form-data).
   * Body: name, slug?, description?, image? (file), image_remove? (true to remove image), is_active? (1|0).
   * No category parameter.
   */
  updateService: async (
    serviceId: number,
    params: {
      name: string;
      slug?: string;
      description?: string;
      image?: { uri: string };
      image_remove?: boolean;
      is_active?: boolean;
    }
  ): Promise<{ status?: boolean; success?: boolean; message?: string; data: AdminService }> => {
    const formData = new FormData();
    formData.append('name', params.name.trim());
    if (params.slug != null && String(params.slug).trim()) {
      formData.append('slug', params.slug.trim());
    }
    if (params.description != null && String(params.description).trim()) {
      formData.append('description', params.description.trim());
    }
    if (params.is_active !== undefined) {
      formData.append('is_active', params.is_active ? '1' : '0');
    }
    if (params.image_remove === true) {
      formData.append('image_remove', 'true');
    }
    if (params.image?.uri) {
      formData.append('image', {
        uri: params.image.uri,
        type: 'image/jpeg',
        name: 'service-image.jpg',
      } as any);
    }
    const response = await apiClient.post(`/admin/services/${serviceId}`, formData, { timeout: 60000 });
    return response.data;
  },

  /**
   * POST /admin/services/:service_id/toggle-status - toggle active/inactive (Bearer token, Accept: application/json).
   */
  toggleServiceStatus: async (serviceId: number): Promise<{ success: boolean; message?: string; data?: AdminService }> => {
    const response = await apiClient.post<{ success: boolean; message?: string; data?: AdminService }>(`/admin/services/${serviceId}/toggle-status`);
    return response.data;
  },

  /**
   * DELETE /admin/services/:service_id
   * Headers: Authorization: Bearer <token>, Accept: application/json (sent by apiClient).
   */
  deleteService: async (serviceId: number): Promise<{ status?: boolean; success?: boolean; message?: string }> => {
    const response = await apiClient.delete(`/admin/services/${serviceId}`);
    return response.data ?? {};
  },

  // Create category (POST /admin/categories, multipart: name, slug?, description?, image?, is_active?)
  createCategory: async (params: {
    name: string;
    slug?: string;
    description?: string;
    image?: { uri: string };
    is_active?: number; // 1 = active, 0 = disabled (Coming Soon). Default 1.
  }): Promise<{ status?: boolean; success?: boolean; message?: string; data: AdminCategory }> => {
    const formData = new FormData();
    formData.append('name', params.name.trim());
    if (params.slug != null && String(params.slug).trim()) {
      formData.append('slug', params.slug.trim());
    }
    if (params.description != null && String(params.description).trim()) {
      formData.append('description', params.description.trim());
    }
    if (params.is_active !== undefined) {
      formData.append('is_active', String(params.is_active));
    }
    if (params.image?.uri) {
      formData.append('image', {
        uri: params.image.uri,
        type: 'image/jpeg',
        name: 'category-image.jpg',
      } as any);
    }
    const response = await apiClient.post('/admin/categories', formData, { timeout: 60000 });
    return response.data;
  },

  // Update category (POST /admin/categories/:id, multipart: name, slug?, description?, image?, is_active?)
  updateCategory: async (
    categoryId: number,
    params: {
      name: string;
      slug?: string;
      description?: string;
      image?: { uri: string };
      is_active?: number; // 1 = active, 0 = disabled (Coming Soon).
    }
  ): Promise<{ status?: boolean; success?: boolean; message?: string; data: AdminCategory }> => {
    const formData = new FormData();
    formData.append('name', params.name.trim());
    if (params.slug != null && String(params.slug).trim()) {
      formData.append('slug', params.slug.trim());
    }
    if (params.description != null && String(params.description).trim()) {
      formData.append('description', params.description.trim());
    }
    if (params.is_active !== undefined) {
      formData.append('is_active', String(params.is_active));
    }
    if (params.image?.uri) {
      formData.append('image', {
        uri: params.image.uri,
        type: 'image/jpeg',
        name: 'category-image.jpg',
      } as any);
    }
    const response = await apiClient.post(`/admin/categories/${categoryId}`, formData, { timeout: 60000 });
    return response.data;
  },

  // Toggle category status (POST /admin/categories/:id/toggle-status). No body. Returns updated category.
  toggleCategoryStatus: async (categoryId: number): Promise<{ status?: boolean; success?: boolean; message?: string; data?: AdminCategory }> => {
    const response = await apiClient.post<{ status?: boolean; success?: boolean; message?: string; data?: AdminCategory }>(
      `/admin/categories/${categoryId}/toggle-status`
    );
    return response.data;
  },

  // Delete category (DELETE /admin/categories/:id)
  deleteCategory: async (categoryId: number): Promise<{ status?: boolean; success?: boolean; message?: string }> => {
    const response = await apiClient.delete(`/admin/categories/${categoryId}`);
    return response.data;
  },

  // Tips: send/create tip (POST /api/tips, JSON: title, description)
  sendTip: async (params: { title: string; description: string }): Promise<{ status?: boolean; success?: boolean; message?: string; data?: Tip }> => {
    const response = await apiClient.post('/tips', {
      title: params.title.trim(),
      description: params.description.trim(),
    }, { timeout: 15000 });
    return response.data;
  },

  // Get tips list (GET /api/tips). Uses apiClient so Authorization: Bearer <token> and Accept: application/json are sent automatically.
  getTips: async (): Promise<{ data: Tip[] }> => {
    try {
      const response = await apiClient.get('/tips', { timeout: 15000 });
      const body = response?.data ?? response;
      const list = Array.isArray(body?.data) ? body.data : Array.isArray(body?.tips) ? body.tips : Array.isArray(body) ? body : [];
      return { data: list };
    } catch (_) {
      return { data: [] };
    }
  },

  // Delete tip (DELETE /api/tips/:tip_id)
  deleteTip: async (tipId: number | string): Promise<{ status?: boolean; success?: boolean; message?: string }> => {
    const response = await apiClient.delete(`/tips/${tipId}`, { timeout: 15000 });
    return response.data;
  },

  // Banners (GET /api/admin/banners) – slider/customer banners for theme
  getBanners: async (): Promise<{ success?: boolean; message?: string; data: AdminBanner[] }> => {
    const response = await apiClient.get('/admin/banners', { timeout: 15000 });
    const body = response?.data ?? response;
    const list = Array.isArray(body?.data) ? body.data : [];
    return { success: body?.success, message: body?.message, data: list };
  },

  /** GET /admin/exclusive-offers – list exclusive offers (Bearer token). */
  getExclusiveOffers: async (params?: {
    page?: number;
    per_page?: number;
  }): Promise<{ success?: boolean; message?: string; data: AdminExclusiveOffer[]; meta?: { current_page?: number; last_page?: number; total?: number }; pagination?: { current_page?: number; last_page?: number; total?: number } }> => {
    const response = await apiClient.get<{ success?: boolean; message?: string; data: AdminExclusiveOffer[] | { data: AdminExclusiveOffer[]; current_page?: number; last_page?: number; total?: number }; meta?: { current_page?: number; last_page?: number; total?: number }; pagination?: { current_page?: number; last_page?: number; total?: number } }>(
      '/admin/exclusive-offers',
      { params: params ?? {}, timeout: 15000 }
    );
    const body = response?.data ?? response;
    const rawData = (body as any)?.data;
    const list = Array.isArray(rawData) ? rawData : (rawData && Array.isArray((rawData as any)?.data) ? (rawData as any).data : []);
    const meta = (body as any)?.meta ?? (body as any)?.pagination ?? (Array.isArray(rawData) ? undefined : (rawData as any));
    return {
      success: (body as any)?.success,
      message: (body as any)?.message,
      data: list,
      meta: meta && typeof meta === 'object' ? meta : undefined,
      pagination: meta && typeof meta === 'object' ? meta : undefined,
    };
  },

  /** POST /admin/exclusive-offers – create exclusive offer (form-data, Bearer token). */
  createExclusiveOffer: async (params: {
    title: string;
    description?: string;
    discount_type: 'percentage' | 'fixed_amount' | 'buy_one_get_one';
    discount_value?: number | string;
    applies_to?: string;
    start_date?: string;
    end_date?: string;
    is_active?: boolean | number;
    sort_order?: number | string;
    product_ids?: number[] | string;
    image?: { uri: string };
  }): Promise<{ success?: boolean; status?: boolean; message?: string; data?: AdminExclusiveOffer }> => {
    const formData = new FormData();
    formData.append('title', params.title.trim());
    if (params.description != null && String(params.description).trim()) {
      formData.append('description', String(params.description).trim());
    }
    formData.append('discount_type', params.discount_type);
    if (params.discount_value != null && String(params.discount_value).trim() !== '') {
      formData.append('discount_value', String(params.discount_value));
    }
    if (params.applies_to != null && String(params.applies_to).trim()) {
      formData.append('applies_to', String(params.applies_to).trim());
    }
    if (params.start_date != null && String(params.start_date).trim()) {
      formData.append('start_date', String(params.start_date).trim());
    }
    if (params.end_date != null && String(params.end_date).trim()) {
      formData.append('end_date', String(params.end_date).trim());
    }
    if (params.is_active != null) {
      const v = typeof params.is_active === 'boolean' ? (params.is_active ? '1' : '0') : String(params.is_active);
      formData.append('is_active', v === '1' ? '1' : '0');
    }
    if (params.sort_order != null && String(params.sort_order).trim() !== '') {
      formData.append('sort_order', String(params.sort_order));
    }
    if (params.product_ids != null) {
      const ids = typeof params.product_ids === 'string'
        ? params.product_ids
        : Array.isArray(params.product_ids)
          ? params.product_ids.join(',')
          : '';
      if (ids) formData.append('product_ids', ids);
    }
    if (params.image?.uri) {
      formData.append('image', {
        uri: params.image.uri,
        type: 'image/jpeg',
        name: 'offer-image.jpg',
      } as any);
    }
    const response = await apiClient.post('/admin/exclusive-offers', formData, { timeout: 60000 });
    return response.data;
  },

  /** GET /admin/exclusive-offers/:id – get single offer (Bearer token). */
  getExclusiveOfferById: async (offerId: number): Promise<{ success?: boolean; message?: string; data: AdminExclusiveOffer }> => {
    const response = await apiClient.get<{ success?: boolean; message?: string; data: AdminExclusiveOffer }>(
      `/admin/exclusive-offers/${offerId}`,
      { timeout: 15000 }
    );
    return response.data;
  },

  /** POST /admin/exclusive-offers/:id – update exclusive offer (form-data, Bearer token). */
  updateExclusiveOffer: async (
    offerId: number,
    params: {
      title: string;
      description?: string;
      discount_type: 'percentage' | 'fixed_amount' | 'buy_one_get_one';
      discount_value?: number | string;
      applies_to?: string;
      start_date?: string;
      end_date?: string;
      is_active?: boolean | number;
      sort_order?: number | string;
      product_ids?: number[] | string;
      image?: { uri: string };
    }
  ): Promise<{ success?: boolean; status?: boolean; message?: string; data?: AdminExclusiveOffer }> => {
    const formData = new FormData();
    formData.append('title', params.title.trim());
    if (params.description != null && String(params.description).trim()) {
      formData.append('description', String(params.description).trim());
    }
    formData.append('discount_type', params.discount_type);
    if (params.discount_value != null && String(params.discount_value).trim() !== '') {
      formData.append('discount_value', String(params.discount_value));
    }
    if (params.applies_to != null && String(params.applies_to).trim()) {
      formData.append('applies_to', String(params.applies_to).trim());
    }
    if (params.start_date != null && String(params.start_date).trim()) {
      formData.append('start_date', String(params.start_date).trim());
    }
    if (params.end_date != null && String(params.end_date).trim()) {
      formData.append('end_date', String(params.end_date).trim());
    }
    if (params.is_active != null) {
      const v = typeof params.is_active === 'boolean' ? (params.is_active ? '1' : '0') : String(params.is_active);
      formData.append('is_active', v === '1' ? '1' : '0');
    }
    if (params.sort_order != null && String(params.sort_order).trim() !== '') {
      formData.append('sort_order', String(params.sort_order));
    }
    if (params.product_ids != null) {
      const ids = typeof params.product_ids === 'string'
        ? params.product_ids
        : Array.isArray(params.product_ids)
          ? params.product_ids.join(',')
          : '';
      formData.append('product_ids', ids);
    }
    if (params.image?.uri) {
      formData.append('image', {
        uri: params.image.uri,
        type: 'image/jpeg',
        name: 'offer-image.jpg',
      } as any);
    }
    const response = await apiClient.post(`/admin/exclusive-offers/${offerId}`, formData, { timeout: 60000 });
    return response.data;
  },

  /** DELETE /admin/exclusive-offers/:id – delete exclusive offer (Bearer token). */
  deleteExclusiveOffer: async (offerId: number): Promise<{ success?: boolean; message?: string }> => {
    const response = await apiClient.delete(`/admin/exclusive-offers/${offerId}`, { timeout: 15000 });
    return response.data;
  },

  // Create banner (POST /api/admin/banners) – multipart/form-data (image optional)
  createBanner: async (params: {
    title: string;
    description?: string;
    button_text?: string;
    button_link?: string;
    priority?: number | string;
    is_active?: boolean | number | string;
    image?: { uri: string };
  }): Promise<{ success?: boolean; status?: boolean; message?: string; data?: AdminBanner }> => {
    const formData = new FormData();
    formData.append('title', params.title.trim());
    if (params.description != null && String(params.description).trim()) {
      formData.append('description', String(params.description).trim());
    }
    if (params.button_text != null && String(params.button_text).trim()) {
      formData.append('button_text', String(params.button_text).trim());
    }
    if (params.button_link != null && String(params.button_link).trim()) {
      formData.append('button_link', String(params.button_link).trim());
    }
    if (params.priority != null && String(params.priority).trim() !== '') {
      formData.append('priority', String(params.priority));
    }
    if (params.is_active != null) {
      const v =
        typeof params.is_active === 'boolean'
          ? params.is_active
            ? '1'
            : '0'
          : String(params.is_active);
      formData.append('is_active', v === '1' || v.toLowerCase?.() === 'true' ? '1' : '0');
    }
    if (params.image?.uri) {
      formData.append('image', {
        uri: params.image.uri,
        type: 'image/jpeg',
        name: 'banner-image.jpg',
      } as any);
    }
    const response = await apiClient.post('/admin/banners', formData, { timeout: 300000 });
    return response.data;
  },

  // Update banner (POST /api/admin/banners/:id) – multipart/form-data (image optional, add/replace)
  updateBanner: async (
    bannerId: number,
    params: {
      title: string;
      description?: string;
      button_text?: string;
      button_link?: string;
      priority?: number | string;
      is_active?: boolean | number | string;
      image?: { uri: string };
    }
  ): Promise<{ success?: boolean; status?: boolean; message?: string; data?: AdminBanner }> => {
    const formData = new FormData();
    formData.append('title', params.title.trim());
    if (params.description != null && String(params.description).trim()) {
      formData.append('description', String(params.description).trim());
    }
    if (params.button_text != null && String(params.button_text).trim()) {
      formData.append('button_text', String(params.button_text).trim());
    }
    if (params.button_link != null && String(params.button_link).trim()) {
      formData.append('button_link', String(params.button_link).trim());
    }
    if (params.priority != null && String(params.priority).trim() !== '') {
      formData.append('priority', String(params.priority));
    }
    if (params.is_active != null) {
      const v =
        typeof params.is_active === 'boolean'
          ? params.is_active
            ? '1'
            : '0'
          : String(params.is_active);
      formData.append('is_active', v === '1' || v.toLowerCase?.() === 'true' ? '1' : '0');
    }
    if (params.image?.uri) {
      formData.append('image', {
        uri: params.image.uri,
        type: 'image/jpeg',
        name: 'banner-image.jpg',
      } as any);
    }
    const response = await apiClient.post(`/admin/banners/${bannerId}`, formData, { timeout: 300000 });
    return response.data;
  },

  // Toggle banner status (POST /api/admin/banners/:id/toggle-status) – no body
  toggleBannerStatus: async (
    bannerId: number
  ): Promise<{ success?: boolean; message?: string; data?: { id: number; is_active: boolean } }> => {
    const response = await apiClient.post(`/admin/banners/${bannerId}/toggle-status`, null, {
      timeout: 15000,
    });
    return response.data;
  },

  // Delete banner (DELETE /api/admin/banners/:id)
  deleteBanner: async (bannerId: number): Promise<{ success?: boolean; status?: boolean; message?: string }> => {
    const response = await apiClient.delete(`/admin/banners/${bannerId}`, { timeout: 15000 });
    return response.data;
  },

  /** Shop settings (shipping & tax). GET /api/admin/settings/shop */
  getShopSettings: async (): Promise<{
    success?: boolean;
    data?: { shipping_amount: number; tax_percent: number; currency: string };
  }> => {
    const response = await apiClient.get('/admin/settings/shop', { timeout: 15000 });
    return response.data;
  },

  /** Update shop settings. PUT /api/admin/settings/shop body: { shipping_amount, tax_percent } */
  updateShopSettings: async (body: {
    shipping_amount: number;
    tax_percent: number;
  }): Promise<{
    success?: boolean;
    data?: { shipping_amount: number; tax_percent: number; currency: string };
  }> => {
    const response = await apiClient.put('/admin/settings/shop', body, { timeout: 15000 });
    return response.data;
  },
};

export interface AdminBanner {
  id: number;
  title: string;
  description?: string | null;
  button_text?: string | null;
  button_link?: string | null;
  image?: string | null;
  image_url?: string | null;
  link?: string | null;
  action_type?: string | null;
  action_value?: string | null;
  priority?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Exclusive offer (GET /admin/exclusive-offers and GET /admin/exclusive-offers/:id) */
export interface AdminExclusiveOffer {
  id: number;
  title?: string;
  name?: string;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  image_path?: string | null;
  status?: string;
  is_active?: boolean | number;
  valid_from?: string | null;
  valid_to?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  applies_to?: string | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  priority?: number;
  sort_order?: number;
  product_ids?: number[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Tip {
  id: number | string;
  title: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  is_active?: number | boolean; // 1 = active, 0 = disabled (Coming Soon)
  created_at?: string;
  updated_at?: string;
  products_count?: number;
}

/** Pagination object when API returns data + pagination separately */
export interface AdminCategoriesPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** API can return: { data: Category[] } (array) + { pagination } OR legacy { data: { data, current_page, ... } } */
export interface AdminCategoriesResponse {
  success: boolean;
  message?: string;
  data: AdminCategory[] | {
    current_page: number;
    data: AdminCategory[];
    last_page: number;
    per_page: number;
    total: number;
    first_page_url?: string;
    from?: number;
    last_page_url?: string;
    links?: Array<{ url: string | null; label: string; page: number | null; active: boolean }>;
    next_page_url?: string | null;
    path?: string;
    prev_page_url?: string | null;
    to?: number;
  };
  pagination?: AdminCategoriesPagination;
}

export interface AdminService {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  icon?: string | null;
  is_active?: boolean;
  coming_soon?: boolean;
  category_id?: number | null;
  category?: { id: number; name: string; slug: string } | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  products_count?: number;
}

export interface AdminServicesResponse {
  success: boolean;
  message?: string;
  data: AdminService[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

// Admin product (for list from GET /admin/products)
export interface AdminProduct {
  id: number;
  category_id?: number;
  name: string;
  vendor?: string;
  type?: string;
  sku?: string;
  description?: string;
  price: string;
  stock?: number;
  status?: string;
  weight_unit?: string;
  handle?: string;
  is_featured?: number; // 0 = no, 1 = show in Featured Products
  image?: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
  category?: { id: number; name: string; slug?: string };
  service?: { id: number; name: string };
  primary_image?: { id?: number; image_path?: string; image_url?: string };
  images?: Array<{ id?: number; image_path?: string; image_url?: string; is_primary?: number }>;
}

// Admin product create response (POST /admin/products – JSON or multipart)
export interface AdminProductCreated {
  id: number;
  name: string;
  description?: string;
  sku?: string;
  price: string | number;
  stock: number;
  status: string;
  weight_unit?: string;
  handle?: string;
  category_id?: number | null;
  service_id?: number | null;
  track_quantity?: boolean;
  allow_backorder?: boolean;
  requires_shipping?: boolean;
  taxable?: boolean;
  created_at?: string;
  updated_at?: string;
  image?: string | null;
  image_url?: string | null;
  category?: { id: number; name: string } | null;
  service?: { id: number; name: string } | null;
  primary_image?: {
    id: number;
    product_id: number;
    image_path: string;
    sort_order: number;
    is_primary: number;
    created_at?: string;
    updated_at?: string;
  };
  images?: Array<{
    id: number;
    product_id: number;
    image_path: string;
    sort_order: number;
    is_primary: number;
    created_at?: string;
    updated_at?: string;
  }>;
}

// Reports types
export interface ReportCreatedBy {
  id: number;
  name: string;
}

export interface ReportParameters {
  start_date?: string;
  end_date?: string;
  format?: string;
  include_charts?: boolean;
  include_details?: boolean;
}

export interface AdminReport {
  id?: number;
  title?: string;
  type?: string;
  status?: string;
  created_at?: string;
  scheduled_at?: string | null;
  generated_at?: string | null;
  file_url?: string | null;
  file_size?: number;
  created_by?: ReportCreatedBy;
  parameters?: ReportParameters;
}

export interface ReportsMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface ReportsListResponse {
  success?: boolean;
  data: AdminReport[];
  meta: ReportsMeta;
}

export interface ShopOrder {
  id: number;
  order_number?: string;
  status?: string;
  total?: number | string;
  created_at?: string;
  updated_at?: string;
  user?: { id: number; name?: string; email?: string };
  customer?: { id: number; name?: string; email?: string };
  [key: string]: any;
}

export interface OrdersListResponse {
  success?: boolean;
  data?: ShopOrder[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface AdminActivity {
  type?: string;
  icon_type?: string;
  description?: string;
  timestamp?: string;
  created_at?: string;
  related_id?: number;
  related_type?: string;
}

export interface AdminNotificationItem {
  id: string | number;
  type?: string;
  notifiable_type?: string;
  notifiable_id?: number;
  read_at?: string | null;
  created_at?: string;
  updated_at?: string;
  title: string;
  message: string;
  action?: string | null;
  meta?: Record<string, unknown> | null;
}

