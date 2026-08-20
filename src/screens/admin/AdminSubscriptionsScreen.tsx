import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  subscriptionService,
  Subscription,
  getSubscriptionPlanLabel,
  resolveSubscriptionImageUrl,
} from '../../services/subscriptionService';

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString || '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateString || '—';
  }
};

function getTargetLabel(item: Subscription): string {
  const raw = String(item.target_type || item.audience || '').toLowerCase();
  if (raw === 'all_users' || raw === 'all') return 'All users';
  if (raw === 'specific_clients' || raw === 'specific') return 'Specific clients';
  return item.client?.name ? 'Specific clients' : 'All users';
}

function getDisplayName(item: Subscription): string {
  return (
    item.plan_name ||
    item.title ||
    getSubscriptionPlanLabel(String(item.plan || '')) ||
    'Subscription'
  );
}

function getAudienceLine(item: Subscription): string {
  const target = getTargetLabel(item);
  if (target === 'All users') {
    const count = Number(item._groupCount || 0);
    return count > 1
      ? `Visible to every client · ${count} assignments`
      : 'Visible to every client';
  }
  if (item.client?.name) {
    return item.client.email
      ? `${item.client.name} · ${item.client.email}`
      : item.client.name;
  }
  const ids = Array.isArray(item.client_ids) ? item.client_ids : [];
  return ids.length ? `${ids.length} selected clients` : 'Specific clients';
}

function statusColors(status: string): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'paid':
      return { bg: '#E8F5E9', text: COLORS.primary, dot: COLORS.primary };
    case 'pending':
      return { bg: '#FFF8E1', text: '#B45309', dot: COLORS.warning };
    case 'failed':
    case 'cancelled':
      return { bg: '#FEECEC', text: COLORS.error, dot: COLORS.error };
    case 'refunded':
      return { bg: '#EEF2FF', text: '#4338CA', dot: COLORS.info };
    default:
      return { bg: COLORS.surfaceLight, text: COLORS.textSecondary, dot: COLORS.textSecondary };
  }
}

const AdminSubscriptionsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  const stats = useMemo(() => {
    const paid = subscriptions.filter(
      (s) => String(s.payment_status).toLowerCase() === 'paid'
    ).length;
    const allUsers = subscriptions.filter((s) => {
      const t = String(s.target_type || s.audience || '').toLowerCase();
      return t === 'all_users' || t === 'all';
    }).length;
    return { total: subscriptions.length, paid, allUsers };
  }, [subscriptions]);

  const fetchSubscriptions = useCallback(async (showLoading = true) => {
    try {
      setError(null);
      if (showLoading) setLoading(true);
      const response = await subscriptionService.getSubscriptions({
        page: 1,
        per_page: 100,
      });
      setSubscriptions(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || 'Failed to load subscriptions');
      setSubscriptions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchSubscriptions(true);
    }, [fetchSubscriptions])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void fetchSubscriptions(false);
  };

  const handleMenuPress = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setShowMenu(true);
  };

  const handleEdit = () => {
    if (!selectedSubscription) return;
    setShowMenu(false);
    navigation.navigate('EditSubscription' as never, {
      subscription: selectedSubscription,
    } as never);
  };

  const handleDelete = () => {
    if (!selectedSubscription) return;
    const label = getDisplayName(selectedSubscription);
    const groupIds =
      Array.isArray(selectedSubscription._groupIds) && selectedSubscription._groupIds.length > 0
        ? selectedSubscription._groupIds
        : [selectedSubscription.id];
    const count = groupIds.length;
    Alert.alert(
      'Delete Subscription',
      count > 1
        ? `Delete "${label}" and all ${count} related all-users assignments? This cannot be undone.`
        : `Are you sure you want to delete "${label}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setShowMenu(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setShowMenu(false);
            try {
              // Delete every expanded all_users row so the plan disappears fully
              for (const id of groupIds) {
                await subscriptionService.deleteSubscription(id);
              }
              Alert.alert('Success', 'Subscription deleted successfully');
              void fetchSubscriptions(false);
            } catch (err: unknown) {
              const ax = err as { response?: { data?: { message?: string } }; message?: string };
              Alert.alert(
                'Error',
                ax.response?.data?.message ||
                  ax.message ||
                  'Failed to delete subscription.'
              );
            }
          },
        },
      ]
    );
  };

  const renderSubscription = ({ item }: { item: Subscription }) => {
    const planName = getDisplayName(item);
    const pictureUri = resolveSubscriptionImageUrl(
      item.picture_url || item.image_url,
      (typeof item.picture === 'string' ? item.picture : null) ||
        (typeof item.image === 'string' ? item.image : null)
    );
    const status = String(item.payment_status || 'pending').toLowerCase();
    const colors = statusColors(status);
    const target = getTargetLabel(item);
    const isAllUsers = target === 'All users';
    const visitsTotal = Number(item.total_visits ?? 0);
    const visitsDone = Number(item.completed_visits ?? 0);
    const visitsPct =
      visitsTotal > 0 ? Math.min(100, Math.round((visitsDone / visitsTotal) * 100)) : 0;

    return (
      <View style={styles.card}>
        {/* Media / accent */}
        {pictureUri ? (
          <View style={styles.cardMedia}>
            <Image source={{ uri: pictureUri }} style={styles.cardImage} contentFit="cover" />
            <View style={styles.mediaOverlay} />
            <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.dot }]} />
              <Text style={[styles.statusPillText, { color: colors.text }]}>{status}</Text>
            </View>
            <TouchableOpacity
              style={styles.mediaMore}
              onPress={() => handleMenuPress(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardAccentBar}>
            <View style={[styles.statusPillInline, { backgroundColor: colors.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.dot }]} />
              <Text style={[styles.statusPillText, { color: colors.text }]}>{status}</Text>
            </View>
            <TouchableOpacity
              style={styles.plainMore}
              onPress={() => handleMenuPress(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <View style={styles.leafIcon}>
              <Ionicons name="leaf" size={16} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planTitle} numberOfLines={1}>
                {planName}
              </Text>
              {item.subtitle ? (
                <Text style={styles.planSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
            <Text style={styles.price}>AED {item.amount}</Text>
          </View>

          <View style={styles.chipsRow}>
            <View style={[styles.chip, isAllUsers ? styles.chipAll : styles.chipSpecific]}>
              <Ionicons
                name={isAllUsers ? 'globe-outline' : 'person-outline'}
                size={13}
                color={isAllUsers ? COLORS.primary : '#8B5E3C'}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: isAllUsers ? COLORS.primary : '#8B5E3C' },
                ]}
              >
                {target}
              </Text>
            </View>
            <View style={styles.chipMuted}>
              <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.chipMutedText}>
                {getSubscriptionPlanLabel(String(item.plan || ''))}
              </Text>
            </View>
          </View>

          <Text style={styles.audienceLine} numberOfLines={1}>
            {getAudienceLine(item)}
          </Text>

          <View style={styles.footerStrip}>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Start</Text>
              <Text style={styles.footerValue}>{formatDate(String(item.start_date || ''))}</Text>
            </View>
            <View style={styles.footerDivider} />
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>End</Text>
              <Text style={styles.footerValue}>{formatDate(String(item.end_date || ''))}</Text>
            </View>
            {visitsTotal > 0 ? (
              <>
                <View style={styles.footerDivider} />
                <View style={styles.footerItem}>
                  <Text style={styles.footerLabel}>Visits</Text>
                  <Text style={styles.footerValue}>
                    {visitsDone}/{visitsTotal}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {visitsTotal > 0 ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${visitsPct}%` }]} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={[styles.hero, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.heroTop}>
          <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroBtn}
            onPress={() => navigation.navigate('AdminAddSubscription')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Subscriptions</Text>
        <Text style={styles.heroSubtitle}>Manage membership plans for your clients</Text>

        {!loading && !error ? (
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.paid}</Text>
              <Text style={styles.statLabel}>Paid</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.allUsers}</Text>
              <Text style={styles.statLabel}>All users</Text>
            </View>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading subscriptions…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle" size={36} color={COLORS.error} />
          </View>
          <Text style={styles.errorTitle}>Couldn’t load list</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void fetchSubscriptions()}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={subscriptions}
          renderItem={renderSubscription}
          keyExtractor={(item, index) =>
            item?.id != null ? `sub-${item.id}` : `sub-fallback-${index}`
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="leaf-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No subscriptions yet</Text>
              <Text style={styles.emptyBody}>
                Create a plan for all users or specific clients to get started.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.navigate('AdminAddSubscription')}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyCtaText}>Add subscription</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal
        transparent
        visible={showMenu}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle} numberOfLines={1}>
              {selectedSubscription ? getDisplayName(selectedSubscription) : 'Actions'}
            </Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <View style={[styles.menuIcon, { backgroundColor: COLORS.primary + '15' }]}>
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.menuItemText}>Edit subscription</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <View style={[styles.menuIcon, { backgroundColor: COLORS.error + '15' }]}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </View>
              <Text style={[styles.menuItemText, { color: COLORS.error }]}>Delete</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surfaceLight },
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.md,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(28,75,39,0.08)',
    shadowColor: '#0F2513',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardMedia: {
    height: 140,
    backgroundColor: COLORS.primary + '22',
  },
  cardImage: { width: '100%', height: '100%' },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,37,19,0.18)',
  },
  cardAccentBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  statusPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: {
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  mediaMore: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainMore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  leafIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  planSubtitle: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  price: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipAll: { backgroundColor: COLORS.primary + '14' },
  chipSpecific: { backgroundColor: '#F3E9E0' },
  chipText: { fontSize: 11, fontWeight: FONT_WEIGHTS.semiBold },
  chipMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceLight,
  },
  chipMutedText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  audienceLine: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  footerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  footerItem: { flex: 1, alignItems: 'center' },
  footerLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  footerValue: {
    marginTop: 3,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  footerDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  progressWrap: { marginTop: 2 },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  stateText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  retryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  emptyBody: {
    marginTop: 6,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyCtaText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,37,19,0.45)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.sm,
  },
  menuHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  menuTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
});

export default AdminSubscriptionsScreen;
