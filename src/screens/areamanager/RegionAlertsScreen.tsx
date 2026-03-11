import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  getAreaManagerDashboardAlerts,
  AreaManagerDashboardAlert,
} from '../../services/areaManagerService';

dayjs.extend(relativeTime);

const RegionAlertsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [alerts, setAlerts] = useState<AreaManagerDashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getAreaManagerDashboardAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const formatAlertTime = (ts: string) => {
    try {
      return dayjs(ts).fromNow();
    } catch {
      return ts;
    }
  };

  const getAlertBorderColor = (type: string) => {
    if (type === 'warning') return COLORS.warning;
    if (type === 'success') return COLORS.success;
    return COLORS.info;
  };

  const getAlertIcon = (type: string) =>
    type === 'warning'
      ? 'warning-outline'
      : type === 'success'
        ? 'checkmark-circle-outline'
        : 'information-circle-outline';
  const getAlertIconColor = (type: string) =>
    type === 'warning' ? COLORS.warning : type === 'success' ? COLORS.success : COLORS.info;

  const renderItem = ({ item, index }: { item: AreaManagerDashboardAlert; index: number }) => (
    <View style={[styles.alertCard, { borderLeftColor: getAlertBorderColor(item.type) }]}>
      <Ionicons
        name={getAlertIcon(item.type) as any}
        size={20}
        color={getAlertIconColor(item.type)}
      />
      <View style={styles.alertContent}>
        <Text style={styles.alertMessage}>{item.message}</Text>
        <Text style={styles.alertTime}>{formatAlertTime(item.timestamp)}</Text>
      </View>
    </View>
  );

  if (loading && alerts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.areaManagerDashboard.regionAlerts')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.areaManagerDashboard.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.areaManagerDashboard.regionAlerts')}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <FlatList
        data={alerts}
        renderItem={renderItem}
        keyExtractor={(_, index) => `alert-${index}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>{t('admin.areaManagerDashboard.noAlerts')}</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
        }
      />
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: { padding: SPACING.sm },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderColor: COLORS.border,
  },
  alertContent: { flex: 1, marginLeft: SPACING.sm },
  alertMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  alertTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
});

export default RegionAlertsScreen;
