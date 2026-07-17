import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import {
  getClientLoyaltyDashboard,
  redeemClientLoyaltyReward,
  LoyaltyDashboard,
  LoyaltyReward,
  LoyaltyTransaction,
} from '../../services/loyaltyService';

const LoyaltyPointsScreen: React.FC = () => {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<LoyaltyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);

  const loadLoyalty = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setDashboard(await getClientLoyaltyDashboard());
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
            ? err.message
            : undefined;
      setError(message || t('loyaltyPoints.loadFailed', { defaultValue: 'Unable to load loyalty points.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadLoyalty();
    }, [loadLoyalty])
  );

  const loyaltyPoints = dashboard?.points ?? 0;
  const availableRewards = dashboard?.rewards ?? [];
  const recentTransactions = dashboard?.transactions ?? [];

  const redeemReward = useCallback(async (reward: LoyaltyReward) => {
    setRedeemingRewardId(reward.id);
    try {
      const result = await redeemClientLoyaltyReward(reward.id);
      await loadLoyalty(true);
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        result.message
      );
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
            ? err.message
            : undefined;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        message ||
          t('loyaltyPoints.redeemFailed', {
            defaultValue: 'Unable to redeem this reward.',
          })
      );
    } finally {
      setRedeemingRewardId(null);
    }
  }, [loadLoyalty, t]);

  const confirmRedeem = useCallback((reward: LoyaltyReward) => {
    Alert.alert(
      t('loyaltyPoints.redeem', { defaultValue: 'Redeem' }),
      t('loyaltyPoints.redeemConfirmation', {
        defaultValue: `Redeem ${reward.title} for ${reward.pointsRequired} points?`,
        reward: reward.title,
        points: reward.pointsRequired,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('loyaltyPoints.redeem', { defaultValue: 'Redeem' }),
          onPress: () => redeemReward(reward),
        },
      ]
    );
  }, [redeemReward, t]);

  const renderReward = ({ item }: { item: LoyaltyReward }) => (
    <TouchableOpacity style={styles.rewardCard}>
      <View style={styles.rewardContent}>
        <Text style={styles.rewardName}>{item.title}</Text>
        <Text style={styles.rewardDescription}>{item.description}</Text>
        <View style={styles.rewardFooter}>
          <Text style={styles.rewardPoints}>
            {item.pointsRequired} {t('common.points')}
          </Text>
          <TouchableOpacity
            style={[
              styles.redeemButton,
              item.canRedeem && styles.redeemButtonActive,
            ]}
            disabled={!item.canRedeem || redeemingRewardId !== null}
            onPress={() => confirmRedeem(item)}
          >
            {redeemingRewardId === item.id ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Text
                style={[
                  styles.redeemButtonText,
                  item.canRedeem && styles.redeemButtonTextActive,
                ]}
              >
                {item.canRedeem
                  ? t('loyaltyPoints.redeem')
                  : t('loyaltyPoints.notEnoughPoints')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTransaction = ({ item }: { item: LoyaltyTransaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionIcon}>
        <Ionicons
          name={item.type === 'earned' ? 'add-circle' : 'remove-circle'}
          size={24}
          color={item.type === 'earned' ? COLORS.success : COLORS.error}
        />
      </View>
      <View style={styles.transactionContent}>
        <Text style={styles.transactionDescription}>{item.description}</Text>
        <Text style={styles.transactionDate}>{item.date}</Text>
      </View>
      <Text
        style={[
          styles.transactionPoints,
          { color: item.type === 'earned' ? COLORS.success : COLORS.error },
        ]}
      >
        {item.type === 'earned' ? '+' : ''}
        {item.points}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title={t('loyaltyPoints.title')}
        showBack
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && !dashboard ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={44} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadLoyalty()}>
            <Text style={styles.retryText}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadLoyalty(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          <View style={styles.pointsCard}>
            <View style={styles.pointsHeader}>
              <Ionicons name="star" size={32} color={COLORS.warning} />
              <Text style={styles.pointsTitle}>{t('loyaltyPoints.yourPoints')}</Text>
            </View>
            <Text style={styles.pointsValue}>{loyaltyPoints}</Text>
            <Text style={styles.pointsDescription}>
              {dashboard?.earnInfo || t('loyaltyPoints.earnInfo')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('loyaltyPoints.availableRewards')}</Text>
            {availableRewards.length ? (
              <FlatList
                data={availableRewards}
                renderItem={renderReward}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.emptyText}>
                {t('loyaltyPoints.noRewards', { defaultValue: 'No rewards are available yet.' })}
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('loyaltyPoints.recentTransactions')}</Text>
            {recentTransactions.length ? (
              <FlatList
                data={recentTransactions}
                renderItem={renderTransaction}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.emptyText}>
                {t('loyaltyPoints.noTransactions', {
                  defaultValue: 'No loyalty transactions yet.',
                })}
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  pointsCard: {
    backgroundColor: COLORS.primary,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  pointsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
    marginLeft: SPACING.sm,
  },
  pointsValue: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: SPACING.sm,
  },
  pointsDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.background,
    opacity: 0.9,
    textAlign: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  rewardCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  rewardContent: {
    flex: 1,
  },
  rewardName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  rewardDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  rewardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardPoints: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  redeemButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  redeemButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  redeemButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  redeemButtonTextActive: {
    color: COLORS.background,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  transactionIcon: {
    marginRight: SPACING.md,
  },
  transactionContent: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  transactionDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  transactionPoints: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
});

export default LoyaltyPointsScreen;
