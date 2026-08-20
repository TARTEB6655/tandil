import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { adminLoyaltyService } from '../../services/adminLoyaltyService';
import type {
  AdminLoyaltyCustomerDetail,
  AdminLoyaltyLedgerItem,
  LoyaltyLedgerType,
} from '../../types/adminLoyalty';

const ledgerColor = (type: LoyaltyLedgerType): string => {
  switch (type) {
    case 'earn':
    case 'adjust_add':
      return COLORS.success;
    case 'redeem':
    case 'adjust_deduct':
      return COLORS.error;
    case 'expire':
      return COLORS.warning;
    default:
      return COLORS.textSecondary;
  }
};

const AdminLoyaltyCustomerDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const userId = Number(route.params?.userId);
  const routePhotoUrl =
    typeof route.params?.profilePictureUrl === 'string'
      ? route.params.profilePictureUrl.trim()
      : null;

  const [detail, setDetail] = useState<AdminLoyaltyCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setLoading(false);
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const data = await adminLoyaltyService.getCustomerDetail(userId);
      setDetail(data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAdjust = async () => {
    const pts = Number(amount);
    if (!Number.isFinite(pts) || pts === 0) {
      Alert.alert(
        t('admin.loyalty.customerDetail.invalidTitle', 'Check amount'),
        t(
          'admin.loyalty.customerDetail.invalidAmount',
          'Enter a non-zero amount. Use negative to deduct.'
        )
      );
      return;
    }
    setApplying(true);
    try {
      const next = await adminLoyaltyService.adjustCustomerPoints(
        userId,
        Math.trunc(pts),
        reason.trim()
      );
      if (next) {
        setDetail(next);
        setAmount('');
        setReason('');
        Alert.alert(
          t('admin.users.success', 'Success'),
          t('admin.loyalty.customerDetail.adjusted', 'Points updated.')
        );
      }
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        err?.message ||
          t('admin.loyalty.customerDetail.adjustFailed', 'Failed to adjust points.')
      );
    } finally {
      setApplying(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const typeLabel = (type: LoyaltyLedgerType) => {
    const map: Record<LoyaltyLedgerType, [string, string]> = {
      earn: ['admin.loyalty.ledger.earn', 'Earn'],
      redeem: ['admin.loyalty.ledger.redeem', 'Redeem'],
      adjust_add: ['admin.loyalty.ledger.adjustAdd', 'Credit'],
      adjust_deduct: ['admin.loyalty.ledger.adjustDeduct', 'Deduct'],
      expire: ['admin.loyalty.ledger.expire', 'Expire'],
    };
    const [key, def] = map[type] || ['admin.loyalty.ledger.other', type];
    return t(key, def);
  };

  const renderLedger = ({ item }: { item: AdminLoyaltyLedgerItem }) => {
    const color = ledgerColor(item.type);
    const sign = item.points > 0 ? '+' : '';
    return (
      <View style={styles.ledgerRow}>
        <View style={[styles.ledgerDot, { backgroundColor: color }]} />
        <View style={styles.ledgerBody}>
          <Text style={styles.ledgerReason} numberOfLines={2}>
            {item.reason}
          </Text>
          <Text style={styles.ledgerMeta}>
            {typeLabel(item.type)} · {formatDate(item.created_at)}
            {item.admin_name ? ` · ${item.admin_name}` : ''}
          </Text>
        </View>
        <View style={[styles.pointsPill, { backgroundColor: color + '12', borderColor: color + '30' }]}>
          <Text style={[styles.pointsPillText, { color }]}>
            {sign}
            {item.points}
          </Text>
        </View>
      </View>
    );
  };

  const ListHeader = () => {
    if (!detail) return null;
    const photoUrl = detail.profile_picture_url?.trim() || routePhotoUrl || null;
    return (
      <View>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroAvatar}>
              {photoUrl ? (
                <Image
                  source={{ uri: photoUrl }}
                  style={styles.heroAvatarImage}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <Ionicons name="person-outline" size={18} color={COLORS.background} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName} numberOfLines={1}>
                {detail.name}
              </Text>
              <Text style={styles.heroEmail} numberOfLines={1}>
                {detail.email}
              </Text>
            </View>
          </View>
          {detail.city ? (
            <View style={styles.heroCityRow}>
              <Ionicons name="location-outline" size={14} color={'rgba(255,255,255,0.85)'} />
              <Text style={styles.heroCity} numberOfLines={1}>
                {detail.city}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="wallet-outline" size={16} color={COLORS.primary} />
            <Text style={styles.statValue}>{detail.points_balance}</Text>
            <Text style={styles.statLabel}>
              {t('admin.loyalty.customerDetail.balance', 'Balance')}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="arrow-up-circle-outline" size={16} color={COLORS.success} />
            <Text style={[styles.statValue, { color: COLORS.success }]}>
              {detail.lifetime_earned}
            </Text>
            <Text style={styles.statLabel}>
              {t('admin.loyalty.customerDetail.lifetimeEarned', 'Earned')}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="arrow-down-circle-outline" size={16} color={COLORS.error} />
            <Text style={[styles.statValue, { color: COLORS.error }]}>
              {detail.lifetime_redeemed}
            </Text>
            <Text style={styles.statLabel}>
              {t('admin.loyalty.customerDetail.lifetimeRedeemed', 'Redeemed')}
            </Text>
          </View>
        </View>

        <View style={styles.adjustCard}>
          <Text style={styles.sectionTitle}>
            {t('admin.loyalty.customerDetail.manualAdjust', 'Manual adjust')}
          </Text>
          <Text style={styles.hint}>
            {t(
              'admin.loyalty.customerDetail.adjustHint',
              'Positive to credit, negative to deduct.'
            )}
          </Text>
          <Text style={styles.fieldLabel}>
            {t('admin.loyalty.customerDetail.amount', 'Amount (+/−)')}
          </Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numbers-and-punctuation"
            placeholder="50 or -20"
            placeholderTextColor={COLORS.textSecondary}
          />
          <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>
            {t('admin.loyalty.customerDetail.reason', 'Reason')}
          </Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder={t(
              'admin.loyalty.customerDetail.reasonPlaceholder',
              'Optional note'
            )}
            placeholderTextColor={COLORS.textSecondary}
          />
          <Button
            title={t('admin.loyalty.customerDetail.apply', 'Apply')}
            onPress={handleAdjust}
            loading={applying}
            style={{ marginTop: SPACING.md }}
            size="small"
          />
        </View>

        <View style={styles.ledgerTitleRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.primary} />
          <Text style={styles.ledgerTitle}>
            {t('admin.loyalty.customerDetail.ledger', 'Points history')}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.loyalty.customerDetail.title', 'Customer points')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      {loading && !detail ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : !detail ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.emptyText}>
            {t('admin.loyalty.customerDetail.notFound', 'Customer not found')}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            data={detail.ledger}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderLedger}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyLedger}>
                {t('admin.loyalty.customerDetail.noLedger', 'No ledger entries yet.')}
              </Text>
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  list: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  heroAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  heroName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  heroEmail: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  heroCityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  heroCity: { fontSize: FONT_SIZES.sm, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  adjustCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  hint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  ledgerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginLeft: 2,
  },
  ledgerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  ledgerDot: { width: 8, height: 8, borderRadius: 4 },
  ledgerBody: { flex: 1 },
  ledgerReason: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  ledgerMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pointsPill: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsPillText: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold },
  emptyLedger: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});

export default AdminLoyaltyCustomerDetailScreen;
