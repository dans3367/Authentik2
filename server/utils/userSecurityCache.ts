/**
 * User Security Cache
 *
 * Caches security-critical user fields (role, tenantId, isActive) to reduce
 * database reads on every authenticated request. The cache is automatically
 * invalidated on logout, password reset, role change, status change, and
 * other security-sensitive operations.
 *
 * Uses node-cache with a short TTL so stale data self-heals quickly even
 * if an invalidation call is missed.
 */

import NodeCache from 'node-cache';
import { logActivity } from './activityLogger';

// Cached subset of user security fields — only the columns that
// authenticateToken needs from the database.
export interface CachedUserSecurity {
  id: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  language: string;
}

// Short TTL (60s) keeps the blast radius of stale data small.
// checkperiod runs every 120s to purge expired keys.
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// ─── Session result cache ────────────────────────────────────────────────────
// Caches the full auth.api.getSession() result keyed by session token.
// This eliminates the two DB queries Better Auth makes per request
// (better_auth_session lookup + better_auth_user lookup).

export interface CachedSessionResult {
  session: any;
  user: any;
}

const sessionCache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

// ─── Session result read/write ───────────────────────────────────────────────

/** Return cached getSession() result for a token, or undefined on miss. */
export function getSessionResult(token: string): CachedSessionResult | undefined {
  return sessionCache.get<CachedSessionResult>(token);
}

/** Populate the session result cache after a successful getSession() call. */
export function setSessionResult(token: string, result: CachedSessionResult): void {
  sessionCache.set(token, result);
}

/** Remove a session from the cache (e.g. on logout or revocation). */
export function invalidateSessionResult(token: string): void {
  sessionCache.del(token);
}

// ─── Read ────────────────────────────────────────────────────────────────────

/** Return cached security data for a user, or undefined on cache miss. */
export function getUserSecurity(userId: string): CachedUserSecurity | undefined {
  return cache.get<CachedUserSecurity>(userId);
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Populate (or refresh) the cache after a successful DB read. */
export function setUserSecurity(userId: string, data: CachedUserSecurity): void {
  cache.set(userId, data);
}

// ─── Invalidation ────────────────────────────────────────────────────────────

export type SecurityInvalidationReason =
  | 'logout'
  | 'logout_all'
  | 'session_revoked'
  | 'password_reset'
  | 'role_change'
  | 'status_change'
  | 'user_deleted'
  | '2fa_change'
  | 'profile_update';

/**
 * Remove a single user's cached security data.
 * Should be called whenever a security-sensitive field changes.
 *
 * @param userId   – the user whose cache entry to drop
 * @param reason   – why the cache was invalidated (for audit trail)
 * @param metadata – optional extra context written to the audit log
 */
export function invalidateUserSecurity(
  userId: string,
  reason: SecurityInvalidationReason,
  metadata?: { tenantId?: string; performedBy?: string; req?: any },
): void {
  const existed = cache.del(userId) > 0;

  // Also evict any cached session results belonging to this user so the next
  // request goes through auth.api.getSession() and picks up fresh data.
  for (const key of sessionCache.keys()) {
    const entry = sessionCache.get<CachedSessionResult>(key);
    if (entry?.user?.id === userId) {
      sessionCache.del(key);
    }
  }

  // Fire-and-forget audit log — never blocks the caller.
  if (metadata?.tenantId) {
    logActivity({
      tenantId: metadata.tenantId,
      userId: metadata.performedBy ?? userId,
      entityType: 'user',
      entityId: userId,
      activityType: 'updated',
      description: `Security cache invalidated: ${reason}`,
      metadata: { cacheEvent: 'invalidate', reason, hadCachedEntry: existed },
      req: metadata.req,
    }).catch(() => {});
  }
}

/**
 * Remove cached security data for every user in a tenant.
 * Useful after bulk operations (e.g. permission matrix reset).
 */
export function invalidateTenantSecurity(tenantId: string): void {
  for (const key of cache.keys()) {
    const entry = cache.get<CachedUserSecurity>(key);
    if (entry?.tenantId === tenantId) {
      cache.del(key);
    }
  }
  // Also evict session results for users in this tenant
  for (const key of sessionCache.keys()) {
    const entry = sessionCache.get<CachedSessionResult>(key);
    if (entry?.user?.tenantId === tenantId) {
      sessionCache.del(key);
    }
  }
}

/** Wipe all caches (e.g. during graceful shutdown or tests). */
export function flushSecurityCache(): void {
  cache.flushAll();
  sessionCache.flushAll();
  tenantSubCache.flushAll();
  tenantLimitsCache.flushAll();
}

// ─── Tenant subscription cache ──────────────────────────────────────────────
// Caches the full getTenantSubscription() result (subscription + joined plan)
// to avoid the subscriptions+plan JOIN on every request. This is the root
// query called by getTenantPlan, checkUserLimits, checkEmailLimits,
// requirePlanFeature, requireShopAccess, and account usage routes.
// Subscription data changes only on Stripe webhook events or manual plan changes.

const tenantSubCache = new NodeCache({ stdTTL: 120, checkperiod: 60 });
const NO_SUBSCRIPTION = Symbol.for('NO_SUB');

export function getTenantPlanCached(tenantId: string): any | undefined {
  const val = tenantSubCache.get(tenantId);
  if (val === NO_SUBSCRIPTION) return null;
  return val; // undefined = cache miss, object = subscription+plan
}

export function setTenantPlanCached(tenantId: string, subscription: any | null): void {
  tenantSubCache.set(tenantId, subscription === null ? NO_SUBSCRIPTION : subscription);
}

/** Invalidate when subscription changes (upgrade, downgrade, webhook). */
export function invalidateTenantPlanCache(tenantId: string): void {
  tenantSubCache.del(tenantId);
}

// ─── Tenant limits cache ────────────────────────────────────────────────────
// Caches the active tenant_limits row to avoid repeated DB lookups in
// checkShopLimits, checkEmailLimits, and validateUserCreation.
// Limits change only when an admin explicitly creates/updates/deletes them.

export interface CachedTenantLimits {
  id: string;
  maxShops: number | null;
  maxUsers: number | null;
  maxStorageGb: number | null;
  monthlyEmailLimit: number | null;
  overrideReason: string | null;
  expiresAt: string | null; // ISO string (not Date) to survive node-cache serialization
  isActive: boolean;
}

const tenantLimitsCache = new NodeCache({ stdTTL: 120, checkperiod: 60 });

// Use a sentinel to cache "no limits row exists" so we don't re-query every time.
const NO_LIMITS = Symbol.for('NO_LIMITS');

export function getTenantLimitsCached(tenantId: string): CachedTenantLimits | null | undefined {
  const val = tenantLimitsCache.get(tenantId);
  if (val === NO_LIMITS) return null; // cached miss — no limits row for this tenant
  if (val === undefined) return undefined; // true cache miss

  const entry = val as CachedTenantLimits;

  // Re-check expiry on read — a limit may have expired while cached.
  if (entry.expiresAt) {
    const expiresMs = new Date(entry.expiresAt).getTime();
    if (expiresMs <= Date.now()) {
      tenantLimitsCache.del(tenantId); // evict stale entry
      return undefined; // force DB re-query
    }
  }

  return entry;
}

export function setTenantLimitsCached(tenantId: string, limits: CachedTenantLimits | null): void {
  tenantLimitsCache.set(tenantId, limits === null ? NO_LIMITS : limits);
}

export function invalidateTenantLimitsCache(tenantId: string): void {
  tenantLimitsCache.del(tenantId);
}

// ─── Stats (useful for health checks / monitoring) ──────────────────────────

export function getSecurityCacheStats() {
  return {
    userSecurity: cache.getStats(),
    sessionResult: sessionCache.getStats(),
    tenantSubscription: tenantSubCache.getStats(),
    tenantLimits: tenantLimitsCache.getStats(),
  };
}
