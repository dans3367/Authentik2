import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';
import { db } from '../db';
import { betterAuthUser } from '@shared/schema';
import { sql, eq, and } from 'drizzle-orm';

export const roleRoutes = Router();

// Default permission definitions for each role
// These define what each role can do in the system
const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  Owner: {
    'users.view': true,
    'users.create': true,
    'users.edit': true,
    'users.delete': true,
    'users.manage_roles': true,
    'shops.view': true,
    'shops.create': true,
    'shops.edit': true,
    'shops.delete': true,
    'company.view': true,
    'company.edit': true,
    'subscriptions.view': true,
    'subscriptions.manage': true,
    'emails.view': true,
    'emails.send': true,
    'emails.manage': true,
    'newsletters.view': true,
    'newsletters.create': true,
    'newsletters.send': true,
    'campaigns.view': true,
    'campaigns.create': true,
    'campaigns.manage': true,
    'contacts.view': true,
    'contacts.create': true,
    'contacts.edit': true,
    'contacts.delete': true,
    'forms.view': true,
    'forms.create': true,
    'forms.edit': true,
    'forms.delete': true,
    'promotions.view': true,
    'promotions.create': true,
    'promotions.manage': true,
    'appointments.view': true,
    'appointments.create': true,
    'appointments.edit': true,
    'appointments.delete': true,
    'analytics.view': true,
    'settings.view': true,
    'settings.edit': true,
  },
  Administrator: {
    'users.view': true,
    'users.create': true,
    'users.edit': true,
    'users.delete': true,
    'users.manage_roles': true,
    'shops.view': true,
    'shops.create': true,
    'shops.edit': true,
    'shops.delete': true,
    'company.view': true,
    'company.edit': true,
    'subscriptions.view': true,
    'subscriptions.manage': false,
    'emails.view': true,
    'emails.send': true,
    'emails.manage': true,
    'newsletters.view': true,
    'newsletters.create': true,
    'newsletters.send': true,
    'campaigns.view': true,
    'campaigns.create': true,
    'campaigns.manage': true,
    'contacts.view': true,
    'contacts.create': true,
    'contacts.edit': true,
    'contacts.delete': true,
    'forms.view': true,
    'forms.create': true,
    'forms.edit': true,
    'forms.delete': true,
    'promotions.view': true,
    'promotions.create': true,
    'promotions.manage': true,
    'appointments.view': true,
    'appointments.create': true,
    'appointments.edit': true,
    'appointments.delete': true,
    'analytics.view': true,
    'settings.view': true,
    'settings.edit': false,
  },
  Manager: {
    'users.view': true,
    'users.create': false,
    'users.edit': false,
    'users.delete': false,
    'users.manage_roles': false,
    'shops.view': true,
    'shops.create': false,
    'shops.edit': true,
    'shops.delete': false,
    'company.view': true,
    'company.edit': false,
    'subscriptions.view': false,
    'subscriptions.manage': false,
    'emails.view': true,
    'emails.send': true,
    'emails.manage': false,
    'newsletters.view': true,
    'newsletters.create': true,
    'newsletters.send': true,
    'campaigns.view': true,
    'campaigns.create': true,
    'campaigns.manage': false,
    'contacts.view': true,
    'contacts.create': true,
    'contacts.edit': true,
    'contacts.delete': false,
    'forms.view': true,
    'forms.create': true,
    'forms.edit': true,
    'forms.delete': false,
    'promotions.view': true,
    'promotions.create': true,
    'promotions.manage': false,
    'appointments.view': true,
    'appointments.create': true,
    'appointments.edit': true,
    'appointments.delete': true,
    'analytics.view': true,
    'settings.view': true,
    'settings.edit': false,
  },
  Employee: {
    'users.view': false,
    'users.create': false,
    'users.edit': false,
    'users.delete': false,
    'users.manage_roles': false,
    'shops.view': true,
    'shops.create': false,
    'shops.edit': false,
    'shops.delete': false,
    'company.view': true,
    'company.edit': false,
    'subscriptions.view': false,
    'subscriptions.manage': false,
    'emails.view': true,
    'emails.send': false,
    'emails.manage': false,
    'newsletters.view': true,
    'newsletters.create': false,
    'newsletters.send': false,
    'campaigns.view': true,
    'campaigns.create': false,
    'campaigns.manage': false,
    'contacts.view': true,
    'contacts.create': true,
    'contacts.edit': false,
    'contacts.delete': false,
    'forms.view': true,
    'forms.create': false,
    'forms.edit': false,
    'forms.delete': false,
    'promotions.view': true,
    'promotions.create': false,
    'promotions.manage': false,
    'appointments.view': true,
    'appointments.create': true,
    'appointments.edit': false,
    'appointments.delete': false,
    'analytics.view': false,
    'settings.view': false,
    'settings.edit': false,
  },
};

// Permission categories for UI grouping
const PERMISSION_CATEGORIES = [
  {
    key: 'users',
    label: 'User Management',
    permissions: ['users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_roles'],
  },
  {
    key: 'shops',
    label: 'Shop Management',
    permissions: ['shops.view', 'shops.create', 'shops.edit', 'shops.delete'],
  },
  {
    key: 'company',
    label: 'Company',
    permissions: ['company.view', 'company.edit'],
  },
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    permissions: ['subscriptions.view', 'subscriptions.manage'],
  },
  {
    key: 'emails',
    label: 'Email System',
    permissions: ['emails.view', 'emails.send', 'emails.manage'],
  },
  {
    key: 'newsletters',
    label: 'Newsletters',
    permissions: ['newsletters.view', 'newsletters.create', 'newsletters.send'],
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    permissions: ['campaigns.view', 'campaigns.create', 'campaigns.manage'],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    permissions: ['contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete'],
  },
  {
    key: 'forms',
    label: 'Forms',
    permissions: ['forms.view', 'forms.create', 'forms.edit', 'forms.delete'],
  },
  {
    key: 'promotions',
    label: 'Promotions',
    permissions: ['promotions.view', 'promotions.create', 'promotions.manage'],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    permissions: ['appointments.view', 'appointments.create', 'appointments.edit', 'appointments.delete'],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    permissions: ['analytics.view'],
  },
  {
    key: 'settings',
    label: 'Settings',
    permissions: ['settings.view', 'settings.edit'],
  },
];

// GET /api/roles - Get all roles with their permissions and user counts
roleRoutes.get("/", authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Get user counts per role
    const roleCounts = await db
      .select({
        role: betterAuthUser.role,
        count: sql<number>`count(*)::int`,
      })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.tenantId, tenantId))
      .groupBy(betterAuthUser.role);

    const roleCountMap: Record<string, number> = {};
    roleCounts.forEach((rc: { role: string; count: number }) => {
      roleCountMap[rc.role] = rc.count;
    });

    const roles = [
      {
        name: 'Owner',
        level: 4,
        description: 'Full system access with billing and subscription management',
        userCount: roleCountMap['Owner'] || 0,
        permissions: DEFAULT_ROLE_PERMISSIONS['Owner'],
        isSystem: true,
      },
      {
        name: 'Administrator',
        level: 3,
        description: 'Full operational access without billing management',
        userCount: roleCountMap['Administrator'] || 0,
        permissions: DEFAULT_ROLE_PERMISSIONS['Administrator'],
        isSystem: true,
      },
      {
        name: 'Manager',
        level: 2,
        description: 'Team and content management with limited admin access',
        userCount: roleCountMap['Manager'] || 0,
        permissions: DEFAULT_ROLE_PERMISSIONS['Manager'],
        isSystem: true,
      },
      {
        name: 'Employee',
        level: 1,
        description: 'Basic access for day-to-day operations',
        userCount: roleCountMap['Employee'] || 0,
        permissions: DEFAULT_ROLE_PERMISSIONS['Employee'],
        isSystem: true,
      },
    ];

    res.json({
      roles,
      permissionCategories: PERMISSION_CATEGORIES,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Failed to get roles' });
  }
});

// GET /api/roles/users - Get users grouped by role
roleRoutes.get("/users", authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    const users = await db.query.betterAuthUser.findMany({
      where: eq(betterAuthUser.tenantId, tenantId),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: (user: any, { asc }: any) => [asc(user.role), asc(user.firstName)],
    });

    // Group users by role
    const usersByRole: Record<string, typeof users> = {
      Owner: [],
      Administrator: [],
      Manager: [],
      Employee: [],
    };

    users.forEach((user: any) => {
      const role = user.role || 'Employee';
      if (usersByRole[role]) {
        usersByRole[role].push(user);
      }
    });

    res.json({ usersByRole });
  } catch (error) {
    console.error('Get role users error:', error);
    res.status(500).json({ message: 'Failed to get users by role' });
  }
});

// PATCH /api/roles/users/:userId/role - Update a user's role
roleRoutes.patch("/users/:userId/role", authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const tenantId = req.user.tenantId;

    if (!role || !['Owner', 'Administrator', 'Manager', 'Employee'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be Owner, Administrator, Manager, or Employee.' });
    }

    // Check if user exists and belongs to the same tenant
    const existingUser = await db.query.betterAuthUser.findFirst({
      where: and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, tenantId)
      ),
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cannot change own role
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    // Cannot modify Owner accounts unless you are an Owner
    if (existingUser.role === 'Owner' && req.user.role !== 'Owner') {
      return res.status(403).json({ message: 'Only owners can modify other owner accounts' });
    }

    // Prevent demoting the only owner
    if (existingUser.role === 'Owner' && role !== 'Owner') {
      const ownerCount = await db.select({
        count: sql<number>`count(*)::int`,
      }).from(betterAuthUser).where(and(
        eq(betterAuthUser.role, 'Owner'),
        eq(betterAuthUser.tenantId, tenantId)
      ));

      if (ownerCount[0].count <= 1) {
        return res.status(400).json({ message: 'Cannot demote the only owner. Assign another owner first.' });
      }
    }

    // Only Owners can promote to Owner
    if (role === 'Owner' && req.user.role !== 'Owner') {
      return res.status(403).json({ message: 'Only owners can promote users to the Owner role' });
    }

    // Update user role
    await db.update(betterAuthUser)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, tenantId)
      ));

    res.json({
      message: `User role updated to ${role} successfully`,
      userId,
      role,
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});
