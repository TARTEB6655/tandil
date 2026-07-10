import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Button } from '../common/Button';

export type StaffLoginShellProps = {
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;
  badge?: string;
  title: string;
  subtitle: string;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string | null;
  emailLabel?: string;
  emailPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  forgotPasswordLabel?: string;
  onForgotPassword?: () => void;
  signInLabel?: string;
  signingInLabel?: string;
  backLabel?: string;
  infoText?: string;
  footer?: React.ReactNode;
};

export function StaffLoginShell({
  icon,
  accent = COLORS.primary,
  badge,
  title,
  subtitle,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onBack,
  isLoading = false,
  error,
  emailLabel = 'Email',
  emailPlaceholder = 'Enter your email',
  passwordLabel = 'Password',
  passwordPlaceholder = 'Enter your password',
  forgotPasswordLabel = 'Forgot Password?',
  onForgotPassword,
  signInLabel = 'Sign In',
  signingInLabel = 'Signing In...',
  backLabel = 'Back to roles',
  infoText,
  footer,
}: StaffLoginShellProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surfaceLight} />
      <View style={[styles.decorTop, { backgroundColor: accent + '12' }]} />
      <View style={styles.decorBottom} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backChip} onPress={onBack} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={18} color={accent} />
            <Text style={[styles.backChipText, { color: accent }]}>{backLabel}</Text>
          </TouchableOpacity>

          <View style={styles.hero}>
            <View style={[styles.iconGlow, { backgroundColor: accent + '18' }]} />
            <View style={[styles.iconCard, { borderColor: accent + '30' }]}>
              <View style={[styles.iconInner, { backgroundColor: accent + '16' }]}>
                <Ionicons name={icon} size={36} color={accent} />
              </View>
            </View>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: accent + '14' }]}>
                <Text style={[styles.badgeText, { color: accent }]}>{badge}</Text>
              </View>
            ) : null}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.formCard}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>{emailLabel}</Text>
            <View style={styles.inputWrap}>
              <View style={[styles.inputIcon, { backgroundColor: accent + '12' }]}>
                <Ionicons name="mail-outline" size={18} color={accent} />
              </View>
              <TextInput
                style={styles.input}
                placeholder={emailPlaceholder}
                value={email}
                onChangeText={onEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <Text style={styles.label}>{passwordLabel}</Text>
            <View style={styles.inputWrap}>
              <View style={[styles.inputIcon, { backgroundColor: accent + '12' }]}>
                <Ionicons name="lock-closed-outline" size={18} color={accent} />
              </View>
              <TextInput
                style={styles.input}
                placeholder={passwordPlaceholder}
                value={password}
                onChangeText={onPasswordChange}
                secureTextEntry={!showPassword}
                placeholderTextColor={COLORS.textSecondary}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {onForgotPassword ? (
              <TouchableOpacity style={styles.forgotBtn} onPress={onForgotPassword}>
                <Text style={[styles.forgotText, { color: accent }]}>{forgotPasswordLabel}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.forgotSpacer} />
            )}

            <Button
              title={isLoading ? signingInLabel : signInLabel}
              onPress={onSubmit}
              loading={isLoading}
              disabled={isLoading}
              style={styles.loginButton}
            />

            {infoText ? (
              <View style={styles.infoBox}>
                <Ionicons name="shield-checkmark-outline" size={18} color={accent} />
                <Text style={styles.infoText}>{infoText}</Text>
              </View>
            ) : null}

            {footer}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  flex: { flex: 1 },
  decorTop: {
    position: 'absolute',
    top: -90,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  decorBottom: {
    position: 'absolute',
    bottom: 60,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.secondary + '0C',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  backChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  iconGlow: {
    position: 'absolute',
    top: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  iconCard: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.sm,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  formCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.error + '12',
    borderWidth: 1,
    borderColor: COLORS.error + '40',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
    minHeight: 52,
  },
  inputIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    paddingVertical: SPACING.sm,
  },
  eyeBtn: {
    padding: SPACING.xs,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotSpacer: {
    height: SPACING.sm,
  },
  forgotText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  loginButton: {
    marginBottom: SPACING.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
