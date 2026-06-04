import { Router, Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { db } from '../db';
import {
  userAvailability,
  userAvailabilityOverrides,
  betterAuthUser,
  tenants,
  appointments,
  emailContacts,
} from '@shared/schema';
import { computeOpenSlots } from '../utils/availabilitySlots';
import { acquireProviderScheduleLocks, collectProviderOverlapConflicts } from '../utils/appointmentOverlap';
import { getBrandingForTenant } from '../utils/tenantBranding';
import { resolveShopId } from '../utils/defaultShop';
import { parseWeeklyHours, parseRanges } from './availabilityRoutes';
import { logActivity } from '../utils/activityLogger';

export const publicBookingRoutes = Router();

// Public, unauthenticated — rate-limit to deter abuse (same shape as public newsletter routes).
publicBookingRoutes.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
}));

// Resolve a provider + tenant + availability config from a public booking slug.
// Returns null for any reason the page should appear unavailable (slug missing,
// not bookable, disabled, or tenant inactive) — callers respond with a uniform 404.
async function resolveProviderBySlug(slug: string) {
  const [row] = await db
    .select({
      tenantId: userAvailability.tenantId,
      providerId: userAvailability.userId,
      timezone: userAvailability.timezone,
      weeklyHours: userAvailability.weeklyHours,
      slotLengthMinutes: userAvailability.slotLengthMinutes,
      bufferMinutes: userAvailability.bufferMinutes,
      minimumNoticeHours: userAvailability.minimumNoticeHours,
      bookingHorizonDays: userAvailability.bookingHorizonDays,
      bookableStartDate: userAvailability.bookableStartDate,
      bookableEndDate: userAvailability.bookableEndDate,
      isBookable: userAvailability.isBookable,
      isEnabled: userAvailability.isEnabled,
      providerName: betterAuthUser.name,
      tenantName: tenants.name,
      tenantActive: tenants.isActive,
    })
    .from(userAvailability)
    .innerJoin(betterAuthUser, eq(betterAuthUser.id, userAvailability.userId))
    .innerJoin(tenants, eq(tenants.id, userAvailability.tenantId))
    .where(eq(userAvailability.bookingSlug, slug))
    .limit(1);

  if (!row || !row.isBookable || !row.isEnabled || row.tenantActive === false) return null;
  return row;
}

async function loadOverridesForProvider(tenantId: string, providerId: string) {
  const rows = await db
    .select()
    .from(userAvailabilityOverrides)
    .where(and(
      eq(userAvailabilityOverrides.tenantId, tenantId),
      eq(userAvailabilityOverrides.userId, providerId),
    ));
  return rows.map((o) => ({ date: o.date, type: o.type as 'off' | 'custom', ranges: parseRanges(o.ranges) }));
}

async function openSlotsFor(row: NonNullable<Awaited<ReturnType<typeof resolveProviderBySlug>>>) {
  const overrides = await loadOverridesForProvider(row.tenantId, row.providerId);
  return computeOpenSlots({
    tenantId: row.tenantId,
    providerId: row.providerId,
    timezone: row.timezone,
    weeklyHours: parseWeeklyHours(row.weeklyHours),
    overrides,
    slotLengthMinutes: row.slotLengthMinutes,
    bufferMinutes: row.bufferMinutes,
    minimumNoticeHours: row.minimumNoticeHours,
    bookingHorizonDays: row.bookingHorizonDays,
    bookableStartDate: row.bookableStartDate,
    bookableEndDate: row.bookableEndDate,
  });
}

// GET /api/public/booking/:slug — provider info + branding + open slots. No PII of other customers.
publicBookingRoutes.get('/:slug', async (req, res: Response) => {
  try {
    const row = await resolveProviderBySlug(req.params.slug);
    if (!row) return res.status(404).json({ message: 'This booking page is not available.' });

    const [slotsByDate, branding] = await Promise.all([
      openSlotsFor(row),
      getBrandingForTenant(row.tenantId, row.tenantName),
    ]);

    return res.json({
      provider: { name: row.providerName },
      branding,
      rules: { timezone: row.timezone, slotLengthMinutes: row.slotLengthMinutes },
      slotsByDate,
    });
  } catch (error: any) {
    console.error('[Public Booking] GET /:slug failed:', error);
    return res.status(500).json({ message: 'Failed to load booking page' });
  }
});

const publicBookingSchema = z.object({
  startUtc: z.string().datetime(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  note: z.string().trim().max(1000).optional().nullable(),
});

// POST /api/public/booking/:slug — create a pending appointment for the chosen slot.
publicBookingRoutes.post('/:slug', async (req, res: Response) => {
  try {
    const row = await resolveProviderBySlug(req.params.slug);
    if (!row) return res.status(404).json({ message: 'This booking page is not available.' });

    const parsed = publicBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid booking details', errors: parsed.error.flatten() });
    }
    const { startUtc, name, email, note } = parsed.data;

    // The chosen start must be a currently-open slot (guards forged/expired/late times).
    const slotsByDate = await openSlotsFor(row);
    const isOpen = slotsByDate.some((d) => d.slots.some((s) => s.startUtc === startUtc));
    if (!isOpen) {
      return res.status(409).json({ code: 'SLOT_UNAVAILABLE', message: 'That time is no longer available. Please pick another.' });
    }

    const startMs = new Date(startUtc).getTime();
    const shopId = await resolveShopId(null, row.tenantId); // default shop or null — appointment placement
    // Lock + overlap are provider-wide (shopId null) to match the slot engine and
    // give public bookings a consistent guarantee against each other.
    const bufferedCandidate = {
      appointmentDate: new Date(startMs - row.bufferMinutes * 60_000),
      duration: row.slotLengthMinutes + 2 * row.bufferMinutes,
      providerId: row.providerId,
      status: 'scheduled' as const,
    };

    const [firstName, lastName] = splitName(name);

    const result = await db.transaction(async (tx) => {
      await acquireProviderScheduleLocks(tx, row.tenantId, null, [bufferedCandidate]);

      const conflicts = await collectProviderOverlapConflicts({
        database: tx,
        tenantId: row.tenantId,
        shopId: null,
        candidates: [bufferedCandidate],
      });
      if (conflicts.length > 0) return { taken: true as const };

      const [contact] = await tx
        .insert(emailContacts)
        .values({
          tenantId: row.tenantId,
          shopId,
          email,
          firstName,
          lastName,
          status: 'active',
          consentGiven: true,
          consentDate: new Date(),
          consentMethod: 'booking_form',
          consentIpAddress: req.ip ?? null,
          consentUserAgent: req.get('user-agent') ?? null,
        })
        .onConflictDoUpdate({
          target: [emailContacts.tenantId, emailContacts.email],
          set: {
            // Fill in name only if the existing contact has none; never blank it out.
            firstName: sql`coalesce(${emailContacts.firstName}, ${firstName})`,
            lastName: sql`coalesce(${emailContacts.lastName}, ${lastName})`,
            consentGiven: true,
            consentMethod: 'booking_form',
            consentDate: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      const [appt] = await tx
        .insert(appointments)
        .values({
          tenantId: row.tenantId,
          shopId,
          customerId: contact.id,
          userId: row.providerId, // provider owns publicly-booked appointments
          providerId: row.providerId,
          title: `Booking with ${row.providerName}`,
          description: note ?? null,
          appointmentDate: new Date(startUtc),
          duration: row.slotLengthMinutes,
          status: 'scheduled',
          confirmationToken: randomUUID(),
        })
        .returning();

      return { taken: false as const, appt };
    });

    if (result.taken) {
      return res.status(409).json({ code: 'SLOT_UNAVAILABLE', message: 'That time was just booked. Please pick another.' });
    }

    await logActivity({
      tenantId: row.tenantId,
      userId: null,
      entityType: 'appointment',
      entityId: result.appt.id,
      entityName: result.appt.title,
      activityType: 'created',
      description: `Public booking by ${name}`,
      metadata: { source: 'public_booking', email, startUtc },
      req,
    });

    // TODO: trigger a booking-confirmation email (no such Trigger.dev task exists yet).

    return res.status(201).json({
      success: true,
      appointment: {
        id: result.appt.id,
        startUtc,
        durationMinutes: row.slotLengthMinutes,
        providerName: row.providerName,
      },
    });
  } catch (error: any) {
    console.error('[Public Booking] POST /:slug failed:', error);
    return res.status(500).json({ message: 'Failed to create booking' });
  }
});

function splitName(name: string): [string, string | null] {
  const trimmed = name.trim();
  const sp = trimmed.indexOf(' ');
  if (sp === -1) return [trimmed, null];
  return [trimmed.slice(0, sp), trimmed.slice(sp + 1).trim() || null];
}

export default publicBookingRoutes;
