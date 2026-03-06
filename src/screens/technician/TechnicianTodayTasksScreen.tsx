import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import {
  getTechnicianTasks,
  acceptTechnicianTask,
  rejectTechnicianTask,
  TechnicianTodayTask,
  type GetTechnicianTasksResult,
} from '../../services/technicianService';

function mapTaskToJob(task: TechnicianTodayTask) {
  const status = (task.status ?? 'pending').toLowerCase().replace(/\s+/g, '_');
  const durationStr =
    task.duration_minutes != null
      ? `${task.duration_minutes} min`
      : (task.estimated_duration ?? task.estimatedDuration ?? '—');
  const price = task.price;
  const priceDisplay = task.price_display ?? (price != null && Number(price) >= 0 ? `AED ${Number(price).toFixed(2)}` : undefined);
  return {
    id: String(task.id),
    customerName: task.farm_name ?? task.customer_name ?? task.customerName ?? '—',
    service: task.service_name ?? task.service ?? '—',
    address: task.location ?? task.address ?? '—',
    scheduledTime: task.scheduled_time ?? task.scheduledTime ?? '—',
    status,
    estimatedDuration: durationStr,
    priceDisplay,
  };
}

const PER_PAGE = 15;

const TechnicianTodayTasksScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [result, setResult] = useState<GetTechnicianTasksResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadTasks = useCallback(
    async (page: number = 1, append: boolean = false) => {
      if (page === 1 && !append) setLoading(true);
      else if (append) setLoadingMore(true);
      else setRefreshing(true);
      try {
        const data = await getTechnicianTasks('today', page, PER_PAGE);
        setResult(prev => {
          if (append && prev && page > 1) {
            return {
              ...data,
              list: [...prev.list, ...data.list],
            };
          }
          return data;
        });
      } catch {
        if (!append) setResult(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadTasks(1);
    }, [loadTasks])
  );

  const handleLoadMore = () => {
    if (!result?.nextPageUrl || loadingMore || result.currentPage >= result.lastPage) return;
    loadTasks(result.currentPage + 1, true);
  };

  const jobs = (result?.list ?? []).map(mapTaskToJob);

  const renderJob = ({ item }: { item: any }) => (
    <View style={styles.jobCard}>
      <TouchableOpacity
        style={styles.jobContent}
        onPress={() => navigation.navigate('JobDetail', { orderId: item.id })}
      >
        <View style={styles.jobHeader}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.status === 'in_progress'
                    ? COLORS.primary + '20'
                    : item.status === 'accepted'
                    ? COLORS.info + '20'
                    : item.status === 'pending' || item.status === 'pending_acceptance'
                    ? COLORS.warning + '20'
                    : COLORS.textSecondary + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.jobStatusText,
                {
                  color:
                    item.status === 'in_progress'
                      ? COLORS.primary
                      : item.status === 'accepted'
                      ? COLORS.info
                      : item.status === 'pending' || item.status === 'pending_acceptance'
                      ? COLORS.warning
                      : COLORS.textSecondary,
                },
              ]}
            >
              {item.status === 'in_progress'
                ? t('technician.status.inProgress')
                : item.status === 'accepted'
                ? t('technician.status.accepted')
                : item.status === 'pending' || item.status === 'pending_acceptance'
                ? (t('technician.status.pending_acceptance', { defaultValue: 'Pending acceptance' }))
                : t('technician.status.assigned')}
            </Text>
          </View>
        </View>

        <Text style={styles.serviceName}>{item.service}</Text>
        <Text style={styles.jobAddress}>{item.address}</Text>

        <View style={styles.jobFooter}>
          <View style={styles.jobInfo}>
            <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.jobInfoText}>{item.scheduledTime}</Text>
          </View>
          <View style={styles.jobInfo}>
            <Ionicons name="timer-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.jobInfoText}>
              {typeof item.estimatedDuration === 'string' && item.estimatedDuration.endsWith(' min')
                ? item.estimatedDuration.replace(' min', '') + ' ' + t('technician.min')
                : item.estimatedDuration}
            </Text>
          </View>
          {item.priceDisplay != null && (
            <View style={styles.jobInfo}>
              <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
              <Text style={styles.jobPriceText}>{item.priceDisplay}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {(item.status === 'pending' || item.status === 'pending_acceptance') && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => {
              Alert.alert(t('technician.acceptJob'), t('technician.acceptJobConfirm', { name: item.customerName }), [
                { text: t('technician.cancel'), style: 'cancel' },
                {
                  text: t('technician.accept'),
                  onPress: async () => {
                    try {
                      const result = await acceptTechnicianTask(item.id);
                      if (result.success) {
                        loadTasks(1);
                        Alert.alert(t('technician.acceptJob'), result.message ?? t('technician.jobAccepted'), [{ text: t('technician.ok') }]);
                      } else {
                        Alert.alert(t('technician.error'), result.message ?? t('technician.failedAccept'));
                      }
                    } catch {
                      Alert.alert(t('technician.error'), t('technician.failedAccept') + ' ' + t('technician.tryAgain'));
                    }
                  },
                },
              ]);
            }}
          >
            <Ionicons name="checkmark" size={16} color={COLORS.background} />
            <Text style={styles.actionButtonText}>{t('technician.accept')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              Alert.alert(t('technician.rejectJob'), t('technician.rejectJobConfirm', { name: item.customerName }), [
                { text: t('technician.cancel'), style: 'cancel' },
                {
                  text: t('technician.reject'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const result = await rejectTechnicianTask(item.id, 'Not available');
                      if (result.success) {
                        loadTasks(1);
                        Alert.alert(t('technician.rejectJob'), result.message ?? t('technician.jobRejected'), [{ text: t('technician.ok') }]);
                      } else {
                        Alert.alert(t('technician.error'), result.message ?? t('technician.failedReject'));
                      }
                    } catch {
                      Alert.alert(t('technician.error'), t('technician.failedReject') + ' ' + t('technician.tryAgain'));
                    }
                  },
                },
              ]);
            }}
          >
            <Ionicons name="close" size={16} color={COLORS.background} />
            <Text style={styles.actionButtonText}>{t('technician.reject')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading && !result) {
    return (
      <View style={styles.container}>
        <Header title={t('technician.todaysTasks')} showBack={true} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('home.loading', 'Loading...')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('technician.todaysTasks')} showBack={true} />
      {jobs.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyStateText}>{t('technician.noTasksForToday')}</Text>
            <Text style={styles.emptyStateSubtext}>{t('technician.noTasksSubtext')}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={jobs}
          renderItem={renderJob}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTasks(1)}
              colors={[COLORS.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  jobCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  jobContent: {
    flex: 1,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  jobStatusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  serviceName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  jobAddress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  jobFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobInfoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  jobPriceText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.error,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.background,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyStateSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  footerLoader: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
});

export default TechnicianTodayTasksScreen;
