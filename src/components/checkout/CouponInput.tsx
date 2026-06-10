import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useCouponStore } from '../../store/couponStore';
import type { CouponApplyContext } from '../../types/coupon';
import type { OrderSummaryData } from '../../services/cartService';

type Props = {
  subtotal: number;
  catalogDiscount?: number;
  currency?: string;
  cartContext?: CouponApplyContext;
  /** Checkout step 2 — ticket-style promo card. */
  variant?: 'default' | 'checkout';
  showDemoHint?: boolean;
  /** Called after POST /shop/coupons/apply succeeds (server order summary if returned). */
  onApplied?: (orderSummary?: OrderSummaryData) => void;
  /** Called when coupon is removed — refresh totals without code. */
  onCleared?: () => void;
};

const CouponInput: React.FC<Props> = ({
  subtotal,
  catalogDiscount = 0,
  currency = 'AED',
  cartContext,
  variant = 'default',
  showDemoHint = true,
  onApplied,
  onCleared,
}) => {
  const { t } = useTranslation();
  const isCheckout = variant === 'checkout';
  const applied = useCouponStore((s) => s.applied);
  const appliedCode = useCouponStore((s) => s.appliedCode);
  const apply = useCouponStore((s) => s.apply);
  const clear = useCouponStore((s) => s.clear);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t('coupon.enterCode', 'Enter a coupon code.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apply(trimmed);
      if (!res.ok) {
        setError(res.message || t('coupon.invalid', 'Invalid coupon.'));
        return;
      }
      setCode('');
      onApplied?.(res.orderSummary);
    } catch {
      setError(t('coupon.loadFailed', 'Could not apply coupon. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => {
    clear();
    setError(null);
    setCode('');
    onCleared?.();
  };

  if (isCheckout) {
    return (
      <View style={styles.checkoutCard}>
          <View style={styles.checkoutHeader}>
            <View style={styles.checkoutIconWrap}>
              <Ionicons name="ticket-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.checkoutHeaderText}>
              <Text style={styles.checkoutTitle}>
                {t('coupon.checkoutTitle', 'Have a promo code?')}
              </Text>
              <Text style={styles.checkoutSubtitle}>
                {t('coupon.checkoutSub', 'Apply your code before payment')}
              </Text>
            </View>
          </View>

          {applied && appliedCode ? (
            <View style={styles.checkoutApplied}>
              <View style={styles.checkoutAppliedBadge}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                <View style={styles.checkoutAppliedText}>
                  <Text style={styles.checkoutAppliedCode}>{appliedCode}</Text>
                  <Text style={styles.checkoutAppliedSaving}>
                    {applied.free_shipping
                      ? t('coupon.freeShippingApplied', 'Free shipping applied')
                      : t('coupon.discountApplied', {
                          defaultValue: 'You save {{amount}} {{currency}}',
                          amount: applied.coupon_discount.toFixed(2),
                          currency,
                        })}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.checkoutRemoveBtn}
                onPress={handleRemove}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.checkoutInputWrap}>
              <TextInput
                style={styles.checkoutInput}
                value={code}
                onChangeText={(text) => {
                  setCode(text);
                  setError(null);
                }}
                placeholder={t('coupon.checkoutPlaceholder', 'e.g. SAVE10')}
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.checkoutApplyBtn, busy && styles.checkoutApplyBtnDisabled]}
                onPress={handleApply}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color={COLORS.background} />
                    <Text style={styles.checkoutApplyText}>
                      {t('coupon.apply', 'Apply')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {error ? (
            <View style={styles.checkoutErrorRow}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
              <Text style={styles.checkoutErrorText}>{error}</Text>
            </View>
          ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('coupon.title', 'Coupon code')}</Text>
      {applied && appliedCode ? (
        <View style={styles.appliedRow}>
          <View style={styles.appliedLeft}>
            <Ionicons name="pricetag" size={18} color={COLORS.primary} />
            <View>
              <Text style={styles.appliedCode}>{appliedCode}</Text>
              <Text style={styles.appliedHint}>
                {applied.free_shipping
                  ? t('coupon.freeShippingApplied', 'Free shipping applied')
                  : t('coupon.discountApplied', {
                      defaultValue: '-{{amount}} {{currency}} off',
                      amount: applied.coupon_discount.toFixed(2),
                      currency,
                    })}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.removeText}>{t('coupon.remove', 'Remove')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setError(null);
            }}
            placeholder={t('coupon.placeholder', 'Enter code')}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.applyBtn, busy && styles.applyBtnDisabled]}
            onPress={handleApply}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Text style={styles.applyBtnText}>{t('coupon.apply', 'Apply')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {showDemoHint && !applied ? (
        <Text style={styles.demoHint}>
          {t('coupon.demoCodes', 'Demo: SAVE10, FLAT20, WELCOME15, FREESHIP')}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  checkoutCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '22',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  checkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  checkoutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  checkoutHeaderText: {
    flex: 1,
  },
  checkoutTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  checkoutSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  checkoutInputWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xs,
  },
  checkoutInput: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    letterSpacing: 1,
  },
  checkoutApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 96,
  },
  checkoutApplyBtnDisabled: {
    opacity: 0.65,
  },
  checkoutApplyText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.sm,
  },
  checkoutApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    padding: SPACING.md,
  },
  checkoutAppliedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  checkoutAppliedText: {
    flex: 1,
  },
  checkoutAppliedCode: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  checkoutAppliedSaving: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  checkoutRemoveBtn: {
    padding: SPACING.xs,
  },
  checkoutErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  checkoutErrorText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
  },
  wrap: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 72,
    alignItems: 'center',
  },
  applyBtnDisabled: {
    opacity: 0.6,
  },
  applyBtnText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary + '12',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    padding: SPACING.md,
  },
  appliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  appliedCode: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  appliedHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  removeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    fontWeight: FONT_WEIGHTS.medium,
  },
  errorText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  demoHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});

export default CouponInput;
