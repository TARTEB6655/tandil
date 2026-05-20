/** Laravel validation errors: { errors: { code: ["The code has already been taken."] } } */

export function extractCouponFieldErrors(
  errors: unknown
): Record<string, string> {
  if (!errors || typeof errors !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(errors as Record<string, unknown>)) {
    if (Array.isArray(val) && val.length > 0 && val[0] != null) {
      out[key] = String(val[0]);
    } else if (typeof val === 'string' && val.trim()) {
      out[key] = val.trim();
    }
  }
  return out;
}

export function getCouponErrorFeedback(err: unknown): {
  alertMessage: string;
  fieldErrors: Record<string, string>;
} {
  const anyErr = err as {
    message?: string;
    fieldErrors?: Record<string, string>;
    response?: { data?: { message?: string; errors?: unknown } };
  };
  const data = anyErr?.response?.data;
  const fieldErrors =
    anyErr?.fieldErrors ??
    extractCouponFieldErrors(data?.errors);

  const firstFieldMessage = Object.values(fieldErrors).find(Boolean);
  const alertMessage =
    fieldErrors.code ||
    firstFieldMessage ||
    data?.message ||
    anyErr?.message ||
    'Request failed.';

  return { alertMessage, fieldErrors };
}
