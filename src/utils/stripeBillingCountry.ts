/**
 * Stripe Payment Sheet expects ISO 3166-1 alpha-2 in `BillingDetails.address.country`
 * (e.g. "AE" for UAE). Free-text from checkout must be normalized.
 */
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

export function countryToStripeAlpha2(country: string): string {
  const s = country.trim();
  if (!s) return '';
  if (/^[A-Za-z]{2}$/.test(s)) {
    return s.toUpperCase();
  }
  const fromAlias = ALIAS[s.toLowerCase()];
  if (fromAlias) return fromAlias;
  return s.length === 2 ? s.toUpperCase() : s;
}
