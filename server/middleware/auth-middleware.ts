import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { betterAuthUser, tenants, rolePermissions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '../auth';
import { storage } from '../storage';
import {
  getUserSecurity, setUserSecurity, type CachedUserSecurity,
  getSessionResult, setSessionResult,
} from '../utils/userSecurityCache';

// Shape of session.user returned by Better Auth with additionalFields
interface SessionUser {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  tenantId?: string;
  isActive?: boolean;
  language?: string;
}

// Better Auth session-based authentication middleware
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId: string;
  language?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// Extract the base token (without signature suffix) from the session cookie.
function extractSessionToken(req: Request): string | undefined {
  const raw = (req as any).cookies?.['better-auth.session_token'];
  if (!raw) return undefined;
  const dot = raw.indexOf('.');
  return dot > 0 ? raw.substring(0, dot) : raw;
}

// Better Auth session verification middleware
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check session result cache first to avoid the two DB queries that
    // auth.api.getSession() makes on every call (session + user lookup).
    const token = extractSessionToken(req);
    let session: { session: any; user: any } | null = null;

    if (token) {
      const cached = getSessionResult(token);
      if (cached) {
        // Verify the cached session hasn't expired
        const expiresAt = new Date(cached.session.expiresAt).getTime();
        if (expiresAt > Date.now()) {
          session = cached;
        }
        // If expired, fall through to getSession() which will clean up
      }
    }

    if (!session) {
      session = await auth.api.getSession({
        headers: req.headers as any
      });

      // Populate session cache on success
      if (session && token) {
        setSessionResult(token, { session: session.session, user: session.user });
      }
    }

    if (!session) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }

    const sessionUser = session.user as SessionUser;

    // Check the in-memory security cache first; fall back to the database on
    // cache miss. The cache is invalidated on every security-sensitive change
    // (role, status, password reset, logout, 2FA, etc.) so the data stays fresh.
    let userRecord: CachedUserSecurity | undefined = getUserSecurity(sessionUser.id);

    if (!userRecord) {
      const dbRecord = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, sessionUser.id),
        columns: {
          id: true,
          role: true,
          tenantId: true,
          isActive: true,
          language: true,
        },
      });

      if (!dbRecord) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Also load the tenant's pending-deletion state so we can gate access.
      // This piggybacks on the user security cache lookup so it's a one-time
      // cost per cache miss.
      let tenantDeletionScheduledAt: Date | null = null;
      if (dbRecord.tenantId) {
        const tenantRecord = await db.query.tenants.findFirst({
          where: eq(tenants.id, dbRecord.tenantId),
          columns: { deletionScheduledAt: true },
        });
        tenantDeletionScheduledAt = tenantRecord?.deletionScheduledAt ?? null;
      }

      // Populate cache for subsequent requests
      userRecord = {
        id: dbRecord.id,
        role: dbRecord.role || 'Employee',
        tenantId: dbRecord.tenantId,
        isActive: dbRecord.isActive ?? false,
        language: dbRecord.language || 'en',
        tenantDeletionScheduledAt,
      };
      setUserSecurity(sessionUser.id, userRecord);
    }

    // Check if user account is active (treat missing/undefined as inactive to be safe)
    if (userRecord.isActive !== true) {
      return res.status(403).json({ message: 'Account is deactivated. Please contact your administrator.' });
    }

    // Use session data for display-only fields (avoids fetching unnecessary columns)
    let firstName: string | undefined = sessionUser.firstName || undefined;
    let lastName: string | undefined = sessionUser.lastName || undefined;

    // Fallback to parsing name if fields are missing
    if (!firstName && !lastName && sessionUser.name) {
      const nameParts = sessionUser.name.split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ') || undefined;
    }

    // Check if user has a valid tenant ID (use DB-authoritative value)
    const placeholderTenantIds = [
      '00000000-0000-0000-0000-000000000000',
      '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff', // Old schema default
    ];

    let finalTenantId = userRecord.tenantId;

    if (!userRecord.tenantId || placeholderTenantIds.includes(userRecord.tenantId)) {
      // We no longer provide a fallback. This will likely cause downstream failures if the route requires a tenant,
      // which is the intended stricter behavior.
    }

    // Create authenticated user object using DB-authoritative security fields
    // and session-sourced display fields
    const authUser: AuthUser = {
      id: userRecord.id,
      email: sessionUser.email,
      name: sessionUser.name || undefined,
      firstName,
      lastName,
      role: userRecord.role || 'Employee',
      tenantId: finalTenantId,
      language: userRecord.language || 'en',
    };

    req.user = authUser;

    // Pending-deletion gate: if the tenant has been scheduled for deletion,
    // only a narrow whitelist of endpoints is usable (so the Owner can still
    // check status, cancel, export data, or log out).
    if (userRecord.tenantDeletionScheduledAt) {
      const allowedDuringDeletion = [
        '/api/account/deletion-status',
        '/api/account/cancel-deletion',
        '/api/account/export',
        '/api/auth/logout',
      ];
      // req.originalUrl is the full URL including query string — strip ?...
      const pathname = (req.originalUrl || '').split('?')[0];
      const isAllowed = allowedDuringDeletion.some((p) => pathname.startsWith(p));
      if (!isAllowed) {
        return res.status(403).json({
          code: 'TENANT_PENDING_DELETION',
          message: 'This account is scheduled for deletion.',
          scheduledPurgeAt: userRecord.tenantDeletionScheduledAt,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ message: 'Authentication service error' });
  }
};

// Role hierarchy: Owner > Administrator > Manager > Employee
export const ROLE_HIERARCHY: Record<string, number> = {
  'Employee': 1,
  'Manager': 2,
  'Administrator': 3,
  'Owner': 4,
};

/**
 * Returns the list of roles strictly below the given role in the hierarchy.
 * Used to enforce that users can only assign roles below their own level.
 */
export function getAssignableRoles(currentRole: string): string[] {
  const currentLevel = ROLE_HIERARCHY[currentRole] || 0;
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, level]) => level < currentLevel)
    .map(([role]) => role);
}

/**
 * Role gate (HIERARCHICAL / at-least).
 *
 * `requireRole('Manager')` admits Manager, Administrator AND Owner because
 * the hierarchy is Owner > Administrator > Manager > Employee. This is the
 * intended behaviour for permission-style gates ("any role at this level
 * or above"), but it means an Owner can invoke routes intended only for a
 * lower role — e.g. employee-only self-service actions that an admin
 * arguably should not impersonate.
 *
 * Use `requireExactRole(...)` below if a route must be invoked by exactly
 * a specific role (or one of a fixed set) regardless of hierarchy.
 *
 * AUDIT NOTE: every existing `requireRole(...)` call site should be
 * reviewed to confirm at-least semantics are actually desired. Switch any
 * "only X may do this" routes to `requireExactRole`.
 */
export const requireRole = (requiredRole: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const roleHierarchy = ROLE_HIERARCHY;

    const userRoleLevel = roleHierarchy[req.user.role as keyof typeof roleHierarchy] || 0;

    // Handle both single role and array of roles
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    // Check if user's role is in the list of required roles or has higher hierarchy
    const hasAccess = requiredRoles.some(role => {
      const requiredRoleLevel = roleHierarchy[role as keyof typeof roleHierarchy] || 0;
      return userRoleLevel >= requiredRoleLevel;
    });

    if (!hasAccess) {
      return res.status(403).json({
        message: 'Insufficient permissions for this action'
      });
    }

    next();
  };
};

/**
 * Role gate (EXACT membership).
 *
 * `requireExactRole('Employee')` admits ONLY Employees. Owners and
 * Administrators are rejected with 403 even though they sit higher in the
 * hierarchy. Use for routes that represent role-specific responsibilities
 * (self-service actions, peer-only flows, segregation-of-duties) rather
 * than capability tiers.
 */
export const requireExactRole = (allowedRoles: string | string[]) => {
  const allowed = new Set(Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]);
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!allowed.has(req.user.role)) {
      return res.status(403).json({
        message: 'This action is not available for your role',
      });
    }
    next();
  };
};

// ─── Default permission definitions per role (must match roleRoutes.ts) ──────
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  Owner: {
    'users.view': true, 'users.create': true, 'users.edit': true, 'users.delete': true, 'users.manage_roles': true, 'users.toggle_status': true,
    'shops.view': true, 'shops.create': true, 'shops.edit': true, 'shops.delete': true, 'shops.toggle_status': true,
    'billing.view': true, 'billing.manage_subscription': true, 'billing.delete_account': true,
    'emails.view': true, 'emails.send': true, 'emails.view_status': true, 'emails.manage_design': true, 'emails.manage_suppression': true,
    'newsletters.view': true, 'newsletters.create': true, 'newsletters.send': true,
    'contacts.view': true, 'contacts.create': true, 'contacts.edit': true, 'contacts.delete': true, 'contacts.import': true, 'contacts.export': true,
    'tags.view': true, 'tags.create': true, 'tags.edit': true, 'tags.delete': true,
    'forms.view': true, 'forms.create': true, 'forms.edit': true, 'forms.delete': true,
    'promotions.view': true, 'promotions.create': true, 'promotions.manage': true,
    'cards.view': true, 'cards.create': true, 'cards.edit': true, 'cards.manage_images': true,
    'appointments.view': true, 'appointments.create': true, 'appointments.edit': true, 'appointments.delete': true, 'appointments.manage_reminders': true, 'appointments.manage_notes': true, 'appointments.send_reschedule': true,
    'segments.view': true, 'segments.create': true, 'segments.edit': true, 'segments.delete': true,
    'templates.view': true, 'templates.create': true, 'templates.edit': true, 'templates.delete': true, 'templates.duplicate': true,
    'birthdays.view': true, 'birthdays.manage': true,
    'activity.view': true,
    'analytics.view_dashboard': true, 'analytics.view_reports': true, 'analytics.export': true,
    'account_usage.view': true,
    'admin.view_sessions': true, 'admin.manage_sessions': true, 'admin.view_system_stats': true,
    'settings.view': true, 'settings.edit': true, 'settings.manage_2fa': true,
  },
  Administrator: {
    'users.view': true, 'users.create': true, 'users.edit': true, 'users.delete': true, 'users.manage_roles': true, 'users.toggle_status': true,
    'shops.view': true, 'shops.create': true, 'shops.edit': true, 'shops.delete': true, 'shops.toggle_status': true,
    'billing.view': true, 'billing.manage_subscription': false, 'billing.delete_account': false,
    'emails.view': true, 'emails.send': true, 'emails.view_status': true, 'emails.manage_design': true, 'emails.manage_suppression': true,
    'newsletters.view': true, 'newsletters.create': true, 'newsletters.send': true,
    'contacts.view': true, 'contacts.create': true, 'contacts.edit': true, 'contacts.delete': true, 'contacts.import': true, 'contacts.export': true,
    'tags.view': true, 'tags.create': true, 'tags.edit': true, 'tags.delete': true,
    'forms.view': true, 'forms.create': true, 'forms.edit': true, 'forms.delete': true,
    'promotions.view': true, 'promotions.create': true, 'promotions.manage': true,
    'cards.view': true, 'cards.create': true, 'cards.edit': true, 'cards.manage_images': true,
    'appointments.view': true, 'appointments.create': true, 'appointments.edit': true, 'appointments.delete': true, 'appointments.manage_reminders': true, 'appointments.manage_notes': true, 'appointments.send_reschedule': true,
    'segments.view': true, 'segments.create': true, 'segments.edit': true, 'segments.delete': true,
    'templates.view': true, 'templates.create': true, 'templates.edit': true, 'templates.delete': true, 'templates.duplicate': true,
    'birthdays.view': true, 'birthdays.manage': true,
    'activity.view': true,
    'analytics.view_dashboard': true, 'analytics.view_reports': true, 'analytics.export': true,
    'account_usage.view': true,
    'admin.view_sessions': true, 'admin.manage_sessions': true, 'admin.view_system_stats': true,
    'settings.view': true, 'settings.edit': false, 'settings.manage_2fa': true,
  },
  Manager: {
    'users.view': true, 'users.create': false, 'users.edit': false, 'users.delete': false, 'users.manage_roles': false, 'users.toggle_status': false,
    'shops.view': true, 'shops.create': true, 'shops.edit': true, 'shops.delete': false, 'shops.toggle_status': true,
    'billing.view': false, 'billing.manage_subscription': false, 'billing.delete_account': false,
    'emails.view': true, 'emails.send': true, 'emails.view_status': false, 'emails.manage_design': false, 'emails.manage_suppression': false,
    'newsletters.view': true, 'newsletters.create': true, 'newsletters.send': true,
    'contacts.view': true, 'contacts.create': true, 'contacts.edit': true, 'contacts.delete': false, 'contacts.import': true, 'contacts.export': true,
    'tags.view': true, 'tags.create': true, 'tags.edit': true, 'tags.delete': false,
    'forms.view': true, 'forms.create': true, 'forms.edit': true, 'forms.delete': false,
    'promotions.view': true, 'promotions.create': true, 'promotions.manage': false,
    'cards.view': true, 'cards.create': true, 'cards.edit': true, 'cards.manage_images': true,
    'appointments.view': true, 'appointments.create': true, 'appointments.edit': true, 'appointments.delete': true, 'appointments.manage_reminders': true, 'appointments.manage_notes': true, 'appointments.send_reschedule': true,
    'segments.view': true, 'segments.create': true, 'segments.edit': true, 'segments.delete': false,
    'templates.view': true, 'templates.create': true, 'templates.edit': true, 'templates.delete': false, 'templates.duplicate': true,
    'birthdays.view': true, 'birthdays.manage': true,
    'activity.view': true,
    'analytics.view_dashboard': true, 'analytics.view_reports': true, 'analytics.export': false,
    'account_usage.view': true,
    'admin.view_sessions': false, 'admin.manage_sessions': false, 'admin.view_system_stats': false,
    'settings.view': true, 'settings.edit': false, 'settings.manage_2fa': true,
  },
  Employee: {
    'users.view': false, 'users.create': false, 'users.edit': false, 'users.delete': false, 'users.manage_roles': false, 'users.toggle_status': false,
    'shops.view': true, 'shops.create': false, 'shops.edit': false, 'shops.delete': false, 'shops.toggle_status': false,
    'billing.view': false, 'billing.manage_subscription': false, 'billing.delete_account': false,
    'emails.view': true, 'emails.send': false, 'emails.view_status': false, 'emails.manage_design': false, 'emails.manage_suppression': false,
    'newsletters.view': true, 'newsletters.create': true, 'newsletters.send': true,
    'contacts.view': true, 'contacts.create': true, 'contacts.edit': false, 'contacts.delete': false, 'contacts.import': false, 'contacts.export': false,
    'tags.view': true, 'tags.create': false, 'tags.edit': false, 'tags.delete': false,
    'forms.view': true, 'forms.create': false, 'forms.edit': false, 'forms.delete': false,
    'promotions.view': true, 'promotions.create': false, 'promotions.manage': false,
    'cards.view': true, 'cards.create': false, 'cards.edit': false, 'cards.manage_images': false,
    'appointments.view': true, 'appointments.create': true, 'appointments.edit': false, 'appointments.delete': false, 'appointments.manage_reminders': false, 'appointments.manage_notes': true, 'appointments.send_reschedule': false,
    'segments.view': true, 'segments.create': false, 'segments.edit': false, 'segments.delete': false,
    'templates.view': true, 'templates.create': false, 'templates.edit': false, 'templates.delete': false, 'templates.duplicate': false,
    'birthdays.view': true, 'birthdays.manage': false,
    'activity.view': false,
    'analytics.view_dashboard': false, 'analytics.view_reports': false, 'analytics.export': false,
    'account_usage.view': false,
    'admin.view_sessions': false, 'admin.manage_sessions': false, 'admin.view_system_stats': false,
    'settings.view': false, 'settings.edit': false, 'settings.manage_2fa': true,
  },
};

/**
 * Resolve the effective permissions for a given role and tenant.
 * Merges default role permissions with any tenant-specific overrides.
 * Owner role always gets all permissions set to true.
 */
export async function getEffectivePermissions(userRole: string, tenantId: string): Promise<Record<string, boolean>> {
  if (userRole === 'Owner') {
    return { ...DEFAULT_ROLE_PERMISSIONS['Owner'] };
  }

  let effectivePermissions: Record<string, boolean> = { ...(DEFAULT_ROLE_PERMISSIONS[userRole] || {}) };

  try {
    if (tenantId) {
      const customRow = await db.query.rolePermissions.findFirst({
        where: and(
          eq(rolePermissions.tenantId, tenantId),
          eq(rolePermissions.role, userRole)
        ),
      });

      if (customRow) {
        try {
          const customPerms = JSON.parse(customRow.permissions);
          effectivePermissions = { ...effectivePermissions, ...customPerms };
        } catch (e) {
          console.error(`Failed to parse custom permissions for role ${userRole}, tenant ${tenantId}:`, e);
        }
      }
    }
  } catch (e) {
    console.log('rolePermissions table not available, using defaults');
  }

  return effectivePermissions;
}

// Permission-based access control middleware
// Checks custom per-tenant permission overrides from rolePermissions table,
// falling back to DEFAULT_ROLE_PERMISSIONS when no overrides exist.
export const requirePermission = (permission: string | string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const requiredPermissions = Array.isArray(permission) ? permission : [permission];

    // Owner always has full access (cannot be customized)
    if (userRole === 'Owner') {
      return next();
    }

    // Get the effective permissions: custom overrides merged with defaults
    let effectivePermissions: Record<string, boolean> = { ...(DEFAULT_ROLE_PERMISSIONS[userRole] || {}) };

    try {
      if (tenantId) {
        const customRow = await db.query.rolePermissions.findFirst({
          where: and(
            eq(rolePermissions.tenantId, tenantId),
            eq(rolePermissions.role, userRole)
          ),
        });

        if (customRow) {
          try {
            const customPerms = JSON.parse(customRow.permissions);
            effectivePermissions = { ...effectivePermissions, ...customPerms };
          } catch (e) {
            console.error(`Failed to parse custom permissions for role ${userRole}, tenant ${tenantId}:`, e);
          }
        }
      }
    } catch (e) {
      // rolePermissions table may not exist yet — use defaults
      console.log('rolePermissions table not available, using defaults');
    }

    // Check if user has ANY of the required permissions
    const hasPermission = requiredPermissions.some(perm => effectivePermissions[perm] === true);

    if (!hasPermission) {
      return res.status(403).json({
        message: 'Insufficient permissions for this action'
      });
    }

    next();
  };
};

// Tenant isolation middleware - ensures tenant ID is present and valid
export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!req.user.tenantId) {
    return res.status(400).json({ message: 'Tenant ID is required' });
  }

  // Validate tenant ID format (should be UUID or contain valid UUID)
  const uuidRegexExact = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uuidRegexExtract = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

  // Check if it's a perfect UUID
  if (uuidRegexExact.test(req.user.tenantId)) {
    // Valid tenant ID, continue
  } else {
    // Check if tenant ID contains a valid UUID (e.g., "tenant-owner2-uuid-here")
    const uuidMatch = req.user.tenantId.match(uuidRegexExtract);
    if (uuidMatch) {
      // Extract the valid UUID and update the request
      const extractedUuid = uuidMatch[0];
      console.log(`🔧 [Tenant Fix] Extracted valid UUID from malformed tenant ID: ${req.user.tenantId} -> ${extractedUuid}`);
      req.user.tenantId = extractedUuid;
    } else {
      return res.status(400).json({
        message: 'Invalid tenant ID format'
      });
    }
  }

  // Add tenant context to request for easier access in route handlers
  (req as any).tenantId = req.user.tenantId;
  (req as any).userId = req.user.id;

  next();
};

// Advanced tenant validation middleware with tenant existence check
export const requireValidTenant = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!req.user.tenantId) {
    return res.status(400).json({ message: 'Tenant ID is required' });
  }

  // First, do basic format validation
  const uuidRegexExact = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uuidRegexExtract = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

  // Check if it's a perfect UUID
  if (uuidRegexExact.test(req.user.tenantId)) {
    // Valid tenant ID, continue
  } else {
    // Check if tenant ID contains a valid UUID (e.g., "tenant-owner2-uuid-here")
    const uuidMatch = req.user.tenantId.match(uuidRegexExtract);
    if (uuidMatch) {
      // Extract the valid UUID and update the request
      const extractedUuid = uuidMatch[0];
      console.log(`🔧 [Tenant Fix] Extracted valid UUID from malformed tenant ID`);
      req.user.tenantId = extractedUuid;
    } else {
      return res.status(400).json({
        message: 'Invalid tenant ID format'
      });
    }
  }

  // Verify tenant exists in database
  try {
    // Verify tenant exists in database
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, req.user.tenantId),
    });

    if (!tenant) {
      return res.status(404).json({
        message: 'Tenant not found'
      });
    }

    if (!tenant.isActive) {
      return res.status(403).json({
        message: 'Tenant is inactive'
      });
    }
  } catch (error) {
    console.error('Tenant validation error:', error);
    return res.status(500).json({ message: 'Tenant validation failed' });
  }

  // Add tenant context to request for easier access in route handlers
  (req as any).tenantId = req.user.tenantId;
  (req as any).userId = req.user.id;

  next();
};

// Shop access gating middleware
// Blocks access when the tenant's plan has maxShops === 0 (e.g. Free plan)
export const requireShopAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.tenantId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const plan = await storage.getTenantPlan(req.user.tenantId);

    if (plan.maxShops === 0) {
      return res.status(403).json({
        message: `Your current plan (${plan.planName}) does not include shops. Please upgrade to access this feature.`,
        upgradeRequired: true,
        currentPlan: plan.planName,
        feature: 'shops',
      });
    }

    next();
  } catch (error) {
    console.error('Shop access check error:', error);
    return res.status(500).json({ message: 'Failed to verify plan features' });
  }
};

// Plan-based feature gating middleware
// Checks the tenant's subscription plan and blocks access if the feature is not available.
// Usage: requirePlanFeature('allowUsersManagement') or requirePlanFeature('allowRolesManagement')
export const requirePlanFeature = (feature: 'allowUsersManagement' | 'allowRolesManagement') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!req.user.tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    try {
      const plan = await storage.getTenantPlan(req.user.tenantId);

      if (!plan[feature]) {
        const featureLabel = feature === 'allowUsersManagement' ? 'user management' : 'roles & permissions management';
        return res.status(403).json({
          message: `Your current plan (${plan.planName}) does not include ${featureLabel}. Please upgrade to access this feature.`,
          upgradeRequired: true,
          currentPlan: plan.planName,
          feature,
        });
      }

      next();
    } catch (error) {
      console.error('Plan feature check error:', error);
      return res.status(500).json({ message: 'Failed to verify plan features' });
    }
  };
};
