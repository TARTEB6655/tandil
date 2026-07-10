import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { vendorService, VendorDashboardStats } from '../../services/vendorService';
import { useAppStore } from '../../store';
import {
  VENDOR_SCREEN_BG,
  VendorHeroBanner,
  VendorSectionTitle,
  VendorCard,
  VendorMenuRow,
  VendorStatTile,
  VendorQuickAction,
} from '../../components/vendor/VendorUi';

const { width } = Dimensions.get('window');

const VendorDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const user = useAppStore((s) => s.user);
  const [stats, setStats] = useState<VendorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const storeName = user?.name || t('vendorDashboard.demoStore');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setStats(await vendorService.getDashboardStats());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const quickActions = [
    {
      title: t('vendorDashboard.addProduct'),
      icon: 'add-circle',
      color: COLORS.primary,
      action: () => navigation.navigate('AddProduct'),
    },
    {
      title: t('vendorDashboard.inventory'),
      icon: 'layers',
      color: COLORS.warning,
      action: () => navigation.navigate('Inventory'),
    },
    {
      title: t('vendorDashboard.pricing'),
      icon: 'pricetag',
      color: COLORS.info,
      action: () => navigation.navigate('Pricing'),
    },
    {
      title: t('vendorDashboard.orders'),
      icon: 'receipt',
      color: '#2E7D4F',
      action: () => navigation.navigate('Orders'),
    },
  ];

  const manageOptions = [
    {
      icon: 'cube-outline',
      color: COLORS.primary,
      title: t('vendorTabs.products'),
      subtitle: t('vendorDashboard.manageProducts'),
      onPress: () => navigation.navigate('Products'),
    },
    {
      icon: 'analytics-outline',
      color: COLORS.info,
      title: t('vendorDashboard.analytics'),
      subtitle: t('vendorDashboard.analyticsHint'),
      onPress: () => navigation.navigate('Analytics'),
    },
    {
      icon: 'person-outline',
      color: COLORS.textSecondary,
      title: t('vendorTabs.profile'),
      subtitle: t('vendorDashboard.settingsHint'),
      onPress: () => navigation.navigate('Profile'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={styles.scrollContent}
      >
        <VendorHeroBanner
          badge={t('vendorDashboard.vendorPortal')}
          title={t('vendorDashboard.greeting', { name: storeName })}
          subtitle={t('vendorDashboard.subtitle')}
        />

        {loading ? (
          <ActivityIndicator style={styles.loader} color={COLORS.primary} />
        ) : stats ? (
          <>
            <View style={styles.highlightRow}>
              <View style={[styles.highlightCard, styles.highlightPrimary]}>
                <Ionicons name="cash-outline" size={28} color={COLORS.background} />
                <Text style={styles.highlightValue}>
                  {stats.currency} {Math.round(stats.revenue)}
                </Text>
                <Text style={styles.highlightLabel}>{t('vendorDashboard.revenue')}</Text>
              </View>
              <View style={[styles.highlightCard, styles.highlightAccent]}>
                <Ionicons name="time-outline" size={28} color={COLORS.primary} />
                <Text style={[styles.highlightValue, styles.highlightValueDark]}>
                  {stats.pendingOrders}
                </Text>
                <Text style={[styles.highlightLabel, styles.highlightLabelDark]}>
                  {t('vendorDashboard.pendingOrders')}
                </Text>
              </View>
            </View>

            <VendorSectionTitle title={t('vendorDashboard.overview')} />
            <View style={styles.statsWrap}>
              <VendorStatTile
                label={t('vendorDashboard.totalProducts')}
                value={stats.totalProducts}
                icon="cube-outline"
              />
              <VendorStatTile
                label={t('vendorDashboard.activeProducts')}
                value={stats.activeProducts}
                icon="checkmark-circle-outline"
                accent="#2E7D4F"
              />
              <VendorStatTile
                label={t('vendorDashboard.lowStock')}
                value={stats.lowStockCount}
                icon="warning-outline"
                accent={COLORS.warning}
              />
              <VendorStatTile
                label={t('vendorDashboard.totalOrders')}
                value={stats.totalOrders}
                icon="receipt-outline"
                accent={COLORS.info}
              />
            </View>

            <VendorSectionTitle title={t('vendorDashboard.quickActions')} />
            <View style={styles.quickGrid}>
              {quickActions.map((action) => (
                <VendorQuickAction
                  key={action.title}
                  title={action.title}
                  icon={action.icon}
                  color={action.color}
                  onPress={action.action}
                />
              ))}
            </View>

            <VendorSectionTitle title={t('vendorDashboard.manageStore')} />
            <VendorCard style={styles.menuCard}>
              {manageOptions.map((opt, i) => (
                <View key={opt.title}>
                  <VendorMenuRow {...opt} />
                  {i < manageOptions.length - 1 ? null : (
                    <View style={{ height: 0 }} />
                  )}
                </View>
              ))}
            </VendorCard>

            <VendorCard style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Ionicons name="bulb-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.tipBody}>
                <Text style={styles.tipTitle}>{t('vendorDashboard.gettingStarted')}</Text>
                <Text style={styles.tipText}>{t('vendorDashboard.tipText')}</Text>
              </View>
            </VendorCard>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VENDOR_SCREEN_BG },
  scrollContent: { paddingBottom: SPACING.xxl },
  loader: { marginVertical: SPACING.xxl },
  highlightRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginTop: -SPACING.lg,
    marginBottom: SPACING.lg,
  },
  highlightCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  highlightPrimary: { backgroundColor: COLORS.primary },
  highlightAccent: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  highlightValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginTop: SPACING.sm,
  },
  highlightValueDark: { color: COLORS.text },
  highlightLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  highlightLabelDark: { color: COLORS.textSecondary },
  statsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  menuCard: { paddingVertical: SPACING.xs },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary + '25',
  },
  tipIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipBody: { flex: 1 },
  tipTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  tipText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 20 },
});

export default VendorDashboardScreen;
