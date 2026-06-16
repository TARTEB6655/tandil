import Constants from 'expo-constants';

function readExtra(key: string): unknown {
  try {
    return (
      Constants.expoConfig?.extra?.[key] ??
      Constants.manifest?.extra?.[key] ??
      Constants.manifest2?.extra?.expoConfig?.extra?.[key]
    );
  } catch {
    return undefined;
  }
}

function readEnableApplePayFlag(): boolean {
  const fromEnv =
    process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY === 'true' ||
    process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY === '1';
  if (fromEnv) return true;
  const extra = readExtra('enableApplePay');
  if (extra === true || extra === 'true' || extra === 1 || extra === '1') {
    return true;
  }
  const merchantId = readExtra('stripeMerchantIdentifier');
  return typeof merchantId === 'string' && merchantId.trim() !== '';
}

/** Controlled via app.json extra.enableApplePay or EXPO_PUBLIC_ENABLE_APPLE_PAY. */
export const ENABLE_APPLE_PAY = readEnableApplePayFlag();

/** Re-read at runtime so Metro reload picks up app.json changes without a full restart. */
export function isApplePayEnabled(): boolean {
  return readEnableApplePayFlag();
}
