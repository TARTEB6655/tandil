import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import {
  adminSupportChatService,
  AdminSupportChatMessage,
  AdminSupportChatSession,
  AdminSupportChatStatus,
} from '../../services/adminSupportChatService';

const POLL_INTERVAL_MS = 4000;

type RouteParams = {
  session: AdminSupportChatSession;
};

function formatChatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hour = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${day}/${month}/${year} ${hour12}:${min} ${ampm}`;
  } catch {
    return iso;
  }
}

function mergeMessages(
  existing: AdminSupportChatMessage[],
  incoming: AdminSupportChatMessage[]
): AdminSupportChatMessage[] {
  const map = new Map<string, AdminSupportChatMessage>();
  [...existing, ...incoming].forEach((msg) => {
    map.set(String(msg.id), msg);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function getLastMessageId(messages: AdminSupportChatMessage[]): number | string {
  if (!messages.length) return 0;
  return messages[messages.length - 1].id;
}

function isSessionClosed(session?: AdminSupportChatSession | null): boolean {
  const status = (session?.status || '').toLowerCase();
  return status === 'closed' || status === 'resolved';
}

function statusColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'open') return COLORS.error;
  if (s === 'in_progress') return COLORS.warning;
  if (s === 'resolved' || s === 'closed') return COLORS.success;
  return COLORS.textSecondary;
}

const STATUS_OPTIONS: { value: AdminSupportChatStatus; label: string }[] = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const AdminVendorLiveChatScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const sessionFromParams = route.params?.session;

  const listRef = useRef<FlatList<AdminSupportChatMessage>>(null);
  const messagesRef = useRef<AdminSupportChatMessage[]>([]);
  const sessionRef = useRef<AdminSupportChatSession | null>(sessionFromParams ?? null);
  const pollingRef = useRef(false);

  const [session, setSession] = useState<AdminSupportChatSession | null>(sessionFromParams ?? null);
  const [messages, setMessages] = useState<AdminSupportChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatReady, setChatReady] = useState(false);
  const [polling, setPolling] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const loadSession = useCallback(async () => {
    if (!sessionFromParams?.id) {
      setLoadError(
        t('adminVendorLiveChat.sessionNotFound', { defaultValue: 'Chat session not found.' })
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const result = await adminSupportChatService.getSession(sessionFromParams.id);
      setSession(result.session);
      sessionRef.current = result.session;
      setMessages(result.messages);
      messagesRef.current = result.messages;
      setChatReady(true);
      scrollToBottom();
    } catch (err: unknown) {
      setChatReady(false);
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('adminVendorLiveChat.loadFailed', { defaultValue: 'Failed to load chat session.' });
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [scrollToBottom, sessionFromParams?.id, t]);

  const pollNewMessages = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession?.id || !chatReady || pollingRef.current || isSessionClosed(activeSession)) {
      return;
    }
    pollingRef.current = true;
    setPolling(true);
    try {
      const afterId = getLastMessageId(messagesRef.current);
      const incoming = await adminSupportChatService.pollMessages(activeSession.id, afterId);
      if (incoming.length > 0) {
        const merged = mergeMessages(messagesRef.current, incoming);
        messagesRef.current = merged;
        setMessages(merged);
        scrollToBottom();
      }
    } catch {
      // Silent poll failures — next tick will retry.
    } finally {
      pollingRef.current = false;
      setPolling(false);
    }
  }, [chatReady, scrollToBottom]);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      loadSession();
      return () => setIsFocused(false);
    }, [loadSession])
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!isFocused || !chatReady || isSessionClosed(session)) return undefined;
    const timer = setInterval(() => {
      pollNewMessages();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isFocused, chatReady, session?.status, pollNewMessages]);

  const handleSend = async () => {
    const text = draft.trim();
    const activeSession = sessionRef.current;
    if (!text || !activeSession?.id || !chatReady || sending || isSessionClosed(activeSession)) {
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const sent = await adminSupportChatService.sendMessage(activeSession.id, text);
      setDraft('');
      if (sent) {
        const merged = mergeMessages(messagesRef.current, [sent]);
        messagesRef.current = merged;
        setMessages(merged);
      } else {
        const optimistic: AdminSupportChatMessage = {
          id: `local-${Date.now()}`,
          message: text,
          is_admin: true,
          sender_name: t('adminVendorLiveChat.admin', { defaultValue: 'Admin' }),
          created_at: new Date().toISOString(),
        };
        const merged = mergeMessages(messagesRef.current, [optimistic]);
        messagesRef.current = merged;
        setMessages(merged);
        await pollNewMessages();
      }
      scrollToBottom();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('adminVendorLiveChat.sendFailed', { defaultValue: 'Failed to send reply.' });
      setSendError(message);
    } finally {
      setSending(false);
    }
  };

  const applyStatus = async (status: AdminSupportChatStatus) => {
    const activeSession = sessionRef.current;
    if (!activeSession?.id || updatingStatus) return;
    if ((activeSession.status || '').toLowerCase() === status) return;

    setUpdatingStatus(true);
    try {
      const updated = await adminSupportChatService.updateStatus(activeSession.id, status);
      if (updated) {
        setSession(updated);
        sessionRef.current = updated;
      } else {
        const next = { ...activeSession, status, status_label: status.replace(/_/g, ' ') };
        setSession(next);
        sessionRef.current = next;
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('adminVendorLiveChat.statusUpdateFailed', { defaultValue: 'Failed to update status.' });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleChangeStatus = () => {
    const activeSession = sessionRef.current;
    if (!activeSession?.id || updatingStatus) return;

    Alert.alert(
      t('adminVendorLiveChat.changeStatus', { defaultValue: 'Change status' }),
      undefined,
      [
        ...STATUS_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: () => applyStatus(opt.value),
        })),
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
      ]
    );
  };

  const renderMessage = ({ item }: { item: AdminSupportChatMessage }) => {
    const isAdmin = item.is_admin;
    return (
      <View
        style={[
          styles.messageBubble,
          isAdmin ? styles.messageBubbleAdmin : styles.messageBubbleVendor,
        ]}
      >
        <Text style={[styles.messageSender, isAdmin && styles.messageSenderAdmin]}>
          {item.sender_name}
        </Text>
        <Text style={[styles.messageBody, isAdmin && styles.messageBodyAdmin]}>{item.message}</Text>
        <Text style={[styles.messageTime, isAdmin && styles.messageTimeAdmin]}>
          {formatChatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  if (!sessionFromParams) {
    return (
      <View style={styles.container}>
        <Header
          title={t('adminVendorLiveChat.chat', { defaultValue: 'Chat' })}
          showBack
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {t('adminVendorLiveChat.sessionNotFound', { defaultValue: 'Chat session not found.' })}
          </Text>
        </View>
      </View>
    );
  }

  const displayName = session?.business_name || session?.vendor_name || sessionFromParams.vendor_name;
  const closed = isSessionClosed(session);
  const currentStatus = (session?.status || 'open').toLowerCase();

  return (
    <View style={styles.container}>
      <Header
        title={displayName}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.sessionInfo}>
        <TouchableOpacity
          style={[
            styles.statusChip,
            { backgroundColor: statusColor(session?.status || 'open') + '20' },
          ]}
          onPress={handleChangeStatus}
          disabled={updatingStatus}
        >
          {updatingStatus ? (
            <ActivityIndicator size="small" color={statusColor(session?.status || 'open')} />
          ) : (
            <>
              <Text
                style={[
                  styles.statusChipText,
                  { color: statusColor(session?.status || 'open') },
                ]}
              >
                {session?.status_label || session?.status || 'open'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={statusColor(session?.status || 'open')}
              />
            </>
          )}
        </TouchableOpacity>
        {session?.vendor_email ? (
          <Text style={styles.sessionMeta} numberOfLines={1}>
            {session.vendor_email}
          </Text>
        ) : null}
        {polling ? (
          <Text style={styles.syncingText}>
            {t('adminVendorLiveChat.syncing', { defaultValue: 'Syncing...' })}
          </Text>
        ) : null}
      </View>

      <View style={styles.statusActions}>
        <Text style={styles.statusActionsLabel}>
          {t('adminVendorLiveChat.updateStatus', { defaultValue: 'Update status:' })}
        </Text>
        <View style={styles.statusActionsRow}>
          {currentStatus !== 'resolved' && (
            <TouchableOpacity
              style={[styles.statusActionBtn, styles.resolveBtn]}
              onPress={() => applyStatus('resolved')}
              disabled={updatingStatus}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
              <Text style={[styles.statusActionText, { color: COLORS.success }]}>
                {t('adminVendorLiveChat.markResolved', { defaultValue: 'Resolve' })}
              </Text>
            </TouchableOpacity>
          )}
          {currentStatus !== 'closed' && (
            <TouchableOpacity
              style={[styles.statusActionBtn, styles.closeBtn]}
              onPress={() => applyStatus('closed')}
              disabled={updatingStatus}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
              <Text style={[styles.statusActionText, { color: COLORS.error }]}>
                {t('adminVendorLiveChat.markClosed', { defaultValue: 'Close' })}
              </Text>
            </TouchableOpacity>
          )}
          {currentStatus !== 'in_progress' && currentStatus !== 'resolved' && currentStatus !== 'closed' && (
            <TouchableOpacity
              style={[styles.statusActionBtn, styles.progressBtn]}
              onPress={() => applyStatus('in_progress')}
              disabled={updatingStatus}
            >
              <Ionicons name="time-outline" size={16} color={COLORS.warning} />
              <Text style={[styles.statusActionText, { color: COLORS.warning }]}>
                {t('adminVendorLiveChat.inProgress', { defaultValue: 'In progress' })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {t('adminVendorLiveChat.loadingChat', { defaultValue: 'Loading conversation...' })}
            </Text>
          </View>
        ) : loadError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadSession}>
              <Text style={styles.retryButtonText}>
                {t('common.retry', { defaultValue: 'Retry' })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={scrollToBottom}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {t('adminVendorLiveChat.emptyChat', {
                      defaultValue: 'No messages yet. Reply when the vendor writes.',
                    })}
                  </Text>
                </View>
              }
            />

            {sendError ? (
              <View style={styles.sendErrorWrap}>
                <Text style={styles.errorText}>{sendError}</Text>
              </View>
            ) : null}

            {closed ? (
              <View style={styles.closedBanner}>
                <Text style={styles.closedText}>
                  {t('adminVendorLiveChat.closed', {
                    defaultValue: 'This chat is resolved/closed. Change status to reply again.',
                  })}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.replyRow,
                  { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.sm },
                ]}
              >
                <TextInput
                  style={styles.replyInput}
                  placeholder={t('adminVendorLiveChat.replyPlaceholder', {
                    defaultValue: 'Reply to vendor...',
                  })}
                  placeholderTextColor={COLORS.textSecondary}
                  value={draft}
                  onChangeText={(value) => {
                    setDraft(value);
                    if (sendError) setSendError(null);
                  }}
                  multiline
                  maxLength={2000}
                  editable={!sending}
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!draft.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={COLORS.background} />
                  ) : (
                    <Ionicons name="send" size={22} color={COLORS.background} />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.error, textAlign: 'center' },
  retryButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexWrap: 'wrap',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusChipText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  sessionMeta: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, flex: 1 },
  syncingText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  statusActions: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  statusActionsLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statusActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  statusActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  statusActionText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  resolveBtn: {
    borderColor: COLORS.success + '55',
    backgroundColor: COLORS.success + '10',
  },
  closeBtn: {
    borderColor: COLORS.error + '55',
    backgroundColor: COLORS.error + '10',
  },
  progressBtn: {
    borderColor: COLORS.warning + '55',
    backgroundColor: COLORS.warning + '10',
  },
  chatWrap: { flex: 1 },
  messagesList: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  messageBubble: {
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  messageBubbleVendor: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  messageBubbleAdmin: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  messageSender: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    marginBottom: 2,
  },
  messageSenderAdmin: { color: COLORS.background, opacity: 0.9 },
  messageBody: { fontSize: FONT_SIZES.md, color: COLORS.text },
  messageBodyAdmin: { color: COLORS.background },
  messageTime: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4 },
  messageTimeAdmin: { color: COLORS.background, opacity: 0.85 },
  empty: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: 'center' },
  sendErrorWrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  closedBanner: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.warning + '14',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closedText: { fontSize: FONT_SIZES.sm, color: COLORS.text, textAlign: 'center' },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: SPACING.sm,
  },
  replyInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
});

export default AdminVendorLiveChatScreen;
