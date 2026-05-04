import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, AdminUser, UsersResponse } from '../../services/adminService';

const BROADCAST_ROLES = [
  { api: 'client', labelKey: 'admin.notificationStats.roles.client' },
  { api: 'technician', labelKey: 'admin.notificationStats.roles.technician' },
  { api: 'supervisor', labelKey: 'admin.notificationStats.roles.supervisor' },
  { api: 'area_manager', labelKey: 'admin.notificationStats.roles.area_manager' },
  { api: 'hr', labelKey: 'admin.notificationStats.roles.hr' },
  { api: 'admin', labelKey: 'admin.notificationStats.roles.admin' },
] as const;

function parseUsersFromResponse(res: UsersResponse | null | undefined): AdminUser[] {
  if (!res?.data) return [];
  if (Array.isArray(res.data)) return res.data;
  const inner = (res.data as { data?: AdminUser[] }).data;
  return Array.isArray(inner) ? inner : [];
}

function getLastPage(res: UsersResponse): number {
  const d = res?.data;
  if (d && typeof d === 'object' && !Array.isArray(d) && 'last_page' in d) {
    const lp = (d as { last_page?: number }).last_page;
    return typeof lp === 'number' && lp > 0 ? lp : 1;
  }
  return 1;
}

function getNormalizedRole(user: AdminUser): string {
  const raw = (user.role || user.roles?.[0]?.name || '').toString().trim();
  const lower = raw.toLowerCase();
  if (lower === 'area manager') return 'area_manager';
  if (lower === 'hr manager' || lower === 'hr_manager') return 'hr';
  const normalized = lower.replace(/\s+/g, '_');
  return normalized || '';
}

function userMatchesBroadcastRole(user: AdminUser, roleApi: string): boolean {
  const r = getNormalizedRole(user);
  switch (roleApi) {
    case 'technician':
      return r === 'technician' || r === 'worker';
    case 'supervisor':
      return r === 'supervisor' || r === 'team_leader';
    case 'client':
      return r === 'client' || r === 'customer';
    case 'area_manager':
      return r === 'area_manager';
    case 'hr':
      return r === 'hr';
    case 'admin':
      return r === 'admin';
    default:
      return r === roleApi;
  }
}

async function loadUsersForBroadcastRole(roleApi: string): Promise<AdminUser[]> {
  const collected: AdminUser[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const res = await adminService.getUsers({ role: roleApi, per_page: 200, page });
    const chunk = parseUsersFromResponse(res);
    lastPage = getLastPage(res);
    collected.push(...chunk);
    if (chunk.length === 0 && page === 1) break;
    page += 1;
  } while (page <= lastPage);

  if (collected.length > 0) return collected;

  const all: AdminUser[] = [];
  page = 1;
  lastPage = 1;
  do {
    const res = await adminService.getUsers({ per_page: 200, page });
    const chunk = parseUsersFromResponse(res);
    lastPage = getLastPage(res);
    all.push(...chunk);
    page += 1;
  } while (page <= lastPage);

  return all.filter((u) => userMatchesBroadcastRole(u, roleApi));
}

const AdminSendNotificationScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [targetAll, setTargetAll] = useState(true);
  const [roleApi, setRoleApi] = useState<string>('');
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [roleUsers, setRoleUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectAllInRole, setSelectAllInRole] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!roleApi || targetAll) {
      setRoleUsers([]);
      setSelectAllInRole(false);
      setSelectedIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      setSelectAllInRole(false);
      setSelectedIds([]);
      try {
        const users = await loadUsersForBroadcastRole(roleApi);
        if (!cancelled) setRoleUsers(users);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setRoleUsers([]);
          Alert.alert(t('common.error'), t('admin.sendNotification.loadUsersError'));
        }
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roleApi, targetAll, t]);

  const toggleUserId = useCallback((id: number) => {
    setSelectAllInRole(false);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const onToggleSelectAllInRole = useCallback(
    (checked: boolean) => {
      setSelectAllInRole(checked);
      if (checked) setSelectedIds([]);
      else setSelectedIds([]);
    },
    []
  );

  const resetForm = useCallback(() => {
    setTargetAll(true);
    setRoleApi('');
    setSelectAllInRole(false);
    setSelectedIds([]);
    setTitle('');
    setMessage('');
  }, []);

  const onSend = useCallback(async () => {
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    if (!trimmedTitle || !trimmedMessage) {
      Alert.alert(t('common.error'), t('admin.sendNotification.validationTitleMessage'));
      return;
    }
    if (!targetAll) {
      if (!roleApi) {
        Alert.alert(t('common.error'), t('admin.sendNotification.validationRole'));
        return;
      }
      if (!loadingUsers && roleUsers.length === 0) {
        Alert.alert(t('common.error'), t('admin.sendNotification.noUsersForRole'));
        return;
      }
      if (!selectAllInRole && selectedIds.length === 0) {
        Alert.alert(t('common.error'), t('admin.sendNotification.validationRecipients'));
        return;
      }
    }

    setSending(true);
    try {
      let type: 'all' | 'role' | 'users' = 'all';
      let role: string | undefined;
      let userIds: number[] | undefined;

      if (targetAll) {
        type = 'all';
      } else if (selectAllInRole) {
        type = 'role';
        role = roleApi;
      } else {
        type = 'users';
        userIds = selectedIds;
      }

      const res = await adminService.broadcastNotification({
        title: trimmedTitle,
        message: trimmedMessage,
        type,
        role,
        userIds,
      });

      if (res.success === false || res.status === false) {
        Alert.alert(t('common.error'), res.message || t('admin.sendNotification.sendFailed'));
      } else {
        Alert.alert(t('admin.sendNotification.sentTitle'), t('admin.sendNotification.sent'));
        resetForm();
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      Alert.alert(t('common.error'), msg || t('admin.sendNotification.sendFailed'));
    } finally {
      setSending(false);
    }
  }, [title, message, targetAll, roleApi, selectAllInRole, selectedIds, loadingUsers, roleUsers.length, t, resetForm]);

  const selectedRoleLabel = BROADCAST_ROLES.find((r) => r.api === roleApi);
  const showRoleRecipients = !targetAll && !!roleApi;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <Text style={styles.title}>{t('admin.sendNotification.title')}</Text>
              <Text style={styles.subtitle}>{t('admin.sendNotification.subtitle')}</Text>
            </View>
            <TouchableOpacity
              style={styles.backStatsBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back" size={18} color={COLORS.text} />
              <Text style={styles.backStatsText}>{t('admin.sendNotification.backToStats')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('admin.sendNotification.sendTo')}</Text>

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => setTargetAll(true)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={targetAll ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={targetAll ? COLORS.primary : COLORS.textSecondary}
              />
              <View style={styles.radioTextCol}>
                <Text style={styles.radioTitle}>{t('admin.sendNotification.allUsers')}</Text>
                <Text style={styles.radioDesc}>{t('admin.sendNotification.allUsersDesc')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => setTargetAll(false)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={!targetAll ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={!targetAll ? COLORS.primary : COLORS.textSecondary}
              />
              <View style={styles.radioTextCol}>
                <Text style={styles.radioTitle}>{t('admin.sendNotification.specificRole')}</Text>
                <Text style={styles.radioDesc}>{t('admin.sendNotification.specificRoleDesc')}</Text>
              </View>
            </TouchableOpacity>

            {!targetAll && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>
                  {t('admin.sendNotification.selectRole')}
                </Text>
                <TouchableOpacity
                  style={[styles.dropdown, !roleApi && styles.dropdownPlaceholder]}
                  onPress={() => setRolePickerOpen(true)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.dropdownText, !roleApi && styles.dropdownTextMuted]}>
                    {selectedRoleLabel ? t(selectedRoleLabel.labelKey) : t('admin.sendNotification.selectRolePlaceholder')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {showRoleRecipients && (
                  <View style={styles.recipientsBlock}>
                    <Text style={styles.recipientsTitle}>{t('admin.sendNotification.specificRole')}</Text>
                    <Text style={styles.recipientsSubtitle}>{t('admin.sendNotification.specificRoleDesc')}</Text>

                    {loadingUsers ? (
                      <ActivityIndicator style={{ marginVertical: SPACING.lg }} color={COLORS.primary} />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.selectAllRow}
                          onPress={() => onToggleSelectAllInRole(!selectAllInRole)}
                          activeOpacity={0.85}
                        >
                          <Ionicons
                            name={selectAllInRole ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={selectAllInRole ? COLORS.primary : COLORS.textSecondary}
                          />
                          <Text style={styles.selectAllText}>{t('admin.sendNotification.selectAllInRole')}</Text>
                        </TouchableOpacity>

                        <View style={styles.userListOuter}>
                          {roleUsers.length === 0 ? (
                            <Text style={styles.emptyUsers}>{t('admin.sendNotification.noUsersForRole')}</Text>
                          ) : (
                            roleUsers.map((u, index) => {
                              const checked = !selectAllInRole && selectedIds.includes(u.id);
                              const isLast = index === roleUsers.length - 1;
                              return (
                                <TouchableOpacity
                                  key={u.id}
                                  style={[styles.userRow, !isLast && styles.userRowDivider]}
                                  onPress={() => toggleUserId(u.id)}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons
                                    name={checked ? 'checkbox' : 'square-outline'}
                                    size={22}
                                    color={checked ? COLORS.primary : COLORS.textSecondary}
                                  />
                                  <Text style={styles.userRowText} numberOfLines={2}>
                                    {u.name} <Text style={styles.userEmail}>({u.email})</Text>
                                  </Text>
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </View>
                      </>
                    )}
                  </View>
                )}
              </>
            )}

            <Text style={styles.fieldLabel}>{t('admin.sendNotification.notificationTitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('admin.sendNotification.titlePlaceholder')}
              placeholderTextColor={COLORS.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.fieldLabel}>{t('admin.sendNotification.message')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('admin.sendNotification.messagePlaceholder')}
              placeholderTextColor={COLORS.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetForm} activeOpacity={0.85}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={onSend}
                disabled={sending}
                activeOpacity={0.9}
              >
                {sending ? (
                  <ActivityIndicator color={COLORS.surface} />
                ) : (
                  <Text style={styles.sendBtnText}>{t('admin.sendNotification.send')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={rolePickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setRolePickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('admin.sendNotification.selectRole')}</Text>
            <ScrollView style={styles.modalList}>
              {BROADCAST_ROLES.map((r) => (
                <TouchableOpacity
                  key={r.api}
                  style={styles.modalRow}
                  onPress={() => {
                    setRoleApi(r.api);
                    setRolePickerOpen(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{t(r.labelKey)}</Text>
                  {roleApi === r.api ? (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  backStatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backStatsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    maxWidth: 120,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  radioTextCol: {
    flex: 1,
  },
  radioTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  radioDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  dropdownPlaceholder: {
    borderColor: COLORS.border,
  },
  dropdownText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    flex: 1,
  },
  dropdownTextMuted: {
    color: COLORS.textSecondary,
  },
  recipientsBlock: {
    marginBottom: SPACING.lg,
  },
  recipientsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  recipientsSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  selectAllText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  userListOuter: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    marginTop: SPACING.xs,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  userRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  userRowText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  userEmail: {
    color: COLORS.textSecondary,
  },
  emptyUsers: {
    padding: SPACING.lg,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  textArea: {
    minHeight: 120,
    paddingTop: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  cancelBtnText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  sendBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    minWidth: 140,
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  sendBtnText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.surface,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: SPACING.lg,
    position: 'relative',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    maxHeight: '70%',
    paddingVertical: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  modalList: {
    maxHeight: 400,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  modalRowText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
});

export default AdminSendNotificationScreen;
