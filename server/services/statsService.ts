import { db } from '../db';
import { emailContacts, emailSends, newsletters, appointments } from '@shared/schema';
import { eq, sql, and, gte, lt, count } from 'drizzle-orm';

// --- Types ---

export interface StatMetric {
  value: number;
  change: number | null; // percentage change vs prior period; null if prior period is 0
}

export interface HighlightStats {
  totalContacts: StatMetric;
  emailsSentThisMonth: StatMetric;
  newslettersSent: StatMetric;
  upcomingAppointments: StatMetric;
}

// --- Helpers ---

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

// --- Stats Functions ---

export async function getHighlightStats(tenantId: string): Promise<HighlightStats> {
  const currentMonth = getMonthRange(0);
  const previousMonth = getMonthRange(-1);
  const now = new Date();

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
  ] = await Promise.all([
    // Total contacts
    db.select({ count: count() })
      .from(emailContacts)
      .where(eq(emailContacts.tenantId, tenantId)),

    // Contacts created before this month (previous snapshot)
    db.select({ count: count() })
      .from(emailContacts)
      .where(and(
        eq(emailContacts.tenantId, tenantId),
        lt(emailContacts.createdAt, currentMonth.start)
      )),

    // Emails sent this month
    db.select({ count: count() })
      .from(emailSends)
      .where(and(
        eq(emailSends.tenantId, tenantId),
        gte(emailSends.sentAt, currentMonth.start),
        lt(emailSends.sentAt, currentMonth.end)
      )),

    // Emails sent previous month
    db.select({ count: count() })
      .from(emailSends)
      .where(and(
        eq(emailSends.tenantId, tenantId),
        gte(emailSends.sentAt, previousMonth.start),
        lt(emailSends.sentAt, previousMonth.end)
      )),

    // Newsletters sent (all time)
    db.select({ count: count() })
      .from(newsletters)
      .where(and(
        eq(newsletters.tenantId, tenantId),
        eq(newsletters.status, 'sent')
      )),

    // Newsletters sent before this month
    db.select({ count: count() })
      .from(newsletters)
      .where(and(
        eq(newsletters.tenantId, tenantId),
        eq(newsletters.status, 'sent'),
        lt(newsletters.sentAt, currentMonth.start)
      )),

    // Upcoming appointments (scheduled or confirmed, in the future)
    db.select({ count: count() })
      .from(appointments)
      .where(and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.appointmentDate, now),
        sql`${appointments.status} IN ('scheduled', 'confirmed')`
      )),
  ]);

  const totalContactsVal = contactsCurrent[0]?.count ?? 0;
  const totalContactsPrev = contactsPrevious[0]?.count ?? 0;

  const emailsVal = emailsCurrentMonth[0]?.count ?? 0;
  const emailsPrev = emailsPreviousMonth[0]?.count ?? 0;

  const newslettersVal = newslettersSentCurrent[0]?.count ?? 0;
  const newslettersPrev = newslettersSentPrevious[0]?.count ?? 0;

  // Newsletters sent this month = total - previous
  const newslettersThisMonth = newslettersVal - newslettersPrev;

  const upcomingVal = upcomingAppointmentsCurrent[0]?.count ?? 0;

  return {
    totalContacts: {
      value: totalContactsVal,
      change: computeChange(totalContactsVal, totalContactsPrev),
    },
    emailsSentThisMonth: {
      value: emailsVal,
      change: computeChange(emailsVal, emailsPrev),
    },
    newslettersSent: {
      value: newslettersVal,
      change: newslettersPrev > 0
        ? computeChange(newslettersThisMonth, newslettersPrev)
        : null,
    },
    upcomingAppointments: {
      value: upcomingVal,
      change: null, // no meaningful prior period for upcoming appointments
    },
  };
}
