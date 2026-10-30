export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** E.164-style string for auth APIs (matches Postman: "+971501234567"). */
export function normalizePhoneForApi(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return `+${normalizePhoneDigits(trimmed)}`;
  }
  const digits = normalizePhoneDigits(trimmed);
  if (!digits) return trimmed;
  if (digits.startsWith('971')) return `+${digits}`;
  if (digits.startsWith('0')) return `+971${digits.slice(1)}`;
  return `+${digits}`;
}

export function isValidPhoneForAuth(phone: string, minDigits = 8): boolean {
  return normalizePhoneDigits(phone).length >= minDigits;
}

export function maskPhoneForDisplay(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (digits.length <= 4) return phone;
  const tail = digits.slice(-4);
  return `••• ••• ${tail}`;
}
