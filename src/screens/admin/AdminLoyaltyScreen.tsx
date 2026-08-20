import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { adminLoyaltyService } from '../../services/adminLoyaltyService';
import type { AdminLoyaltyControlCenter } from '../../types/adminLoyalty';

type HubItem = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  defaultTitle: string;
  subtitleKey: string;
  defaultSubtitle: string;
  route: string;
  tint: string;
};

const HUB_ITEMS: HubItem[] = [
  {
    icon: 'settings-outline',
    titleKey: 'admin.loyalty.hub.settings',
    defaultTitle: 'System settings',
    subtitleKey: 'admin.loyalty.hub.settingsHint',
    defaultSubtitle: 'Enable loyalty, points per AED, eligibility & expiry',
    route: 'AdminLoyaltySettings',
    tint: COLORS.primary,
  },
  {
    icon: 'gift-outline',
    titleKey: 'admin.loyalty.hub.rewards',
    defaultTitle: 'Rewards',
    subtitleKey: 'admin.loyalty.hub.rewardsHint',
    defaultSubtitle: 'Create, edit, enable/disable reward catalog',
    route: 'AdminLoyaltyRewards',
    tint: '#2d7541',
  },
  {
    icon: 'people-outline',
    titleKey: 'admin.loyalty.hub.customers',
    defaultTitle: 'Customers',
    subtitleKey: 'admin.loyalty.hub.customersHint',
    defaultSubtitle: 'Balances, history, and manual point adjustments',
    route: 'AdminLoyaltyCustomers',
    tint: '#6D4C41',
  },
  {
    icon: 'flash-outline',
    titleKey: 'admin.loyalty.hub.campaigns',
    defaultTitle: 'Campaigns',
    subtitleKey: 'admin.loyalty.hub.campaignsHint',
    defaultSubtitle: 'Double / triple points promotional periods',
    route: 'AdminLoyaltyCampaigns',
    tint: '#E0A100',
  },
  {
    icon: 'bar-chart-outline',
    titleKey: 'admin.loyalty.hub.reports',
    defaultTitle: 'Reports & export',
    subtitleKey: 'admin.loyalty.hub.reportsHint',
    defaultSubtitle: 'Analytics and CSV export',
    route: 'AdminLoyaltyReports',
    tint: '#2B8AE0',
  },
];

const AdminLoyaltyScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [controlCenter, setControlCenter] = useState<AdminLoyaltyControlCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await adminLoyaltyService.getControlCenter();
      setControlCenter(data);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        t('admin.loyalty.loadFailed', 'Failed to load loyalty dashboard.');
      Alert.alert(t('admin.users.error', 'Error'), message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onToggleSystem = async (value: boolean) => {
    if (!controlCenter || toggling) return;
    setToggling(true);
    const previous = controlCenter;
    setControlCenter({
      ...controlCenter,
      loyalty_system_enabled: value,
      status: value ? 'Active' : 'Paused',
      status_label: value
        ? 'Active - customers can earn and redeem'
        : 'Disabled - earning and redeeming paused',
    });
    try {
      const next = await adminLoyaltyService.toggleLoyaltySystem(value);
      setControlCenter(next);
    } catch (err: any) {
      setControlCenter(previous);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        t('admin.loyalty.toggleFailed', 'Failed to update loyalty system.');
      Alert.alert(t('admin.users.error', 'Error'), message);
    } finally {
      setToggling(false);
    }
  };

  const enabled = !!controlCenter?.loyalty_system_enabled;
  const statusText = controlCenter?.status
    ? controlCenter.status
    : enabled
      ? t('admin.loyalty.statusActive', 'Active')
      : t('admin.loyalty.statusPaused', 'Paused');
  const statusLabel =
    controlCenter?.status_label ||
    (enabled
      ? t('admin.loyalty.systemOn', 'Active — customers can earn and redeem')
      : t('admin.loyalty.systemOff', 'Disabled — earning and redeeming paused'));

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.loyalty.title', 'Loyalty Points')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[COLORS.primary]}
          />
        }
      >
        {loading && !controlCenter ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.heroDecorA} />
              <View style={styles.heroDecorB} />
              <View style={styles.heroTopRow}>
                <View style={styles.heroIcon}>
                  <Ionicons name="diamond" size={26} color={COLORS.background} />
                </View>
                <View style={[styles.statusPill, enabled ? styles.statusOn : styles.statusOff]}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: enabled ? '#7CF29A' : '#F5C6C6' },
                    ]}
                  />
                  <Text style={styles.statusText}>{statusText}</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>
                {t('admin.loyalty.heroTitle', 'Loyalty control center')}
              </Text>
              <Text style={styles.heroSubtitle}>
                {t(
                  'admin.loyalty.heroSubtitle',
                  'Configure earning, rewards, campaigns, and customer points.'
                )}
              </Text>
            </View>

            <View style={styles.toggleCard}>
              <View style={styles.toggleIcon}>
                <Ionicons
                  name={enabled ? 'toggle' : 'toggle-outline'}
                  size={22}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleTitle}>
                  {t('admin.loyalty.systemEnabled', 'Loyalty system')}
                </Text>
                <Text style={styles.toggleSubtitle}>{statusLabel}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={onToggleSystem}
                disabled={toggling || loading}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={enabled ? COLORS.primary : COLORS.background}
              />
            </View>

            {controlCenter ? (
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <View style={styles.statIcon}>
                    <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.statValue}>{controlCenter.points_per_aed}</Text>
                  <Text style={styles.statLabel}>
                    {t('admin.loyalty.statPointsPerAed', 'Points / AED')}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <View style={styles.statIcon}>
                    <Ionicons name="list-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.statValue}>{controlCenter.activities}</Text>
                  <Text style={styles.statLabel}>
                    {t('admin.loyalty.statActivities', 'Activities')}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <View style={styles.statIcon}>
                    <Ionicons name="time-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.statValue}>
                    {controlCenter.expiry_months ?? '—'}
                  </Text>
                  <Text style={styles.statLabel}>
                    {t('admin.loyalty.statExpiryMonths', 'Expiry (mo)')}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>{t('admin.loyalty.manage', 'Manage')}</Text>
            <View style={styles.menuGrid}>
              {HUB_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={styles.menuCard}
                  onPress={() => navigation.navigate(item.route)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.tint + '18' }]}>
                    <Ionicons name={item.icon} size={22} color={item.tint} />
                  </View>
                  <Text style={styles.menuTitle}>{t(item.titleKey, item.defaultTitle)}</Text>
                  <Text style={styles.menuSubtitle} numberOfLines={2}>
                    {t(item.subtitleKey, item.defaultSubtitle)}
                  </Text>
                  <View style={styles.menuGo}>
                    <Text style={styles.menuGoText}>{t('common.open', 'Open')}</Text>
                    <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
      },
      android: { elevation: 5 },
    }),
  },
  heroDecorA: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primaryLight + '44',
    top: -40,
    right: -30,
  },
  heroDecorB: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryDark + '33',
    bottom: -30,
    left: -20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusOn: { backgroundColor: 'rgba(124,242,154,0.2)' },
  statusOff: { backgroundColor: 'rgba(245,198,198,0.25)' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  toggleLeft: { flex: 1, paddingRight: SPACING.sm },
  toggleTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  toggleSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
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
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  menuCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  menuTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: SPACING.sm,
    minHeight: 32,
  },
  menuGo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuGoText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
});

export default AdminLoyaltyScreen;
