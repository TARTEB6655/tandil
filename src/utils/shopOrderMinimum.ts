import { Alert } from 'react-native';
import type { TFunction } from 'i18next';

/** Minimum order total (AED) required before checkout or buy now. */
export const MIN_ORDER_AMOUNT_AED = 45;

/** Visual style when checkout / buy-now is below minimum order. */
export const MIN_ORDER_BUTTON_DISABLED_STYLE = { opacity: 0.4 } as const;

export function meetsMinimumOrderAmount(orderTotal: number): boolean {
  const amount = Number(orderTotal);
  return Number.isFinite(amount) && amount >= MIN_ORDER_AMOUNT_AED;
}

export function showMinimumOrderAlert(currency: string, t: TFunction): void {
  const code = currency?.trim() || 'AED';
  Alert.alert(
    t('cart.minOrderTitle', 'Minimum order required'),
    t('cart.minOrderMessage', {
      defaultValue:
        'Your order total must be {{amount}} {{currency}} or more to complete your purchase. Please add more items to your cart.',
      amount: MIN_ORDER_AMOUNT_AED,
      currency: code,
    }),
    [{ text: t('common.ok', 'OK') }]
  );
}

export function ensureMinimumOrderAmount(
  orderTotal: number,
  currency: string,
  t: TFunction
): boolean {
  if (meetsMinimumOrderAmount(orderTotal)) return true;
  showMinimumOrderAlert(currency, t);
  return false;
}
