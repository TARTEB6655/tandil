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
import { useTranslation } from 'react-i18next';
import { useStripe, PlatformPay } from '@stripe/stripe-react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { isApplePayEnabled } from '../../config/payments';
import { getStripePublishableKey } from '../../config/api';
import { getStripePaymentSheetReturnURL } from '../../config/stripeLinking';
import {
  createWalletTopUpPaymentIntent,
  confirmWalletTopUpAfterStripe,
  extractWalletTopUpPaymentIntentId,
} from '../../services/walletTopUpService';

type PaymentMethodId = 'stripe' | 'apple_pay';

type RouteParams = {
  amount: number;
  currency?: string;
};

const WalletTopUpPaymentScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as RouteParams;
  const amount = Number(params.amount) || 0;
  const currency = String(params.currency || 'AED').toUpperCase();

  const { initPaymentSheet, presentPaymentSheet, confirmPlatformPayPayment } = useStripe();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodId>('stripe');
  const [loading, setLoading] = useState(false);

  const showApplePay = Platform.OS === 'ios' && isApplePayEnabled() && amount > 0;
  const amountLabel = useMemo(
    () => `${currency} ${amount.toFixed(2)}`,
    [currency, amount]
  );

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

  const showTopUpSuccess = () => {
    Alert.alert(
      t('wallet.topUp.successTitle', 'Wallet topped up'),
      t('wallet.topUp.successMessage', {
        amount: amountLabel,
        defaultValue: `${amountLabel} was added to your wallet.`,
      }),
      [
        {
          text: t('common.ok', 'OK'),
          onPress: () => navigation.navigate('Wallet'),
        },
      ]
    );
  };

  const finalizeAfterStripe = async (clientSecret: string, paymentIntentIdFromApi?: string) => {
    const paymentIntentId =
      paymentIntentIdFromApi || extractWalletTopUpPaymentIntentId(clientSecret);
    if (!paymentIntentId) {
      showTopUpSuccess();
      return;
    }
    const confirm = await confirmWalletTopUpAfterStripe(paymentIntentId);
    if (!confirm.success) {
      if (confirm.notImplemented) {
        Alert.alert(
          t('wallet.topUp.paymentReceivedTitle', 'Payment received'),
          t(
            'wallet.topUp.confirmApiPending',
            'Your payment went through. Wallet credit will appear once the confirm API is connected. If balance does not update, contact support with your receipt.'
          ),
          [{ text: t('common.ok', 'OK'), onPress: () => navigation.navigate('Wallet') }]
        );
        return;
      }
      Alert.alert(
        t('wallet.topUp.paymentReceivedTitle', 'Payment received'),
        confirm.message ||
          t(
            'wallet.topUp.confirmPending',
            'Your card was charged. If the wallet balance does not update, contact support with your receipt.'
          ),
        [{ text: t('common.ok', 'OK'), onPress: () => navigation.navigate('Wallet') }]
      );
      return;
    }
    showTopUpSuccess();
  };

  const requestTopUpIntent = async (method: PaymentMethodId) =>
    createWalletTopUpPaymentIntent({
      amount: Math.round(amount * 100) / 100,
      payment_method: method,
    });

  const handleStripeCardPay = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        t('common.error', 'Error'),
        t(
          'checkout.stripeNativeOnly',
          'Stripe card payments are available in the iOS or Android app, not in the browser.'
        )
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

    setLoading(true);
    try {
      const { data: pi, message: piMessage, notImplemented } = await requestTopUpIntent('stripe');

      if (notImplemented || !pi?.client_secret) {
        Alert.alert(
          t('wallet.topUp.apiPendingTitle', 'Payment UI ready'),
          notImplemented
            ? t(
                'wallet.topUp.apiPendingBody',
                'Stripe and Apple Pay are ready on this screen. Connect backend endpoints POST /client/wallet/add-money/payment-intent and POST /client/wallet/add-money/confirm to complete live top-ups. Shop checkout payments are unchanged.'
              )
            : piMessage ||
                t(
                  'wallet.topUp.paymentIntentFailed',
                  'Could not start wallet top-up. Please try again or contact support.'
                ),
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
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.message || t('wallet.topUp.paymentFailed', 'Wallet top-up failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApplePay = async () => {
    if (!showApplePay) {
      handleStripeCardPay();
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

    setLoading(true);
    try {
      const { data: pi, message: piMessage, notImplemented } = await requestTopUpIntent('apple_pay');

      if (notImplemented || !pi?.client_secret) {
        Alert.alert(
          t('wallet.topUp.apiPendingTitle', 'Payment UI ready'),
          notImplemented
            ? t(
                'wallet.topUp.apiPendingBody',
                'Stripe and Apple Pay are ready on this screen. Connect backend endpoints POST /client/wallet/add-money/payment-intent and POST /client/wallet/add-money/confirm to complete live top-ups. Shop checkout payments are unchanged.'
              )
            : piMessage ||
                t(
                  'wallet.topUp.paymentIntentFailed',
                  'Could not start wallet top-up. Please try again or contact support.'
                ),
          [{ text: t('common.ok', 'OK') }]
        );
        return;
      }

      const { error: applePayError } = await confirmPlatformPayPayment(pi.client_secret, {
        applePay: {
          cartItems: [
            {
              label: t('wallet.topUp.applePayLabel', 'Wallet top-up'),
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
    } catch (err: any) {
      Alert.alert(
        t('common.error', 'Error'),
        err?.message || t('wallet.topUp.paymentFailed', 'Wallet top-up failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePay = () => {
    if (!(amount > 0)) {
      Alert.alert(
        t('common.error', 'Error'),
        t('wallet.topUp.invalidAmount', 'Invalid top-up amount.')
      );
      return;
    }
    if (selectedPaymentMethod === 'apple_pay' && showApplePay) {
      handleApplePay();
    } else {
      handleStripeCardPay();
    }
  };

  if (!(amount > 0)) {
    return (
      <View style={styles.container}>
        <Header title={t('wallet.topUp.title', 'Top up wallet')} showBack />
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="alert-circle-outline" size={36} color={COLORS.textSecondary} />
          </View>
          <Text style={styles.errorText}>
            {t('wallet.topUp.invalidAmount', 'Invalid top-up amount.')}
          </Text>
          <Button
            title={t('wallet.topUp.backToAmount', 'Choose amount')}
            onPress={() => navigation.goBack()}
            style={{ marginTop: SPACING.lg, alignSelf: 'stretch' }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('wallet.topUp.title', 'Top up wallet')} showBack />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount hero */}
        <View style={styles.amountHero}>
          <View style={styles.amountDecorA} />
          <View style={styles.amountDecorB} />
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              {t('wallet.topUp.stepLabel', 'Step 2 of 2')}
            </Text>
          </View>
          <Text style={styles.amountLabel}>
            {t('wallet.topUp.amountToAdd', 'Amount to add')}
          </Text>
          <Text style={styles.amountValue}>{amountLabel}</Text>
          <TouchableOpacity
            style={styles.changeAmountBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.changeAmount}>
              {t('wallet.topUp.changeAmount', 'Change amount')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment methods */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="card-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              {t('checkout.paymentMethod', 'Payment method')}
            </Text>
          </View>
          <Text style={styles.paymentMethodHint}>
            {t(
              'wallet.topUp.selectPaymentHint',
              'Pay with Stripe or Apple Pay — same secure methods used for shop and services.'
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
                'wallet.topUp.stripeSubtitle',
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
                    'wallet.topUp.applePaySubtitle',
                    'Fast and secure top-up with Apple Pay'
                  ),
                })
              : null}
          </View>
        </View>

        {/* Trust row */}
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
              'wallet.topUp.secureNote',
              'Payments are processed securely. This flow is separate from shop checkout and will not affect product or service orders.'
            )}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
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

export default WalletTopUpPaymentScreen;
