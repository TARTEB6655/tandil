import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { getShopSettings, ShopSettings } from '../../services/shopSettingsService';
import { getOrderSummary, OrderSummaryData } from '../../services/cartService';
import {
  createStripePaymentIntent,
  extractPaymentIntentId,
  confirmCheckoutAfterStripe,
  type CreatePaymentIntentBody,
} from '../../services/paymentService';
import { getStripePublishableKey } from '../../config/api';
import {
  useStripe,
  AddressCollectionMode,
  CollectionMode,
} from '@stripe/stripe-react-native';
import { countryToStripeAlpha2 } from '../../utils/stripeBillingCountry';
import { getStripePaymentSheetReturnURL } from '../../config/stripeLinking';
import { captureException } from '../../utils/sentry';
import * as Location from 'expo-location';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  color: string;
  size: string;
  quantity: number;
}

interface ShippingAddress {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface PaymentMethod {
  id: string;
  type: 'stripe' | 'paypal';
  name: string;
  icon: string;
  last4?: string;
}

const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const route = useRoute<any>();
  const {
    cartItems = [],
    buyNowSummary = null,
    isBuyNow = false,
  } = route.params || { cartItems: [], buyNowSummary: null, isBuyNow: false };
  
  const [currentStep, setCurrentStep] = useState<'location' | 'phone' | 'payment'>('location');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [orderSummaryApi, setOrderSummaryApi] = useState<OrderSummaryData | null>(buyNowSummary);
  
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  });

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('stripe');
  const STEP_ORDER: Array<'location' | 'phone' | 'payment'> = ['location', 'phone', 'payment'];
  const activeStepIndex = STEP_ORDER.indexOf(currentStep);

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'stripe',
      type: 'stripe',
      name: 'Stripe',
      icon: 'card-outline',
    },
    {
      id: 'paypal',
      type: 'paypal',
      name: 'PayPal',
      icon: 'logo-paypal',
    },
  ];

  const calculateSubtotal = () => {
    const items: CartItem[] = (cartItems || []) as CartItem[];
    return items.reduce((acc: number, item: CartItem) => acc + (item.price * item.quantity), 0);
  };

  const calculateDiscount = () => {
    const items: CartItem[] = (cartItems || []) as CartItem[];
    return items.reduce((acc: number, item: CartItem) => {
      if (item.originalPrice) {
        return acc + ((item.originalPrice - item.price) * item.quantity);
      }
      return acc;
    }, 0);
  };

  useEffect(() => {
    let cancelled = false;
    getShopSettings().then((s) => { if (!cancelled) setShopSettings(s); });
    if (isBuyNow && buyNowSummary) {
      if (!cancelled) setOrderSummaryApi(buyNowSummary);
    } else {
      getOrderSummary().then((s) => { if (!cancelled) setOrderSummaryApi(s ?? null); });
    }
    return () => { cancelled = true; };
  }, [buyNowSummary, isBuyNow]);

  useFocusEffect(
    useCallback(() => {
      getShopSettings().then(setShopSettings);
      if (isBuyNow && buyNowSummary) {
        setOrderSummaryApi(buyNowSummary);
      } else {
        getOrderSummary().then(setOrderSummaryApi);
      }
    }, [buyNowSummary, isBuyNow])
  );

  const useApiSummary = orderSummaryApi != null;
  const subtotal = useApiSummary ? orderSummaryApi.subtotal : calculateSubtotal();
  const discount = useApiSummary ? orderSummaryApi.discount : calculateDiscount();
  const shippingAmount = useApiSummary ? orderSummaryApi.shipping : (shopSettings?.shipping_amount ?? 0);
  const taxPercent = useApiSummary ? (orderSummaryApi.tax_percent ?? 0) : (shopSettings?.tax_percent ?? 0);
  // For API summaries, prefer backend tax/total values to avoid mismatches.
  const derivedTaxAmount = Math.round((subtotal - discount) * (taxPercent / 100) * 100) / 100;
  const taxAmount = useApiSummary
    ? (orderSummaryApi.tax ?? Math.max(0, (orderSummaryApi.total ?? 0) - (subtotal - discount + shippingAmount)))
    : derivedTaxAmount;
  const total = useApiSummary
    ? orderSummaryApi.total
    : Math.round((subtotal - discount + shippingAmount + taxAmount) * 100) / 100;
  const currency = useApiSummary ? orderSummaryApi.currency : (shopSettings?.currency ?? 'AED');

  const showOrderPlacedAlert = () => {
    Alert.alert(
      t('checkout.placedTitle'),
      t('checkout.placedBody'),
      [
        { text: t('checkout.viewOrders'), onPress: () => navigation.navigate('OrderHistory') },
        {
          text: t('checkout.continueShopping'),
          onPress: () => navigation.navigate('Main' as never, { screen: 'Home' } as never),
        },
      ]
    );
  };

  const handlePlaceOrder = async () => {
    if (selectedPaymentMethod === 'paypal') {
      Alert.alert(
        t('common.info', 'Information'),
        t('checkout.paypalComingSoon', 'PayPal is not set up yet. Please pay with Stripe.')
      );
      return;
    }

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
          'Add your Stripe publishable key: set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY or extra.stripePublishableKey in app config (pk_test_… or pk_live_…). Rebuild the native app after changing plugins.'
        )
      );
      return;
    }

    setLoading(true);
    try {
      const items: CartItem[] = (cartItems || []) as CartItem[];
      const first = items[0];

      // Same shape as Postman: cart = { is_buy_now, shipping }; buy-now adds product_id + quantity.
      const shippingPayload = {
        full_name: shippingAddress.fullName.trim(),
        phone: shippingAddress.phone.trim(),
        street: shippingAddress.street.trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        zip_code: shippingAddress.zipCode.trim(),
        country: shippingAddress.country.trim(),
      };

      let paymentIntentBody: CreatePaymentIntentBody = {
        is_buy_now: !!isBuyNow,
        shipping: shippingPayload,
      };
      if (isBuyNow && first) {
        const pid = Number(first.productId);
        const qty = Number(first.quantity);
        if (Number.isFinite(pid)) {
          paymentIntentBody = { ...paymentIntentBody, product_id: pid };
        }
        if (Number.isFinite(qty)) {
          paymentIntentBody = { ...paymentIntentBody, quantity: qty };
        }
      }

      const { data: pi, message: piMessage } = await createStripePaymentIntent(paymentIntentBody);

      if (!pi?.client_secret) {
        let body =
          piMessage ||
          t(
            'checkout.paymentIntentFailed',
            'Could not start payment. Ensure the server exposes POST /shop/checkout/stripe/payment-intent and try again.'
          );
        // Text like "Stripe is not enabled…" is returned by Laravel, not the app — fix on server.
        if (/stripe is not enabled|not configured/i.test(piMessage || '')) {
          body +=
            '\n\n' +
            t(
              'checkout.stripeDisabledOnServerHint',
              'Ask your backend developer to enable Stripe for the shop (admin/settings), set STRIPE_SECRET_KEY in Laravel .env, and ensure AED (or your currency) is supported on the Stripe account.'
            );
        }
        if (__DEV__) {
          console.warn('[checkout] payment-intent failed:', piMessage, paymentIntentBody);
        }
        Alert.alert(t('common.error', 'Error'), body);
        return;
      }

      const countryCode = countryToStripeAlpha2(shippingAddress.country);
      const defaultBillingDetails = {
        name: shippingAddress.fullName.trim() || undefined,
        phone: shippingAddress.phone.trim() || undefined,
        address: {
          line1: shippingAddress.street.trim() || undefined,
          city: shippingAddress.city.trim() || undefined,
          state: shippingAddress.state.trim() || undefined,
          postalCode: shippingAddress.zipCode.trim() || undefined,
          country: countryCode || undefined,
        },
      };
      const customerProps =
        pi.customer && pi.ephemeral_key
          ? { customerId: pi.customer, customerEphemeralKeySecret: pi.ephemeral_key }
          : {};

      const sheetBase = {
        merchantDisplayName: 'Tandil',
        paymentIntentClientSecret: pi.client_secret,
        returnURL: getStripePaymentSheetReturnURL(),
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails,
        ...customerProps,
      };

      // Prefer not re-asking for address; if that fails on some SDK/OS builds, fall back to a simpler sheet.
      let { error: initError } = await initPaymentSheet({
        ...sheetBase,
        billingDetailsCollectionConfiguration: {
          name: CollectionMode.NEVER,
          phone: CollectionMode.NEVER,
          email: CollectionMode.AUTOMATIC,
          address: AddressCollectionMode.NEVER,
          attachDefaultsToPaymentMethod: true,
        },
      });
      if (initError) {
        if (__DEV__) {
          console.warn('[checkout] initPaymentSheet (with billing rules) failed:', initError);
        }
        const retry = await initPaymentSheet(sheetBase);
        initError = retry.error;
      }

      if (initError) {
        Alert.alert(t('common.error', 'Error'), initError.message || 'Could not open payment screen.');
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') {
          return;
        }
        Alert.alert(t('common.error', 'Error'), presentError.message);
        return;
      }

      const paymentIntentId = extractPaymentIntentId(pi.client_secret);
      if (paymentIntentId) {
        if (__DEV__) {
          console.log('[checkout] POST /shop/checkout/confirm payment_intent_id:', paymentIntentId);
        }
        const confirm = await confirmCheckoutAfterStripe(paymentIntentId);
        if (!confirm.success) {
          Alert.alert(
            t('checkout.paymentSucceededTitle', 'Payment received'),
            t(
              'checkout.orderSyncPending',
              'Your card was charged. If the order does not appear under Order History, contact support with your receipt.'
            ),
            [
              { text: t('checkout.viewOrders'), onPress: () => navigation.navigate('OrderHistory') },
              { text: t('common.ok', 'OK'), style: 'cancel' },
            ]
          );
          return;
        }
      }

      showOrderPlacedAlert();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      captureException(err, { tags: { area: 'checkout_place_order' } });
      Alert.alert(t('common.error', 'Error'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error', 'Error'),
          t(
            'checkout.locationPermissionRequired',
            'Location permission is required to auto-fill your address.'
          )
        );
        return;
      }

      const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
      });
      const place = places?.[0];

      if (!place) {
        Alert.alert(
          t('common.error', 'Error'),
          t('checkout.locationNotFound', 'Could not fetch address from your location.')
        );
        return;
      }

      const streetParts = [place.name, place.street].filter(Boolean);
      const street = streetParts.join(', ');
      setShippingAddress((prev) => ({
        ...prev,
        street: street || prev.street,
        city: place.city || place.subregion || prev.city,
        state: place.region || place.subregion || prev.state,
        zipCode: place.postalCode || prev.zipCode,
        country: place.country || prev.country,
      }));
    } catch {
      Alert.alert(
        t('common.error', 'Error'),
        t('checkout.locationFetchFailed', 'Unable to get your current location. Please try again.')
      );
    } finally {
      setLocating(false);
    }
  };

  const renderLocationStep = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('checkout.locationStep', 'Location')}</Text>
      <Text style={styles.helperText}>
        {t(
          'checkout.locationStepHelp',
          'Use GPS to auto-fill your shipping address instead of typing all address fields manually.'
        )}
      </Text>

      <TouchableOpacity
        style={[styles.locationButton, locating && styles.locationButtonDisabled]}
        onPress={handleUseMyLocation}
        disabled={locating}
      >
        <Ionicons name="locate-outline" size={18} color={COLORS.primary} />
        <Text style={styles.locationButtonText}>
          {locating ? t('common.loading', 'Loading...') : t('checkout.useMyLocation', 'Use my location')}
        </Text>
      </TouchableOpacity>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('checkout.fullName', 'Full Name')}</Text>
        <TextInput
          style={styles.input}
          value={shippingAddress.fullName}
          onChangeText={(text) => setShippingAddress(prev => ({ ...prev, fullName: text }))}
          placeholder={t('checkout.fullName', 'Full Name')}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('checkout.streetAddress')}</Text>
        <TextInput
          style={styles.input}
          value={shippingAddress.street}
          onChangeText={(text) => setShippingAddress(prev => ({ ...prev, street: text }))}
          placeholder={t('checkout.streetAddress')}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.sm }]}>
          <Text style={styles.label}>{t('checkout.city')}</Text>
          <TextInput
            style={styles.input}
            value={shippingAddress.city}
            onChangeText={(text) => setShippingAddress(prev => ({ ...prev, city: text }))}
            placeholder={t('checkout.city')}
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.sm }]}>
          <Text style={styles.label}>{t('checkout.state')}</Text>
          <TextInput
            style={styles.input}
            value={shippingAddress.state}
            onChangeText={(text) => setShippingAddress(prev => ({ ...prev, state: text }))}
            placeholder={t('checkout.state')}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.sm }]}>
          <Text style={styles.label}>{t('checkout.zipCode')}</Text>
          <TextInput
            style={styles.input}
            value={shippingAddress.zipCode}
            onChangeText={(text) => setShippingAddress(prev => ({ ...prev, zipCode: text }))}
            placeholder={t('checkout.zipCode')}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.sm }]}>
          <Text style={styles.label}>{t('checkout.country')}</Text>
          <TextInput
            style={styles.input}
            value={shippingAddress.country}
            onChangeText={(text) => setShippingAddress(prev => ({ ...prev, country: text }))}
            placeholder={t('checkout.country')}
          />
        </View>
      </View>
    </View>
  );

  const renderPhoneStep = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('checkout.phoneNumberStep', 'Phone Number')}</Text>
      <Text style={styles.helperText}>
        {t('checkout.phoneStepHelp', 'Please enter your phone number so we can contact you about delivery.')}
      </Text>
      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('checkout.phoneNumber')}</Text>
        <TextInput
          style={styles.input}
          value={shippingAddress.phone}
          onChangeText={(text) => setShippingAddress(prev => ({ ...prev, phone: text }))}
          placeholder={t('checkout.phoneNumber')}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );

  const renderPaymentMethods = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('checkout.paymentMethod')}</Text>

      {paymentMethods.map((method) => (
        <TouchableOpacity
          key={method.id}
          style={[
            styles.paymentMethod,
            selectedPaymentMethod === method.id && styles.selectedPaymentMethod,
          ]}
          onPress={() => setSelectedPaymentMethod(method.id)}
        >
          <View style={styles.paymentMethodContent}>
            <View style={styles.paymentMethodIcon}>
              <Ionicons name={method.icon as any} size={24} color={COLORS.primary} />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>{method.name}</Text>
              {method.last4 && (
                <Text style={styles.paymentMethodDetails}>•••• {method.last4}</Text>
              )}
            </View>
          </View>
          <View style={[
            styles.paymentMethodRadio,
            selectedPaymentMethod === method.id && styles.selectedRadio,
          ]}>
            {selectedPaymentMethod === method.id && (
              <View style={styles.radioDot} />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={styles.stepContainer}>
        <View style={[
          styles.stepCircle,
          activeStepIndex >= 0 && styles.activeStepCircle,
        ]}>
          {activeStepIndex > 0 ? (
            <Ionicons name="checkmark" size={16} color={COLORS.background} />
          ) : (
            <Text style={[styles.stepNumber, styles.activeStepNumber]}>1</Text>
          )}
        </View>
        <Text style={[
          styles.stepLabel,
          activeStepIndex >= 0 && styles.activeStepLabel,
        ]}>{t('checkout.locationStep', 'Location')}</Text>
      </View>
      
      <View style={styles.stepLine} />
      
      <View style={styles.stepContainer}>
        <View style={[
          styles.stepCircle,
          activeStepIndex >= 1 && styles.activeStepCircle,
        ]}>
          {activeStepIndex > 1 ? (
            <Ionicons name="checkmark" size={16} color={COLORS.background} />
          ) : (
            <Text style={[styles.stepNumber, activeStepIndex >= 1 && styles.activeStepNumber]}>2</Text>
          )}
        </View>
        <Text style={[
          styles.stepLabel,
          activeStepIndex >= 1 && styles.activeStepLabel,
        ]}>{t('checkout.phoneNumberStep', 'Phone')}</Text>
      </View>
      
      <View style={styles.stepLine} />
      
      <View style={styles.stepContainer}>
        <View style={[
          styles.stepCircle,
          activeStepIndex >= 2 && styles.activeStepCircle,
        ]}>
          <Text style={[
            styles.stepNumber,
            activeStepIndex >= 2 && styles.activeStepNumber,
          ]}>3</Text>
        </View>
        <Text style={[
          styles.stepLabel,
          activeStepIndex >= 2 && styles.activeStepLabel,
        ]}>{t('checkout.paymentStep', 'Payment')}</Text>
      </View>
    </View>
  );

  const getNextStep = () => {
    switch (currentStep) {
      case 'location':
        return 'phone';
      case 'phone':
        return 'payment';
      case 'payment':
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    if (currentStep === 'location') {
      if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.country) {
        Alert.alert(
          t('common.error', 'Error'),
          t(
            'checkout.completeLocationFirst',
            'Please use your location or complete your address before continuing.'
          )
        );
        return;
      }
    }
    if (currentStep === 'phone') {
      if (!shippingAddress.phone.trim()) {
        Alert.alert(
          t('common.error', 'Error'),
          t('checkout.enterPhoneFirst', 'Please enter your phone number before continuing.')
        );
        return;
      }
    }

    const nextStep = getNextStep();
    if (nextStep) {
      setCurrentStep(nextStep as any);
    } else if (currentStep === 'payment') {
      handlePlaceOrder();
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'phone':
        setCurrentStep('location');
        break;
      case 'payment':
        setCurrentStep('phone');
        break;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <Header 
        title={t('checkout.title')} 
        showBack={true}
      />

      {/* Step Indicator */}
      {renderStepIndicator()}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepCard}>
          {currentStep === 'location' && renderLocationStep()}
          {currentStep === 'phone' && renderPhoneStep()}
          {currentStep === 'payment' && renderPaymentMethods()}
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.summaryTitle}>{t('cart.orderSummary')}</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('cart.subtotal')}</Text>
            <Text style={styles.summaryValue}>{currency} {subtotal.toFixed(2)}</Text>
          </View>
          
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('cart.discount')}</Text>
              <Text style={[styles.summaryValue, styles.discountText]}>
                -{currency} {discount.toFixed(2)}
              </Text>
            </View>
          )}
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('cart.shipping')}</Text>
            <Text style={styles.summaryValue}>
              {shippingAmount === 0 ? t('cart.free', 'Free') : `${currency} ${shippingAmount.toFixed(2)}`}
            </Text>
          </View>
          
          {(taxAmount > 0 || taxPercent > 0) && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {taxPercent > 0 ? `${t('cart.tax', 'Tax')} (${taxPercent}%)` : t('cart.tax', 'Tax')}
              </Text>
              <Text style={styles.summaryValue}>{currency} {taxAmount.toFixed(2)}</Text>
            </View>
          )}
          
          <View style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>{t('cart.total')}</Text>
            <Text style={styles.totalValue}>{currency} {total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {currentStep !== 'location' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <Text style={styles.backButtonText}>{t('checkout.back')}</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.nextButton,
            currentStep === 'payment' && styles.placeOrderButton,
          ]}
          onPress={handleNext}
          disabled={loading}
        >
            <Text style={styles.nextButtonText}>
              {loading ? t('checkout.processing') : 
               currentStep === 'payment' ? t('checkout.placeOrder') : t('checkout.next')}
            </Text>
          {currentStep !== 'payment' && (
            <Ionicons name="arrow-forward" size={20} color={COLORS.background} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  activeStepCircle: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepNumber: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  activeStepNumber: {
    color: COLORS.background,
  },
  stepLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  activeStepLabel: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  contentContainer: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  stepCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  section: {
    marginBottom: 0,
  },
  helperText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  locationButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '12',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  locationButtonDisabled: {
    opacity: 0.6,
  },
  locationButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D5DCE5',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  row: {
    flexDirection: 'row',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  selectedPaymentMethod: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  paymentMethodDetails: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  paymentMethodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRadio: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  paypalSubSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  paypalSubTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  paypalSubOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  paypalSubOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  paypalSubHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  paypalOrDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  paypalOrLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  paypalOrText: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  cardFormSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cardFormTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  cardRow: {
    flexDirection: 'row',
  },
  reviewCardDetails: {
    marginTop: SPACING.sm,
  },
  orderItems: {
    marginBottom: SPACING.lg,
  },
  orderItem: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderItemImage: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.md,
  },
  orderItemContent: {
    flex: 1,
  },
  orderItemName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  orderItemSpecs: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  orderItemPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  reviewSection: {
    marginBottom: SPACING.lg,
  },
  reviewSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  reviewText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  orderSummary: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  discountText: {
    color: COLORS.success,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  totalLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  totalValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  backButton: {
    minWidth: 96,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  backButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  nextButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  placeOrderButton: {
    backgroundColor: COLORS.success,
  },
  nextButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.background,
  },
});

export default CheckoutScreen;
