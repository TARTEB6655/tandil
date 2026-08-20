/**
 * Admin Job Scheduling hub.
 * Entry: Admin → Dashboard / Settings → Job Scheduling
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { getAdminWorkingHours } from '../../services/adminJobSchedulingService';
import { getAdminTimeSlots } from '../../services/adminTimeSlotsService';
import { getAdminBlockedDates } from '../../services/adminBlockedDatesService';
import { isoDateOffset } from '../../services/schedulingMockService';

type HubItem = {
  titleKey: string;
  subtitleKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  tint: string;
};

const LINKS: HubItem[] = [
  {
    titleKey: 'admin.scheduling.hub.hours',
    subtitleKey: 'admin.scheduling.hub.hoursHint',
    icon: 'time-outline',
    route: 'AdminSchedulingSettings',
    tint: COLORS.primary,
  },
  {
    titleKey: 'admin.scheduling.hub.slots',
    subtitleKey: 'admin.scheduling.hub.slotsHint',
    icon: 'grid-outline',
    route: 'AdminSchedulingSlots',
    tint: '#2d7541',
  },
  {
    titleKey: 'admin.scheduling.hub.blocks',
    subtitleKey: 'admin.scheduling.hub.blocksHint',
    icon: 'ban-outline',
    route: 'AdminSchedulingBlocks',
    tint: '#D14343',
  },
  {
    titleKey: 'admin.scheduling.hub.calendar',
    subtitleKey: 'admin.scheduling.hub.calendarHint',
    icon: 'calendar-outline',
    route: 'AdminSchedulingCalendar',
    tint: '#2B8AE0',
  },
];

const AdminSchedulingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [workingDays, setWorkingDays] = useState<number | null>(null);
  const [activeSlots, setActiveSlots] = useState<number | null>(null);
  const [blockCount, setBlockCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [hours, slots, blocks] = await Promise.allSettled([
        getAdminWorkingHours(),
        getAdminTimeSlots(),
        getAdminBlockedDates({ from: isoDateOffset(-7), to: isoDateOffset(90) }),
      ]);
      if (hours.status === 'fulfilled') {
        setWorkingDays(hours.value.workingDays.filter((d) => d.enabled).length);
      }
      if (slots.status === 'fulfilled') {
        setActiveSlots(slots.value.filter((s) => s.enabled).length);
      }
      if (blocks.status === 'fulfilled') {
        setBlockCount(blocks.value.length);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats])
  );

  const stat = (value: number | null) => (value == null ? '—' : String(value));

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.scheduling.title')}
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
            onRefresh={() => void loadStats(true)}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroDecorA} />
          <View style={styles.heroDecorB} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="calendar" size={26} color={COLORS.background} />
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={12} color={COLORS.background} />
              <Text style={styles.heroBadgeText}>{t('admin.scheduling.adminBadge')}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{t('admin.scheduling.heroTitle')}</Text>
          <Text style={styles.heroSubtitle}>{t('admin.scheduling.heroSubtitle')}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.primary + '14' }]}>
              <Ionicons name="sunny-outline" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>{stat(workingDays)}</Text>
            <Text style={styles.statLabel}>{t('admin.scheduling.workingDays')}</Text>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: '#2d7541' + '18' }]}>
              <Ionicons name="time-outline" size={16} color="#2d7541" />
            </View>
            <Text style={styles.statValue}>{stat(activeSlots)}</Text>
            <Text style={styles.statLabel}>{t('admin.scheduling.activeSlots')}</Text>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: '#D14343' + '14' }]}>
              <Ionicons name="ban-outline" size={16} color="#D14343" />
            </View>
            <Text style={styles.statValue}>{stat(blockCount)}</Text>
            <Text style={styles.statLabel}>{t('admin.scheduling.blocked')}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('admin.scheduling.manage')}</Text>
        <View style={styles.menuGrid}>
          {LINKS.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuCard}
              onPress={() => navigation.navigate(item.route)}
              activeOpacity={0.82}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.tint + '18' }]}>
                <Ionicons name={item.icon} size={22} color={item.tint} />
              </View>
              <Text style={styles.menuTitle}>{t(item.titleKey)}</Text>
              <Text style={styles.menuSubtitle} numberOfLines={2}>
                {t(item.subtitleKey)}
              </Text>
              <View style={styles.menuGo}>
                <Text style={[styles.menuGoText, { color: item.tint }]}>{t('common.open')}</Text>
                <Ionicons name="arrow-forward" size={14} color={item.tint} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroBadgeText: {
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
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  },
});

export default AdminSchedulingScreen;
