import { fromZonedTime } from 'date-fns-tz';
import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { appointments } from '@shared/schema';
import { toPostgresTimestampString } from './appointmentOverlap';

// Computes a provider's open booking slots from their availability (weekly hours
// + date overrides + booking rules) minus existing appointments. All wall-clock
// times are interpreted in the provider's IANA timezone (DST-aware via
// date-fns-tz). Cross-midnight ranges are not supported (schema enforces start<end).

interface Range { start: string; end: string }
interface DayHours { day: number; enabled: boolean; ranges: Range[] }
interface Override { date: string; type: 'off' | 'custom'; ranges: Range[] | null }

export interface BookableSlot {
  startUtc: string; // ISO 8601 UTC
  endUtc: string;   // ISO 8601 UTC
  label: string;    // provider-local "HH:MM" (the client re-renders in the visitor's tz)
}
export interface SlotsByDate {
  date: string;     // provider-local YYYY-MM-DD
  slots: BookableSlot[];
}

export interface ComputeSlotsInput {
  tenantId: string;
  providerId: string;
  timezone: string;
  weeklyHours: DayHours[];
  overrides: Override[];
  slotLengthMinutes: number;
  bufferMinutes: number;
  minimumNoticeHours: number;
  bookingHorizonDays: number;
  // Optional explicit bookable window (provider-local YYYY-MM-DD). Narrows the
  // offered dates; null/undefined means unbounded on that side.
  bookableStartDate?: string | null;
  bookableEndDate?: string | null;
  now?: Date; // injectable for tests
}

// Hard upper bound (days past today) on how far out slots are computed. Matches
// the schema's max bookingHorizonDays (365) so a full-year rolling horizon or an
// explicit bookable window up to a year out is honored; also bounds the busy
// query window and the date loop.
const MAX_HORIZON_DAYS = 365;

// Provider-local YYYY-MM-DD for an instant (en-CA formats as YYYY-MM-DD).
function localDateString(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Day-of-week (0=Sun..6=Sat) for a calendar date string (timezone-independent).
function dowOfLocalDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Add n calendar days to a YYYY-MM-DD string.
function addDaysToDateString(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return localDateString(dt, 'UTC');
}

export async function computeOpenSlots(input: ComputeSlotsInput): Promise<SlotsByDate[]> {
  const now = input.now ?? new Date();
  const earliestMs = now.getTime() + input.minimumNoticeHours * 3_600_000;
  const horizon = Math.min(Math.max(input.bookingHorizonDays, 0), MAX_HORIZON_DAYS);
  const slotLen = input.slotLengthMinutes;
  const buffer = input.bufferMinutes;

  const todayLocal = localDateString(now, input.timezone);
  // The explicit window (if any) narrows the range; a hard cap of MAX_HORIZON_DAYS
  // past today bounds the query regardless of how far out the window's end is.
  const hardCapDate = addDaysToDateString(todayLocal, MAX_HORIZON_DAYS);
  const rollingEnd = addDaysToDateString(todayLocal, horizon);
  const startDate =
    input.bookableStartDate && input.bookableStartDate > todayLocal ? input.bookableStartDate : todayLocal;
  let endDate = input.bookableEndDate ?? rollingEnd;
  if (endDate > hardCapDate) endDate = hardCapDate;

  const dates: string[] = [];
  for (let cursor = startDate; cursor <= endDate; cursor = addDaysToDateString(cursor, 1)) {
    dates.push(cursor);
    if (dates.length > MAX_HORIZON_DAYS + 1) break; // belt-and-suspenders against a runaway loop
  }
  if (dates.length === 0) return [];
  const firstLocal = dates[0];
  const lastLocal = dates[dates.length - 1];

  // One query for all existing busy intervals in the window (provider-wide).
  const windowStartUtc = fromZonedTime(`${firstLocal}T00:00:00`, input.timezone);
  const windowEndUtc = fromZonedTime(`${lastLocal}T23:59:59`, input.timezone);
  const busyRows = await db
    .select({ appointmentDate: appointments.appointmentDate, duration: appointments.duration })
    .from(appointments)
    .where(and(
      eq(appointments.tenantId, input.tenantId),
      eq(appointments.providerId, input.providerId),
      or(eq(appointments.status, 'scheduled'), eq(appointments.status, 'confirmed'))!,
      sql`${appointments.appointmentDate} < ${toPostgresTimestampString(windowEndUtc)}::timestamp`,
      sql`${appointments.appointmentDate} + (coalesce(${appointments.duration}, 60) * interval '1 minute') > ${toPostgresTimestampString(windowStartUtc)}::timestamp`,
    ));
  const busy = busyRows.map((r) => {
    const startMs = new Date(r.appointmentDate as Date).getTime();
    return { startMs, endMs: startMs + (r.duration ?? 60) * 60_000 };
  });

  const overrideByDate = new Map<string, Override>();
  for (const o of input.overrides) overrideByDate.set(o.date, o);

  const result: SlotsByDate[] = [];

  for (const date of dates) {
    const override = overrideByDate.get(date);
    let ranges: Range[];
    if (override) {
      if (override.type === 'off') continue;
      ranges = override.ranges ?? [];
    } else {
      const day = input.weeklyHours.find((d) => d.day === dowOfLocalDate(date));
      ranges = day && day.enabled ? day.ranges : [];
    }
    if (ranges.length === 0) continue;

    const slots: BookableSlot[] = [];
    for (const range of ranges) {
      const startMin = hhmmToMinutes(range.start);
      const endMin = hhmmToMinutes(range.end);
      for (let s = startMin; s + slotLen <= endMin; s += slotLen) {
        const hhmm = minutesToHHMM(s);
        const startUtc = fromZonedTime(`${date}T${hhmm}:00`, input.timezone);
        const startMs = startUtc.getTime();
        const endMs = startMs + slotLen * 60_000;
        if (startMs < earliestMs) continue;
        // Buffer widens the candidate on both sides when testing against busy intervals.
        const bStart = startMs - buffer * 60_000;
        const bEnd = endMs + buffer * 60_000;
        if (busy.some((b) => bStart < b.endMs && bEnd > b.startMs)) continue;
        slots.push({ startUtc: startUtc.toISOString(), endUtc: new Date(endMs).toISOString(), label: hhmm });
      }
    }
    if (slots.length > 0) result.push({ date, slots });
  }

  return result;
}
