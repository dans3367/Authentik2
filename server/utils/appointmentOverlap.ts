import { and, eq, or, asc, sql } from 'drizzle-orm';
import { db } from '../db';
import { appointments, emailContacts, betterAuthUser } from '@shared/schema';

// Shared provider double-booking detection + advisory-lock helpers.
// Used by the authenticated appointment routes AND the public booking route so
// both paths serialize against the same PostgreSQL advisory lock and apply
// identical overlap semantics.

export type AppointmentOverlapCandidate = {
  appointmentDate: Date;
  duration?: number | null;
  providerId?: string | null;
  status?: string | null;
};

export type AppointmentOverlapConflict = {
  requestedStart: Date;
  requestedEnd: Date;
  conflictingAppointmentId: string;
  conflictingTitle: string;
  conflictingStart: Date;
  conflictingEnd: Date;
  conflictingDuration: number;
  conflictingStatus: string;
  conflictingCustomerName: string;
  conflictingCustomerEmail?: string | null;
  providerId?: string | null;
  providerName?: string | null;
};

export function isProviderConflictStatus(status?: string | null): boolean {
  return status === 'scheduled' || status === 'confirmed';
}

export function toPostgresTimestampString(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

export async function collectProviderOverlapConflicts({
  database = db,
  tenantId,
  shopId,
  candidates,
  excludeAppointmentId,
}: {
  database?: any;
  tenantId: string;
  shopId?: string | null;
  candidates: AppointmentOverlapCandidate[];
  excludeAppointmentId?: string;
}): Promise<AppointmentOverlapConflict[]> {
  const conflicts: AppointmentOverlapConflict[] = [];
  const seenConflictKeys = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate.providerId || !isProviderConflictStatus(candidate.status ?? 'scheduled')) {
      continue;
    }

    const candidateDuration = candidate.duration ?? 60;
    const requestedStart = new Date(candidate.appointmentDate);
    const requestedEnd = new Date(requestedStart.getTime() + candidateDuration * 60 * 1000);
    const requestedStartTimestamp = toPostgresTimestampString(requestedStart);
    const requestedEndTimestamp = toPostgresTimestampString(requestedEnd);
    const conditions = [
      eq(appointments.tenantId, tenantId),
      eq(appointments.providerId, candidate.providerId),
      or(
        eq(appointments.status, 'scheduled'),
        eq(appointments.status, 'confirmed'),
      )!,
      sql`${appointments.appointmentDate} < ${requestedEndTimestamp}::timestamp`,
      sql`${appointments.appointmentDate} + (coalesce(${appointments.duration}, 60) * interval '1 minute') > ${requestedStartTimestamp}::timestamp`,
    ];

    if (shopId) {
      conditions.push(eq(appointments.shopId, shopId));
    }

    if (excludeAppointmentId) {
      conditions.push(sql`${appointments.id} <> ${excludeAppointmentId}`);
    }

    const overlappingAppointments = await database
      .select({
        id: appointments.id,
        title: appointments.title,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        status: appointments.status,
        customerEmail: emailContacts.email,
        customerFirstName: emailContacts.firstName,
        customerLastName: emailContacts.lastName,
        providerId: betterAuthUser.id,
        providerName: betterAuthUser.name,
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .leftJoin(betterAuthUser, eq(appointments.providerId, betterAuthUser.id))
      .where(and(...conditions))
      .orderBy(asc(appointments.appointmentDate));

    for (const overlap of overlappingAppointments) {
      const conflictKey = `${requestedStart.toISOString()}:${overlap.id}`;
      if (seenConflictKeys.has(conflictKey)) {
        continue;
      }
      seenConflictKeys.add(conflictKey);

      const conflictingStart = new Date(overlap.appointmentDate);
      const conflictingDuration = overlap.duration ?? 60;
      const conflictingEnd = new Date(conflictingStart.getTime() + conflictingDuration * 60 * 1000);
      const customerName =
        `${overlap.customerFirstName || ''} ${overlap.customerLastName || ''}`.trim() ||
        overlap.customerEmail ||
        'Unknown Customer';

      conflicts.push({
        requestedStart,
        requestedEnd,
        conflictingAppointmentId: overlap.id,
        conflictingTitle: overlap.title,
        conflictingStart,
        conflictingEnd,
        conflictingDuration,
        conflictingStatus: overlap.status,
        conflictingCustomerName: customerName,
        conflictingCustomerEmail: overlap.customerEmail,
        providerId: overlap.providerId,
        providerName: overlap.providerName,
      });
    }
  }

  return conflicts;
}

export function getProviderScheduleLockKeys(tenantId: string, shopId: string | null | undefined, candidates: AppointmentOverlapCandidate[]): string[] {
  const keys = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.providerId || !isProviderConflictStatus(candidate.status ?? 'scheduled')) {
      continue;
    }
    keys.add(`${tenantId}:${shopId ?? 'all'}:${candidate.providerId}`);
  }
  return Array.from(keys).sort();
}

export async function acquireProviderScheduleLocks(
  database: any,
  tenantId: string,
  shopId: string | null | undefined,
  candidates: AppointmentOverlapCandidate[],
): Promise<void> {
  const lockKeys = getProviderScheduleLockKeys(tenantId, shopId, candidates);
  for (const lockKey of lockKeys) {
    await database.execute(sql`SELECT pg_advisory_xact_lock(hashtext('appointment_provider_schedule'), hashtext(${lockKey}))`);
  }
}
