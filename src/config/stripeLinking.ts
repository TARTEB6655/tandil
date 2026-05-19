import Constants from 'expo-constants';

/**
 * Return URL for Stripe Payment Sheet (3DS, iDEAL, and other redirect-based methods).
 * Must match the `expo.scheme` value in `app.json` (e.g. `tandil://stripe-redirect`).
 * @see https://stripe.com/docs/payments/accept-a-payment?platform=react-native&ui=payment-sheet
 */
function getAppUrlScheme(): string {
  const fromConfig = Constants.expoConfig?.scheme;
  if (typeof fromConfig === 'string' && fromConfig.trim() !== '') {
    return fromConfig.trim();
  }
  return 'tandil';
}

/** Required by StripeProvider for 3DS / redirects; must match `expo.scheme` in app config. */
export function getStripeUrlScheme(): string {
  return getAppUrlScheme();
}

export function getStripePaymentSheetReturnURL(): string {
  return `${getAppUrlScheme()}://stripe-redirect`;
}
