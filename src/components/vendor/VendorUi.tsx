import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';

export const VENDOR_SCREEN_BG = COLORS.surfaceLight;

export function VendorHeroBanner({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <View style={ui.hero}>
      <View style={ui.heroDecor1} />
      <View style={ui.heroDecor2} />
      <View style={ui.heroContent}>
        {badge ? (
          <View style={ui.heroBadge}>
            <Ionicons name="storefront" size={14} color={COLORS.background} />
            <Text style={ui.heroBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={ui.heroTitle}>{title}</Text>
        {subtitle ? <Text style={ui.heroSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function VendorPageHeader({
  title,
  subtitle,
  actionLabel,
  actionIcon = 'add',
  onAction,
  onBack,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
  onBack?: () => void;
}) {
  return (
    <View style={ui.pageHeader}>
      {onBack ? (
        <TouchableOpacity style={ui.backBtn} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
      ) : null}
      <View style={[ui.pageHeaderText, onBack && ui.pageHeaderTextWithBack]}>
        <Text style={ui.pageTitle}>{title}</Text>
        {subtitle ? <Text style={ui.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {onAction && actionLabel ? (
        <TouchableOpacity style={ui.headerAction} onPress={onAction} activeOpacity={0.85}>
          <Ionicons name={actionIcon as any} size={18} color={COLORS.background} />
          <Text style={ui.headerActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function VendorSectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={ui.sectionTitleRow}>
      <Text style={ui.sectionTitle}>{title}</Text>
      {action ? <Text style={ui.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function VendorCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export function VendorMenuRow({
  icon,
  iconColor = COLORS.primary,
  iconBg,
  title,
  subtitle,
  onPress,
  showChevron = true,
}: {
  icon: string;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
}) {
  return (
    <TouchableOpacity style={ui.menuRow} onPress={onPress} activeOpacity={0.85}>
      <View style={[ui.menuIcon, { backgroundColor: iconBg ?? iconColor + '18' }]}>
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>
      <View style={ui.menuText}>
        <Text style={ui.menuTitle}>{title}</Text>
        {subtitle ? <Text style={ui.menuSubtitle}>{subtitle}</Text> : null}
      </View>
      {showChevron ? (
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      ) : null}
    </TouchableOpacity>
  );
}

export function VendorStatTile({
  label,
  value,
  icon,
  accent = COLORS.primary,
  wide,
}: {
  label: string;
  value: string | number;
  icon: string;
  accent?: string;
  wide?: boolean;
}) {
  return (
    <View style={[ui.statTile, wide && ui.statTileWide, { borderLeftColor: accent }]}>
      <View style={[ui.statIconWrap, { backgroundColor: accent + '16' }]}>
        <Ionicons name={icon as any} size={20} color={accent} />
      </View>
      <Text style={ui.statValue}>{value}</Text>
      <Text style={ui.statLabel}>{label}</Text>
    </View>
  );
}

export function VendorQuickAction({
  title,
  icon,
  color,
  onPress,
}: {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={ui.quickAction} onPress={onPress} activeOpacity={0.88}>
      <View style={[ui.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={26} color={color} />
      </View>
      <Text style={ui.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );
}

const ui = StyleSheet.create({
  hero: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  heroDecor1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -30,
  },
  heroDecor2: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -20,
    left: -20,
  },
  heroContent: { zIndex: 1 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.sm,
  },
  heroBadgeText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  pageHeaderText: { flex: 1, marginRight: SPACING.md },
  pageHeaderTextWithBack: { marginRight: SPACING.sm },
  pageTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  pageSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
  },
  headerActionText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  sectionAction: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuText: { flex: 1 },
  menuTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  menuSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statTile: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    marginBottom: SPACING.sm,
  },
  statTileWide: { width: '100%' },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  quickAction: {
    width: '47%',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  quickActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
  },
});
