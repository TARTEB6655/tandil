import Constants from 'expo-constants';

/**
 * Return URL for Stripe Payment Sheet (3DS, iDEAL, and other redirect-based methods).
 * Must match the `expo.scheme` value in `app.json` (e.g. `tandil://stripe-redirect`).
 * @see https://stripe.com/docs/payments/accept-a-payment?platform=react-native&ui=payment-sheet
 */
export function getStripePaymentSheetReturnURL(): string {
  const scheme =
    typeof Constants.expoConfig?.scheme === 'string' && Constants.expoConfig.scheme.trim() !== ''
      ? Constants.expoConfig.scheme.trim()
      : 'tandil';
  return `${scheme}://stripe-redirect`;
}
