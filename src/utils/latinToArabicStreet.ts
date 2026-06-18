/** Detect Arabic/Urdu script (Arabic Unicode block). */
export function isArabicScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

export function isMostlyLatin(text: string): boolean {
  const letters = text.replace(/[^A-Za-z\u0600-\u06FF]/g, '');
  if (!letters) return false;
  const latin = letters.replace(/[^A-Za-z]/g, '').length;
  return latin / letters.length > 0.5;
}

const STREET_TERMS: Record<'ar' | 'ur', Record<string, string>> = {
  ar: {
    street: 'شارع',
    road: 'طريق',
    avenue: 'جادة',
    boulevard: 'شارع',
    lane: 'زقاق',
    drive: 'طريق',
    way: 'طريق',
    square: 'ساحة',
    plaza: 'ساحة',
  },
  ur: {
    street: 'گلی',
    road: 'سڑک',
    avenue: 'شاہراہ',
    boulevard: 'بلوار',
    lane: 'گلی',
    drive: 'سڑک',
    way: 'راستہ',
    square: 'چوک',
    plaza: 'چوک',
  },
};

/** Rough Latin → Arabic-script phonetic map for address labels. */
const LATIN_PHONETIC: Record<string, string> = {
  a: 'ا',
  b: 'ب',
  c: 'ك',
  d: 'د',
  e: 'ي',
  f: 'ف',
  g: 'ج',
  h: 'ه',
  i: 'ي',
  j: 'ج',
  k: 'ك',
  l: 'ل',
  m: 'م',
  n: 'ن',
  o: 'و',
  p: 'ب',
  q: 'ق',
  r: 'ر',
  s: 'س',
  t: 'ت',
  u: 'و',
  v: 'ف',
  w: 'و',
  x: 'كس',
  y: 'ي',
  z: 'ز',
};

function transliterateWord(word: string): string {
  const lower = word.toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (LATIN_PHONETIC[ch]) out += LATIN_PHONETIC[ch];
    else if (/\d/.test(ch)) out += ch;
    else if (ch === '&') out += ' و ';
    else if (ch === '-') out += '-';
  }
  return out.trim();
}

/**
 * When geocoders only return Latin street names, show a readable Arabic/Urdu label.
 * Example: "Ellis Street" → "شارع إيليس"
 */
export function transliterateStreetLabel(street: string, lang: 'ar' | 'ur'): string {
  const trimmed = street.trim();
  if (!trimmed || isArabicScript(trimmed) || !isMostlyLatin(trimmed)) {
    return trimmed;
  }

  const terms = STREET_TERMS[lang];
  const parts = trimmed.split(/[\s,/]+/).filter(Boolean);
  const translated: string[] = [];
  let suffixTerm: string | null = null;

  for (const part of parts) {
    const key = part.replace(/[^A-Za-z]/g, '').toLowerCase();
    if (terms[key]) {
      suffixTerm = terms[key];
      continue;
    }
    const phonetic = transliterateWord(part);
    if (phonetic) translated.push(phonetic);
  }

  const name = translated.join(' ').trim();
  if (suffixTerm && name) return `${suffixTerm} ${name}`;
  if (suffixTerm) return suffixTerm;
  if (name) return lang === 'ar' ? `شارع ${name}` : name;
  return trimmed;
}
