import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { adminLoyaltyService } from '../../services/adminLoyaltyService';
import { type AdminLoyaltyReward } from '../../types/adminLoyalty';

const REWARD_ICONS = ['gift-outline', 'star-outline', 'ribbon-outline', 'trophy-outline', 'diamond-outline'] as const;
const REWARD_GRADIENTS = [
  { bg: '#FFF7ED', accent: '#F97316', badge: '#FED7AA' },
  { bg: '#F0FDF4', accent: '#22C55E', badge: '#BBF7D0' },
  { bg: '#EFF6FF', accent: '#3B82F6', badge: '#BFDBFE' },
  { bg: '#FDF4FF', accent: '#A855F7', badge: '#E9D5FF' },
  { bg: '#FFF1F2', accent: '#F43F5E', badge: '#FECDD3' },
];

function getCardTheme(id: number) {
  return REWARD_GRADIENTS[id % REWARD_GRADIENTS.length];
}
function getCardIcon(id: number) {
  return REWARD_ICONS[id % REWARD_ICONS.length];
}

const AdminLoyaltyRewardsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [rewards, setRewards] = useState<AdminLoyaltyReward[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, starts_at: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await adminLoyaltyService.listRewards();
      setRewards(list);
      const active = list.filter((r) => r.is_active).length;
      const startsAt = list.length ? Math.min(...list.map((r) => r.points_required)) : 0;
      setSummary({ total: list.length, active, starts_at: startsAt });
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        err?.message || t('admin.loyalty.rewards.loadFailed', 'Failed to load rewards.')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const formatCustomers = (item: AdminLoyaltyReward) => {
    if (item.customer_targeting === 'specific' && item.specific_customers?.length) {
      return item.specific_customers.join(', ');
    }
    return item.customer_targeting_label || t('admin.loyalty.groups.all', 'All customers');
  };

  const onToggleActive = async (item: AdminLoyaltyReward, value: boolean) => {
    if (togglingId != null) return;
    setTogglingId(item.id);
    const prev = rewards;
    setRewards((list) => list.map((r) => (r.id === item.id ? { ...r, is_active: value } : r)));
    try {
      await adminLoyaltyService.toggleReward(item.id, value);
    } catch {
      setRewards(prev);
      Alert.alert(t('admin.users.error', 'Error'), t('admin.loyalty.rewards.toggleFailed', 'Failed to update reward.'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (item: AdminLoyaltyReward) => {
    Alert.alert(
      t('admin.loyalty.rewards.deleteTitle', 'Delete reward?'),
      t('admin.loyalty.rewards.deleteMessage', 'Delete "{{title}}"? This cannot be undone.').replace('{{title}}', item.title),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await adminLoyaltyService.deleteReward(item.id);
              setRewards((list) => list.filter((r) => r.id !== item.id));
            } catch (err: any) {
              Alert.alert(t('admin.users.error', 'Error'), err?.message || t('admin.loyalty.rewards.deleteFailed', 'Failed to delete reward.'));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AdminLoyaltyReward }) => {
    const theme = getCardTheme(item.id);
    const icon = getCardIcon(item.id);
    const citiesSummary = item.cities || t('admin.loyalty.rewards.allCities', 'All cities');

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.accent + '30' }]}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('AdminLoyaltyRewardForm', { rewardId: item.id })}
      >
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={[styles.iconCircle, { backgroundColor: theme.accent + '18' }]}>
            <Ionicons name={icon} size={22} color={theme.accent} />
          </View>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {!!item.description && (
              <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.is_active ? theme.badge : COLORS.border }]}>
            <View style={[styles.statusDot, { backgroundColor: item.is_active ? theme.accent : COLORS.textSecondary }]} />
            <Text style={[styles.statusText, { color: item.is_active ? theme.accent : COLORS.textSecondary }]}>
              {item.is_active ? t('admin.loyalty.rewards.active', 'Active') : t('admin.loyalty.rewards.inactive', 'Inactive')}
            </Text>
          </View>
        </View>

        {/* Points badge */}
        <View style={[styles.pointsBadge, { backgroundColor: theme.accent + '14' }]}>
          <Ionicons name="flash" size={14} color={theme.accent} />
          <Text style={[styles.pointsText, { color: theme.accent }]}>
            {item.points_required.toLocaleString()} {t('admin.loyalty.rewards.pts', 'pts required')}
          </Text>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{citiesSummary}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="people-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{formatCustomers(item)}</Text>
          </View>
          {item.expires_at && (
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{item.expires_at}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={[styles.cardFooter, { borderTopColor: theme.accent + '20' }]}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('admin.loyalty.rewards.enable', 'Enabled')}</Text>
            <Switch
              value={item.is_active}
              onValueChange={(v) => onToggleActive(item, v)}
              disabled={togglingId === item.id}
              trackColor={{ false: COLORS.border, true: theme.accent + '50' }}
              thumbColor={item.is_active ? theme.accent : COLORS.background}
            />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.primary + '12' }]}
              onPress={() => navigation.navigate('AdminLoyaltyRewardForm', { rewardId: item.id })}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>
                {t('common.edit', 'Edit')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.error + '12' }]}
              onPress={() => handleDelete(item)}
              disabled={deletingId === item.id}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  <Text style={[styles.actionBtnText, { color: COLORS.error }]}>
                    {t('common.delete', 'Delete')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.loyalty.rewards.title', 'Rewards')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AdminLoyaltyRewardForm')}
          >
            <Ionicons name="add" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={rewards}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, rewards.length === 0 && styles.listEmpty]}
          ListHeaderComponent={
            <View style={styles.heroCard}>
              {/* Hero top */}
              <View style={styles.heroTop}>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="gift" size={26} color={COLORS.primary} />
                </View>
                <TouchableOpacity
                  style={styles.heroAddButton}
                  onPress={() => navigation.navigate('AdminLoyaltyRewardForm')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.heroAddText}>
                    {t('admin.loyalty.rewards.add', 'Add reward')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.heroTitle}>
                {t('admin.loyalty.rewards.heroTitle', 'Rewards that feel worth earning')}
              </Text>
              <Text style={styles.heroSubtitle}>
                {t(
                  'admin.loyalty.rewards.heroSubtitle',
                  'Create offers, control availability, and keep redemption options fresh for every customer segment.'
                )}
              </Text>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="layers-outline" size={16} color="#3B82F6" />
                  </View>
                  <Text style={styles.statValue}>{summary.total}</Text>
                  <Text style={styles.statLabel}>{t('admin.loyalty.rewards.totalRewards', 'Total')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#22C55E" />
                  </View>
                  <Text style={styles.statValue}>{summary.active}</Text>
                  <Text style={styles.statLabel}>{t('admin.loyalty.rewards.activeShort', 'Active')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: '#FFF7ED' }]}>
                    <Ionicons name="flash-outline" size={16} color="#F97316" />
                  </View>
                  <Text style={styles.statValue}>{summary.starts_at}</Text>
                  <Text style={styles.statLabel}>{t('admin.loyalty.rewards.startingAt', 'Starts at')}</Text>
                </View>
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="gift-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('admin.loyalty.rewards.empty', 'No rewards yet')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('admin.loyalty.rewards.emptyHint', 'Tap "Add reward" to create your first reward.')}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('AdminLoyaltyRewardForm')}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>{t('admin.loyalty.rewards.add', 'Add reward')}</Text>
              </TouchableOpacity>
            </View>
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  addBtn: { padding: SPACING.xs },
  list: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  listEmpty: { flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* Hero card */
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '18',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  heroAddText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: '#fff' },
  heroTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, textAlign: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: COLORS.border },

  /* Reward card */
  card: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleBlock: { flex: 1 },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  cardDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    flexShrink: 0,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },

  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  pointsText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.bold },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  metaText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, maxWidth: 100 },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
    borderTopWidth: 1,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  toggleLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: SPACING.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  actionBtnText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },

  /* Empty state */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
  },
  emptyBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: '#fff' },
});

export default AdminLoyaltyRewardsScreen;
