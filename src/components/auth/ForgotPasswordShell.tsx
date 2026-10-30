import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { FORGOT_PASSWORD_UI_PREVIEW } from '../../config/forgotPassword';

type Props = {
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  step: 1 | 2 | 3;
  title: string;
  subtitle: string;
  onBack: () => void;
  backLabel: string;
  /** e.g. "Client" — shows which portal `roles` is sent for. */
  portalLabel?: string;
  children: React.ReactNode;
};

export function ForgotPasswordShell({
  accent,
  icon,
  step,
  title,
  subtitle,
  onBack,
  backLabel,
  portalLabel,
  children,
}: Props) {
  const { t } = useTranslation();
  const steps = [1, 2, 3] as const;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surfaceLight} />
      <View style={[styles.decorTop, { backgroundColor: accent + '0F' }]} />
      <View style={[styles.decorBlob, { backgroundColor: accent + '08' }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backChip} onPress={onBack} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={20} color={accent} />
            <Text style={[styles.backChipText, { color: accent }]}>{backLabel}</Text>
          </TouchableOpacity>

          <View style={styles.stepRow}>
            {steps.map((n, index) => (
              <React.Fragment key={n}>
                <View
                  style={[
                    styles.stepDot,
                    n === step && styles.stepDotCurrent,
                    n < step && { backgroundColor: accent, borderColor: accent },
                    n === step && { borderColor: accent, backgroundColor: accent },
                  ]}
                >
                  {n < step ? (
                    <Ionicons name="checkmark" size={14} color={COLORS.background} />
                  ) : (
                    <Text
                      style={[
                        styles.stepDotText,
                        (n === step || n < step) && styles.stepDotTextActive,
                      ]}
                    >
                      {n}
                    </Text>
                  )}
                </View>
                {index < steps.length - 1 ? (
                  <View
                    style={[
                      styles.stepLine,
                      n < step && { backgroundColor: accent },
                    ]}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </View>

          <View style={styles.hero}>
            <View style={[styles.iconRing, { borderColor: accent + '35' }]}>
              <View style={[styles.iconInner, { backgroundColor: accent + '14' }]}>
                <Ionicons name={icon} size={34} color={accent} />
              </View>
            </View>
            {portalLabel ? (
              <View style={[styles.portalBadge, { backgroundColor: accent + '14' }]}>
                <Text style={[styles.portalBadgeText, { color: accent }]}>{portalLabel}</Text>
              </View>
            ) : null}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {FORGOT_PASSWORD_UI_PREVIEW ? (
            <View style={[styles.previewPill, { borderColor: accent + '40' }]}>
              <Ionicons name="eye-outline" size={16} color={accent} />
              <Text style={[styles.previewPillText, { color: accent }]}>
                {t('auth.forgotReset.uiPreviewHint')}
              </Text>
            </View>
          ) : null}

          <View style={styles.formCard}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surfaceLight },
  flex: { flex: 1 },
  decorTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  decorBlob: {
    position: 'absolute',
    top: 40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.xs,
    gap: 2,
  },
  backChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    maxWidth: 280,
    alignSelf: 'center',
    width: '100%',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotCurrent: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  stepDotText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textSecondary,
  },
  stepDotTextActive: {
    color: COLORS.background,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
    borderRadius: 1,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  portalBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.sm,
  },
  portalBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: SPACING.sm,
    maxWidth: 340,
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.md,
  },
  previewPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  formCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
});
