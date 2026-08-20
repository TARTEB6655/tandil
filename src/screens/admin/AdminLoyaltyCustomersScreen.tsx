import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { adminLoyaltyService } from '../../services/adminLoyaltyService';
import type { AdminLoyaltyCustomer } from '../../types/adminLoyalty';

const AdminLoyaltyCustomersScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [customers, setCustomers] = useState<AdminLoyaltyCustomer[]>([]);
  const [summary, setSummary] = useState({ visible: 0, points_pool: 0, holders: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async (q: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await adminLoyaltyService.listCustomers(q);
      setCustomers(list);
      // Use real summary only when not searching (so counts reflect full dataset)
      if (!q) {
        const s = await adminLoyaltyService.listCustomersSummary();
        setSummary(s);
      } else {
        setSummary({ visible: list.length, points_pool: list.reduce((acc, c) => acc + c.points_balance, 0), holders: list.filter((c) => c.points_balance > 0).length });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(searchQuery);
    }, [load, searchQuery])
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const renderItem = ({ item }: { item: AdminLoyaltyCustomer }) => {
    const hasPoints = item.points_balance > 0;
    const accent = hasPoints ? COLORS.success : COLORS.textSecondary;
    const badgeBg = hasPoints ? COLORS.success + '18' : COLORS.border + '40';
    const photoUrl = item.profile_picture_url?.trim() || null;

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: hasPoints ? COLORS.success + '30' : COLORS.border }]}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('AdminLoyaltyCustomerDetail', {
            userId: item.id,
            profilePictureUrl: photoUrl,
          })
        }
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconCircle, { backgroundColor: badgeBg }]}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <Ionicons name={hasPoints ? 'star' : 'person-outline'} size={18} color={accent} />
            )}
          </View>

          <View style={styles.cardTopText}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {item.email}
            </Text>
          </View>

          <View style={[styles.pointsBadge, { backgroundColor: badgeBg, borderColor: accent + '35' }]}>
            <View style={styles.pointsTopRow}>
              <Ionicons name="flash-outline" size={14} color={accent} />
              <Text style={[styles.pointsValue, { color: accent }]}>{item.points_balance.toLocaleString()}</Text>
            </View>
            <Text style={[styles.pointsUnit, { color: accent }]}>
              {t('admin.loyalty.customers.pts', 'pts')}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.city || t('admin.loyalty.customers.noCity', 'No city')}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} style={styles.metaChevron} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.loyalty.customers.title', 'Loyalty customers')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={t(
            'admin.loyalty.customers.searchPlaceholder',
            'Search name, email, or phone'
          )}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            customers.length === 0 && styles.listEmpty,
          ]}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Ionicons name="people-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.heroTitle}>
                {t('admin.loyalty.customers.heroTitle', 'Track your most engaged customers')}
              </Text>
              <Text style={styles.heroSubtitle}>
                {t(
                  'admin.loyalty.customers.heroSubtitle',
                  'Search balances fast, spot repeat redeemers, and open any customer ledger in one tap.'
                )}
              </Text>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <View style={[styles.statIcon, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '22' }]}>
                    <Ionicons name="eye-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.heroStatValue}>{summary.visible}</Text>
                  <Text style={styles.heroStatLabel}>
                    {t('admin.loyalty.customers.totalShort', 'Visible')}
                  </Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <View style={[styles.statIcon, { backgroundColor: COLORS.success + '12', borderColor: COLORS.success + '22' }]}>
                    <Ionicons name="flash-outline" size={16} color={COLORS.success} />
                  </View>
                  <Text style={styles.heroStatValue}>{summary.points_pool.toLocaleString()}</Text>
                  <Text style={styles.heroStatLabel}>
                    {t('admin.loyalty.customers.pointsPool', 'Points pool')}
                  </Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <View style={[styles.statIcon, { backgroundColor: COLORS.error + '12', borderColor: COLORS.error + '22' }]}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.error} />
                  </View>
                  <Text style={styles.heroStatValue}>{summary.holders}</Text>
                  <Text style={styles.heroStatLabel}>
                    {t('admin.loyalty.customers.holdersShort', 'Holders')}
                  </Text>
                </View>
              </View>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(searchQuery, true)}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={[styles.emptyIcon, { backgroundColor: COLORS.primary + '14' }]}>
                <Ionicons name="people-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('admin.loyalty.customers.empty', 'No customers found')}</Text>
              <Text style={styles.emptySub}>
                {t('admin.loyalty.customers.emptyHint', 'Try clearing search or check the backend data.')}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '18',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: SPACING.xs,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  heroStatLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    paddingVertical: 4,
  },
  list: { padding: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xxl },
  listEmpty: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
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
  emptySub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    gap: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    flexDirection: 'column',
  },
  cardLeft: { justifyContent: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  name: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  email: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cityText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  cardRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  cardTopText: { flex: 1 },
  pointsBadge: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    alignItems: 'center',
    minWidth: 92,
  },
  pointsTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pointsValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
  },
  pointsUnit: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginTop: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    flex: 1,
    marginRight: SPACING.sm,
  },
  metaText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, flex: 1 },
  metaChevron: { marginRight: 2 },

  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

export default AdminLoyaltyCustomersScreen;
