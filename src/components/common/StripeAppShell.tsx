import React, { useEffect, type ReactNode } from 'react';
import { StripeProvider, initStripe } from '@stripe/stripe-react-native';
import { getStripeMerchantIdentifier, getStripePublishableKey } from '../../config/api';
import { getStripeUrlScheme } from '../../config/stripeLinking';

type Props = { children: ReactNode };

function isValidStripePublishableKey(key: string): boolean {
  return typeof key === 'string' && key.startsWith('pk_') && key.length > 20;
}

/**
 * StripeProvider does not render children when publishableKey is null/empty (iOS release hang / white screen).
 * Fall back to rendering the app and lazy initStripe when the key is available.
 */
export function StripeAppShell({ children }: Props) {
  const publishableKey = getStripePublishableKey();
  const merchantIdentifier = getStripeMerchantIdentifier();
  const urlScheme = getStripeUrlScheme();

  useEffect(() => {
    if (!isValidStripePublishableKey(publishableKey)) {
      console.warn('[Stripe] Publishable key missing — checkout payments disabled until configured.');
      return;
    }
    initStripe({
      publishableKey,
      merchantIdentifier: merchantIdentifier || undefined,
      urlScheme,
    }).catch((err) => {
      console.warn('[Stripe] initStripe failed', err);
    });
  }, [publishableKey, merchantIdentifier, urlScheme]);

  if (!isValidStripePublishableKey(publishableKey)) {
    return <>{children}</>;
  }

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier={merchantIdentifier || undefined}
      urlScheme={urlScheme}
    >
      {children}
    </StripeProvider>
  );
}
