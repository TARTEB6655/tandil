import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import {
  getAreaManagerNotifications,
  markAreaManagerNotificationAsRead,
  markAllAreaManagerNotificationsAsRead,
  deleteAreaManagerNotification,
  clearAllAreaManagerNotifications,
  type AreaManagerNotificationItem,
} from '../../services/areaManagerService';

const AreaManagerNotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [list, setList] = useState<AreaManagerNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [markingSelected, setMarkingSelected] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAreaManagerNotifications({ per_page: 20, page: 1 });
      setList(result.list);
    } catch {
      setError(t('notifications.errorLoad'));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main');
  }, [navigation]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = list.map((item) => item.id);
    if (allIds.length === 0) return;
    const areAllSelected = allIds.every((id) => selectedIds.includes(id));
    setSelectedIds(areAllSelected ? [] : allIds);
  }, [list, selectedIds]);

  const handleMarkSelectedAsRead = useCallback(async () => {
    if (selectedIds.length === 0 || markingSelected) return;
    setMarkingSelected(true);
    try {
      await Promise.all(selectedIds.map((id) => markAreaManagerNotificationAsRead(id)));
      const now = new Date().toISOString();
      setList((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, read_at: item.read_at ?? now } : item))
      );
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e?.response?.data?.message ?? e?.message ?? t('notifications.errorMarkAsReadSelected', 'Failed to mark selected notifications as read.'));
    } finally {
      setMarkingSelected(false);
    }
  }, [markingSelected, selectedIds]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const res = await markAllAreaManagerNotificationsAsRead();
      if (!res.success) throw new Error(res.message || 'Failed to mark all notifications as read.');
      const now = new Date().toISOString();
      setList((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? now })));
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e?.response?.data?.message ?? e?.message ?? t('notifications.errorMarkAllRead'));
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0 || deletingSelected) return;
    setDeletingSelected(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteAreaManagerNotification(id)));
      setList((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e?.response?.data?.message ?? e?.message ?? t('notifications.errorDeleteSelected', 'Failed to delete selected notifications.'));
    } finally {
      setDeletingSelected(false);
    }
  }, [deletingSelected, selectedIds]);

  const handleClearAll = useCallback(async () => {
    if (clearingAll || list.length === 0) return;
    setClearingAll(true);
    try {
      const res = await clearAllAreaManagerNotifications();
      if (!res.success) throw new Error(res.message || 'Failed to clear all notifications.');
      setList([]);
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e?.response?.data?.message ?? e?.message ?? t('notifications.errorClear'));
    } finally {
      setClearingAll(false);
    }
  }, [clearingAll, list.length]);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'report_generated':
        return 'document-text-outline';
      case 'tip_published':
        return 'bulb-outline';
      case 'admin_notification':
        return 'chatbubble-ellipses-outline';
      default:
        return 'notifications-outline';
    }
  };

  const renderNotification = ({ item }: { item: AreaManagerNotificationItem }) => {
    const notificationType = item.data?.type ?? item.type ?? '';
    const title = item.data?.title || t('notifications.title');
    const message = item.data?.message || t('notifications.defaultMessage', { defaultValue: 'You have a new notification.' });
    const isUnread = !item.read_at;
    return (
      <View style={[styles.notificationItem, isUnread && styles.notificationUnread]}>
        <View style={styles.leadingColumn}>
          <TouchableOpacity
            style={styles.checkboxTouchable}
            onPress={() => toggleSelected(item.id)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.checkbox,
                selectedIds.includes(item.id) && styles.checkboxSelected,
              ]}
            >
              {selectedIds.includes(item.id) ? (
                <Ionicons name="checkmark" size={16} color={COLORS.background} />
              ) : null}
            </View>
          </TouchableOpacity>
          <View style={styles.notificationIcon}>
            <Ionicons
              name={getIconForType(notificationType) as any}
              size={24}
              color={COLORS.primary}
            />
          </View>
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{title}</Text>
          <Text style={styles.notificationMessage}>{message}</Text>
          <Text style={styles.notificationTime}>{dayjs(item.created_at).format('DD MMM YYYY, hh:mm A')}</Text>
        </View>
        {isUnread ? <View style={styles.unreadDot} /> : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('notifications.title')}
        showBack={true}
        onBackPress={handleBackPress}
      />

      <View style={styles.actionsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsRow}
        >
          <TouchableOpacity style={styles.actionBtn} onPress={handleSelectAll}>
            <Text style={styles.actionBtnText}>
              {list.length > 0 && list.every((item) => selectedIds.includes(item.id))
                ? t('notifications.unselectAll', 'Unselect All')
                : t('notifications.selectAll', 'Select All')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary, (selectedIds.length === 0 || markingSelected) && styles.actionBtnDisabled]}
            onPress={handleMarkSelectedAsRead}
            disabled={selectedIds.length === 0 || markingSelected}
          >
            {markingSelected ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Text style={styles.actionBtnPrimaryText}>{t('notifications.markAsRead', 'Mark as Read')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline, markingAll && styles.actionBtnDisabled]}
            onPress={handleMarkAllAsRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.actionBtnOutlineText}>{t('notifications.markAllRead')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger, (selectedIds.length === 0 || deletingSelected) && styles.actionBtnDisabled]}
            onPress={handleDeleteSelected}
            disabled={selectedIds.length === 0 || deletingSelected}
          >
            {deletingSelected ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Text style={styles.actionBtnDangerText}>{t('common.delete', 'Delete')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDangerOutline, (clearingAll || list.length === 0) && styles.actionBtnDisabled]}
            onPress={handleClearAll}
            disabled={clearingAll || list.length === 0}
          >
            {clearingAll ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Text style={styles.actionBtnDangerOutlineText}>{t('notifications.clearAll')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.notificationsList}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  notificationsList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  actionsContainer: {
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
  },
  actionBtn: {
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionBtnOutline: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.primary,
  },
  actionBtnDanger: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  actionBtnDangerOutline: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.error,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  actionBtnPrimaryText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  actionBtnOutlineText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  actionBtnDangerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  actionBtnDangerOutlineText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  notificationItem: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notificationUnread: {
    borderColor: COLORS.primary + '35',
  },
  leadingColumn: {
    width: 48,
    alignItems: 'center',
    marginRight: SPACING.sm,
    paddingTop: 2,
  },
  checkboxTouchable: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.textSecondary + '88',
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  notificationMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  notificationTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.primary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default AreaManagerNotificationsScreen;
