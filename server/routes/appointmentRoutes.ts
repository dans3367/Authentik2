import { Router, Request, Response } from 'express';
import { and, eq, desc, asc, like, ilike, gte, lte, isNull, isNotNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  appointments,
  appointmentReminders,
  appointmentAutoReminderSettings,
  emailContacts,
  companies,
  shops,
  betterAuthUser,
  createAppointmentSchema,
  updateAppointmentSchema,
  createAppointmentReminderSchema,
  Appointment,
  AppointmentReminder
} from '@shared/schema';
import { authenticateToken, getEffectivePermissions, requireTenant } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/auth-middleware';
import { logActivity, computeChanges } from '../utils/activityLogger';
import { v4 as uuidv4 } from 'uuid';
import { cancelReminderRun, triggerRescheduleEmail, triggerThankYouEmail } from '../lib/trigger';
import { getDefaultShopId, resolveShopId } from '../utils/defaultShop';

const router = Router();

/**
 * Cancels all pending reminders for an appointment when it's rescheduled.
 * This prevents old reminders from firing at incorrect times.
 */
async function cancelPendingRemindersForAppointment(appointmentId: string): Promise<{ cancelled: number; errors: string[] }> {
  const errors: string[] = [];
  let cancelled = 0;

  try {
    // Find all pending reminders for this appointment
    const pendingReminders = await db
      .select()
      .from(appointmentReminders)
      .where(and(
        eq(appointmentReminders.appointmentId, appointmentId),
        eq(appointmentReminders.status, 'pending')
      ));

    console.log(`[Reschedule] Found ${pendingReminders.length} pending reminders for appointment ${appointmentId}`);

    for (const reminder of pendingReminders) {
      try {
        // Cancel the Trigger.dev run if we have a run ID (stored in inngestEventId field for backwards compatibility)
        if (reminder.inngestEventId) {
          try {
            const result = await cancelReminderRun(reminder.inngestEventId);
            if (!result.success) {
              console.warn(`[Reschedule] Failed to cancel Trigger.dev run ${reminder.inngestEventId}: ${result.error}`);
            } else {
              console.log(`[Reschedule] Cancelled Trigger.dev run ${reminder.inngestEventId}`);
            }
          } catch (triggerError) {
            console.warn(`[Reschedule] Error cancelling Trigger.dev run:`, triggerError);
          }
        }

        // Update reminder status to cancelled in database
        await db
          .update(appointmentReminders)
          .set({
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(appointmentReminders.id, reminder.id));

        cancelled++;
        console.log(`[Reschedule] Cancelled reminder ${reminder.id}`);
      } catch (reminderError) {
        const errorMsg = `Failed to cancel reminder ${reminder.id}: ${reminderError}`;
        console.error(`[Reschedule] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
  } catch (error) {
    const errorMsg = `Failed to fetch pending reminders: ${error}`;
    console.error(`[Reschedule] ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { cancelled, errors };
}

type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

const MAX_RECURRENCE_OCCURRENCES = 365;

function addRecurrenceInterval(date: Date, frequency: RecurrenceFrequency, interval: number): Date {
  const next = new Date(date);
  if (frequency === 'daily') {
    next.setDate(next.getDate() + interval);
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + interval * 7);
  } else if (frequency === 'monthly') {
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + interval);
    const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDayOfMonth));
  }
  return next;
}

function buildAppointmentOccurrences<T extends { appointmentDate: Date; recurrenceFrequency?: RecurrenceFrequency; recurrenceInterval?: number | null; recurrenceCount?: number | null; recurrenceEndDate?: Date | null }>(
  data: T,
): T[] {
  const frequency = data.recurrenceFrequency ?? 'none';
  if (frequency === 'none') {
    return [{ ...data, recurrenceFrequency: 'none', recurrenceInterval: 1, recurrenceCount: null, recurrenceEndDate: null }];
  }

  const interval = data.recurrenceInterval || 1;
  const targetCount = Math.min(data.recurrenceCount || MAX_RECURRENCE_OCCURRENCES, MAX_RECURRENCE_OCCURRENCES);
  const occurrences: T[] = [];
  let occurrenceDate = new Date(data.appointmentDate);

  for (let index = 0; index < targetCount; index++) {
    if (data.recurrenceEndDate && occurrenceDate > data.recurrenceEndDate) break;
    occurrences.push({
      ...data,
      appointmentDate: new Date(occurrenceDate),
      recurrenceFrequency: frequency,
      recurrenceInterval: interval,
      recurrenceCount: targetCount,
      recurrenceEndDate: data.recurrenceEndDate ?? null,
    });
    occurrenceDate = addRecurrenceInterval(occurrenceDate, frequency, interval);
  }

  return occurrences.length > 0 ? occurrences : [data];
}

type AppointmentOverlapCandidate = {
  appointmentDate: Date;
  duration?: number | null;
  providerId?: string | null;
  status?: string | null;
};

type AppointmentOverlapConflict = {
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

function isProviderConflictStatus(status?: string | null): boolean {
  return status === 'scheduled' || status === 'confirmed';
}

function toPostgresTimestampString(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

async function collectProviderOverlapConflicts({
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

function getProviderScheduleLockKeys(tenantId: string, shopId: string | null | undefined, candidates: AppointmentOverlapCandidate[]): string[] {
  const keys = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.providerId || !isProviderConflictStatus(candidate.status ?? 'scheduled')) {
      continue;
    }
    keys.add(`${tenantId}:${shopId ?? 'all'}:${candidate.providerId}`);
  }
  return Array.from(keys).sort();
}

async function acquireProviderScheduleLocks(
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

async function getAuthorizedForceOverbook(req: Request, res: Response, user: any, tenantId: string): Promise<boolean | null> {
  if (req.body?.forceOverbook !== true) {
    return false;
  }

  const permissions = await getEffectivePermissions(user.role, tenantId);
  if (permissions['appointments.edit'] !== true) {
    res.status(403).json({ error: 'Insufficient permissions to overbook appointments' });
    return null;
  }

  return true;
}

async function resolveAuthorizedShopId(req: Request, res: Response, tenantId: string): Promise<string | null | undefined> {
  const requestedShopId = (req as any).shopId as string | null | undefined;

  if (requestedShopId) {
    const shop = await db
      .select({ id: shops.id })
      .from(shops)
      .where(and(
        eq(shops.id, requestedShopId),
        eq(shops.tenantId, tenantId),
      ))
      .limit(1);

    if (shop.length === 0) {
      res.status(400).json({ error: 'Shop not found or does not belong to your organization' });
      return undefined;
    }
  }

  return resolveShopId(requestedShopId, tenantId);
}


// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireTenant);

// GET /api/appointments - List appointments with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    // Disable caching to ensure fresh data on every request
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { search, status, customerId, dateFrom, dateTo, serviceType } = req.query;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Build where conditions
    const conditions = [eq(appointments.tenantId, tenantId)];

    // Shop-level filtering when a specific shop is selected.
    // Older appointment rows can have a null shop_id; treat those as default-shop
    // records so historical months still appear when that shop is selected.
    const requestedShopId = (req as any).shopId as string | null | undefined;
    if (requestedShopId) {
      const defaultShopId = await getDefaultShopId(tenantId);
      conditions.push(
        defaultShopId === requestedShopId
          ? or(eq(appointments.shopId, requestedShopId), isNull(appointments.shopId))!
          : eq(appointments.shopId, requestedShopId)
      );
    }

    if (status && status !== 'all') {
      conditions.push(eq(appointments.status, status as string));
    }

    if (customerId) {
      conditions.push(eq(appointments.customerId, customerId as string));
    }

    if (dateFrom) {
      conditions.push(gte(appointments.appointmentDate, new Date(dateFrom as string)));
    }

    if (dateTo) {
      conditions.push(lte(appointments.appointmentDate, new Date(dateTo as string)));
    }

    if (serviceType) {
      conditions.push(eq(appointments.serviceType, serviceType as string));
    }

    // Fetch appointments with customer details
    // Note: confirmationToken intentionally excluded from list response for security
    let query = db
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        userId: appointments.userId,
        providerId: appointments.providerId,
        title: appointments.title,
        description: appointments.description,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        serviceType: appointments.serviceType,
        status: appointments.status,
        notes: appointments.notes,
        recurrenceFrequency: appointments.recurrenceFrequency,
        recurrenceInterval: appointments.recurrenceInterval,
        recurrenceCount: appointments.recurrenceCount,
        recurrenceEndDate: appointments.recurrenceEndDate,
        recurrenceSeriesId: appointments.recurrenceSeriesId,
        recurrenceParentId: appointments.recurrenceParentId,
        reminderSent: appointments.reminderSent,
        reminderSentAt: appointments.reminderSentAt,
        confirmationReceived: appointments.confirmationReceived,
        confirmationReceivedAt: appointments.confirmationReceivedAt,
        statusChangedBy: appointments.statusChangedBy,
        declineReason: appointments.declineReason,
        reminderSettings: appointments.reminderSettings,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        // Customer details
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          status: emailContacts.status,
          address: emailContacts.address,
          city: emailContacts.city,
          state: emailContacts.state,
          zipCode: emailContacts.zipCode,
          country: emailContacts.country,
          phoneNumber: emailContacts.phoneNumber,
        },
        // Provider (assigned user) details
        provider: {
          id: betterAuthUser.id,
          name: betterAuthUser.name,
          email: betterAuthUser.email,
        },
        // Shop details
        shop: {
          id: shops.id,
          name: shops.name,
        },
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .leftJoin(betterAuthUser, eq(appointments.providerId, betterAuthUser.id))
      .leftJoin(shops, eq(appointments.shopId, shops.id));

    // Apply search filter across multiple fields (case-insensitive)
    let finalQuery;
    if (search) {
      const searchPattern = `%${search}%`;
      finalQuery = query.where(
        and(
          ...conditions,
          or(
            ilike(appointments.title, searchPattern),
            ilike(appointments.description, searchPattern),
            ilike(appointments.location, searchPattern),
            ilike(emailContacts.firstName, searchPattern),
            ilike(emailContacts.lastName, searchPattern),
            ilike(emailContacts.email, searchPattern),
            // Also search combined full name (first + last and last + first)
            sql`LOWER(CONCAT(${emailContacts.firstName}, ' ', ${emailContacts.lastName})) LIKE LOWER(${searchPattern})`,
            sql`LOWER(CONCAT(${emailContacts.lastName}, ' ', ${emailContacts.firstName})) LIKE LOWER(${searchPattern})`
          )
        )
      );
    } else {
      finalQuery = query.where(and(...conditions));
    }

    const appointmentsList = await finalQuery.orderBy(desc(appointments.appointmentDate));

    res.json({
      appointments: appointmentsList,
      total: appointmentsList.length
    });
  } catch (error) {
    console.error('Failed to fetch appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/:id - Get specific appointment (public endpoint for confirmation)
router.get('/:id', async (req: Request, res: Response) => {
  // Check if this is a public confirmation request
  const { token } = req.query;

  if (token) {
    // Public endpoint for appointment confirmation
    return handlePublicAppointmentView(req, res);
  }

  // Private endpoint - require authentication
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    const appointment = await db
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        userId: appointments.userId,
        title: appointments.title,
        description: appointments.description,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        serviceType: appointments.serviceType,
        status: appointments.status,
        notes: appointments.notes,
        recurrenceFrequency: appointments.recurrenceFrequency,
        recurrenceInterval: appointments.recurrenceInterval,
        recurrenceCount: appointments.recurrenceCount,
        recurrenceEndDate: appointments.recurrenceEndDate,
        recurrenceSeriesId: appointments.recurrenceSeriesId,
        recurrenceParentId: appointments.recurrenceParentId,
        reminderSent: appointments.reminderSent,
        reminderSentAt: appointments.reminderSentAt,
        confirmationReceived: appointments.confirmationReceived,
        confirmationReceivedAt: appointments.confirmationReceivedAt,
        statusChangedBy: appointments.statusChangedBy,
        confirmationToken: appointments.confirmationToken,
        declineReason: appointments.declineReason,
        reminderSettings: appointments.reminderSettings,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        // Customer details
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          status: emailContacts.status,
          address: emailContacts.address,
          city: emailContacts.city,
          state: emailContacts.state,
          zipCode: emailContacts.zipCode,
          country: emailContacts.country,
          phoneNumber: emailContacts.phoneNumber,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ appointment: appointment[0] });
  } catch (error) {
    console.error('Failed to fetch appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST /api/appointments - Create new appointment
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = user.tenantId;
    const userId = user.id;
    const forceOverbook = await getAuthorizedForceOverbook(req, res, user, tenantId);
    if (forceOverbook === null) return;

    // Validate request body
    const validatedData = createAppointmentSchema.parse(req.body);

    // Verify customer belongs to this tenant
    const customer = await db
      .select()
      .from(emailContacts)
      .where(and(
        eq(emailContacts.id, validatedData.customerId),
        eq(emailContacts.tenantId, tenantId)
      ))
      .limit(1);

    if (customer.length === 0) {
      return res.status(400).json({ error: 'Customer not found or does not belong to your organization' });
    }

    // Verify provider belongs to this tenant (if provided)
    if (validatedData.providerId) {
      const provider = await db
        .select({ id: betterAuthUser.id })
        .from(betterAuthUser)
        .where(and(
          eq(betterAuthUser.id, validatedData.providerId),
          eq(betterAuthUser.tenantId, tenantId),
        ))
        .limit(1);
      if (provider.length === 0) {
        return res.status(400).json({ error: 'Provider not found or does not belong to your organization' });
      }
    }

    // Resolve shopId: use selected shop from header, or fall back to tenant default
    const shopId = await resolveAuthorizedShopId(req, res, tenantId);
    if (shopId === undefined) return;

    const occurrences = buildAppointmentOccurrences(validatedData as any);
    const isRecurring = (validatedData.recurrenceFrequency ?? 'none') !== 'none';
    const recurrenceSeriesId = isRecurring ? uuidv4() : null;
    const recurrenceParentId = isRecurring ? uuidv4() : null;

    const overlapCandidates = occurrences.map((occurrence) => ({
      appointmentDate: new Date(occurrence.appointmentDate),
      duration: occurrence.duration,
      providerId: occurrence.providerId ?? null,
      status: 'scheduled',
    }));

    // Create appointment(s). The advisory transaction lock serializes check+insert for each provider.
    const newAppointments = await db.transaction(async (tx: any) => {
      await acquireProviderScheduleLocks(tx, tenantId, shopId, overlapCandidates);

      if (!forceOverbook) {
        const overlapConflicts = await collectProviderOverlapConflicts({
          database: tx,
          tenantId,
          shopId,
          candidates: overlapCandidates,
        });

        if (overlapConflicts.length > 0) {
          return { overlapConflicts };
        }
      }

      const createdAppointments = await tx
        .insert(appointments)
        .values(occurrences.map((occurrence, index) => ({
          id: index === 0 && recurrenceParentId ? recurrenceParentId : undefined,
          tenantId,
          userId,
          confirmationToken: uuidv4(),
          shopId,
          ...occurrence,
          recurrenceCount: isRecurring ? occurrences.length : null,
          recurrenceSeriesId,
          recurrenceParentId: index === 0 ? null : recurrenceParentId,
        })))
        .returning();

      return { createdAppointments };
    });

    if ('overlapConflicts' in newAppointments) {
      return res.status(409).json({
        error: 'This provider already has an appointment at the selected time.',
        message: 'This provider already has an appointment at the selected time.',
        code: 'APPOINTMENT_OVERLAP',
        conflicts: newAppointments.overlapConflicts,
      });
    }

    const createdAppointments = newAppointments.createdAppointments;

    // Fetch customer data if customerId exists to match GET response structure
    let appointmentCustomer = null;
    if (createdAppointments[0].customerId) {
      const customerData = await db
        .select({
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          status: emailContacts.status,
          address: emailContacts.address,
          city: emailContacts.city,
          state: emailContacts.state,
          zipCode: emailContacts.zipCode,
          country: emailContacts.country,
          phoneNumber: emailContacts.phoneNumber,
        })
        .from(emailContacts)
        .where(and(eq(emailContacts.id, createdAppointments[0].customerId), eq(emailContacts.tenantId, tenantId)))
        .limit(1);
      appointmentCustomer = customerData[0] || null;
    }

    // Fetch provider details if assigned
    let appointmentProvider = null;
    if (createdAppointments[0].providerId) {
      const providerData = await db
        .select({ id: betterAuthUser.id, name: betterAuthUser.name, email: betterAuthUser.email })
        .from(betterAuthUser)
        .where(and(eq(betterAuthUser.id, createdAppointments[0].providerId), eq(betterAuthUser.tenantId, tenantId)))
        .limit(1);
      appointmentProvider = providerData[0] || null;
    }

    // Log activity for appointment creation
    const customerName = appointmentCustomer
      ? `${appointmentCustomer.firstName || ''} ${appointmentCustomer.lastName || ''}`.trim() || appointmentCustomer.email
      : 'Unknown Customer';

    try {
      await logActivity({
        tenantId,
        userId,
        entityType: 'appointment',
        entityId: createdAppointments[0].id,
        entityName: createdAppointments[0].title,
        activityType: 'created',
        description: isRecurring && createdAppointments.length > 1
          ? `Created ${createdAppointments.length} recurring appointments "${createdAppointments[0].title}" for ${customerName}`
          : `Created appointment "${createdAppointments[0].title}" for ${customerName}`,
        metadata: {
          customerId: createdAppointments[0].customerId,
          customerName,
          appointmentDate: createdAppointments[0].appointmentDate,
          serviceType: createdAppointments[0].serviceType,
          location: createdAppointments[0].location,
          recurrenceFrequency: createdAppointments[0].recurrenceFrequency,
          recurrenceCount: createdAppointments.length,
          overbookOverride: forceOverbook,
        },
        req,
      });
    } catch (error) {
      console.error('[Activity Log] Failed to log appointment creation:', error);
    }

    const appointmentsWithRelations = createdAppointments.map((appointment: Appointment) => ({
      ...appointment,
      customer: appointmentCustomer,
      provider: appointmentProvider,
    }));

    res.status(201).json({
      appointment: appointmentsWithRelations[0],
      appointments: appointmentsWithRelations,
      recurrenceCreatedCount: appointmentsWithRelations.length,
      message: isRecurring && appointmentsWithRelations.length > 1
        ? `${appointmentsWithRelations.length} appointments created successfully`
        : 'Appointment created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Failed to create appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PUT /api/appointments/:id - Update appointment (full update)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;
    const forceOverbook = await getAuthorizedForceOverbook(req, res, user, tenantId);
    if (forceOverbook === null) return;

    // Validate request body
    const validatedData = updateAppointmentSchema.parse(req.body);

    // Check if appointment exists and belongs to tenant
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (existingAppointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify provider (if being set) belongs to this tenant
    if (validatedData.providerId) {
      const provider = await db
        .select({ id: betterAuthUser.id })
        .from(betterAuthUser)
        .where(and(
          eq(betterAuthUser.id, validatedData.providerId),
          eq(betterAuthUser.tenantId, tenantId),
        ))
        .limit(1);
      if (provider.length === 0) {
        return res.status(400).json({ error: 'Provider not found or does not belong to your organization' });
      }
    }

    // Check if appointment date/time is being changed - if so, cancel pending reminders
    const existing = existingAppointment[0];
    const isDateChanging = validatedData.appointmentDate &&
      new Date(validatedData.appointmentDate).getTime() !== new Date(existing.appointmentDate).getTime();
    const effectiveProviderId =
      validatedData.providerId !== undefined ? validatedData.providerId : existing.providerId;
    const effectiveAppointmentDate = validatedData.appointmentDate ?? existing.appointmentDate;
    const effectiveDuration = validatedData.duration ?? existing.duration ?? 60;
    const effectiveStatus = validatedData.status ?? existing.status;
    const shouldCheckOverlap =
      !forceOverbook &&
      isProviderConflictStatus(effectiveStatus) &&
      (
        effectiveProviderId !== existing.providerId ||
        new Date(effectiveAppointmentDate).getTime() !== new Date(existing.appointmentDate).getTime() ||
        effectiveDuration !== (existing.duration ?? 60) ||
        !isProviderConflictStatus(existing.status)
      );

    const overlapCandidates = [{
      appointmentDate: new Date(effectiveAppointmentDate),
      duration: effectiveDuration,
      providerId: effectiveProviderId ?? null,
      status: effectiveStatus,
    }];

    let remindersCancelled = 0;
    if (isDateChanging) {
      console.log(`[Reschedule] Appointment ${id} date/time is changing, cancelling pending reminders`);
      const cancelResult = await cancelPendingRemindersForAppointment(id);
      remindersCancelled = cancelResult.cancelled;
      if (cancelResult.errors.length > 0) {
        console.warn(`[Reschedule] Some reminders failed to cancel:`, cancelResult.errors);
      }
    }

    // The advisory transaction lock serializes overlap check+update for this provider.
    const updateResult = await db.transaction(async (tx: any) => {
      if (shouldCheckOverlap) {
        await acquireProviderScheduleLocks(tx, tenantId, existing.shopId, overlapCandidates);
        const overlapConflicts = await collectProviderOverlapConflicts({
          database: tx,
          tenantId,
          shopId: existing.shopId,
          excludeAppointmentId: id,
          candidates: overlapCandidates,
        });

        if (overlapConflicts.length > 0) {
          return { overlapConflicts };
        }
      }

      const updatedAppointment = await tx
        .update(appointments)
        .set({
          ...validatedData,
          // Reset reminder flags if date/time changed so new reminders can be scheduled
          ...(isDateChanging ? {
            reminderSent: false,
            reminderSentAt: null,
          } : {}),
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

      return { updatedAppointment };
    });

    if ('overlapConflicts' in updateResult) {
      return res.status(409).json({
        error: 'This provider already has an appointment at the selected time.',
        message: 'This provider already has an appointment at the selected time.',
        code: 'APPOINTMENT_OVERLAP',
        conflicts: updateResult.overlapConflicts,
      });
    }

    const updatedAppointment = updateResult.updatedAppointment;

    // Log activity for appointment update
    const changes = computeChanges(existing, updatedAppointment[0], [
      'title', 'description', 'appointmentDate', 'duration', 'location',
      'serviceType', 'status', 'notes', 'customerId', 'providerId',
      'recurrenceFrequency', 'recurrenceInterval', 'recurrenceCount', 'recurrenceEndDate'
    ]);

    try {
      await logActivity({
        tenantId,
        userId: user.id,
        entityType: 'appointment',
        entityId: id,
        entityName: updatedAppointment[0].title,
        activityType: 'updated',
        description: `Updated appointment "${updatedAppointment[0].title}"`,
        changes: changes || undefined,
        metadata: {
          isDateChanged: isDateChanging,
          remindersCancelled,
          overbookOverride: forceOverbook,
        },
        req,
      });
    } catch (error) {
      console.error('[Activity Log] Failed to log appointment update:', error);
    }

    res.json({
      appointment: updatedAppointment[0],
      message: 'Appointment updated successfully',
      remindersCancelled: remindersCancelled > 0 ? remindersCancelled : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Failed to update appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// PATCH /api/appointments/:id - Partial update appointment
// Security: Only whitelisted fields can be updated to prevent mass assignment
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;
    const forceOverbook = await getAuthorizedForceOverbook(req, res, user, tenantId);
    if (forceOverbook === null) return;

    // Whitelist of allowed fields for PATCH updates - prevents mass assignment attacks
    const allowedFields = [
      'title', 'description', 'appointmentDate', 'duration', 'location',
      'serviceType', 'status', 'notes', 'customerId', 'reminderSettings', 'providerId',
      'recurrenceFrequency', 'recurrenceInterval', 'recurrenceCount', 'recurrenceEndDate',
      'recurrenceSeriesId', 'recurrenceParentId'
    ];

    // Build sanitized update data with only allowed fields
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'];
      if (!validStatuses.includes(updateData.status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      // Check if status is being changed to confirmed or cancelled by an employee
      if (updateData.status === 'confirmed' || updateData.status === 'cancelled') {
        const userName = user.firstName
          ? `${user.firstName} ${user.lastName || ''}`.trim()
          : user.name || 'Employee';

        // Only set statusChangedBy if we have a name (avoid setting to default 'Employee' if possible)
        updateData.statusChangedBy = userName;

        // Also update the confirmationReceived flag if it's confirmed
        if (updateData.status === 'confirmed') {
          updateData.confirmationReceived = true;
          updateData.confirmationReceivedAt = new Date();
        }
      }
    }

    // Convert date strings to Date objects if present
    if (updateData.appointmentDate) {
      updateData.appointmentDate = new Date(updateData.appointmentDate);
      if (isNaN(updateData.appointmentDate.getTime())) {
        return res.status(400).json({ error: 'Invalid appointmentDate format' });
      }
    }

    if (updateData.recurrenceEndDate) {
      updateData.recurrenceEndDate = new Date(updateData.recurrenceEndDate);
      if (isNaN(updateData.recurrenceEndDate.getTime())) {
        return res.status(400).json({ error: 'Invalid recurrenceEndDate format' });
      }
    } else if (updateData.recurrenceEndDate === null) {
      updateData.recurrenceEndDate = null;
    }

    if (updateData.recurrenceFrequency) {
      const validFrequencies = ['none', 'daily', 'weekly', 'monthly'];
      if (!validFrequencies.includes(updateData.recurrenceFrequency)) {
        return res.status(400).json({ error: `Invalid recurrenceFrequency. Must be one of: ${validFrequencies.join(', ')}` });
      }
      if (updateData.recurrenceFrequency === 'none') {
        updateData.recurrenceInterval = 1;
        updateData.recurrenceCount = null;
        updateData.recurrenceEndDate = null;
        updateData.recurrenceSeriesId = null;
        updateData.recurrenceParentId = null;
      }
    }

    if (updateData.recurrenceInterval !== undefined && updateData.recurrenceInterval !== null) {
      const interval = Number(updateData.recurrenceInterval);
      if (!Number.isInteger(interval) || interval < 1 || interval > 12) {
        return res.status(400).json({ error: 'recurrenceInterval must be an integer between 1 and 12' });
      }
      updateData.recurrenceInterval = interval;
    }

    if (updateData.recurrenceCount !== undefined && updateData.recurrenceCount !== null) {
      const count = Number(updateData.recurrenceCount);
      if (!Number.isInteger(count) || count < 1 || count > MAX_RECURRENCE_OCCURRENCES) {
        return res.status(400).json({ error: `recurrenceCount must be an integer between 1 and ${MAX_RECURRENCE_OCCURRENCES}` });
      }
      updateData.recurrenceCount = count;
    }

    // Normalise providerId: empty string → null (unassign)
    if ('providerId' in updateData) {
      if (updateData.providerId === '' || updateData.providerId === undefined) {
        updateData.providerId = null;
      }
      if (updateData.providerId) {
        const provider = await db
          .select({ id: betterAuthUser.id })
          .from(betterAuthUser)
          .where(and(
            eq(betterAuthUser.id, updateData.providerId),
            eq(betterAuthUser.tenantId, tenantId),
          ))
          .limit(1);
        if (provider.length === 0) {
          return res.status(400).json({ error: 'Provider not found or does not belong to your organization' });
        }
      }
    }

    // Check if appointment exists and belongs to tenant
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (existingAppointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if appointment date/time is being changed - if so, cancel pending reminders
    const existing = existingAppointment[0];
    const isDateChanging = updateData.appointmentDate &&
      new Date(updateData.appointmentDate).getTime() !== new Date(existing.appointmentDate).getTime();
    const shouldCreateSeriesFromEdit =
      updateData.recurrenceFrequency &&
      updateData.recurrenceFrequency !== 'none' &&
      !existing.recurrenceSeriesId &&
      ((updateData.recurrenceCount ?? 1) > 1 || updateData.recurrenceEndDate);

    const effectiveProviderId =
      Object.prototype.hasOwnProperty.call(updateData, 'providerId')
        ? updateData.providerId
        : existing.providerId;
    const effectiveAppointmentDate = updateData.appointmentDate ?? existing.appointmentDate;
    const effectiveDuration = updateData.duration ?? existing.duration ?? 60;
    const effectiveStatus = updateData.status ?? existing.status;
    const schedulingFieldsChanged =
      effectiveProviderId !== existing.providerId ||
      new Date(effectiveAppointmentDate).getTime() !== new Date(existing.appointmentDate).getTime() ||
      effectiveDuration !== (existing.duration ?? 60);
    const shouldCheckOverlap =
      !forceOverbook &&
      isProviderConflictStatus(effectiveStatus) &&
      (
        schedulingFieldsChanged ||
        shouldCreateSeriesFromEdit ||
        !isProviderConflictStatus(existing.status)
      );

    const overlapCandidates = shouldCreateSeriesFromEdit
      ? buildAppointmentOccurrences({
          appointmentDate: new Date(effectiveAppointmentDate),
          duration: effectiveDuration,
          providerId: effectiveProviderId ?? null,
          status: effectiveStatus,
          recurrenceFrequency: (updateData.recurrenceFrequency ?? existing.recurrenceFrequency ?? 'none') as RecurrenceFrequency,
          recurrenceInterval: updateData.recurrenceInterval ?? existing.recurrenceInterval ?? 1,
          recurrenceCount: updateData.recurrenceCount ?? existing.recurrenceCount ?? null,
          recurrenceEndDate: updateData.recurrenceEndDate ?? existing.recurrenceEndDate ?? null,
        })
      : [{
          appointmentDate: new Date(effectiveAppointmentDate),
          duration: effectiveDuration,
          providerId: effectiveProviderId ?? null,
          status: effectiveStatus,
        }];

    const editSeriesId = shouldCreateSeriesFromEdit ? uuidv4() : null;
    if (shouldCreateSeriesFromEdit) {
      updateData.recurrenceSeriesId = editSeriesId;
      updateData.recurrenceParentId = null;
    }

    let remindersCancelled = 0;
    if (isDateChanging) {
      console.log(`[Reschedule] Appointment ${id} date/time is changing, cancelling pending reminders`);
      const cancelResult = await cancelPendingRemindersForAppointment(id);
      remindersCancelled = cancelResult.cancelled;
      if (cancelResult.errors.length > 0) {
        console.warn(`[Reschedule] Some reminders failed to cancel:`, cancelResult.errors);
      }
    }

    // The advisory transaction lock serializes overlap check+update/series creation for this provider.
    const updateResult = await db.transaction(async (tx: any) => {
      if (shouldCheckOverlap) {
        await acquireProviderScheduleLocks(tx, tenantId, existing.shopId, overlapCandidates);
        const overlapConflicts = await collectProviderOverlapConflicts({
          database: tx,
          tenantId,
          shopId: existing.shopId,
          excludeAppointmentId: id,
          candidates: overlapCandidates,
        });

        if (overlapConflicts.length > 0) {
          return { overlapConflicts };
        }
      }

      const updatedAppointment = await tx
        .update(appointments)
        .set({
          ...updateData,
          // Reset reminder flags if date/time changed so new reminders can be scheduled
          ...(isDateChanging ? {
            reminderSent: false,
            reminderSentAt: null,
          } : {}),
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

      let createdSeriesOccurrences = 0;
      if (shouldCreateSeriesFromEdit && editSeriesId) {
        const baseAppointment = updatedAppointment[0];
        const occurrences = buildAppointmentOccurrences({
          customerId: baseAppointment.customerId,
          providerId: baseAppointment.providerId,
          title: baseAppointment.title,
          description: baseAppointment.description ?? undefined,
          appointmentDate: baseAppointment.appointmentDate,
          duration: baseAppointment.duration ?? 60,
          location: baseAppointment.location ?? undefined,
          serviceType: baseAppointment.serviceType ?? undefined,
          status: baseAppointment.status,
          notes: baseAppointment.notes ?? undefined,
          recurrenceFrequency: baseAppointment.recurrenceFrequency as RecurrenceFrequency,
          recurrenceInterval: baseAppointment.recurrenceInterval ?? 1,
          recurrenceCount: baseAppointment.recurrenceCount,
          recurrenceEndDate: baseAppointment.recurrenceEndDate,
          reminderSettings: baseAppointment.reminderSettings ?? undefined,
        });

        createdSeriesOccurrences = Math.max(0, occurrences.length - 1);
        if (baseAppointment.recurrenceCount !== occurrences.length) {
          const [baseWithActualCount] = await tx
            .update(appointments)
            .set({ recurrenceCount: occurrences.length, updatedAt: new Date() })
            .where(eq(appointments.id, id))
            .returning();
          updatedAppointment[0] = baseWithActualCount;
        }

        if (createdSeriesOccurrences > 0) {
          await tx.insert(appointments).values(
            occurrences.slice(1).map((occurrence) => ({
              tenantId,
              userId: baseAppointment.userId,
              confirmationToken: uuidv4(),
              shopId: baseAppointment.shopId,
              ...occurrence,
              recurrenceCount: occurrences.length,
              recurrenceSeriesId: editSeriesId,
              recurrenceParentId: baseAppointment.id,
            }))
          );
        }
      }

      return { updatedAppointment, createdSeriesOccurrences };
    });

    if ('overlapConflicts' in updateResult) {
      return res.status(409).json({
        error: 'This provider already has an appointment at the selected time.',
        message: 'This provider already has an appointment at the selected time.',
        code: 'APPOINTMENT_OVERLAP',
        conflicts: updateResult.overlapConflicts,
      });
    }

    const { updatedAppointment, createdSeriesOccurrences } = updateResult;

    // Log activity for appointment update
    const changes = computeChanges(existing, updatedAppointment[0], [
      'title', 'description', 'appointmentDate', 'duration', 'location',
      'serviceType', 'status', 'notes', 'customerId', 'providerId',
      'recurrenceFrequency', 'recurrenceInterval', 'recurrenceCount', 'recurrenceEndDate'
    ]);

    try {
      await logActivity({
        tenantId,
        userId: user.id,
        entityType: 'appointment',
        entityId: id,
        entityName: updatedAppointment[0].title,
        activityType: 'updated',
        description: `Updated appointment "${updatedAppointment[0].title}"`,
        changes: changes || undefined,
        metadata: {
          isDateChanged: isDateChanging,
          remindersCancelled,
          createdSeriesOccurrences,
          overbookOverride: forceOverbook,
        },
        req,
      });
    } catch (error) {
      console.error('[Activity Log] Failed to log appointment update:', error);
    }

    res.json({
      appointment: updatedAppointment[0],
      message: 'Appointment updated successfully',
      remindersCancelled: remindersCancelled > 0 ? remindersCancelled : undefined,
      recurrenceCreatedCount: createdSeriesOccurrences > 0 ? createdSeriesOccurrences + 1 : undefined,
    });
  } catch (error) {
    console.error('Failed to update appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// DELETE /api/appointments/:id - Delete appointment
router.delete('/:id', requireRole(['Owner', 'Administrator', 'Manager']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Check if appointment exists and belongs to tenant
    const existingAppointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (existingAppointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Cancel all pending Trigger.dev reminder tasks before deleting
    console.log(`[Delete] Cancelling pending reminders for appointment ${id}`);
    const cancelResult = await cancelPendingRemindersForAppointment(id);
    if (cancelResult.cancelled > 0) {
      console.log(`[Delete] Cancelled ${cancelResult.cancelled} pending reminder(s)`);
    }
    if (cancelResult.errors.length > 0) {
      console.warn(`[Delete] Some reminders failed to cancel:`, cancelResult.errors);
    }

    // Delete appointment (this will cascade delete reminders from DB)
    await db
      .delete(appointments)
      .where(eq(appointments.id, id));

    // Log activity for appointment deletion after deleting
    const deletedAppointment = existingAppointment[0];
    try {
      await logActivity({
        tenantId,
        userId: user.id,
        entityType: 'appointment',
        entityId: id,
        entityName: deletedAppointment.title,
        activityType: 'deleted',
        description: `Deleted appointment "${deletedAppointment.title}"`,
        metadata: {
          customerId: deletedAppointment.customerId,
          appointmentDate: deletedAppointment.appointmentDate,
          serviceType: deletedAppointment.serviceType,
          status: deletedAppointment.status,
          remindersCancelled: cancelResult.cancelled,
        },
        req,
      });
    } catch (error) {
      console.error('[Activity Log] Failed to log appointment deletion:', error);
    }

    res.json({
      message: 'Appointment deleted successfully',
      remindersCancelled: cancelResult.cancelled
    });
  } catch (error) {
    console.error('Failed to delete appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// POST /api/appointments/:id/confirm - Confirm appointment via API (requires auth + valid token)
// Note: This endpoint is behind authenticateToken middleware. For public customer confirmation,
// use GET /api/appointments/:id/confirm?token=xxx from appointmentConfirmationRoutes
router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Confirmation token is required' });
    }

    // Find appointment by ID and token
    const appointment = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.confirmationToken, token)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Invalid appointment or confirmation token' });
    }

    // Update appointment to confirmed
    const updatedAppointment = await db
      .update(appointments)
      .set({
        status: 'confirmed',
        confirmationReceived: true,
        confirmationReceivedAt: new Date(),
        statusChangedBy: 'Customer',
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    res.json({
      message: 'Appointment confirmed successfully',
      appointment: updatedAppointment[0]
    });
  } catch (error) {
    console.error('Failed to confirm appointment:', error);
    res.status(500).json({ error: 'Failed to confirm appointment' });
  }
});

// Public endpoint for viewing appointment details via confirmation token
async function handlePublicAppointmentView(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const appointment = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        description: appointments.description,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        serviceType: appointments.serviceType,
        status: appointments.status,
        // Customer details
        customer: {
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.id, id),
        eq(appointments.confirmationToken, token as string)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or invalid token' });
    }

    res.json({ appointment: appointment[0] });
  } catch (error) {
    console.error('Failed to fetch appointment for confirmation:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
}

// POST /api/appointments/:id/send-reschedule-email - Send reschedule invitation email to customer
router.post('/:id/send-reschedule-email', requireRole(['Owner', 'Administrator', 'Manager', 'User']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Fetch appointment with customer details
    const appointment = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        status: appointments.status,
        customerId: appointments.customerId,
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appt = appointment[0];

    // Verify status is cancelled or no_show
    if (appt.status !== 'cancelled' && appt.status !== 'no_show') {
      return res.status(400).json({
        error: 'Reschedule emails can only be sent for cancelled or no-show appointments'
      });
    }

    // Verify customer has email
    if (!appt.customer?.email) {
      return res.status(400).json({ error: 'Customer does not have an email address' });
    }

    // Format date and time for email
    const appointmentDate = new Date(appt.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Build customer name
    const customerName = appt.customer.firstName
      ? `${appt.customer.firstName}${appt.customer.lastName ? ' ' + appt.customer.lastName : ''}`
      : 'Valued Customer';

    // Trigger the reschedule email via Trigger.dev
    const result = await triggerRescheduleEmail({
      appointmentId: appt.id,
      customerId: appt.customer.id,
      customerEmail: appt.customer.email,
      customerName,
      appointmentTitle: appt.title,
      appointmentDate: formattedDate,
      appointmentTime: formattedTime,
      location: appt.location || undefined,
      status: appt.status as 'cancelled' | 'no_show',
      tenantId,
    });

    if (!result.success) {
      console.error('Failed to trigger reschedule email:', result.error);
      return res.status(500).json({
        error: 'Failed to send reschedule email',
        details: result.error
      });
    }

    console.log(`📧 Reschedule email triggered for appointment ${id}, runId: ${result.runId}`);

    res.json({
      message: 'Reschedule email sent successfully',
      runId: result.runId
    });
  } catch (error) {
    console.error('Failed to send reschedule email:', error);
    res.status(500).json({ error: 'Failed to send reschedule email' });
  }
});

// POST /api/appointments/:id/send-thank-you-email - Send thank-you email when appointment is completed
router.post('/:id/send-thank-you-email', requireRole(['Owner', 'Administrator', 'Manager', 'User']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const tenantId = user.tenantId;

    // Fetch appointment with customer details
    const appointment = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        appointmentDate: appointments.appointmentDate,
        duration: appointments.duration,
        location: appointments.location,
        status: appointments.status,
        customerId: appointments.customerId,
        customer: {
          id: emailContacts.id,
          email: emailContacts.email,
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.id, id),
        eq(appointments.tenantId, tenantId)
      ))
      .limit(1);

    if (appointment.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appt = appointment[0];

    // Verify status is completed
    if (appt.status !== 'completed') {
      return res.status(400).json({
        error: 'Thank-you emails can only be sent for completed appointments'
      });
    }

    // Verify customer has email
    if (!appt.customer?.email) {
      return res.status(400).json({ error: 'Customer does not have an email address' });
    }

    // Fetch company name for the email
    let companyName = 'Our Team';
    try {
      const companyResult = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.tenantId, tenantId))
        .limit(1);
      if (companyResult[0]?.name) {
        companyName = companyResult[0].name;
      }
    } catch (e) {
      console.warn('[Thank You Email] Could not fetch company name:', e);
    }

    // Format date and time for email
    const appointmentDate = new Date(appt.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Build customer name
    const customerName = appt.customer.firstName
      ? `${appt.customer.firstName}${appt.customer.lastName ? ' ' + appt.customer.lastName : ''}`
      : 'Valued Customer';

    // Trigger the thank-you email via Trigger.dev
    const result = await triggerThankYouEmail({
      appointmentId: appt.id,
      customerId: appt.customer.id,
      customerEmail: appt.customer.email,
      customerName,
      appointmentTitle: appt.title,
      appointmentDate: formattedDate,
      appointmentTime: formattedTime,
      location: appt.location || undefined,
      companyName,
      tenantId,
    });

    if (!result.success) {
      console.error('Failed to trigger thank-you email:', result.error);
      return res.status(500).json({
        error: 'Failed to send thank-you email',
        details: result.error
      });
    }

    console.log(`📧 Thank-you email triggered for appointment ${id}, runId: ${result.runId}`);

    res.json({
      message: 'Thank-you email sent successfully',
      runId: result.runId
    });
  } catch (error) {
    console.error('Failed to send thank-you email:', error);
    res.status(500).json({ error: 'Failed to send thank-you email' });
  }
});

// ─── Auto-reminder settings ─────────────────────────────────────────────────

// GET current auto-reminder settings for the tenant
router.get("/auto-reminder-settings", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const row = await db.query.appointmentAutoReminderSettings.findFirst({
      where: eq(appointmentAutoReminderSettings.tenantId, req.user.tenantId),
    });

    res.json({ enabled: row?.enabled ?? false });
  } catch (error) {
    console.error('Get auto-reminder settings error:', error);
    res.status(500).json({ message: 'Failed to get auto-reminder settings' });
  }
});

// PUT enable/disable auto-reminder for the tenant
router.put("/auto-reminder-settings", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled must be a boolean' });
    }

    // Upsert: insert or update
    await db.insert(appointmentAutoReminderSettings).values({
      tenantId: req.user.tenantId,
      enabled,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [appointmentAutoReminderSettings.tenantId],
      set: {
        enabled,
        updatedAt: new Date(),
      },
    });

    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'appointment',
      activityType: 'updated',
      description: `Appointment auto-reminder ${enabled ? 'enabled' : 'disabled'}`,
      metadata: { enabled },
      req,
    });

    res.json({ message: `Auto-reminder ${enabled ? 'enabled' : 'disabled'} successfully`, enabled });
  } catch (error) {
    console.error('Update auto-reminder settings error:', error);
    res.status(500).json({ message: 'Failed to update auto-reminder settings' });
  }
});

export default router;
