/**
 * Support/ticket API. Uses apiClient so Authorization: Bearer <customer token> is sent.
 */
import apiClient from './api';

/** Single ticket from GET /support/tickets */
export interface SupportTicket {
  id: number;
  ticket_number: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketsResponse {
  success: boolean;
  message?: string;
  data: {
    data: SupportTicket[];
    pagination: { current_page: number; last_page: number; per_page: number; total: number };
  };
}

/**
 * GET /api/support/tickets?status=&per_page=20&page=1
 * Returns the authenticated customer's support tickets. Requires Bearer token.
 */
export async function getSupportTickets(params?: {
  status?: string;
  per_page?: number;
  page?: number;
}): Promise<SupportTicketsResponse> {
  const response = await apiClient.get<SupportTicketsResponse>('/support/tickets', {
    params: { status: params?.status ?? '', per_page: params?.per_page ?? 20, page: params?.page ?? 1 },
    timeout: 15000,
  });
  return response.data;
}

/** Single reply from GET /support/tickets/:id */
export interface SupportTicketReply {
  id: number;
  message: string;
  is_admin: boolean;
  user_name: string;
  created_at: string;
}

/** Ticket detail from GET /support/tickets/:id (includes replies) */
export interface SupportTicketDetail {
  id: number;
  ticket_number: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  replies: SupportTicketReply[];
}

/**
 * GET /api/support/tickets/:id
 * Returns a single ticket with full reply thread (chat). Requires Bearer token (customer or technician).
 */
export async function getSupportTicketById(ticketId: number): Promise<{
  success: boolean;
  message?: string;
  data: SupportTicketDetail;
}> {
  const response = await apiClient.get<{ success: boolean; message?: string; data: SupportTicketDetail }>(
    `/support/tickets/${ticketId}`,
    { timeout: 15000 }
  );
  return response.data;
}

/**
 * POST /api/support/tickets/:id/reply
 * Send a reply to a support ticket. Body: { message }. Requires Bearer token (customer or technician).
 */
export async function replyToSupportTicket(
  ticketId: number,
  message: string
): Promise<{ success: boolean; message?: string }> {
  const response = await apiClient.post<{ success: boolean; message?: string }>(
    `/support/tickets/${ticketId}/reply`,
    { message: message.trim() },
    { timeout: 15000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
  );
  const data = response.data;
  if (data?.success) return { success: true, message: data.message };
  return { success: false, message: (data as any)?.message ?? 'Failed to send reply.' };
}

export interface SubmitTicketParams {
  subject: string;
  email: string;
  description: string;
}

export interface SubmitTicketResponse {
  success?: boolean;
  message?: string;
  data?: { id?: number; [key: string]: unknown };
}

/**
 * POST /api/support/tickets
 * Body: JSON { subject, email, description }. Requires Bearer token (customer).
 */
export async function submitTicket(params: SubmitTicketParams): Promise<{ success: boolean; message?: string }> {
  const body = {
    subject: params.subject.trim(),
    email: params.email.trim(),
    description: params.description.trim(),
  };

  const response = await apiClient.post<SubmitTicketResponse>('/support/tickets', body, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  if (response.data?.success) {
    return { success: true, message: response.data.message };
  }
  return {
    success: false,
    message: (response.data as any)?.message || 'Failed to submit ticket.',
  };
}
