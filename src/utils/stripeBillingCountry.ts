/**
 * Stripe Payment Sheet expects ISO 3166-1 alpha-2 in `BillingDetails.address.country`
 * (e.g. "AE" for UAE). Free-text from checkout (any language) must be normalized.
 */

/** English / Latin aliases (matched lowercase). */
const ALIAS: Record<string, string> = {
  uae: 'AE',
  'united arab emirates': 'AE',
  emirates: 'AE',
  dubai: 'AE',
  'saudi arabia': 'SA',
  ksa: 'SA',
  qatar: 'QA',
  bahrain: 'BH',
  oman: 'OM',
  kuwait: 'KW',
  usa: 'US',
  'united states': 'US',
  'united states of america': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  india: 'IN',
  pakistan: 'PK',
  egypt: 'EG',
  benin: 'BJ',
};

/**
 * Exact-match localized country names (device locale / reverse geocode often returns these).
 * Keys use NFC-normalized Unicode as typically returned by iOS/Android geocoders.
 */
const LOCALIZED_EXACT: Record<string, string> = {
  // Arabic — UAE / GCC / common
  'الإمارات العربية المتحدة': 'AE',
  'الإمارات': 'AE',
  'دولة الإمارات العربية المتحدة': 'AE',
  'المملكة العربية السعودية': 'SA',
  'السعودية': 'SA',
  'قطر': 'QA',
  'الكويت': 'KW',
  'البحرين': 'BH',
  'عمان': 'OM',
  'عُمان': 'OM',
  'مصر': 'EG',
  'الولايات المتحدة': 'US',
  'الولايات المتحدة الأمريكية': 'US',
  'المملكة المتحدة': 'GB',
  'بريطانيا': 'GB',
  'الهند': 'IN',
  'باكستان': 'PK',
  // Urdu (common for UAE label)
  'متحدہ عرب امارات': 'AE',
  'امارات': 'AE',
};

/** ISO 3166-1 alpha-3 → alpha-2 (when users or APIs send 3-letter codes). */
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  ARE: 'AE',
  SAU: 'SA',
  QAT: 'QA',
  KWT: 'KW',
  BHR: 'BH',
  OMN: 'OM',
  EGY: 'EG',
  USA: 'US',
  GBR: 'GB',
  IND: 'IN',
  PAK: 'PK',
};

export function countryToStripeAlpha2(country: string): string {
  const s = country.trim();
  if (!s) return '';
  const nfc = s.normalize('NFC');

  if (/^[A-Za-z]{2}$/.test(nfc)) {
    return nfc.toUpperCase();
  }

  if (/^[A-Za-z]{3}$/.test(nfc)) {
    const a3 = nfc.toUpperCase();
    if (ALPHA3_TO_ALPHA2[a3]) return ALPHA3_TO_ALPHA2[a3];
  }

  const localized = LOCALIZED_EXACT[nfc] ?? LOCALIZED_EXACT[s];
  if (localized) return localized;

  const fromAlias = ALIAS[nfc.toLowerCase()];
  if (fromAlias) return fromAlias;

  if (nfc.length === 2 && /^[A-Za-z]{2}$/.test(nfc)) {
    return nfc.toUpperCase();
  }

  // Never pass a long localized name to Stripe — it rejects non–alpha-2 values.
  return '';
}
