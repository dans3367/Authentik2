import { db } from '../db';
import { emailContacts, emailSends, newsletters, appointments } from '@shared/schema';
import { eq, sql, and, gte, lt, count } from 'drizzle-orm';

// --- Types ---

export interface StatMetric {
  value: number;
  change: number | null; // percentage change vs prior period; null if prior period is 0
  sparkline: number[]; // last N_SPARK_WEEKS weekly data points; empty array if not applicable
}

export interface HighlightStats {
  totalContacts: StatMetric;
  emailsSentThisMonth: StatMetric;
  newslettersSent: StatMetric;
  upcomingAppointments: StatMetric;
}

// --- Helpers ---

const N_SPARK_WEEKS = 12;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function computeChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10; // one decimal
}

function getMonthRange(offset: number = 0): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

// Returns the Monday 00:00 of the week containing `d` (matches Postgres
// `date_trunc('week', ...)`, which aligns to ISO Monday).
function startOfISOWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay(); // 0=Sun..6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + mondayOffset);
  return r;
}

function bucketize(
  rows: Array<{ bucket: Date | string; count: number }>,
  startMonday: Date,
  nWeeks: number,
): number[] {
  const series = new Array(nWeeks).fill(0);
  const startMs = startMonday.getTime();
  for (const row of rows) {
    const bucketDate = row.bucket instanceof Date ? row.bucket : new Date(row.bucket);
    const idx = Math.floor((bucketDate.getTime() - startMs) / MS_PER_WEEK);
    if (idx >= 0 && idx < nWeeks) series[idx] = Number(row.count);
  }
  return series;
}

// --- Stats Functions ---

export async function getHighlightStats(tenantId: string, shopId?: string | null): Promise<HighlightStats> {
  const currentMonth = getMonthRange(0);
  const previousMonth = getMonthRange(-1);
  const now = new Date();
  const sparkStart = startOfISOWeek(new Date(now.getTime() - N_SPARK_WEEKS * MS_PER_WEEK));

  // Build base conditions per table, optionally scoped to a shop
  const contactBase = shopId
    ? and(eq(emailContacts.tenantId, tenantId), eq(emailContacts.shopId, shopId))
    : eq(emailContacts.tenantId, tenantId);

  const sendsBase = (extra: any[]) => shopId
    ? and(eq(emailSends.tenantId, tenantId), eq(emailSends.shopId, shopId), ...extra)
    : and(eq(emailSends.tenantId, tenantId), ...extra);

  const nlBase = (extra: any[]) => shopId
    ? and(eq(newsletters.tenantId, tenantId), eq(newsletters.shopId, shopId), ...extra)
    : and(eq(newsletters.tenantId, tenantId), ...extra);

  const apptBase = shopId
    ? and(eq(appointments.tenantId, tenantId), eq(appointments.shopId, shopId), gte(appointments.appointmentDate, now), sql`${appointments.status} IN ('scheduled', 'confirmed')`)
    : and(eq(appointments.tenantId, tenantId), gte(appointments.appointmentDate, now), sql`${appointments.status} IN ('scheduled', 'confirmed')`);

  const contactsWeekBucket = sql<Date>`date_trunc('week', ${emailContacts.createdAt})`;
  const emailsWeekBucket = sql<Date>`date_trunc('week', ${emailSends.sentAt})`;
  const newslettersWeekBucket = sql<Date>`date_trunc('week', ${newsletters.sentAt})`;

  const [
    // Total contacts (current)
    contactsCurrent,
    // Contacts that existed before this month (proxy for previous period count)
    contactsPrevious,
    // Emails sent this month
    emailsCurrentMonth,
    // Emails sent previous month
    emailsPreviousMonth,
    // Newsletters sent (all time)
    newslettersSentCurrent,
    // Newsletters sent before this month
    newslettersSentPrevious,
    // Upcoming appointments
    upcomingAppointmentsCurrent,
    // --- Sparkline data ---
    // Contacts created before sparkStart (baseline for cumulative series)
    contactsBaseline,
    // Contacts created weekly since sparkStart
    contactsWeekly,
    // Emails sent weekly since sparkStart
    emailsWeekly,
    // Newsletters sent weekly since sparkStart
    newslettersWeekly,
  ] = await Promise.all([
    // Total contacts
    db.select({ count: count() })
      .from(emailContacts)
      .where(contactBase),

    // Contacts created before this month (previous snapshot)
    db.select({ count: count() })
      .from(emailContacts)
      .where(and(contactBase, lt(emailContacts.createdAt, currentMonth.start))),

    // Emails sent this month
    db.select({ count: count() })
      .from(emailSends)
      .where(sendsBase([gte(emailSends.sentAt, currentMonth.start), lt(emailSends.sentAt, currentMonth.end)])),

    // Emails sent previous month
    db.select({ count: count() })
      .from(emailSends)
      .where(sendsBase([gte(emailSends.sentAt, previousMonth.start), lt(emailSends.sentAt, previousMonth.end)])),

    // Newsletters sent this month
    db.select({ count: count() })
      .from(newsletters)
      .where(nlBase([eq(newsletters.status, 'sent'), gte(newsletters.sentAt, currentMonth.start), lt(newsletters.sentAt, currentMonth.end)])),

    // Newsletters sent previous month
    db.select({ count: count() })
      .from(newsletters)
      .where(nlBase([eq(newsletters.status, 'sent'), gte(newsletters.sentAt, previousMonth.start), lt(newsletters.sentAt, previousMonth.end)])),

    // Upcoming appointments (scheduled or confirmed, in the future)
    db.select({ count: count() })
      .from(appointments)
      .where(apptBase),

    // Baseline: contacts created before the sparkline window
    db.select({ count: count() })
      .from(emailContacts)
      .where(and(contactBase, lt(emailContacts.createdAt, sparkStart))),

    // Weekly contact creations across the sparkline window
    db.select({ bucket: contactsWeekBucket, count: count() })
      .from(emailContacts)
      .where(and(contactBase, gte(emailContacts.createdAt, sparkStart)))
      .groupBy(contactsWeekBucket)
      .orderBy(contactsWeekBucket),

    // Weekly email sends across the sparkline window
    db.select({ bucket: emailsWeekBucket, count: count() })
      .from(emailSends)
      .where(sendsBase([gte(emailSends.sentAt, sparkStart)]))
      .groupBy(emailsWeekBucket)
      .orderBy(emailsWeekBucket),

    // Weekly newsletters sent across the sparkline window
    db.select({ bucket: newslettersWeekBucket, count: count() })
      .from(newsletters)
      .where(nlBase([eq(newsletters.status, 'sent'), gte(newsletters.sentAt, sparkStart)]))
      .groupBy(newslettersWeekBucket)
      .orderBy(newslettersWeekBucket),
  ]);

  const totalContactsVal = contactsCurrent[0]?.count ?? 0;
  const totalContactsPrev = contactsPrevious[0]?.count ?? 0;

  const emailsVal = emailsCurrentMonth[0]?.count ?? 0;
  const emailsPrev = emailsPreviousMonth[0]?.count ?? 0;

  const newslettersVal = newslettersSentCurrent[0]?.count ?? 0;
  const newslettersPrev = newslettersSentPrevious[0]?.count ?? 0;

  const upcomingVal = upcomingAppointmentsCurrent[0]?.count ?? 0;

  // Build weekly sparkline series. Contacts are cumulative (baseline + running
  // sum of weekly creations); emails and newsletters are per-week activity.
  const contactsWeeklyCreations = bucketize(contactsWeekly, sparkStart, N_SPARK_WEEKS);
  const baseline = contactsBaseline[0]?.count ?? 0;
  let running = baseline;
  const contactsSpark = contactsWeeklyCreations.map((c) => {
    running += c;
    return running;
  });

  const emailsSpark = bucketize(emailsWeekly, sparkStart, N_SPARK_WEEKS);
  const newslettersSpark = bucketize(newslettersWeekly, sparkStart, N_SPARK_WEEKS);

  return {
    totalContacts: {
      value: totalContactsVal,
      change: computeChange(totalContactsVal, totalContactsPrev),
      sparkline: contactsSpark,
    },
    emailsSentThisMonth: {
      value: emailsVal,
      change: computeChange(emailsVal, emailsPrev),
      sparkline: emailsSpark,
    },
    newslettersSent: {
      value: newslettersVal,
      change: computeChange(newslettersVal, newslettersPrev),
      sparkline: newslettersSpark,
    },
    upcomingAppointments: {
      value: upcomingVal,
      change: null, // no meaningful prior period for upcoming appointments
      sparkline: [], // snapshot metric — no historical series
    },
  };
}
