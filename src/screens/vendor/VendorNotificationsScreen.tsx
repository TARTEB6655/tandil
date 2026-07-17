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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { VendorPageHeader, VENDOR_SCREEN_BG } from '../../components/vendor/VendorUi';
import { useTranslation } from 'react-i18next';
import {
  getVendorNotifications,
  markVendorNotificationRead,
  markVendorNotificationsReadAll,
  deleteVendorNotification,
  clearVendorNotifications,
  type VendorNotification,
} from '../../services/vendorNotificationService';

const VendorNotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [list, setList] = useState<VendorNotification[]>([]);
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
      const result = await getVendorNotifications({ per_page: 20, page: 1 });
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
      await Promise.all(selectedIds.map((id) => markVendorNotificationRead(id)));
      const now = new Date().toISOString();
      setList((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, read_at: item.read_at ?? now } : item))
      );
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert(
        t('common.error', 'Error'),
        e?.response?.data?.message ??
          e?.message ??
          t('notifications.errorMarkAsReadSelected', 'Failed to mark selected notifications as read.')
      );
    } finally {
      setMarkingSelected(false);
    }
  }, [markingSelected, selectedIds, t]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const res = await markVendorNotificationsReadAll();
      if (res.success === false) throw new Error(res.message || 'Failed to mark all notifications as read.');
      const now = new Date().toISOString();
      setList((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? now })));
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert(
        t('common.error', 'Error'),
        e?.response?.data?.message ?? e?.message ?? t('notifications.errorMarkAllRead')
      );
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, t]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0 || deletingSelected) return;
    setDeletingSelected(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteVendorNotification(id)));
      setList((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert(
        t('common.error', 'Error'),
        e?.response?.data?.message ??
          e?.message ??
          t('notifications.errorDeleteSelected', 'Failed to delete selected notifications.')
      );
    } finally {
      setDeletingSelected(false);
    }
  }, [deletingSelected, selectedIds, t]);

  const handleClearAll = useCallback(async () => {
    if (clearingAll || list.length === 0) return;
    setClearingAll(true);
    try {
      const res = await clearVendorNotifications();
      if (res.success === false) throw new Error(res.message || 'Failed to clear all notifications.');
      setList([]);
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert(
        t('common.error', 'Error'),
        e?.response?.data?.message ?? e?.message ?? t('notifications.errorClear')
      );
    } finally {
      setClearingAll(false);
    }
  }, [clearingAll, list.length, t]);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'order_placed':
      case 'new_order':
        return 'receipt-outline';
      case 'order_status':
        return 'sync-outline';
      case 'product_approved':
      case 'product_rejected':
        return 'cube-outline';
      case 'low_stock':
        return 'warning-outline';
      case 'admin_notification':
        return 'chatbubble-ellipses-outline';
      case 'tip_published':
        return 'bulb-outline';
      default:
        return 'notifications-outline';
    }
  };

  const renderNotification = ({ item }: { item: VendorNotification }) => {
    const notificationType = item.data?.type ?? item.type ?? '';
    const title = item.data?.title || t('notifications.title');
    const message =
      item.data?.message ||
      t('notifications.defaultMessage', { defaultValue: 'You have a new notification.' });
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
            <Ionicons name={getIconForType(notificationType) as any} size={22} color={COLORS.primary} />
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <VendorPageHeader title={t('notifications.title')} onBack={handleBackPress} />

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
            style={[
              styles.actionBtn,
              styles.actionBtnPrimary,
              (selectedIds.length === 0 || markingSelected) && styles.actionBtnDisabled,
            ]}
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
            style={[
              styles.actionBtn,
              styles.actionBtnDanger,
              (selectedIds.length === 0 || deletingSelected) && styles.actionBtnDisabled,
            ]}
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
            style={[
              styles.actionBtn,
              styles.actionBtnDangerOutline,
              (clearingAll || list.length === 0) && styles.actionBtnDisabled,
            ]}
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
          <Ionicons name="notifications-off-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
        </View>
      ) : (
        <View style={styles.listWrapper}>
          <FlatList
            style={styles.listFlex}
            data={list}
            renderItem={renderNotification}
            keyExtractor={(item, index) => (item.id != null ? String(item.id) : `row-${index}`)}
            showsVerticalScrollIndicator={true}
            removeClippedSubviews={false}
            initialNumToRender={24}
            maxToRenderPerBatch={24}
            windowSize={10}
            extraData={list.length}
            contentContainerStyle={styles.notificationsList}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VENDOR_SCREEN_BG,
  },
  listWrapper: {
    flex: 1,
  },
  listFlex: {
    flex: 1,
  },
  notificationsList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  actionsContainer: {
    flexShrink: 0,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: VENDOR_SCREEN_BG,
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
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notificationUnread: {
    borderWidth: 1,
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
    gap: SPACING.sm,
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

export default VendorNotificationsScreen;
