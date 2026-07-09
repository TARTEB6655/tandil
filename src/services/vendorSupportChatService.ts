import apiClient from './api';

export interface VendorSupportChatSession {
  id: number | string;
  status?: string;
  status_label?: string;
  subject?: string;
  user_role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VendorSupportChatMessage {
  id: number | string;
  message: string;
  is_admin: boolean;
  sender_name: string;
  sender_role?: string;
  created_at: string;
}

export interface VendorSupportChatOpenResult {
  session: VendorSupportChatSession;
  messages: VendorSupportChatMessage[];
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

function defaultSession(): VendorSupportChatSession {
  return {
    id: 'active',
    status: 'open',
    status_label: 'Open',
  };
}

function mapSession(raw: unknown): VendorSupportChatSession | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = row.id ?? row.session_id ?? row.chat_id;
  if (id == null || id === '') return null;
  return {
    id,
    status: pickString(row.status) || undefined,
    status_label: pickString(row.status_label, row.status) || undefined,
    subject: pickString(row.subject, row.title) || undefined,
    user_role: pickString(row.user_role, row.role) || undefined,
    created_at: pickString(row.created_at) || undefined,
    updated_at: pickString(row.updated_at) || undefined,
  };
}

function mapMessage(raw: unknown): VendorSupportChatMessage | null {
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
      (isAdmin ? 'Support' : 'You'),
    sender_role: senderRole || undefined,
    created_at: pickString(row.created_at, row.sent_at, row.timestamp) || new Date().toISOString(),
  };
}

function mapMessages(raw: unknown): VendorSupportChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(mapMessage)
    .filter((item): item is VendorSupportChatMessage => item != null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function extractPayload(payload: unknown): Record<string, unknown> {
  const body = asRecord(payload);
  if (!body) throw new Error('Invalid chat response.');
  if (body.success === false || body.status === false) {
    throw new Error(pickString(body.message) || 'Chat request failed.');
  }
  return asRecord(body.data) ?? body;
}

function firstMessageList(...sources: unknown[]): VendorSupportChatMessage[] {
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

function extractOpenResult(payload: unknown): VendorSupportChatOpenResult {
  const data = extractPayload(payload);
  const session =
    mapSession(data.session) ??
    mapSession(data.chat) ??
    mapSession(asRecord(data.conversation)) ??
    defaultSession();

  const messages = firstMessageList(
    data.messages,
    data.chat_messages,
    asRecord(data.chat)?.messages,
    asRecord(data.session)?.messages
  );

  return { session, messages };
}

function extractPollMessages(payload: unknown): VendorSupportChatMessage[] {
  const data = extractPayload(payload);
  return firstMessageList(data.messages, data.new_messages, data.chat_messages, data.data);
}

function extractSentMessage(payload: unknown): VendorSupportChatMessage | null {
  const data = extractPayload(payload);
  return (
    mapMessage(data.message) ||
    mapMessage(data.chat_message) ||
    mapMessage(asRecord(data.data)?.message) ||
    mapMessage(data.data) ||
    mapMessage(data)
  );
}

export const vendorSupportChatService = {
  /** GET /vendor/support/chat */
  async openChat(): Promise<VendorSupportChatOpenResult> {
    const response = await apiClient.get('/vendor/support/chat', { timeout: 20000 });
    return extractOpenResult(response.data);
  },

  /**
   * GET /vendor/support/chat/messages
   * Query: after_id — last message id on screen (0 for initial poll)
   */
  async pollMessages(afterId: number | string = 0): Promise<VendorSupportChatMessage[]> {
    const response = await apiClient.get('/vendor/support/chat/messages', {
      params: { after_id: afterId },
      timeout: 15000,
    });
    return extractPollMessages(response.data);
  },

  /**
   * POST /vendor/support/chat/messages
   * Body: { message }
   */
  async sendMessage(message: string): Promise<VendorSupportChatMessage | null> {
    const response = await apiClient.post(
      '/vendor/support/chat/messages',
      { message: message.trim() },
      {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }
    );
    return extractSentMessage(response.data);
  },
};
