import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, type AdminNotificationItem } from '../../services/adminService';

const AdminNotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [list, setList] = useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await adminService.getNotifications({ page: 1, per_page: 50 });
      setList(res.list ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load notifications.');
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const iconFor = (item: AdminNotificationItem) => {
    const action = String(item.action || '').toLowerCase();
    const type = String(item.type || '').toLowerCase();
    if (action.includes('ticket') || type.includes('support')) return 'chatbubble-ellipses-outline';
    if (action.includes('order') || type.includes('order')) return 'cart-outline';
    if (action.includes('user') || type.includes('user')) return 'person-outline';
    return 'notifications-outline';
  };

  const renderItem = ({ item }: { item: AdminNotificationItem }) => (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={iconFor(item) as any} size={22} color={COLORS.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{item.title || 'Notification'}</Text>
        <Text style={styles.message}>{item.message || '—'}</Text>
        <Text style={styles.time}>
          {item.created_at ? dayjs(item.created_at).format('DD MMM YYYY, hh:mm A') : '—'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="notifications-off-outline" size={44} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} colors={[COLORS.primary]} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  backButton: { padding: SPACING.sm },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  headerSpacer: { width: 40 },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '14',
    marginRight: SPACING.md,
  },
  content: { flex: 1 },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  time: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.error, textAlign: 'center' },
  retryButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
});

export default AdminNotificationsScreen;
