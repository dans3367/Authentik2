import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { betterAuthSession, betterAuthUser, tenants, rolePermissions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '../auth';
import { storage } from '../storage';

// Better Auth session-based authentication middleware
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// Better Auth session verification middleware
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log('🔐 [Auth] authenticateToken triggered for:', req.path);
  try {
    // Use Better Auth's built-in session verification
    const session = await auth.api.getSession({
      headers: req.headers as any
    });

    console.log('🔍 [Auth] Session result:', !!session, session?.user?.id);

    if (!session) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }

    // Get additional user data from our database for tenant info
    const userRecord = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, session.user.id)
    });

    if (!userRecord) {
      console.log('❌ [Auth] User not found in database:', session.user.id);
      return res.status(401).json({ message: 'User not found' });
    }

    // Parse user name for firstName/lastName
    let firstName: string | undefined = userRecord.firstName || undefined;
    let lastName: string | undefined = userRecord.lastName || undefined;

    // Fallback to parsing name if fields are missing
    if (!firstName && !lastName && userRecord.name) {
      const nameParts = userRecord.name.split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ') || undefined;
    }

    // Check if user has a valid tenant ID
    const placeholderTenantIds = [
      '00000000-0000-0000-0000-000000000000',
    ];

    let finalTenantId = userRecord.tenantId;

    if (!userRecord.tenantId || placeholderTenantIds.includes(userRecord.tenantId)) {
      console.log('⚠️  [Auth] WARNING: User has placeholder/missing tenant ID:', userRecord.tenantId, 'Email:', userRecord.email);
      // We no longer provide a fallback. This will likely cause downstream failures if the route requires a tenant,
      // which is the intended stricter behavior.
    }

    // Create authenticated user object using Better Auth session data
    const authUser: AuthUser = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name || undefined,
      firstName,
      lastName,
      role: userRecord.role || 'Employee',
      tenantId: finalTenantId
    };

    req.user = authUser;
    console.log('🔍 [Auth] Set req.user:', {
      id: authUser.id,
      email: authUser.email,
      role: authUser.role,
      tenantId: authUser.tenantId
    });
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ message: 'Authentication service error' });
  }
};

export const requireRole = (requiredRole: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log('🔍 [Role] requireRole middleware called, required:', requiredRole);
    console.log('🔍 [Role] req.user exists:', !!req.user, 'role:', req.user?.role);

    if (!req.user) {
      console.error('❌ [Role] req.user is undefined in requireRole!');
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Role hierarchy: Owner > Administrator > Manager > Employee
    const roleHierarchy = {
      'Employee': 1,
      'Manager': 2,
      'Administrator': 3,
      'Owner': 4
    };

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
        message: `Insufficient permissions. Required role(s): ${requiredRoles.join(', ')}, your role: ${req.user.role}`
      });
    }

    next();
  };
};

// ─── Default permission definitions per role (must match roleRoutes.ts) ──────
const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  Owner: {
    'users.view': true, 'users.create': true, 'users.edit': true, 'users.delete': true, 'users.manage_roles': true, 'users.toggle_status': true,
    'shops.view': true, 'shops.create': true, 'shops.edit': true, 'shops.delete': true, 'shops.toggle_status': true,
    'company.view': true, 'company.create': true, 'company.edit': true, 'company.manage_users': true,
    'billing.view': true, 'billing.manage_subscription': true, 'billing.manage_checkout': true, 'billing.view_usage': true,
    'tenant.view_limits': true, 'tenant.edit_limits': true, 'tenant.fix_issues': true,
    'emails.view': true, 'emails.send': true, 'emails.view_status': true, 'emails.manage_design': true, 'emails.manage_suppression': true,
    'newsletters.view': true, 'newsletters.create': true, 'newsletters.send': true, 'newsletters.view_stats': true,
    'campaigns.view': true, 'campaigns.create': true, 'campaigns.manage': true,
    'contacts.view': true, 'contacts.create': true, 'contacts.edit': true, 'contacts.delete': true, 'contacts.import': true, 'contacts.export': true,
    'tags.view': true, 'tags.create': true, 'tags.edit': true, 'tags.delete': true,
    'forms.view': true, 'forms.create': true, 'forms.edit': true, 'forms.delete': true,
    'promotions.view': true, 'promotions.create': true, 'promotions.manage': true,
    'cards.view': true, 'cards.create': true, 'cards.edit': true, 'cards.manage_images': true,
    'appointments.view': true, 'appointments.create': true, 'appointments.edit': true, 'appointments.delete': true, 'appointments.manage_reminders': true, 'appointments.manage_notes': true, 'appointments.send_reschedule': true,
    'segments.view': true, 'segments.create': true, 'segments.edit': true, 'segments.delete': true,
    'templates.view': true, 'templates.create': true, 'templates.edit': true, 'templates.delete': true, 'templates.duplicate': true,
    'birthdays.view': true, 'birthdays.manage': true,
    'ai.use': true, 'activity.view': true,
    'analytics.view_dashboard': true, 'analytics.view_reports': true, 'analytics.export': true,
    'account_usage.view': true,
    'admin.view_sessions': true, 'admin.manage_sessions': true, 'admin.view_system_stats': true, 'admin.system_health': true,
    'webhooks.view': true, 'webhooks.manage': true,
    'settings.view': true, 'settings.edit': true, 'settings.manage_2fa': true,
  },
  Administrator: {
    'users.view': true, 'users.create': true, 'users.edit': true, 'users.delete': true, 'users.manage_roles': true, 'users.toggle_status': true,
    'shops.view': true, 'shops.create': true, 'shops.edit': true, 'shops.delete': true, 'shops.toggle_status': true,
    'company.view': true, 'company.create': true, 'company.edit': true, 'company.manage_users': true,
    'billing.view': true, 'billing.manage_subscription': false, 'billing.manage_checkout': false, 'billing.view_usage': true,
    'tenant.view_limits': true, 'tenant.edit_limits': true, 'tenant.fix_issues': true,
    'emails.view': true, 'emails.send': true, 'emails.view_status': true, 'emails.manage_design': true, 'emails.manage_suppression': true,
    'newsletters.view': true, 'newsletters.create': true, 'newsletters.send': true, 'newsletters.view_stats': true,
    'campaigns.view': true, 'campaigns.create': true, 'campaigns.manage': true,
    'contacts.view': true, 'contacts.create': true, 'contacts.edit': true, 'contacts.delete': true, 'contacts.import': true, 'contacts.export': true,
    'tags.view': true, 'tags.create': true, 'tags.edit': true, 'tags.delete': true,
    'forms.view': true, 'forms.create': true, 'forms.edit': true, 'forms.delete': true,
    'promotions.view': true, 'promotions.create': true, 'promotions.manage': true,
    'cards.view': true, 'cards.create': true, 'cards.edit': true, 'cards.manage_images': true,
    'appointments.view': true, 'appointments.create': true, 'appointments.edit': true, 'appointments.delete': true, 'appointments.manage_reminders': true, 'appointments.manage_notes': true, 'appointments.send_reschedule': true,
    'segments.view': true, 'segments.create': true, 'segments.edit': true, 'segments.delete': true,
    'templates.view': true, 'templates.create': true, 'templates.edit': true, 'templates.delete': true, 'templates.duplicate': true,
    'birthdays.view': true, 'birthdays.manage': true,
    'ai.use': true, 'activity.view': true,
    'analytics.view_dashboard': true, 'analytics.view_reports': true, 'analytics.export': true,
    'account_usage.view': true,
    'admin.view_sessions': true, 'admin.manage_sessions': true, 'admin.view_system_stats': true, 'admin.system_health': true,
    'webhooks.view': true, 'webhooks.manage': true,
    'settings.view': true, 'settings.edit': false, 'settings.manage_2fa': true,
  },
  Manager: {
    'users.view': true, 'users.create': false, 'users.edit': false, 'users.delete': false, 'users.manage_roles': false, 'users.toggle_status': false,
    'shops.view': true, 'shops.create': true, 'shops.edit': true, 'shops.delete': false, 'shops.toggle_status': true,
    'company.view': true, 'company.create': false, 'company.edit': false, 'company.manage_users': false,
    'billing.view': false, 'billing.manage_subscription': false, 'billing.manage_checkout': false, 'billing.view_usage': false,
    'tenant.view_limits': false, 'tenant.edit_limits': false, 'tenant.fix_issues': false,
    'emails.view': true, 'emails.send': true, 'emails.view_status': false, 'emails.manage_design': false, 'emails.manage_suppression': false,
    'newsletters.view': true, 'newsletters.create': true, 'newsletters.send': true, 'newsletters.view_stats': true,
    'campaigns.view': true, 'campaigns.create': true, 'campaigns.manage': false,
    'contacts.view': true, 'contacts.create': true, 'contacts.edit': true, 'contacts.delete': false, 'contacts.import': true, 'contacts.export': true,
    'tags.view': true, 'tags.create': true, 'tags.edit': true, 'tags.delete': false,
    'forms.view': true, 'forms.create': true, 'forms.edit': true, 'forms.delete': false,
    'promotions.view': true, 'promotions.create': true, 'promotions.manage': false,
    'cards.view': true, 'cards.create': true, 'cards.edit': true, 'cards.manage_images': true,
    'appointments.view': true, 'appointments.create': true, 'appointments.edit': true, 'appointments.delete': true, 'appointments.manage_reminders': true, 'appointments.manage_notes': true, 'appointments.send_reschedule': true,
    'segments.view': true, 'segments.create': true, 'segments.edit': true, 'segments.delete': false,
    'templates.view': true, 'templates.create': true, 'templates.edit': true, 'templates.delete': false, 'templates.duplicate': true,
    'birthdays.view': true, 'birthdays.manage': true,
    'ai.use': true, 'activity.view': true,
    'analytics.view_dashboard': true, 'analytics.view_reports': true, 'analytics.export': false,
    'account_usage.view': true,
    'admin.view_sessions': false, 'admin.manage_sessions': false, 'admin.view_system_stats': false, 'admin.system_health': false,
    'webhooks.view': false, 'webhooks.manage': false,
    'settings.view': true, 'settings.edit': false, 'settings.manage_2fa': true,
  },
  Employee: {
    'users.view': false, 'users.create': false, 'users.edit': false, 'users.delete': false, 'users.manage_roles': false, 'users.toggle_status': false,
    'shops.view': true, 'shops.create': false, 'shops.edit': false, 'shops.delete': false, 'shops.toggle_status': false,
    'company.view': true, 'company.create': false, 'company.edit': false, 'company.manage_users': false,
    'billing.view': false, 'billing.manage_subscription': false, 'billing.manage_checkout': false, 'billing.view_usage': false,
    'tenant.view_limits': false, 'tenant.edit_limits': false, 'tenant.fix_issues': false,
    'emails.view': true, 'emails.send': false, 'emails.view_status': false, 'emails.manage_design': false, 'emails.manage_suppression': false,
    'newsletters.view': true, 'newsletters.create': false, 'newsletters.send': false, 'newsletters.view_stats': true,
    'campaigns.view': true, 'campaigns.create': false, 'campaigns.manage': false,
    'contacts.view': true, 'contacts.create': true, 'contacts.edit': false, 'contacts.delete': false, 'contacts.import': false, 'contacts.export': false,
    'tags.view': true, 'tags.create': false, 'tags.edit': false, 'tags.delete': false,
    'forms.view': true, 'forms.create': false, 'forms.edit': false, 'forms.delete': false,
    'promotions.view': true, 'promotions.create': false, 'promotions.manage': false,
    'cards.view': true, 'cards.create': false, 'cards.edit': false, 'cards.manage_images': false,
    'appointments.view': true, 'appointments.create': true, 'appointments.edit': false, 'appointments.delete': false, 'appointments.manage_reminders': false, 'appointments.manage_notes': true, 'appointments.send_reschedule': false,
    'segments.view': true, 'segments.create': false, 'segments.edit': false, 'segments.delete': false,
    'templates.view': true, 'templates.create': false, 'templates.edit': false, 'templates.delete': false, 'templates.duplicate': false,
    'birthdays.view': true, 'birthdays.manage': false,
    'ai.use': false, 'activity.view': false,
    'analytics.view_dashboard': false, 'analytics.view_reports': false, 'analytics.export': false,
    'account_usage.view': false,
    'admin.view_sessions': false, 'admin.manage_sessions': false, 'admin.view_system_stats': false, 'admin.system_health': false,
    'webhooks.view': false, 'webhooks.manage': false,
    'settings.view': false, 'settings.edit': false, 'settings.manage_2fa': true,
  },
};

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
        message: `Insufficient permissions. Required: ${requiredPermissions.join(' or ')}, your role: ${userRole}`,
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
        message: 'Invalid tenant ID format - no valid UUID found',
        tenantId: req.user.tenantId
      });
    }
  }

  // Add tenant context to request for easier access in route handlers
  (req as any).tenantId = req.user.tenantId;
  (req as any).userId = req.user.id;

  console.log('✅ Tenant validation passed:', {
    userId: req.user.id,
    email: req.user.email,
    tenantId: req.user.tenantId,
    role: req.user.role
  });

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
      console.log(`🔧 [Tenant Fix] Extracted valid UUID from malformed tenant ID: ${req.user.tenantId} -> ${extractedUuid}`);
      req.user.tenantId = extractedUuid;
    } else {
      return res.status(400).json({
        message: 'Invalid tenant ID format - no valid UUID found',
        tenantId: req.user.tenantId
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
        message: 'Tenant not found',
        tenantId: req.user.tenantId
      });
    }

    if (!tenant.isActive) {
      return res.status(403).json({
        message: 'Tenant is inactive',
        tenantId: req.user.tenantId
      });
    }
  } catch (error) {
    console.error('Tenant validation error:', error);
    return res.status(500).json({ message: 'Tenant validation failed' });
  }

  // Add tenant context to request for easier access in route handlers
  (req as any).tenantId = req.user.tenantId;
  (req as any).userId = req.user.id;

  console.log('✅ Advanced tenant validation passed:', {
    userId: req.user.id,
    email: req.user.email,
    tenantId: req.user.tenantId,
    role: req.user.role
  });

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
