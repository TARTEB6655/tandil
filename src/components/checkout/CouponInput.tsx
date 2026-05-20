import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useCouponStore } from '../../store/couponStore';
import type { CouponApplyContext } from '../../types/coupon';

type Props = {
  subtotal: number;
  catalogDiscount?: number;
  currency?: string;
  cartContext?: CouponApplyContext;
  /** Show hint with demo codes (dev/demo builds). */
  showDemoHint?: boolean;
};

const CouponInput: React.FC<Props> = ({
  subtotal,
  catalogDiscount = 0,
  currency = 'AED',
  cartContext,
  showDemoHint = true,
}) => {
  const { t } = useTranslation();
  const applied = useCouponStore((s) => s.applied);
  const appliedCode = useCouponStore((s) => s.appliedCode);
  const apply = useCouponStore((s) => s.apply);
  const clear = useCouponStore((s) => s.clear);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleApply = () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t('coupon.enterCode', 'Enter a coupon code.'));
      return;
    }
    setBusy(true);
    setError(null);
    const res = apply(trimmed, subtotal, catalogDiscount, cartContext);
    setBusy(false);
    if (!res.ok) {
      setError(res.message || t('coupon.invalid', 'Invalid coupon.'));
      return;
    }
    setCode('');
  };

  const handleRemove = () => {
    clear();
    setError(null);
    setCode('');
  };

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
