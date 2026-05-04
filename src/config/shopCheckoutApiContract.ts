/**
 * Shop checkout & Stripe — API contract for Laravel (reference for backend + mobile).
 *
 * Axios `baseURL` already includes `/api`, so paths below are relative (e.g. `/shop/...`).
 *
 * Stripe webhooks: configured only in the Stripe Dashboard → your Laravel URL (e.g.
 * `POST https://your-domain.com/api/shop/stripe/webhook`). The mobile app never calls
 * the webhook; Laravel verifies `Stripe-Signature` and handles `payment_intent.*` events.
 */

/**
 * What happens when the user taps **Place Order** (Stripe selected)
 * ---------------------------------------------------------------
 *
 * 1. **App checks Stripe publishable key** (`pk_test_…` / `pk_live_…`) from Expo config.
 *    If missing → you see the alert in the screenshot; **no API is called yet.** Fix: set
 *    `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env` or `stripePublishableKey` under `expo.extra`
 *    in `app.json` / `app.config.js`, then **rebuild** the native app (`expo prebuild` / EAS), not
 *    only refresh Metro.
 *
 * 2. **POST** `STRIPE_PAYMENT_INTENT` — backend creates a Stripe PaymentIntent; returns
 *    `{ success, data: { client_secret } }`. **Build this first** so the app can open the
 *    payment UI.
 *
 * 3. **Card details are not on the Checkout screen** — they are entered in Stripe’s **Payment
 *    Sheet** (native bottom sheet / full-screen UI from `@stripe/stripe-react-native`), which
 *    opens only after step 2 succeeds. That is intentional (PCI; Stripe hosts the card fields).
 *
 * 4. After the user pays in the sheet, **POST** `CHECKOUT_CONFIRM` with `payment_intent_id`
 *    so Laravel can create the order (and clear cart, etc.). Optional for a first milestone
 *    if you rely on webhooks only, but the app will warn if confirm fails.
 *
 * Other calls (earlier in checkout, not on the Place Order button):
 * - **GET** `ORDER_SUMMARY` when the screen loads / focus — already used for totals.
 */

/** Routes the React Native app calls today (aligned with Postman: “7. POST Stripe PaymentIntent”). */
export const SHOP_CHECKOUT_ROUTES = {
  /** Order summary (subtotal, shipping, tax, total). Used by `cartService.getOrderSummary`. */
  ORDER_SUMMARY: '/shop/order-summary',

  /** Creates a Stripe PaymentIntent; returns `client_secret` for the Payment Sheet. */
  STRIPE_PAYMENT_INTENT: '/shop/checkout/stripe/payment-intent',

  /** After the user pays in the Payment Sheet; body `{ payment_intent_id }`, creates order server-side. */
  CHECKOUT_CONFIRM: '/shop/checkout/confirm',

  /**
   * Optional — not used by the app yet. The checkout UI still hardcodes Stripe / PayPal.
   * Safe to add later for a dynamic payment-method list from Laravel.
   */
  PAYMENT_METHODS: '/shop/checkout/payment-methods',
} as const;

/**
 * Laravel developer proposal vs this app
 * --------------------------------------
 *
 * | Laravel proposal                         | Mobile app status |
 * |------------------------------------------|-------------------|
 * | GET …/shop/checkout/payment-methods      | Optional; not wired in app yet. |
 * | GET …/shop/order-summary                 | Matches `ORDER_SUMMARY` ✓ |
 * | POST …/shop/checkout/start               | Does NOT match. App uses `STRIPE_PAYMENT_INTENT` then `CHECKOUT_CONFIRM`, not a single `start`. |
 *
 * To align, either:
 * - Laravel implements `STRIPE_PAYMENT_INTENT` + `CHECKOUT_CONFIRM` (recommended for current app), or
 * - Laravel keeps only `checkout/start` and the mobile `paymentService.ts` paths are changed to call that
 *   endpoint (and confirm logic merged or renamed—must still return a PaymentIntent `client_secret` for Stripe RN).
 */

/** GET /shop/order-summary — response shape (subset; Laravel may add fields). */
export interface ShopOrderSummaryContract {
  subtotal: number;
  discount: number;
  shipping: number;
  shipping_label?: string | null;
  tax_percent?: number;
  tax?: number;
  total: number;
  currency: string;
}

/** POST /shop/checkout/stripe/payment-intent — request body (mobile sends this). */
export interface ShopStripePaymentIntentRequestContract {
  is_buy_now?: boolean;
  product_id?: number;
  quantity?: number;
  shipping: {
    full_name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };
}

/** POST /shop/checkout/stripe/payment-intent — success `data` (mobile expects `client_secret`). */
export interface ShopStripePaymentIntentDataContract {
  client_secret: string;
  customer?: string;
  ephemeral_key?: string;
}

/** POST /shop/checkout/confirm — request body (mobile sends after Payment Sheet succeeds). */
export interface ShopCheckoutConfirmRequestContract {
  payment_intent_id: string;
}

/** GET /shop/checkout/payment-methods — optional future shape (example). */
export interface ShopPaymentMethodOptionContract {
  id: string;
  type: 'stripe' | 'paypal' | string;
  name: string;
  enabled: boolean;
}
