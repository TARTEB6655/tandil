/** Predefined HH:mm options for admin scheduling UIs. */

export function buildTimeOptions(stepMinutes = 30, startHour = 6, endHour = 22): string[] {
  const out: string[] = [];
  const start = startHour * 60;
  const end = endHour * 60;
  for (let m = start; m <= end; m += stepMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return out;
}

/** Default day window options (06:00–22:00 every 30 min). */
export const SCHEDULING_TIME_OPTIONS = buildTimeOptions(30, 6, 22);

/** Slot duration choices (minutes). */
export const SCHEDULING_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export function formatTimeOptionLabel(hhmm: string): string {
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return hhmm;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

/** Ensure current value appears in the list even if off-grid (legacy API data). */
export function withCurrentTimeOption(options: string[], current?: string | null): string[] {
  const v = String(current || '').trim();
  if (!v || options.includes(v)) return options;
  return [...options, v].sort();
}
