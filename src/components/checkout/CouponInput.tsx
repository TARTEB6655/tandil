import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useCouponStore } from '../../store/couponStore';
import type { CouponApplyContext } from '../../types/coupon';
import type { OrderSummaryData } from '../../services/cartService';
import {
  browseCouponsForCheckout,
  type BrowseCouponsResult,
} from '../../services/shopCouponService';
import { shopService } from '../../services/shopService';
import {
  formatCartCategoryHint,
  listCheckoutCouponOffers,
  type CheckoutCouponOffer,
} from '../../utils/couponAvailability';

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
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [categoryNames, setCategoryNames] = useState<Map<number, string>>(new Map());
  const [offersModalVisible, setOffersModalVisible] = useState(false);
  const [browseResult, setBrowseResult] = useState<BrowseCouponsResult>({
    coupons: [],
    eligible: [],
    ineligible: [],
    fromApi: false,
  });

  const loadBrowseOffers = useCallback(async () => {
    setCatalogLoading(true);
    setError(null);
    try {
      const [result, cats] = await Promise.all([
        browseCouponsForCheckout(cartContext, subtotal),
        shopService.getProductCategories().catch(() => []),
      ]);
      setBrowseResult(result);
      const map = new Map<number, string>();
      (cats ?? []).forEach((c: { id?: number; name?: string }) => {
        const id = Number(c.id);
        if (!Number.isNaN(id) && id > 0 && c.name) map.set(id, c.name);
      });
      setCategoryNames(map);

      if (!result.fromApi) {
        setError(
          t(
            'coupon.loadFailed',
            'Could not load offers from server. Sign in and try again.'
          )
        );
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        t('coupon.loadFailed', 'Could not load offers.');
      setError(msg);
      setBrowseResult({ coupons: [], eligible: [], ineligible: [], fromApi: false });
    } finally {
      setCatalogLoading(false);
    }
  }, [cartContext, subtotal, t]);

  useEffect(() => {
    if (!isCheckout) return;
    loadBrowseOffers();
  }, [isCheckout, loadBrowseOffers]);

  useEffect(() => {
    if (!isCheckout || !offersModalVisible) return;
    loadBrowseOffers();
  }, [isCheckout, offersModalVisible, loadBrowseOffers]);

  const { eligible: eligibleOffers, ineligible: ineligibleOffers } = useMemo(() => {
    if (!isCheckout) return { eligible: [], ineligible: [] };
    if (browseResult.fromApi && (browseResult.eligible.length > 0 || browseResult.ineligible.length > 0)) {
      return {
        eligible: browseResult.eligible,
        ineligible: browseResult.ineligible,
      };
    }
    if (browseResult.fromApi && browseResult.coupons.length > 0) {
      return listCheckoutCouponOffers(
        subtotal,
        catalogDiscount,
        cartContext,
        categoryNames,
        undefined,
        browseResult.coupons
      );
    }
    return { eligible: [], ineligible: [] };
  }, [isCheckout, browseResult, subtotal, catalogDiscount, cartContext, categoryNames]);

  const cartCategoryHint = useMemo(() => {
    const ids = cartContext?.cartCategoryIds ?? [];
    return formatCartCategoryHint(ids, categoryNames);
  }, [cartContext?.cartCategoryIds, categoryNames]);

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

  const handleApplyCode = async (couponCode: string, closeModalOnSuccess = false) => {
    const trimmed = couponCode.trim();
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
      if (closeModalOnSuccess) {
        setOffersModalVisible(false);
        setError(null);
      }
    } catch {
      setError(t('coupon.loadFailed', 'Could not apply coupon. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const totalOfferCount = eligibleOffers.length + ineligibleOffers.length;

  const renderOfferRow = (offer: CheckoutCouponOffer, canApply: boolean) => (
    <TouchableOpacity
      key={`${canApply ? 'ok' : 'no'}-${offer.coupon.id}`}
      style={[styles.modalOfferCard, !canApply && styles.modalOfferCardDisabled]}
      onPress={() => canApply && handleApplyCode(offer.coupon.code, true)}
      disabled={busy || !canApply}
      activeOpacity={canApply ? 0.88 : 1}
    >
      <View style={[styles.modalOfferBadge, !canApply && styles.modalOfferBadgeMuted]}>
        <Text style={styles.modalOfferBadgeText}>{offer.discountLabel}</Text>
      </View>
      <View style={styles.modalOfferBody}>
        <Text style={[styles.modalOfferCode, !canApply && styles.modalOfferCodeMuted]}>
          {offer.coupon.code}
        </Text>
        <Text style={styles.modalOfferTitle} numberOfLines={1}>
          {offer.coupon.title}
        </Text>
        <Text style={styles.modalOfferScope} numberOfLines={2}>
          {offer.scopeLabel}
        </Text>
        {!canApply && offer.reason ? (
          <Text style={styles.modalOfferReason} numberOfLines={2}>
            {offer.reason}
          </Text>
        ) : null}
      </View>
      {canApply ? (
        <Text style={styles.modalOfferApply}>{t('coupon.apply', 'Apply')}</Text>
      ) : null}
    </TouchableOpacity>
  );

  const handleRemove = () => {
    clear();
    setError(null);
    setCode('');
    onCleared?.();
  };

  if (isCheckout) {
    const browseLabel = catalogLoading
      ? t('common.loading', 'Loading...')
      : t('coupon.checkOfferHere', 'Check offer here');

    return (
      <>
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
                onPress={() => handleApplyCode(code)}
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

          <TouchableOpacity
            style={styles.browseOffersBtn}
            onPress={() => setOffersModalVisible(true)}
            activeOpacity={0.88}
          >
            <View style={styles.browseOffersInner}>
              <Ionicons name="sparkles" size={15} color={COLORS.primary} />
              <Text style={styles.browseOffersText}>{browseLabel}</Text>
            </View>
            <View style={styles.browseOffersArrow}>
              <Ionicons name="arrow-forward" size={16} color={COLORS.background} />
            </View>
          </TouchableOpacity>

          {error && !offersModalVisible ? (
            <View style={styles.checkoutErrorRow}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
              <Text style={styles.checkoutErrorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <Modal
          visible={offersModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setOffersModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setOffersModalVisible(false)}
          />
          <View style={styles.modalSheetWrap}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t('coupon.modalTitle', 'Choose a promo code')}
                </Text>
                <TouchableOpacity
                  onPress={() => setOffersModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {cartCategoryHint ? (
                <Text style={styles.modalCartHint}>
                  {t('coupon.cartCategories', 'Your cart: {{categories}}', {
                    categories: cartCategoryHint,
                  })}
                </Text>
              ) : null}

              {error && offersModalVisible ? (
                <Text style={styles.modalError}>{error}</Text>
              ) : null}

              {catalogLoading ? (
                <ActivityIndicator
                  color={COLORS.primary}
                  style={styles.modalLoader}
                />
              ) : (
                <ScrollView
                  style={styles.modalScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {eligibleOffers.length > 0 ? (
                    <>
                      <Text style={styles.modalSectionLabel}>
                        {t('coupon.availableForOrder', 'Available for your order')}
                      </Text>
                      {eligibleOffers.map((offer) => renderOfferRow(offer, true))}
                    </>
                  ) : null}
                  {ineligibleOffers.length > 0 ? (
                    <>
                      <Text
                        style={[
                          styles.modalSectionLabel,
                          eligibleOffers.length > 0 && styles.modalSectionLabelSpaced,
                        ]}
                      >
                        {t('coupon.notYetEligible', 'Not eligible for this cart')}
                      </Text>
                      {ineligibleOffers.map((offer) => renderOfferRow(offer, false))}
                    </>
                  ) : null}
                  {totalOfferCount === 0 ? (
                    <Text style={styles.modalEmpty}>
                      {t('coupon.modalEmpty', 'No promo codes found.')}
                    </Text>
                  ) : null}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </>
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
  browseOffersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs + 2,
    backgroundColor: COLORS.primary + '12',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
  },
  browseOffersInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  browseOffersText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  browseOffersArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '78%',
    paddingBottom: SPACING.lg,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  modalCartHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  modalError: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  modalLoader: {
    marginVertical: SPACING.xl,
  },
  modalScroll: {
    paddingHorizontal: SPACING.lg,
  },
  modalSectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSectionLabelSpaced: {
    marginTop: SPACING.md,
  },
  modalOfferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '35',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  modalOfferCardDisabled: {
    borderColor: COLORS.border,
    opacity: 0.72,
  },
  modalOfferBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: 'center',
  },
  modalOfferBadgeMuted: {
    backgroundColor: COLORS.textSecondary,
  },
  modalOfferBadgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    textAlign: 'center',
  },
  modalOfferBody: {
    flex: 1,
    minWidth: 0,
  },
  modalOfferCode: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  modalOfferCodeMuted: {
    color: COLORS.textSecondary,
  },
  modalOfferTitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    marginTop: 1,
  },
  modalOfferScope: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalOfferReason: {
    fontSize: 10,
    color: COLORS.error,
    marginTop: 4,
  },
  modalOfferApply: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  modalEmpty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    marginVertical: SPACING.lg,
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
