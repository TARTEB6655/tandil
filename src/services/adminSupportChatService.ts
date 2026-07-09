import apiClient from './api';

export type AdminSupportChatStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | string;

export interface AdminSupportChatSession {
  id: number | string;
  status: string;
  status_label?: string;
  vendor_name: string;
  vendor_email?: string;
  business_name?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  user_role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminSupportChatMessage {
  id: number | string;
  message: string;
  is_admin: boolean;
  sender_name: string;
  sender_role?: string;
  created_at: string;
}

export interface AdminSupportChatPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AdminSupportChatSessionsResult {
  sessions: AdminSupportChatSession[];
  pagination: AdminSupportChatPagination | null;
}

export interface AdminSupportChatSessionDetail {
  session: AdminSupportChatSession;
  messages: AdminSupportChatMessage[];
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

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return undefined;
}

function extractPayload(payload: unknown): Record<string, unknown> {
  const body = asRecord(payload);
  if (!body) throw new Error('Invalid chat response.');
  if (body.success === false || body.status === false) {
    throw new Error(pickString(body.message) || 'Chat request failed.');
  }
  return asRecord(body.data) ?? body;
}

function mapSession(raw: unknown): AdminSupportChatSession | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = row.id ?? row.session_id ?? row.support_chat_session_id;
  if (id == null || id === '') return null;

  const vendor = asRecord(row.vendor) ?? asRecord(row.user);
  const vendorName = pickString(
    row.vendor_name,
    row.business_name,
    row.user_name,
    row.name,
    vendor?.business_name,
    vendor?.name,
    vendor?.company_name
  );

  return {
    id,
    status: pickString(row.status, row.session_status) || 'open',
    status_label: pickString(row.status_label, row.status) || undefined,
    vendor_name: vendorName || 'Vendor',
    vendor_email: pickString(row.vendor_email, row.email, vendor?.email) || undefined,
    business_name: pickString(row.business_name, vendor?.business_name) || undefined,
    last_message: pickString(row.last_message, row.latest_message, row.message_preview) || undefined,
    last_message_at:
      pickString(row.last_message_at, row.latest_message_at, row.updated_at) || undefined,
    unread_count: pickNumber(row.unread_count, row.unread_messages_count),
    user_role: pickString(row.user_role, row.role) || undefined,
    created_at: pickString(row.created_at) || undefined,
    updated_at: pickString(row.updated_at) || undefined,
  };
}

function mapSessions(raw: unknown): AdminSupportChatSession[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(mapSession)
    .filter((item): item is AdminSupportChatSession => item != null);
}

function mapPagination(raw: unknown): AdminSupportChatPagination | null {
  const row = asRecord(raw);
  if (!row) return null;
  const current_page = pickNumber(row.current_page) ?? 1;
  const last_page = pickNumber(row.last_page) ?? 1;
  const per_page = pickNumber(row.per_page) ?? 20;
  const total = pickNumber(row.total) ?? 0;
  return { current_page, last_page, per_page, total };
}

function mapMessage(raw: unknown): AdminSupportChatMessage | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = row.id ?? row.message_id;
  const text = pickString(row.message, row.body, row.text, row.content);
  if (id == null || !text) return null;

  const sender = asRecord(row.sender) ?? asRecord(row.user);
  const senderRole = pickString(
    row.sender_role,
    row.role,
    row.user_role,
    row.sender_type,
    row.user_type,
    sender?.role,
    sender?.type
  ).toLowerCase();

  const isVendor =
    senderRole === 'vendor' ||
    row.sender_type === 'vendor' ||
    row.user_type === 'vendor' ||
    row.is_vendor === true;

  const isAdmin =
    !isVendor &&
    (row.is_admin === true ||
      row.is_from_admin === true ||
      row.from_admin === true ||
      senderRole === 'admin' ||
      senderRole === 'support' ||
      row.sender_type === 'admin' ||
      row.user_type === 'admin');

  return {
    id,
    message: text,
    is_admin: isAdmin,
    sender_name:
      pickString(row.sender_name, row.user_name, row.name, sender?.name) ||
      (isAdmin ? 'Admin' : 'Vendor'),
    sender_role: senderRole || undefined,
    created_at: pickString(row.created_at, row.sent_at, row.timestamp) || new Date().toISOString(),
  };
}

function mapMessages(raw: unknown): AdminSupportChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(mapMessage)
    .filter((item): item is AdminSupportChatMessage => item != null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function firstMessageList(...sources: unknown[]): AdminSupportChatMessage[] {
  for (const source of sources) {
    if (Array.isArray(source)) return mapMessages(source);
    const nested = asRecord(source);
    if (nested) {
      const fromNested = firstMessageList(nested.messages, nested.data, nested.items);
      if (fromNested.length > 0) return fromNested;
    }
  }
  return [];
}

function extractSessionsResult(payload: unknown): AdminSupportChatSessionsResult {
  const data = extractPayload(payload);
  const sessions = firstSessionList(data.data, data.sessions, data.items, data);
  const pagination = mapPagination(data.pagination) ?? mapPagination(asRecord(data.data)?.pagination);
  return { sessions, pagination };
}

function firstSessionList(...sources: unknown[]): AdminSupportChatSession[] {
  for (const source of sources) {
    if (Array.isArray(source)) return mapSessions(source);
    const nested = asRecord(source);
    if (nested) {
      const fromNested = firstSessionList(nested.data, nested.sessions, nested.items);
      if (fromNested.length > 0) return fromNested;
    }
  }
  return [];
}

function extractSessionDetail(payload: unknown): AdminSupportChatSessionDetail {
  const data = extractPayload(payload);
  const session =
    mapSession(data.session) ??
    mapSession(data.chat) ??
    mapSession(data);

  if (!session) {
    throw new Error('Chat session missing from response.');
  }

  const messages = firstMessageList(
    data.messages,
    data.chat_messages,
    asRecord(data.session)?.messages,
    asRecord(data.chat)?.messages
  );

  return { session, messages };
}

function extractPollMessages(payload: unknown): AdminSupportChatMessage[] {
  const data = extractPayload(payload);
  return firstMessageList(data.messages, data.new_messages, data.chat_messages, data.data);
}

function extractSentMessage(payload: unknown): AdminSupportChatMessage | null {
  const data = extractPayload(payload);
  return (
    mapMessage(data.message) ||
    mapMessage(data.chat_message) ||
    mapMessage(asRecord(data.data)?.message) ||
    mapMessage(data.data) ||
    mapMessage(data)
  );
}

export const adminSupportChatService = {
  /** GET /admin/support-chat/sessions */
  async listSessions(params?: {
    user_role?: string;
    status?: string;
    search?: string;
    per_page?: number;
    page?: number;
  }): Promise<AdminSupportChatSessionsResult> {
    const response = await apiClient.get('/admin/support-chat/sessions', {
      params: {
        user_role: params?.user_role ?? 'vendor',
        status: params?.status || undefined,
        search: params?.search?.trim() || undefined,
        per_page: params?.per_page ?? 20,
        page: params?.page ?? 1,
      },
      timeout: 20000,
    });
    return extractSessionsResult(response.data);
  },

  /** GET /admin/support-chat/sessions/:id */
  async getSession(sessionId: number | string): Promise<AdminSupportChatSessionDetail> {
    const response = await apiClient.get(`/admin/support-chat/sessions/${sessionId}`, {
      timeout: 20000,
    });
    return extractSessionDetail(response.data);
  },

  /** GET /admin/support-chat/sessions/:id/messages */
  async pollMessages(
    sessionId: number | string,
    afterId: number | string = 0
  ): Promise<AdminSupportChatMessage[]> {
    const response = await apiClient.get(`/admin/support-chat/sessions/${sessionId}/messages`, {
      params: { after_id: afterId },
      timeout: 15000,
    });
    return extractPollMessages(response.data);
  },

  /** POST /admin/support-chat/sessions/:id/messages */
  async sendMessage(
    sessionId: number | string,
    message: string
  ): Promise<AdminSupportChatMessage | null> {
    const response = await apiClient.post(
      `/admin/support-chat/sessions/${sessionId}/messages`,
      { message: message.trim() },
      {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }
    );
    return extractSentMessage(response.data);
  },

  /** PUT /admin/support-chat/sessions/:id/status */
  async updateStatus(
    sessionId: number | string,
    status: AdminSupportChatStatus
  ): Promise<AdminSupportChatSession | null> {
    const response = await apiClient.put(
      `/admin/support-chat/sessions/${sessionId}/status`,
      { status },
      {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }
    );
    const data = extractPayload(response.data);
    return mapSession(data.session) ?? mapSession(data);
  },
};
