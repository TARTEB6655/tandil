/**
 * Membership renew / upgrade checkout.
 * APIs (Postman):
 * - POST /client/memberships/:id/renew/payment-intent  (payment_method)
 * - POST /client/memberships/:id/upgrade/payment-intent (target_plan, payment_method)
 * Stripe / Apple Pay flow matches WalletTopUpPaymentScreen.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStripe, PlatformPay } from '@stripe/stripe-react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { isApplePayEnabled } from '../../config/payments';
import { getStripePublishableKey } from '../../config/api';
import { getStripePaymentSheetReturnURL } from '../../config/stripeLinking';
import {
  createMembershipPaymentIntent,
  confirmMembershipAfterStripe,
  extractMembershipPaymentIntentId,
  type MembershipPurchaseMode,
  type MembershipPaymentMethod,
} from '../../services/clientMembershipService';

type PaymentMethodId = 'stripe' | 'apple_pay' | 'google_pay';

export type MembershipCheckoutParams = {
  mode?: MembershipPurchaseMode;
  planKey?: string;
  planTitle?: string;
  amount?: number;
  currency?: string;
  planId?: string | number;
  membershipId?: number;
  tier?: string;
};

const MembershipCheckoutScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const params = (route.params ?? {}) as MembershipCheckoutParams;

  const mode: MembershipPurchaseMode = params.mode || 'purchase';
  const amount = Number(params.amount) || 0;
  const currency = String(params.currency || 'AED').toUpperCase();
  const planTitle = params.planTitle || params.planKey || params.tier || 'Membership';
  const planKey = params.planKey || params.tier || planTitle;
  const membershipId = params.membershipId;

  const { initPaymentSheet, presentPaymentSheet, confirmPlatformPayPayment } = useStripe();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodId>('stripe');
  const [loading, setLoading] = useState(false);

  const showApplePay = Platform.OS === 'ios' && isApplePayEnabled() && amount > 0;
  const showGooglePay = Platform.OS === 'android' && amount > 0;
  const amountLabel = useMemo(
    () => `${currency} ${amount.toFixed(2)}`,
    [currency, amount]
  );

  const modeLabel = useMemo(() => {
    if (mode === 'renew') return t('memberships.modeRenew', { defaultValue: 'Renew membership' });
    if (mode === 'upgrade') {
      return t('memberships.modeUpgrade', { defaultValue: 'Upgrade membership' });
    }
    return t('memberships.modePurchase', { defaultValue: 'Purchase membership' });
  }, [mode, t]);

  const renderPaymentOption = (opts: {
    id: PaymentMethodId;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBg: string;
    title: string;
    subtitle: string;
  }) => {
    const isSelected = selectedPaymentMethod === opts.id;
    return (
      <TouchableOpacity
        key={opts.id}
        style={[styles.paymentMethod, isSelected && styles.selectedPaymentMethod]}
        onPress={() => setSelectedPaymentMethod(opts.id)}
        activeOpacity={0.75}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
      >
        <View style={styles.paymentMethodContent}>
          <View style={[styles.paymentMethodIcon, { backgroundColor: opts.iconBg }]}>
            <Ionicons name={opts.icon} size={22} color={opts.iconColor} />
          </View>
          <View style={styles.paymentMethodInfo}>
            <Text style={[styles.paymentMethodName, isSelected && styles.paymentMethodNameSelected]}>
              {opts.title}
            </Text>
            <Text style={styles.paymentMethodDetails}>{opts.subtitle}</Text>
          </View>
        </View>
        <View style={[styles.paymentRadio, isSelected && styles.paymentRadioSelected]}>
          {isSelected ? <Ionicons name="checkmark" size={14} color={COLORS.background} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const showSuccess = () => {
    Alert.alert(
      t('memberships.paymentSuccessTitle', { defaultValue: 'Payment successful' }),
      t('memberships.paymentSuccessMessage', {
        defaultValue: '{{mode}} for {{plan}} ({{amount}}) completed.',
        mode: modeLabel,
        plan: planTitle,
        amount: amountLabel,
      }),
      [
        {
          text: t('common.ok', 'OK'),
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const finalizeAfterStripe = async (clientSecret: string, paymentIntentIdFromApi?: string) => {
    const paymentIntentId =
      paymentIntentIdFromApi || extractMembershipPaymentIntentId(clientSecret);

    if (!paymentIntentId) {
      showSuccess();
      return;
    }

    const confirm = await confirmMembershipAfterStripe({
      payment_intent_id: paymentIntentId,
      mode,
      membership_id: membershipId,
    });

    if (!confirm.success) {
      if (confirm.notImplemented) {
        Alert.alert(
          t('memberships.paymentReceivedTitle', { defaultValue: 'Payment received' }),
          t('memberships.confirmApiPending', {
            defaultValue:
              'Your payment went through. Membership will update once the confirm API is connected. If it does not update, contact support with your receipt.',
          }),
          [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }]
        );
        return;
      }
      Alert.alert(
        t('memberships.paymentReceivedTitle', { defaultValue: 'Payment received' }),
        confirm.message ||
          t('memberships.confirmPending', {
            defaultValue:
              'Your card was charged. If your membership does not update, contact support with your receipt.',
          }),
        [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }]
      );
      return;
    }

    showSuccess();
  };

  const requestIntent = async (method: PaymentMethodId) => {
    // Backend currently accepts stripe | apple_pay. Google Pay uses the same Stripe PaymentIntent.
    const apiMethod: MembershipPaymentMethod =
      method === 'apple_pay' ? 'apple_pay' : 'stripe';
    return createMembershipPaymentIntent({
      mode,
      plan_key: planKey,
      plan_id: params.planId,
      membership_id: membershipId,
      amount: Math.round(amount * 100) / 100,
      payment_method: apiMethod,
      currency,
    });
  };

  const handleStripeCardPay = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        t('common.error', 'Error'),
        t('checkout.stripeNativeOnly', {
          defaultValue: 'Card payments work in the iOS / Android app.',
        })
      );
      return;
    }

    const stripePk = getStripePublishableKey();
    if (!stripePk) {
      Alert.alert(
        t('common.error', 'Error'),
        t(
          'checkout.stripeKeyMissing',
          'Add your Stripe publishable key: set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY or extra.stripePublishableKey in app config.'
        )
      );
      return;
    }

    if ((mode === 'renew' || mode === 'upgrade') && membershipId == null) {
      Alert.alert(
        t('common.error', 'Error'),
        t('memberships.missingSubscriptionId', {
          defaultValue: 'Missing membership id. Go back and try again.',
        })
      );
      return;
    }

    setLoading(true);
    try {
      const { data: pi, message: piMessage, notImplemented } = await requestIntent('stripe');

      if (notImplemented || !pi?.client_secret) {
        Alert.alert(
          t('common.error', 'Error'),
          piMessage ||
            t('memberships.paymentFailed', {
              defaultValue: 'Could not start membership payment.',
            }),
          [{ text: t('common.ok', 'OK') }]
        );
        return;
      }

      const merchantCountryCode = 'AE';
      const currencyCode = currency;
      const isStripeTestMode = /pk_test_/i.test(String(stripePk));
      const customerProps =
        pi.customer && pi.ephemeral_key
          ? { customerId: pi.customer, customerEphemeralKeySecret: pi.ephemeral_key }
          : {};
      const hasCustomerSession = Boolean(
        'customerId' in customerProps && 'customerEphemeralKeySecret' in customerProps
      );

      const sheetCore = {
        merchantDisplayName: 'Tandil',
        paymentIntentClientSecret: pi.client_secret,
        returnURL: getStripePaymentSheetReturnURL(),
        allowsDelayedPaymentMethods: false,
        ...(Platform.OS === 'android'
          ? {
              googlePay: {
                merchantCountryCode,
                currencyCode,
                testEnv: isStripeTestMode,
              },
            }
          : {}),
      };

      const initAttempts: Array<Record<string, unknown>> = [];
      if (hasCustomerSession) initAttempts.push({ ...sheetCore, ...customerProps });
      initAttempts.push({ ...sheetCore });

      let initError: { message?: string; code?: string } | undefined;
      for (const sheetParams of initAttempts) {
        const result = await initPaymentSheet(sheetParams as Parameters<typeof initPaymentSheet>[0]);
        if (!result.error) {
          initError = undefined;
          break;
        }
        initError = result.error;
      }

      if (initError) {
        Alert.alert(
          t('common.error', 'Error'),
          initError.message || t('checkout.paymentOpenFailed', 'Could not open payment screen.')
        );
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') return;
        Alert.alert(
          t('common.error', 'Error'),
          presentError.message || t('checkout.paymentFailed', 'Payment failed. Please try again.')
        );
        return;
      }

      await finalizeAfterStripe(pi.client_secret, pi.payment_intent_id);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('memberships.paymentFailed', {
              defaultValue: 'Could not start membership payment.',
            });
      Alert.alert(t('common.error', 'Error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplePay = async () => {
    if (!showApplePay) {
      void handleStripeCardPay();
      return;
    }

    const stripePk = getStripePublishableKey();
    if (!stripePk) {
      Alert.alert(
        t('common.error', 'Error'),
        t(
          'checkout.stripeKeyMissing',
          'Add your Stripe publishable key: set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY or extra.stripePublishableKey in app config.'
        )
      );
      return;
    }

    if ((mode === 'renew' || mode === 'upgrade') && membershipId == null) {
      Alert.alert(
        t('common.error', 'Error'),
        t('memberships.missingSubscriptionId', {
          defaultValue: 'Missing membership id. Go back and try again.',
        })
      );
      return;
    }

    setLoading(true);
    try {
      const { data: pi, message: piMessage, notImplemented } = await requestIntent('apple_pay');

      if (notImplemented || !pi?.client_secret) {
        Alert.alert(
          t('common.error', 'Error'),
          piMessage ||
            t('memberships.paymentFailed', {
              defaultValue: 'Could not start membership payment.',
            }),
          [{ text: t('common.ok', 'OK') }]
        );
        return;
      }

      const { error: applePayError } = await confirmPlatformPayPayment(pi.client_secret, {
        applePay: {
          cartItems: [
            {
              label: planTitle,
              amount: amount.toFixed(2),
              paymentType: PlatformPay.PaymentType.Immediate,
            },
          ],
          merchantCountryCode: 'AE',
          currencyCode: currency,
        },
      });

      if (applePayError) {
        if (applePayError.code === 'Canceled') return;
        Alert.alert(
          t('common.error', 'Error'),
          applePayError.message || t('checkout.paymentFailed', 'Payment failed. Please try again.')
        );
        return;
      }

      await finalizeAfterStripe(pi.client_secret, pi.payment_intent_id);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('memberships.paymentFailed', {
              defaultValue: 'Could not start membership payment.',
            });
      Alert.alert(t('common.error', 'Error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePay = async () => {
    if (!showGooglePay) {
      void handleStripeCardPay();
      return;
    }

    const stripePk = getStripePublishableKey();
    if (!stripePk) {
      Alert.alert(
        t('common.error', 'Error'),
        t(
          'checkout.stripeKeyMissing',
          'Add your Stripe publishable key: set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY or extra.stripePublishableKey in app config.'
        )
      );
      return;
    }

    if ((mode === 'renew' || mode === 'upgrade') && membershipId == null) {
      Alert.alert(
        t('common.error', 'Error'),
        t('memberships.missingSubscriptionId', {
          defaultValue: 'Missing membership id. Go back and try again.',
        })
      );
      return;
    }

    setLoading(true);
    try {
      const { data: pi, message: piMessage, notImplemented } = await requestIntent('google_pay');

      if (notImplemented || !pi?.client_secret) {
        Alert.alert(
          t('common.error', 'Error'),
          piMessage ||
            t('memberships.paymentFailed', {
              defaultValue: 'Could not start membership payment.',
            }),
          [{ text: t('common.ok', 'OK') }]
        );
        return;
      }

      const isStripeTestMode = /pk_test_/i.test(String(stripePk));
      const { error: googlePayError } = await confirmPlatformPayPayment(pi.client_secret, {
        googlePay: {
          testEnv: isStripeTestMode,
          merchantName: 'Tandil',
          merchantCountryCode: 'AE',
          currencyCode: currency,
          billingAddressConfig: {
            format: PlatformPay.BillingAddressFormat.Min,
            isRequired: false,
          },
        },
      });

      if (googlePayError) {
        if (googlePayError.code === 'Canceled') return;
        Alert.alert(
          t('common.error', 'Error'),
          googlePayError.message || t('checkout.paymentFailed', 'Payment failed. Please try again.')
        );
        return;
      }

      await finalizeAfterStripe(pi.client_secret, pi.payment_intent_id);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t('memberships.paymentFailed', {
              defaultValue: 'Could not start membership payment.',
            });
      Alert.alert(t('common.error', 'Error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = () => {
    if (!(amount > 0)) {
      Alert.alert(
        t('common.error', 'Error'),
        t('memberships.invalidAmount', { defaultValue: 'Invalid membership amount.' })
      );
      return;
    }
    if (selectedPaymentMethod === 'apple_pay' && showApplePay) {
      void handleApplePay();
    } else if (selectedPaymentMethod === 'google_pay' && showGooglePay) {
      void handleGooglePay();
    } else {
      void handleStripeCardPay();
    }
  };

  if (!(amount > 0)) {
    return (
      <View style={styles.container}>
        <Header
          title={t('memberships.checkoutTitle', { defaultValue: 'Membership checkout' })}
          showBack
        />
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="alert-circle-outline" size={36} color={COLORS.textSecondary} />
          </View>
          <Text style={styles.errorText}>
            {t('memberships.invalidAmount', { defaultValue: 'Invalid membership amount.' })}
          </Text>
          <Button
            title={t('common.back', { defaultValue: 'Go back' })}
            onPress={() => navigation.goBack()}
            style={{ marginTop: SPACING.lg, alignSelf: 'stretch' }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={t('memberships.checkoutTitle', { defaultValue: 'Membership checkout' })}
        showBack
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.amountHero}>
          <View style={styles.amountDecorA} />
          <View style={styles.amountDecorB} />
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{modeLabel}</Text>
          </View>
          <Text style={styles.amountLabel}>{planTitle}</Text>
          <Text style={styles.amountValue}>{amountLabel}</Text>
          <TouchableOpacity
            style={styles.changeAmountBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.changeAmount}>
              {t('memberships.changePlan', { defaultValue: 'Change plan' })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="card-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              {t('checkout.paymentMethod', 'Payment method')}
            </Text>
          </View>
          <Text style={styles.paymentMethodHint}>
            {t(
              'memberships.selectPaymentHint',
              'Pay with Stripe, Apple Pay, or Google Pay — same secure methods used for wallet top-up.'
            )}
          </Text>

          <View style={styles.paymentMethodsList}>
            {renderPaymentOption({
              id: 'stripe',
              icon: 'card-outline',
              iconColor: COLORS.primary,
              iconBg: COLORS.primary + '18',
              title: t('checkout.stripeLabel', 'Stripe'),
              subtitle: t(
                'memberships.stripeSubtitle',
                'Pay securely with card via Stripe Payment Sheet'
              ),
            })}
            {showApplePay
              ? renderPaymentOption({
                  id: 'apple_pay',
                  icon: 'logo-apple',
                  iconColor: COLORS.text,
                  iconBg: '#E8E8ED',
                  title: t('checkout.applePayLabel', 'Apple Pay'),
                  subtitle: t(
                    'memberships.applePaySubtitle',
                    'Fast and secure checkout with Apple Pay'
                  ),
                })
              : null}
            {showGooglePay
              ? renderPaymentOption({
                  id: 'google_pay',
                  icon: 'logo-google',
                  iconColor: '#4285F4',
                  iconBg: '#E8F0FE',
                  title: t('checkout.googlePayLabel', 'Google Pay'),
                  subtitle: t(
                    'memberships.googlePaySubtitle',
                    'Fast and secure checkout with Google Pay'
                  ),
                })
              : null}
          </View>
        </View>

        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed" size={16} color={COLORS.primary} />
            <Text style={styles.trustText}>{t('wallet.topUp.trustEncrypted', 'Encrypted')}</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
            <Text style={styles.trustText}>{t('wallet.topUp.trustSecure', 'Secure')}</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="flash" size={16} color={COLORS.primary} />
            <Text style={styles.trustText}>{t('wallet.topUp.trustInstant', 'Instant')}</Text>
          </View>
        </View>

        <View style={styles.noteCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
          <Text style={styles.noteText}>
            {t(
              'memberships.secureNote',
              'Payments are processed securely via Stripe. Your membership updates after a successful payment.'
            )}
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          Platform.OS === 'android' && {
            paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.sm,
          },
        ]}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {t('wallet.topUp.processing', 'Processing payment…')}
            </Text>
          </View>
        ) : (
          <Button
            title={
              selectedPaymentMethod === 'apple_pay' && showApplePay
                ? t('wallet.topUp.payWithApplePay', {
                    amount: amountLabel,
                    defaultValue: `Pay ${amountLabel} with Apple Pay`,
                  })
                : selectedPaymentMethod === 'google_pay' && showGooglePay
                  ? t('wallet.topUp.payWithGooglePay', {
                      amount: amountLabel,
                      defaultValue: `Pay ${amountLabel} with Google Pay`,
                    })
                  : t('wallet.topUp.payWithStripe', {
                      amount: amountLabel,
                      defaultValue: `Pay ${amountLabel} with Stripe`,
                    })
            }
            onPress={handlePay}
            size="large"
            icon={
              <Ionicons
                name={
                  selectedPaymentMethod === 'apple_pay' && showApplePay
                    ? 'logo-apple'
                    : selectedPaymentMethod === 'google_pay' && showGooglePay
                      ? 'logo-google'
                      : 'lock-closed-outline'
                }
                size={18}
                color={COLORS.background}
                style={{ marginRight: 8 }}
              />
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  errorText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  amountHero: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  amountDecorA: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primary + '12',
    top: -50,
    right: -40,
  },
  amountDecorB: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    bottom: -40,
    left: -20,
  },
  stepBadge: {
    backgroundColor: COLORS.primary + '14',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  stepBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  amountLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  amountValue: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginBottom: SPACING.md,
    letterSpacing: -0.5,
  },
  changeAmountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  changeAmount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  sectionCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  paymentMethodHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  paymentMethodsList: {
    marginTop: SPACING.xs,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingVertical: SPACING.md + 2,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
  },
  selectedPaymentMethod: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: SPACING.sm,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  paymentMethodNameSelected: {
    color: COLORS.primary,
  },
  paymentMethodDetails: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  paymentRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C5CED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRadioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  trustDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  noteText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 56,
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
});

export default MembershipCheckoutScreen;
