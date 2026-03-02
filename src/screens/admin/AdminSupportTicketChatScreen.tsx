import React, { useState, useMemo, useEffect } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { adminService, type AdminSupportTicket, type AdminSupportTicketDetail } from '../../services/adminService';

type ChatMessage = {
  id: string;
  body: string;
  isAdmin: boolean;
  senderName: string;
  created_at: string;
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

const AdminSupportTicketChatScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: { ticket: AdminSupportTicket } }, 'params'>>();
  const ticketFromParams = route.params?.ticket;

  const [ticketDetail, setTicketDetail] = useState<AdminSupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const ticket = ticketDetail ?? ticketFromParams;

  useEffect(() => {
    if (!ticketFromParams?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    setLoading(true);
    adminService
      .getSupportTicketById(ticketFromParams.id)
      .then((res) => {
        if (!cancelled && res.success && res.data) setTicketDetail(res.data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('admin.supportTickets.failedToLoad', 'Failed to load ticket.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ticketFromParams?.id, t]);

  const messages: ChatMessage[] = useMemo(() => {
    if (!ticket) return [];
    const list: ChatMessage[] = [
      {
        id: 'initial',
        body: ticket.message,
        isAdmin: false,
        senderName: ticket.user_name || ticket.email || t('admin.supportTickets.customer', 'Customer'),
        created_at: ticket.created_at,
      },
    ];
    const replies = ticketDetail?.replies ?? [];
    replies.forEach((r) => {
      list.push({
        id: `reply-${r.id}`,
        body: r.message,
        isAdmin: r.is_admin ?? false,
        senderName: r.user_name ?? t('admin.supportTickets.admin', 'Admin'),
        created_at: r.created_at,
      });
    });
    return list;
  }, [ticket, ticketDetail?.replies, t]);

  const fetchTicket = () => {
    if (!ticketFromParams?.id) return;
    adminService.getSupportTicketById(ticketFromParams.id).then((res) => {
      if (res.success && res.data) setTicketDetail(res.data);
    }).catch(() => {});
  };

  const STATUS_OPTIONS: { value: string; labelKey: string }[] = [
    { value: 'open', labelKey: 'admin.supportTickets.status.open' },
    { value: 'in_progress', labelKey: 'admin.supportTickets.status.in_progress' },
    { value: 'resolved', labelKey: 'admin.supportTickets.status.resolved' },
    { value: 'closed', labelKey: 'admin.supportTickets.status.closed' },
  ];

  const handleChangeStatus = () => {
    if (!ticketFromParams?.id || updatingStatus) return;
    Alert.alert(
      t('admin.supportTickets.changeStatus', 'Change status'),
      undefined,
      [
        ...STATUS_OPTIONS.map((opt) => ({
          text: t(opt.labelKey, opt.value),
          onPress: () => {
            if (ticket.status === opt.value) return;
            setUpdatingStatus(true);
            adminService
              .updateSupportTicketStatus(ticketFromParams.id, opt.value)
              .then((res) => {
                if (res.success) fetchTicket();
                else Alert.alert(t('common.error', 'Error'), res.message ?? t('admin.supportTickets.statusUpdateFailed', 'Failed to update status.'));
              })
              .catch(() => Alert.alert(t('common.error', 'Error'), t('admin.supportTickets.statusUpdateFailed', 'Failed to update status.')))
              .finally(() => setUpdatingStatus(false));
          },
        })),
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      ]
    );
  };

  const handleSendReply = () => {
    const text = replyText.trim();
    if (!text || sending || !ticketFromParams?.id) return;
    setSendError(null);
    setSending(true);
    adminService
      .replyToSupportTicket(ticketFromParams.id, text)
      .then((res) => {
        if (res.success) {
          setReplyText('');
          fetchTicket();
        } else {
          setSendError(res.message || t('admin.supportTickets.replyFailed', 'Failed to send reply.'));
        }
      })
      .catch(() => {
        setSendError(t('admin.supportTickets.replyFailed', 'Failed to send reply.'));
      })
      .finally(() => {
        setSending(false);
      });
  };

  if (!ticket) {
    return (
      <View style={styles.container}>
        <Header title={t('admin.supportTickets.chat', 'Chat')} showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t('admin.supportTickets.ticketNotFound', 'Ticket not found.')}</Text>
        </View>
      </View>
    );
  }

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.messageBubble, item.isAdmin ? styles.messageBubbleAdmin : styles.messageBubbleCustomer]}>
      <Text style={styles.messageSender}>{item.senderName}</Text>
      <Text style={styles.messageBody}>{item.body}</Text>
      <Text style={styles.messageTime}>{formatChatTime(item.created_at)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title={`${ticket.ticket_number} – ${ticket.subject}`}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.ticketInfo}>
        <TouchableOpacity
          style={[styles.statusChip, { backgroundColor: (ticket.status === 'open' ? COLORS.error : ticket.status === 'in_progress' ? COLORS.warning : COLORS.success) + '20' }]}
          onPress={handleChangeStatus}
          disabled={updatingStatus}
        >
          {updatingStatus ? (
            <ActivityIndicator size="small" color={ticket.status === 'open' ? COLORS.error : ticket.status === 'in_progress' ? COLORS.warning : COLORS.success} />
          ) : (
            <Text style={[styles.statusChipText, { color: ticket.status === 'open' ? COLORS.error : ticket.status === 'in_progress' ? COLORS.warning : COLORS.success }]}>
              {t(`admin.supportTickets.status.${(ticket.status || '').toLowerCase().replace(/-/g, '_')}`, ticket.status)}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.ticketMeta}>{ticket.user_name || ticket.email} · {ticket.email}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.chatWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t('admin.supportTickets.noMessages', 'No messages yet.')}</Text>
              </View>
            }
          />
        )}
        {!loading && !loadError && (
          <>
            {sendError ? (
              <View style={styles.sendErrorWrap}>
                <Text style={styles.errorText}>{sendError}</Text>
              </View>
            ) : null}
            <View style={[styles.replyRow, { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.sm }]}>
            <TextInput
              style={styles.replyInput}
              placeholder={t('admin.supportTickets.replyPlaceholder', 'Type your reply...')}
              placeholderTextColor={COLORS.textSecondary}
              value={replyText}
              onChangeText={(v) => { setReplyText(v); if (sendError) setSendError(null); }}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!replyText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSendReply}
              disabled={!replyText.trim() || sending}
            >
              <Ionicons name="send" size={22} color={COLORS.background} />
            </TouchableOpacity>
          </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.error },
  ticketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusChipText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  ticketMeta: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, flex: 1 },
  chatWrap: { flex: 1 },
  messagesList: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  messageBubble: {
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  messageBubbleCustomer: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
  },
  messageBubbleAdmin: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary + '20',
    borderBottomRightRadius: 4,
  },
  messageSender: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary, marginBottom: 2 },
  messageBody: { fontSize: FONT_SIZES.md, color: COLORS.text },
  messageTime: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4 },
  empty: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  sendErrorWrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
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
    marginRight: SPACING.sm,
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

export default AdminSupportTicketChatScreen;
