/** Job Scheduling System — shared types (UI + future API). */

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type CalendarViewMode = 'day' | 'week' | 'month';

export type SlotStatus = 'available' | 'full' | 'blocked' | 'past';

export type ScheduledJobStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'delivered'
  | 'cancelled'
  | 'rescheduled'
  | 'rejected';

export interface WorkingHoursDay {
  day: Weekday;
  enabled: boolean;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface TimeSlotConfig {
  id: string;
  label: string; // e.g. 09:00 AM
  startTime: string; // HH:mm 24h
  durationMinutes: number;
  enabled: boolean;
}

export interface SchedulingSettings {
  workingDays: WorkingHoursDay[];
  slotDurationMinutes: number;
  maxBookingsPerSlot: number;
  maxBookingsPerDay: number;
  bufferMinutesBetweenJobs: number;
  timezone: string;
}

export interface BlockedPeriod {
  id: string;
  type: 'date' | 'slot';
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm when type=slot
  endTime?: string;
  reason?: string;
}

export interface AvailableSlot {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
  bookedCount: number;
  maxBookings: number;
  remaining: number;
}

export interface ScheduledJob {
  id: string;
  serviceName: string;
  customerName: string;
  customerPhone?: string;
  technicianId?: string | null;
  technicianName?: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  status: ScheduledJobStatus;
  /** API display label when provided (e.g. "Delivered"). */
  statusLabel?: string;
  orderNumber?: string;
  jobSource?: string;
  address?: string;
  notes?: string;
  overlapsTechnician?: boolean;
}
