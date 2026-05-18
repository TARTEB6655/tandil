/** Decode JWT payload (no signature verification — used only to read email/sub for login fallback). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    if (typeof globalThis.atob !== 'function') return null;
    const decoded = globalThis.atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readJwtString(payload: Record<string, unknown> | null, key: string): string {
  const v = payload?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}
