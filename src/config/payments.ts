import Constants from 'expo-constants';

function readEnableApplePayFlag(): boolean {
  const fromEnv =
    process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY === 'true' ||
    process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY === '1';
  if (fromEnv) return true;
  try {
    const extra =
      Constants.expoConfig?.extra?.enableApplePay ??
      Constants.manifest?.extra?.enableApplePay ??
      Constants.manifest2?.extra?.expoConfig?.extra?.enableApplePay;
    return extra === true || extra === 'true' || extra === 1 || extra === '1';
  } catch {
    return false;
  }
}

/**
 * Apple Pay is disabled until Stripe live Apple Pay certificate is verified in App Review.
 * Set EXPO_PUBLIC_ENABLE_APPLE_PAY=true in EAS env when ready to re-enable.
 */
export const ENABLE_APPLE_PAY = readEnableApplePayFlag();
