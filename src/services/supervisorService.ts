/**
 * Supervisor API. Uses apiClient so Authorization: Bearer <supervisor token> is sent.
 * Support tickets list/chat/reply use same endpoints as technician (/support/tickets) with supervisor token.
 */
import apiClient from './api';

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
