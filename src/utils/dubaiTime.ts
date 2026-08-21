/** Dubai (GST / UTC+4) helpers for client booking UIs. */

export const DUBAI_TIME_ZONE = 'Asia/Dubai';

export function getDubaiDateIso(now = new Date()): string {
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DUBAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Minutes since midnight in Asia/Dubai. */
export function getDubaiMinutesSinceMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DUBAI_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** Parse slot labels like "09:00 AM", "3:30 PM", or "15:00" → minutes since midnight. */
export function parseSlotLabelToMinutes(label: string): number | null {
  const raw = String(label || '').trim();
  if (!raw) return null;

  const m12 = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = parseInt(m12[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    const ap = m12[3].toUpperCase();
    if (ap === 'AM') {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
    return h * 60 + min;
  }

  const m24 = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    return h * 60 + min;
  }

  return null;
}

/** Split "09:30 AM" → { clock: "09:30", period: "AM" } for compact slot UI. */
export function splitSlotLabel(label: string): { clock: string; period: string } {
  const raw = String(label || '').trim();
  const m12 = raw.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
  if (m12) {
    return { clock: m12[1], period: m12[2].toUpperCase() };
  }
  return { clock: raw, period: '' };
}

/**
 * True when `dateIso` is today in Dubai and the slot start time has already passed
 * (or is the current minute) in Asia/Dubai.
 */
export function isPastBookingSlotInDubai(
  dateIso: string | null | undefined,
  slotLabel: string,
  now = new Date()
): boolean {
  const day = String(dateIso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  if (day !== getDubaiDateIso(now)) return false;
  const slotMins = parseSlotLabelToMinutes(slotLabel);
  if (slotMins == null) return false;
  return slotMins <= getDubaiMinutesSinceMidnight(now);
}
