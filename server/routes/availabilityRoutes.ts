import { Router, Response } from 'express';
import { and, eq, asc, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  userAvailability,
  userAvailabilityOverrides,
  betterAuthUser,
  upsertUserAvailabilitySchema,
  createAvailabilityOverrideSchema,
  updateAvailabilityOverrideSchema,
  type UserAvailability,
  type UserAvailabilityOverride,
} from '@shared/schema';
import { authenticateToken, requireTenant, getEffectivePermissions } from '../middleware/auth-middleware';
import { logActivity } from '../utils/activityLogger';

const router = Router();

// All availability endpoints require an authenticated, tenant-scoped user.
router.use(authenticateToken);
router.use(requireTenant);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_TIMEZONE = 'America/Chicago';

// Empty week: 7 days (0=Sunday..6=Saturday), all disabled, no ranges.
function defaultWeeklyHours() {
  return Array.from({ length: 7 }, (_, day) => ({ day, enabled: false, ranges: [] as { start: string; end: string }[] }));
}

export function parseWeeklyHours(raw: string | null) {
  if (!raw) return defaultWeeklyHours();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === 7 ? parsed : defaultWeeklyHours();
  } catch {
    return defaultWeeklyHours();
  }
}

export function parseRanges(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function serializeAvailability(row: UserAvailability) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    weeklyHours: parseWeeklyHours(row.weeklyHours),
    timezone: row.timezone,
    slotLengthMinutes: row.slotLengthMinutes,
    bufferMinutes: row.bufferMinutes,
    minimumNoticeHours: row.minimumNoticeHours,
    bookingHorizonDays: row.bookingHorizonDays,
    bookableStartDate: row.bookableStartDate,
    bookableEndDate: row.bookableEndDate,
    isBookable: row.isBookable,
    isEnabled: row.isEnabled,
    bookingSlug: row.bookingSlug,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isDefault: false,
  };
}

// Synthesized response when a user has never saved availability (never 404).
function synthesizeDefault(userId: string, timezone: string | null | undefined) {
  return {
    id: null,
    userId,
    weeklyHours: defaultWeeklyHours(),
    timezone: timezone || DEFAULT_TIMEZONE,
    slotLengthMinutes: 30,
    bufferMinutes: 0,
    minimumNoticeHours: 24,
    bookingHorizonDays: 30,
    bookableStartDate: null,
    bookableEndDate: null,
    isBookable: true,
    isEnabled: true,
    bookingSlug: null,
    isDefault: true,
  };
}

function serializeOverride(row: UserAvailabilityOverride) {
  return { ...row, ranges: parseRanges(row.ranges) };
}

// Editing yourself is always allowed; editing others requires the permission.
async function canEditUser(req: any, targetUserId: string): Promise<boolean> {
  if (targetUserId === req.user.id) return true;
  const perms = await getEffectivePermissions(req.user.role, req.user.tenantId);
  return perms['appointments.manage_availability'] === true;
}

// Load a user that belongs to the requester's tenant (null if cross-tenant/missing).
async function getTenantUser(tenantId: string, userId: string) {
  const [u] = await db
    .select({
      id: betterAuthUser.id,
      name: betterAuthUser.name,
      email: betterAuthUser.email,
      timezone: betterAuthUser.timezone,
    })
    .from(betterAuthUser)
    .where(and(eq(betterAuthUser.id, userId), eq(betterAuthUser.tenantId, tenantId)))
    .limit(1);
  return u;
}

function toAvailabilityColumns(data: Record<string, any>) {
  const cols: Record<string, any> = {};
  if (data.weeklyHours !== undefined) cols.weeklyHours = JSON.stringify(data.weeklyHours);
  if (data.timezone !== undefined) cols.timezone = data.timezone;
  if (data.slotLengthMinutes !== undefined) cols.slotLengthMinutes = data.slotLengthMinutes;
  if (data.bufferMinutes !== undefined) cols.bufferMinutes = data.bufferMinutes;
  if (data.minimumNoticeHours !== undefined) cols.minimumNoticeHours = data.minimumNoticeHours;
  if (data.bookingHorizonDays !== undefined) cols.bookingHorizonDays = data.bookingHorizonDays;
  if (data.bookableStartDate !== undefined) cols.bookableStartDate = data.bookableStartDate;
  if (data.bookableEndDate !== undefined) cols.bookableEndDate = data.bookableEndDate;
  if (data.isBookable !== undefined) cols.isBookable = data.isBookable;
  if (data.isEnabled !== undefined) cols.isEnabled = data.isEnabled;
  return cols;
}

export async function fetchOverrides(tenantId: string, userId: string, from?: string, to?: string) {
  const conditions = [
    eq(userAvailabilityOverrides.tenantId, tenantId),
    eq(userAvailabilityOverrides.userId, userId),
  ];
  if (from) conditions.push(gte(userAvailabilityOverrides.date, from));
  if (to) conditions.push(lte(userAvailabilityOverrides.date, to));
  const rows = await db
    .select()
    .from(userAvailabilityOverrides)
    .where(and(...conditions))
    .orderBy(asc(userAvailabilityOverrides.date));
  return rows.map(serializeOverride);
}

// ─── Booking slug ─────────────────────────────────────────────────────────────
// The public short link is /book/<slug>. Slug = sanitized email local-part alone
// when globally unique; on collision the user's id prefix is appended (shortest
// first) until unique. Persisted once and never changed.

function sanitizeSlugBase(emailLocalPart: string): string {
  const cleaned = emailLocalPart.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : 'user';
}

// True when no OTHER user already owns this slug.
async function slugIsFree(slug: string, excludeUserId: string): Promise<boolean> {
  const [hit] = await db
    .select({ userId: userAvailability.userId })
    .from(userAvailability)
    .where(eq(userAvailability.bookingSlug, slug))
    .limit(1);
  return !hit || hit.userId === excludeUserId;
}

async function generateBookingSlug(emailLocalPart: string, userId: string): Promise<string> {
  const base = sanitizeSlugBase(emailLocalPart);
  if (await slugIsFree(base, userId)) return base;
  // Append the shortest prefix of the (hex) user id that makes the slug unique.
  for (let len = 4; len <= userId.length; len++) {
    const candidate = `${base}${userId.slice(0, len)}`;
    if (await slugIsFree(candidate, userId)) return candidate;
  }
  return `${base}${userId}`; // pathological fallback (full id is unique)
}

// Upsert the availability row, assigning a stable booking slug on first save.
// Never overwrites an existing slug (coalesce), and retries if a concurrent
// first-save grabbed the same slug (unique-violation 23505).
async function upsertAvailabilityRow(
  tenantId: string,
  targetUserId: string,
  cols: Record<string, any>,
  email: string,
): Promise<UserAvailability> {
  const [existing] = await db
    .select({ bookingSlug: userAvailability.bookingSlug })
    .from(userAvailability)
    .where(eq(userAvailability.userId, targetUserId))
    .limit(1);
  const existingSlug = existing?.bookingSlug ?? null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = existingSlug ?? (await generateBookingSlug(email.split('@')[0], targetUserId));
    try {
      const [row] = await db
        .insert(userAvailability)
        .values({ tenantId, userId: targetUserId, bookingSlug: slug, ...cols })
        .onConflictDoUpdate({
          target: userAvailability.userId,
          set: {
            ...cols,
            updatedAt: new Date(),
            bookingSlug: sql`coalesce(${userAvailability.bookingSlug}, ${slug})`,
          },
        })
        .returning();
      return row;
    } catch (err: any) {
      // Only retry when assigning a fresh slug and we lost a race on the unique index.
      if (existingSlug || err?.code !== '23505') throw err;
    }
  }
  throw new Error('Could not assign a unique booking slug');
}

// Shared upsert for PUT /me and PUT /:userId.
async function upsertAvailability(req: any, res: Response, targetUserId: string) {
  const tenantId = req.user.tenantId as string;

  const targetUser = await getTenantUser(tenantId, targetUserId);
  if (!targetUser) return res.status(404).json({ message: 'User not found in this organization' });

  const parsed = upsertUserAvailabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid availability data', errors: parsed.error.flatten() });
  }

  const cols = toAvailabilityColumns(parsed.data);
  const row = await upsertAvailabilityRow(tenantId, targetUserId, cols, targetUser.email);

  await logActivity({
    tenantId,
    userId: req.user.id,
    entityType: 'availability',
    entityId: row.id,
    entityName: targetUser.name || targetUser.email,
    activityType: 'updated',
    description: `Updated availability for ${targetUser.name || targetUser.email}`,
    metadata: { targetUserId, editedSelf: targetUserId === req.user.id },
    req,
  });

  const overrides = await fetchOverrides(tenantId, targetUserId);
  return res.json({ availability: serializeAvailability(row), overrides });
}

// ─── Routes (static segments before /:userId so they aren't captured) ────────

// GET /api/availability/me — own availability + overrides (synthesizes a default
// when nothing is saved yet).
router.get('/me', async (req: any, res: Response) => {
  try {
    const tenantId = req.user.tenantId as string;
    const userId = req.user.id as string;
    const [row] = await db
      .select()
      .from(userAvailability)
      .where(and(eq(userAvailability.tenantId, tenantId), eq(userAvailability.userId, userId)))
      .limit(1);
    const overrides = await fetchOverrides(tenantId, userId);
    if (!row) {
      const me = await getTenantUser(tenantId, userId);
      return res.json({ availability: synthesizeDefault(userId, me?.timezone), overrides });
    }
    return res.json({ availability: serializeAvailability(row), overrides });
  } catch (error: any) {
    console.error('[Availability] GET /me failed:', error);
    return res.status(500).json({ message: 'Failed to load availability' });
  }
});

// GET /api/availability/providers — tenant users + their bookable status. Powers
// the admin provider picker and (later) the public booking provider list.
router.get('/providers', async (req: any, res: Response) => {
  try {
    const tenantId = req.user.tenantId as string;
    const rows = await db
      .select({
        id: betterAuthUser.id,
        name: betterAuthUser.name,
        email: betterAuthUser.email,
        role: betterAuthUser.role,
        isActive: betterAuthUser.isActive,
        availabilityId: userAvailability.id,
        timezone: userAvailability.timezone,
        isBookable: userAvailability.isBookable,
        isEnabled: userAvailability.isEnabled,
      })
      .from(betterAuthUser)
      .leftJoin(userAvailability, eq(userAvailability.userId, betterAuthUser.id))
      .where(eq(betterAuthUser.tenantId, tenantId));

    const providers = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      isActive: r.isActive,
      hasAvailability: r.availabilityId !== null,
      timezone: r.timezone,
      isBookable: r.isBookable ?? false,
      isEnabled: r.isEnabled ?? false,
    }));
    return res.json({ providers });
  } catch (error: any) {
    console.error('[Availability] GET /providers failed:', error);
    return res.status(500).json({ message: 'Failed to load providers' });
  }
});

// PUT /api/availability/me — upsert own availability.
router.put('/me', async (req: any, res: Response) => {
  try {
    return await upsertAvailability(req, res, req.user.id);
  } catch (error: any) {
    console.error('[Availability] PUT /me failed:', error);
    return res.status(500).json({ message: 'Failed to save availability' });
  }
});

// PUT /api/availability/overrides/:id — update a single date override.
router.put('/overrides/:id', async (req: any, res: Response) => {
  try {
    const tenantId = req.user.tenantId as string;
    const [existing] = await db
      .select()
      .from(userAvailabilityOverrides)
      .where(and(eq(userAvailabilityOverrides.id, req.params.id), eq(userAvailabilityOverrides.tenantId, tenantId)))
      .limit(1);
    if (!existing) return res.status(404).json({ message: 'Override not found' });
    if (!(await canEditUser(req, existing.userId))) {
      return res.status(403).json({ message: 'Insufficient permissions for this action' });
    }

    const parsed = updateAvailabilityOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid override data', errors: parsed.error.flatten() });
    }
    const data = parsed.data;
    const [row] = await db
      .update(userAvailabilityOverrides)
      .set({
        date: data.date,
        type: data.type,
        ranges: data.type === 'custom' && data.ranges ? JSON.stringify(data.ranges) : null,
        note: data.note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(userAvailabilityOverrides.id, existing.id))
      .returning();

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'availability',
      entityId: row.id,
      activityType: 'updated',
      description: `Updated availability override (${row.date})`,
      metadata: { targetUserId: existing.userId, editedSelf: existing.userId === req.user.id },
      req,
    });
    return res.json({ override: serializeOverride(row) });
  } catch (error: any) {
    console.error('[Availability] PUT /overrides/:id failed:', error);
    return res.status(500).json({ message: 'Failed to update override' });
  }
});

// DELETE /api/availability/overrides/:id — remove a date override.
router.delete('/overrides/:id', async (req: any, res: Response) => {
  try {
    const tenantId = req.user.tenantId as string;
    const [existing] = await db
      .select()
      .from(userAvailabilityOverrides)
      .where(and(eq(userAvailabilityOverrides.id, req.params.id), eq(userAvailabilityOverrides.tenantId, tenantId)))
      .limit(1);
    if (!existing) return res.status(404).json({ message: 'Override not found' });
    if (!(await canEditUser(req, existing.userId))) {
      return res.status(403).json({ message: 'Insufficient permissions for this action' });
    }

    await db.delete(userAvailabilityOverrides).where(eq(userAvailabilityOverrides.id, existing.id));
    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'availability',
      entityId: existing.id,
      activityType: 'deleted',
      description: `Removed availability override (${existing.date})`,
      metadata: { targetUserId: existing.userId, editedSelf: existing.userId === req.user.id },
      req,
    });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Availability] DELETE /overrides/:id failed:', error);
    return res.status(500).json({ message: 'Failed to delete override' });
  }
});

// GET /api/availability/:userId — another user's availability + overrides.
router.get('/:userId', async (req: any, res: Response) => {
  try {
    const tenantId = req.user.tenantId as string;
    const targetUserId = req.params.userId;
    if (!(await canEditUser(req, targetUserId))) {
      return res.status(403).json({ message: 'Insufficient permissions for this action' });
    }
    const targetUser = await getTenantUser(tenantId, targetUserId);
    if (!targetUser) return res.status(404).json({ message: 'User not found in this organization' });

    const [row] = await db
      .select()
      .from(userAvailability)
      .where(and(eq(userAvailability.tenantId, tenantId), eq(userAvailability.userId, targetUserId)))
      .limit(1);
    const overrides = await fetchOverrides(tenantId, targetUserId);
    if (!row) {
      return res.json({ availability: synthesizeDefault(targetUserId, targetUser.timezone), overrides });
    }
    return res.json({ availability: serializeAvailability(row), overrides });
  } catch (error: any) {
    console.error('[Availability] GET /:userId failed:', error);
    return res.status(500).json({ message: 'Failed to load availability' });
  }
});

// PUT /api/availability/:userId — upsert another user's availability.
router.put('/:userId', async (req: any, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    if (!(await canEditUser(req, targetUserId))) {
      return res.status(403).json({ message: 'Insufficient permissions for this action' });
    }
    return await upsertAvailability(req, res, targetUserId);
  } catch (error: any) {
    console.error('[Availability] PUT /:userId failed:', error);
    return res.status(500).json({ message: 'Failed to save availability' });
  }
});

// GET /api/availability/:userId/overrides — optional ?from=&to= date range.
router.get('/:userId/overrides', async (req: any, res: Response) => {
  try {
    const tenantId = req.user.tenantId as string;
    const targetUserId = req.params.userId;
    if (!(await canEditUser(req, targetUserId))) {
      return res.status(403).json({ message: 'Insufficient permissions for this action' });
    }
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const overrides = await fetchOverrides(tenantId, targetUserId, from, to);
    return res.json({ overrides });
  } catch (error: any) {
    console.error('[Availability] GET /:userId/overrides failed:', error);
    return res.status(500).json({ message: 'Failed to load overrides' });
  }
});

// POST /api/availability/:userId/overrides — create or replace a date override.
router.post('/:userId/overrides', async (req: any, res: Response) => {
  try {
    const tenantId = req.user.tenantId as string;
    const targetUserId = req.params.userId;
    if (!(await canEditUser(req, targetUserId))) {
      return res.status(403).json({ message: 'Insufficient permissions for this action' });
    }
    const targetUser = await getTenantUser(tenantId, targetUserId);
    if (!targetUser) return res.status(404).json({ message: 'User not found in this organization' });

    const parsed = createAvailabilityOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid override data', errors: parsed.error.flatten() });
    }
    const data = parsed.data;
    const cols = {
      type: data.type,
      ranges: data.type === 'custom' && data.ranges ? JSON.stringify(data.ranges) : null,
      note: data.note ?? null,
    };
    // Upsert on (userId, date) so re-adding the same day replaces it.
    const [row] = await db
      .insert(userAvailabilityOverrides)
      .values({ tenantId, userId: targetUserId, date: data.date, ...cols })
      .onConflictDoUpdate({
        target: [userAvailabilityOverrides.userId, userAvailabilityOverrides.date],
        set: { ...cols, updatedAt: new Date() },
      })
      .returning();

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'availability',
      entityId: row.id,
      activityType: 'created',
      description: `Added availability override (${row.date})`,
      metadata: { targetUserId, editedSelf: targetUserId === req.user.id },
      req,
    });
    return res.status(201).json({ override: serializeOverride(row) });
  } catch (error: any) {
    console.error('[Availability] POST /:userId/overrides failed:', error);
    return res.status(500).json({ message: 'Failed to create override' });
  }
});

export default router;
