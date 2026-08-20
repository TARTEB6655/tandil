/**
 * Job Scheduling — mock data layer for UI testing.
 * Replace with real API calls when backend endpoints are ready.
 */
import type {
  AvailableSlot,
  BlockedPeriod,
  ScheduledJob,
  SchedulingSettings,
  TimeSlotConfig,
  Weekday,
} from '../types/scheduling';

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

let settings: SchedulingSettings = {
  workingDays: WEEKDAYS.map((day) => ({
    day,
    enabled: day !== 'friday',
    startTime: '09:00',
    endTime: '18:00',
  })),
  slotDurationMinutes: 60,
  maxBookingsPerSlot: 2,
  maxBookingsPerDay: 12,
  bufferMinutesBetweenJobs: 15,
  timezone: 'Asia/Dubai',
};

let slotConfigs: TimeSlotConfig[] = [
  { id: 's1', label: '09:00 AM', startTime: '09:00', durationMinutes: 60, enabled: true },
  { id: 's2', label: '10:00 AM', startTime: '10:00', durationMinutes: 60, enabled: true },
  { id: 's3', label: '11:00 AM', startTime: '11:00', durationMinutes: 60, enabled: true },
  { id: 's4', label: '12:00 PM', startTime: '12:00', durationMinutes: 60, enabled: true },
  { id: 's5', label: '01:00 PM', startTime: '13:00', durationMinutes: 60, enabled: true },
  { id: 's6', label: '02:00 PM', startTime: '14:00', durationMinutes: 60, enabled: true },
  { id: 's7', label: '03:00 PM', startTime: '15:00', durationMinutes: 60, enabled: true },
  { id: 's8', label: '04:00 PM', startTime: '16:00', durationMinutes: 60, enabled: true },
  { id: 's9', label: '05:00 PM', startTime: '17:00', durationMinutes: 60, enabled: false },
];

let blockedPeriods: BlockedPeriod[] = [
  {
    id: 'b1',
    type: 'date',
    date: isoDateOffset(3),
    reason: 'Public holiday / team offsite',
  },
  {
    id: 'b2',
    type: 'slot',
    date: isoDateOffset(1),
    startTime: '11:00',
    endTime: '12:00',
    reason: 'Training session',
  },
];

let jobs: ScheduledJob[] = [
  {
    id: 'job_1',
    serviceName: 'Palm tree pruning',
    customerName: 'Mousa Al Baloushi',
    customerPhone: '+971500000001',
    technicianId: 'tech_1',
    technicianName: 'Ahmed Hassan',
    date: isoDateOffset(0),
    startTime: '10:00',
    endTime: '11:00',
    status: 'confirmed',
    address: 'Al Barsha, Dubai',
  },
  {
    id: 'job_2',
    serviceName: 'Garden maintenance',
    customerName: 'Eisa Al Blooshi',
    technicianId: 'tech_1',
    technicianName: 'Ahmed Hassan',
    date: isoDateOffset(0),
    startTime: '10:30',
    endTime: '11:30',
    status: 'confirmed',
    address: 'Jumeirah, Dubai',
    overlapsTechnician: true,
  },
  {
    id: 'job_3',
    serviceName: 'Soil enrichment',
    customerName: 'Sara Khan',
    technicianId: 'tech_2',
    technicianName: 'Omar Ali',
    date: isoDateOffset(1),
    startTime: '14:00',
    endTime: '15:00',
    status: 'pending',
    address: 'Marina, Dubai',
  },
  {
    id: 'job_4',
    serviceName: 'Seasonal treatment',
    customerName: 'Fatima Noor',
    technicianId: 'tech_2',
    technicianName: 'Omar Ali',
    date: isoDateOffset(2),
    startTime: '09:00',
    endTime: '10:00',
    status: 'confirmed',
    address: 'Business Bay, Dubai',
  },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function isoDateOffset(daysFromToday: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDisplayDate(iso: string, locale = 'en-US'): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function weekdayOfIso(iso: string): Weekday {
  const d = new Date(iso + 'T12:00:00');
  return WEEKDAYS[(d.getDay() + 6) % 7]; // JS Sun=0 → our monday-first
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

function toLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${pad(hour12)}:${pad(m)} ${ampm}`;
}

/** --- Settings --- */
export async function getSchedulingSettings(): Promise<SchedulingSettings> {
  return JSON.parse(JSON.stringify(settings));
}

export async function saveSchedulingSettings(
  next: SchedulingSettings
): Promise<SchedulingSettings> {
  settings = JSON.parse(JSON.stringify(next));
  return getSchedulingSettings();
}

export async function getTimeSlotConfigs(): Promise<TimeSlotConfig[]> {
  return JSON.parse(JSON.stringify(slotConfigs));
}

export async function saveTimeSlotConfigs(
  next: TimeSlotConfig[]
): Promise<TimeSlotConfig[]> {
  slotConfigs = JSON.parse(JSON.stringify(next));
  return getTimeSlotConfigs();
}

/** --- Blocks --- */
export async function getBlockedPeriods(): Promise<BlockedPeriod[]> {
  return JSON.parse(JSON.stringify(blockedPeriods));
}

export async function addBlockedPeriod(
  period: Omit<BlockedPeriod, 'id'>
): Promise<BlockedPeriod> {
  const row: BlockedPeriod = { ...period, id: `b_${Date.now()}` };
  blockedPeriods = [row, ...blockedPeriods];
  return row;
}

export async function removeBlockedPeriod(id: string): Promise<void> {
  blockedPeriods = blockedPeriods.filter((b) => b.id !== id);
}

/** --- Customer available slots --- */
export async function getAvailableSlotsForDate(dateIso: string): Promise<AvailableSlot[]> {
  const day = weekdayOfIso(dateIso);
  const working = settings.workingDays.find((w) => w.day === day);
  if (!working?.enabled) return [];

  const dateBlocked = blockedPeriods.some((b) => b.type === 'date' && b.date === dateIso);
  if (dateBlocked) return [];

  const dayBookings = jobs.filter(
    (j) => j.date === dateIso && j.status !== 'cancelled'
  ).length;

  return slotConfigs
    .filter((s) => s.enabled)
    .filter((s) => s.startTime >= working.startTime && s.startTime < working.endTime)
    .map((s) => {
      const endTime = addMinutes(s.startTime, s.durationMinutes);
      const slotBlocked = blockedPeriods.some(
        (b) =>
          b.type === 'slot' &&
          b.date === dateIso &&
          b.startTime === s.startTime
      );
      const bookedCount = jobs.filter(
        (j) =>
          j.date === dateIso &&
          j.startTime === s.startTime &&
          j.status !== 'cancelled'
      ).length;
      const remaining = Math.max(0, settings.maxBookingsPerSlot - bookedCount);
      const dayFull = dayBookings >= settings.maxBookingsPerDay;

      let status: AvailableSlot['status'] = 'available';
      if (slotBlocked) status = 'blocked';
      else if (dayFull || remaining <= 0) status = 'full';

      return {
        id: `${dateIso}_${s.startTime}`,
        date: dateIso,
        label: s.label || toLabel(s.startTime),
        startTime: s.startTime,
        endTime,
        status,
        bookedCount,
        maxBookings: settings.maxBookingsPerSlot,
        remaining,
      };
    });
}

/** Next N bookable dates (working days, not fully blocked). */
export async function getBookableDates(daysAhead = 21): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const iso = isoDateOffset(i);
    const day = weekdayOfIso(iso);
    const working = settings.workingDays.find((w) => w.day === day);
    if (!working?.enabled) continue;
    if (blockedPeriods.some((b) => b.type === 'date' && b.date === iso)) continue;
    out.push(iso);
  }
  return out;
}

/** --- Jobs / calendar --- */
export async function getScheduledJobs(params?: {
  from?: string;
  to?: string;
  technicianId?: string;
}): Promise<ScheduledJob[]> {
  let list = [...jobs];
  if (params?.from) list = list.filter((j) => j.date >= params.from!);
  if (params?.to) list = list.filter((j) => j.date <= params.to!);
  if (params?.technicianId) {
    list = list.filter((j) => j.technicianId === params.technicianId);
  }
  return list.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)
  );
}

export async function getScheduledJobById(id: string): Promise<ScheduledJob | null> {
  return jobs.find((j) => j.id === id) || null;
}

export async function updateScheduledJob(
  id: string,
  patch: Partial<ScheduledJob>
): Promise<ScheduledJob> {
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx < 0) throw new Error('Job not found');
  jobs[idx] = { ...jobs[idx], ...patch, id };
  // Flag overlap for same technician same day overlapping times (UI demo)
  if (jobs[idx].technicianId) {
    const techId = jobs[idx].technicianId;
    jobs = jobs.map((j) => {
      if (j.technicianId !== techId || j.id === id || j.date !== jobs[idx].date) {
        return { ...j, overlapsTechnician: false };
      }
      const overlaps =
        j.startTime < jobs[idx].endTime && j.endTime > jobs[idx].startTime;
      return { ...j, overlapsTechnician: overlaps };
    });
    jobs[idx].overlapsTechnician = jobs.some(
      (j) =>
        j.id !== id &&
        j.technicianId === techId &&
        j.date === jobs[idx].date &&
        j.startTime < jobs[idx].endTime &&
        j.endTime > jobs[idx].startTime
    );
  }
  return jobs[idx];
}

export const schedulingMockService = {
  getSchedulingSettings,
  saveSchedulingSettings,
  getTimeSlotConfigs,
  saveTimeSlotConfigs,
  getBlockedPeriods,
  addBlockedPeriod,
  removeBlockedPeriod,
  getAvailableSlotsForDate,
  getBookableDates,
  getScheduledJobs,
  getScheduledJobById,
  updateScheduledJob,
  isoDateOffset,
  formatDisplayDate,
};

export default schedulingMockService;
