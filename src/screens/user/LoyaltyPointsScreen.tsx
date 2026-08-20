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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { useIsAuthenticated } from '../../store';
import { navigateToClientAuth } from '../../navigation/clientAuthNavigation';
import {
  getClientLoyaltyCampaigns,
  getClientLoyaltyDashboard,
  redeemClientLoyaltyReward,
  LoyaltyCampaign,
  LoyaltyDashboard,
  LoyaltyReward,
  LoyaltyTransaction,
} from '../../services/loyaltyService';

const ACTIVITY_LABEL_KEYS: Record<string, string> = {
  shop_orders: 'loyaltyPoints.activities.shopOrders',
  service_orders: 'loyaltyPoints.activities.serviceOrders',
  memberships: 'loyaltyPoints.activities.memberships',
  referrals: 'loyaltyPoints.activities.referrals',
  reviews: 'loyaltyPoints.activities.reviews',
};

const LoyaltyPointsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const isAuthenticated = useIsAuthenticated();
  const [dashboard, setDashboard] = useState<LoyaltyDashboard | null>(null);
  const [campaigns, setCampaigns] = useState<LoyaltyCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);

  const loadLoyalty = useCallback(
    async (refresh = false) => {
      if (!isAuthenticated) {
        setDashboard(null);
        setCampaigns([]);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [loyaltyDashboard, campaignsResult] = await Promise.all([
          getClientLoyaltyDashboard(),
          getClientLoyaltyCampaigns().catch(() => ({
            summary: { total: 0, live: 0, topBoost: '' },
            campaigns: [] as LoyaltyCampaign[],
          })),
        ]);
        setDashboard(loyaltyDashboard);
        setCampaigns(
          Array.isArray(campaignsResult?.campaigns) ? campaignsResult.campaigns : []
        );
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : err instanceof Error
              ? err.message
              : undefined;
        setError(
          message ||
            t('loyaltyPoints.loadFailed', { defaultValue: 'Unable to load loyalty points.' })
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated, t]
  );

  useFocusEffect(
    useCallback(() => {
      loadLoyalty();
    }, [loadLoyalty])
  );

  const loyaltyPoints = dashboard?.points ?? 0;
  const availableRewards = Array.isArray(dashboard?.rewards) ? dashboard.rewards : [];
  const activeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const recentTransactions = Array.isArray(dashboard?.transactions)
    ? dashboard.transactions
    : [];
  const redeemableCount = availableRewards.filter((r) => r.canRedeem).length;
  const topBoost = activeCampaigns.reduce(
    (max, campaign) => Math.max(max, campaign.multiplier || 0),
    0
  );

  const activityLabel = useCallback(
    (key: string) => {
      const i18nKey = ACTIVITY_LABEL_KEYS[key];
      if (i18nKey) {
        return t(i18nKey, {
          defaultValue: key.replace(/_/g, ' '),
        });
      }
      return key.replace(/_/g, ' ');
    },
    [t]
  );

  const redeemReward = useCallback(
    async (reward: LoyaltyReward) => {
      setRedeemingRewardId(reward.id);
      try {
        const result = await redeemClientLoyaltyReward(reward.id);
        await loadLoyalty(true);
        Alert.alert(t('common.success', { defaultValue: 'Success' }), result.message);
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
    },
    [loadLoyalty, t]
  );

  const confirmRedeem = useCallback(
    (reward: LoyaltyReward) => {
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
    },
    [redeemReward, t]
  );

  const renderCampaign = ({ item }: { item: LoyaltyCampaign }) => {
    const activityText = item.activities.map(activityLabel).filter(Boolean).join(' · ');
    const detail = item.subtitle || item.notes;
    return (
      <View style={styles.campaignCard}>
        <View style={styles.campaignTop}>
          <View style={styles.campaignIconWrap}>
            <Ionicons name="flash" size={22} color={COLORS.background} />
          </View>
          <View style={styles.campaignTextCol}>
            <Text style={styles.campaignTitle}>{item.title}</Text>
            {detail ? (
              <Text style={styles.campaignNotes} numberOfLines={2}>
                {detail}
              </Text>
            ) : null}
          </View>
          <View style={styles.boostBadge}>
            <Text style={styles.boostBadgeText}>
              {item.multiplier > 1 ? `${item.multiplier}×` : item.boostLabel}
            </Text>
          </View>
        </View>

        <View style={styles.campaignMetaRow}>
          {item.statusLabel ? (
            <View style={[styles.campaignMetaPill, styles.campaignStatusPill]}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.primary} />
              <Text style={styles.campaignMetaText}>{item.statusLabel}</Text>
            </View>
          ) : null}
          {item.dateRange ? (
            <View style={styles.campaignMetaPill}>
              <Ionicons name="calendar-outline" size={13} color={COLORS.primary} />
              <Text style={styles.campaignMetaText}>{item.dateRange}</Text>
            </View>
          ) : null}
          {item.cities ? (
            <View style={styles.campaignMetaPill}>
              <Ionicons name="location-outline" size={13} color={COLORS.primary} />
              <Text style={styles.campaignMetaText} numberOfLines={1}>
                {item.cities}
              </Text>
            </View>
          ) : null}
        </View>

        {activityText ? (
          <Text style={styles.campaignActivities} numberOfLines={2}>
            {t('loyaltyPoints.appliesTo', {
              defaultValue: 'Applies to: {{activities}}',
              activities: activityText,
            })}
          </Text>
        ) : !detail ? (
          <Text style={styles.campaignActivities}>
            {t('loyaltyPoints.earnFaster', {
              defaultValue: 'Earn points faster while this boost is live.',
            })}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderReward = ({ item }: { item: LoyaltyReward }) => {
    const locked = !item.canRedeem;
    return (
      <View style={[styles.rewardCard, item.canRedeem && styles.rewardCardReady]}>
        <View style={styles.rewardTop}>
          <View style={[styles.rewardIconWrap, item.canRedeem && styles.rewardIconWrapReady]}>
            <Ionicons
              name={item.canRedeem ? 'gift' : 'gift-outline'}
              size={22}
              color={item.canRedeem ? COLORS.background : COLORS.primary}
            />
          </View>
          <View style={styles.rewardTextCol}>
            <Text style={styles.rewardName}>{item.title}</Text>
            <Text style={styles.rewardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          {item.canRedeem ? (
            <View style={styles.readyBadge}>
              <Text style={styles.readyBadgeText}>
                {t('loyaltyPoints.ready', { defaultValue: 'Ready' })}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.rewardFooter}>
          <View style={styles.pointsPill}>
            <Ionicons name="diamond-outline" size={14} color={COLORS.primary} />
            <Text style={styles.rewardPoints}>
              {item.pointsRequired} {t('common.points')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.redeemButton, item.canRedeem && styles.redeemButtonActive]}
            disabled={locked || redeemingRewardId !== null}
            onPress={() => confirmRedeem(item)}
            activeOpacity={0.85}
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
    );
  };

  const renderTransaction = ({ item }: { item: LoyaltyTransaction }) => {
    const earned = item.type === 'earned';
    return (
      <View style={styles.transactionItem}>
        <View style={[styles.transactionIcon, earned ? styles.txEarn : styles.txSpend]}>
          <Ionicons
            name={earned ? 'trending-up' : 'trending-down'}
            size={18}
            color={earned ? COLORS.primary : COLORS.error}
          />
        </View>
        <View style={styles.transactionContent}>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.transactionDate}>{item.date}</Text>
        </View>
        <Text style={[styles.transactionPoints, { color: earned ? COLORS.primary : COLORS.error }]}>
          {earned ? '+' : ''}
          {item.points}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header title={t('loyaltyPoints.title')} showBack />

      {!isAuthenticated ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="log-in-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.errorText}>
            {t('loyaltyPoints.loginToView', {
              defaultValue: 'Log in to see your loyalty points.',
            })}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigateToClientAuth(navigation)}
          >
            <Text style={styles.retryText}>{t('auth.login', 'Log in')}</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && !dashboard ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="alert-circle-outline" size={36} color={COLORS.error} />
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadLoyalty()}>
            <Text style={styles.retryText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadLoyalty(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Hero balance */}
          <View style={styles.heroCard}>
            <View style={styles.heroDecorA} />
            <View style={styles.heroDecorB} />
            <View style={styles.heroIconRing}>
              <Ionicons name="diamond" size={28} color={COLORS.background} />
            </View>
            <Text style={styles.heroEyebrow}>{t('loyaltyPoints.yourPoints')}</Text>
            <Text style={styles.heroValue}>{loyaltyPoints.toLocaleString()}</Text>
            <Text style={styles.heroUnit}>{t('common.points')}</Text>
            <Text style={styles.heroHint}>
              {dashboard?.earnInfo || t('loyaltyPoints.earnInfo')}
            </Text>
            <View style={styles.heroChips}>
              <View style={styles.heroChip}>
                <Ionicons name="gift-outline" size={14} color={COLORS.background} />
                <Text style={styles.heroChipText}>
                  {t('loyaltyPoints.rewardsAvailable', {
                    defaultValue: '{{count}} rewards',
                    count: availableRewards.length,
                  })}
                </Text>
              </View>
              <View style={styles.heroChip}>
                <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.background} />
                <Text style={styles.heroChipText}>
                  {t('loyaltyPoints.readyToRedeem', {
                    defaultValue: '{{count}} ready',
                    count: redeemableCount,
                  })}
                </Text>
              </View>
              {topBoost > 1 ? (
                <View style={styles.heroChip}>
                  <Ionicons name="flash-outline" size={14} color={COLORS.background} />
                  <Text style={styles.heroChipText}>
                    {t('loyaltyPoints.boostLive', {
                      defaultValue: '{{multiplier}}× live',
                      multiplier: topBoost,
                    })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Active campaigns — always visible so users see boosts / empty state */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('loyaltyPoints.activeCampaigns', {
                  defaultValue: 'Active boosts',
                })}
              </Text>
              <View style={styles.sectionCountBadge}>
                <Text style={styles.sectionCountText}>{activeCampaigns.length}</Text>
              </View>
            </View>
            {activeCampaigns.length > 0 ? (
              <FlatList
                data={activeCampaigns}
                renderItem={renderCampaign}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="flash-outline" size={28} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>
                  {t('loyaltyPoints.noCampaigns', {
                    defaultValue:
                      'No active point boosts right now. New campaigns from admin will show here.',
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* Rewards */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('loyaltyPoints.availableRewards')}</Text>
              <View style={styles.sectionCountBadge}>
                <Text style={styles.sectionCountText}>{availableRewards.length}</Text>
              </View>
            </View>
            {availableRewards.length ? (
              <FlatList
                data={availableRewards}
                renderItem={renderReward}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="gift-outline" size={28} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>
                  {t('loyaltyPoints.noRewards', { defaultValue: 'No rewards are available yet.' })}
                </Text>
              </View>
            )}
          </View>

          {/* Transactions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('loyaltyPoints.recentTransactions')}</Text>
            </View>
            {recentTransactions.length ? (
              <View style={styles.txCard}>
                <FlatList
                  data={recentTransactions}
                  renderItem={renderTransaction}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={28} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>
                  {t('loyaltyPoints.noTransactions', {
                    defaultValue: 'No loyalty transactions yet.',
                  })}
                </Text>
              </View>
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
    backgroundColor: COLORS.surfaceLight,
  },
  scroll: {
    paddingBottom: SPACING.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  errorText: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
  },
  retryText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  heroDecorA: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primaryLight + '55',
    top: -50,
    right: -40,
  },
  heroDecorB: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.primaryDark + '40',
    bottom: -40,
    left: -30,
  },
  heroIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroEyebrow: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  heroValue: {
    fontSize: 42,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    letterSpacing: -1,
  },
  heroUnit: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: SPACING.sm,
  },
  heroHint: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  heroChipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.medium,
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    flex: 1,
  },
  sectionCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionCountText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  campaignCard: {
    backgroundColor: COLORS.primary + '08',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
  },
  campaignTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  campaignIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  campaignTextCol: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  campaignTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  campaignNotes: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  boostBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 44,
    alignItems: 'center',
  },
  boostBadgeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  campaignMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  campaignMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxWidth: '100%',
  },
  campaignStatusPill: {
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '12',
  },
  campaignMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
    flexShrink: 1,
  },
  campaignActivities: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  rewardCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  rewardCardReady: {
    borderColor: COLORS.primary + '55',
    backgroundColor: COLORS.primary + '08',
  },
  rewardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  rewardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  rewardIconWrapReady: {
    backgroundColor: COLORS.primary,
  },
  rewardTextCol: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  rewardName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  readyBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  readyBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    textTransform: 'uppercase',
  },
  rewardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  rewardPoints: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  redeemButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 110,
    alignItems: 'center',
  },
  redeemButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  redeemButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  redeemButtonTextActive: {
    color: COLORS.background,
  },
  txCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  txEarn: {
    backgroundColor: COLORS.primary + '14',
  },
  txSpend: {
    backgroundColor: COLORS.error + '14',
  },
  transactionContent: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  transactionDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  transactionPoints: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
});

export default LoyaltyPointsScreen;
