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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { VendorPageHeader, VENDOR_SCREEN_BG } from '../../components/vendor/VendorUi';
import {
  vendorSupportChatService,
  VendorSupportChatMessage,
  VendorSupportChatSession,
} from '../../services/vendorSupportChatService';

const POLL_INTERVAL_MS = 4000;

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
  existing: VendorSupportChatMessage[],
  incoming: VendorSupportChatMessage[]
): VendorSupportChatMessage[] {
  const map = new Map<string, VendorSupportChatMessage>();
  [...existing, ...incoming].forEach((msg) => {
    map.set(String(msg.id), msg);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function getLastMessageId(messages: VendorSupportChatMessage[]): number | string {
  if (!messages.length) return 0;
  return messages[messages.length - 1].id;
}

function isSessionClosed(session?: VendorSupportChatSession | null): boolean {
  const status = (session?.status || '').toLowerCase();
  return status === 'closed' || status === 'resolved' || status === 'ended';
}

const VendorLiveChatScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const listRef = useRef<FlatList<VendorSupportChatMessage>>(null);
  const messagesRef = useRef<VendorSupportChatMessage[]>([]);
  const sessionRef = useRef<VendorSupportChatSession | null>(null);
  const pollingRef = useRef(false);

  const [session, setSession] = useState<VendorSupportChatSession | null>(null);
  const [messages, setMessages] = useState<VendorSupportChatMessage[]>([]);
  const [chatReady, setChatReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const openChat = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await vendorSupportChatService.openChat();
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
        t('vendorLiveChat.loadFailed', { defaultValue: 'Failed to open live chat.' });
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [scrollToBottom, t]);

  const pollNewMessages = useCallback(async () => {
    if (!chatReady || pollingRef.current || isSessionClosed(sessionRef.current)) return;
    pollingRef.current = true;
    setPolling(true);
    try {
      const afterId = getLastMessageId(messagesRef.current);
      const incoming = await vendorSupportChatService.pollMessages(afterId);
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
      openChat();
      return () => setIsFocused(false);
    }, [openChat])
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
    if (!text || !chatReady || sending || isSessionClosed(session)) return;

    setSending(true);
    setSendError(null);
    try {
      const sent = await vendorSupportChatService.sendMessage(text);
      setDraft('');
      if (sent) {
        const merged = mergeMessages(messagesRef.current, [sent]);
        messagesRef.current = merged;
        setMessages(merged);
      } else {
        const optimistic: VendorSupportChatMessage = {
          id: `local-${Date.now()}`,
          message: text,
          is_admin: false,
          sender_name: t('vendorLiveChat.you', { defaultValue: 'You' }),
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
        t('vendorLiveChat.sendFailed', { defaultValue: 'Failed to send message.' });
      setSendError(message);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: VendorSupportChatMessage }) => {
    const isMine = !item.is_admin;
    return (
      <View style={[styles.messageBubble, isMine ? styles.messageBubbleMe : styles.messageBubbleOther]}>
        <Text style={[styles.messageSender, isMine && styles.messageSenderMe]}>
          {item.sender_name}
        </Text>
        <Text style={[styles.messageBody, isMine && styles.messageBodyMe]}>{item.message}</Text>
        <Text style={[styles.messageTime, isMine && styles.messageTimeMe]}>
          {formatChatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  const closed = isSessionClosed(session);
  const statusLabel =
    session?.status_label ||
    session?.status ||
    t('vendorLiveChat.statusOpen', { defaultValue: 'Open' });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <VendorPageHeader
        title={t('vendorLiveChat.title', { defaultValue: 'Live Chat' })}
        subtitle={t('vendorLiveChat.subtitle', {
          defaultValue: 'Chat with Tandil support team',
        })}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.statusRow}>
        <View style={[styles.statusChip, closed && styles.statusChipClosed]}>
          <View style={[styles.statusDot, closed ? styles.statusDotClosed : styles.statusDotOpen]} />
          <Text style={[styles.statusText, closed && styles.statusTextClosed]}>{statusLabel}</Text>
        </View>
        {polling ? (
          <Text style={styles.pollingText}>
            {t('vendorLiveChat.syncing', { defaultValue: 'Syncing...' })}
          </Text>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={styles.chatWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {t('vendorLiveChat.connecting', { defaultValue: 'Connecting to support...' })}
            </Text>
          </View>
        ) : loadError ? (
          <View style={styles.centerState}>
            <Ionicons name="chatbubbles-outline" size={42} color={COLORS.textSecondary} />
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={openChat}>
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
              ListHeaderComponent={
                <View style={styles.welcomeCard}>
                  <Ionicons name="headset-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.welcomeTitle}>
                    {t('vendorLiveChat.welcomeTitle', { defaultValue: 'Support is here to help' })}
                  </Text>
                  <Text style={styles.welcomeText}>
                    {t('vendorLiveChat.welcomeText', {
                      defaultValue:
                        'Send a message about orders, products, or your vendor account. Our team will reply here.',
                    })}
                  </Text>
                </View>
              }
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>
                    {t('vendorLiveChat.empty', {
                      defaultValue: 'No messages yet. Say hello to start the conversation.',
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
                  {t('vendorLiveChat.closed', {
                    defaultValue: 'This chat session is closed. Contact support to reopen.',
                  })}
                </Text>
              </View>
            ) : (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={t('vendorLiveChat.placeholder', {
                    defaultValue: 'Type your message...',
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
                    <Ionicons name="send" size={20} color={COLORS.background} />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VENDOR_SCREEN_BG },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.success + '18',
  },
  statusChipClosed: {
    backgroundColor: COLORS.textSecondary + '18',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOpen: { backgroundColor: COLORS.success },
  statusDotClosed: { backgroundColor: COLORS.textSecondary },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.success,
    textTransform: 'capitalize',
  },
  statusTextClosed: { color: COLORS.textSecondary },
  pollingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  chatWrap: { flex: 1 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.sm,
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
  messagesList: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  welcomeCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  welcomeTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  welcomeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  emptyWrap: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  messageBubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  messageSender: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    marginBottom: 2,
  },
  messageSenderMe: {
    color: COLORS.background,
    opacity: 0.9,
  },
  messageBody: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  messageBodyMe: {
    color: COLORS.background,
  },
  messageTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  messageTimeMe: {
    color: COLORS.background,
    opacity: 0.85,
  },
  sendErrorWrap: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  closedBanner: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.warning + '14',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: COLORS.surfaceLight,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
});

export default VendorLiveChatScreen;
