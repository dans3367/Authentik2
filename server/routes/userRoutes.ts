import { Router } from 'express';
import { authenticateToken, requirePermission, requirePlanFeature, getEffectivePermissions, getAssignableRoles, ROLE_HIERARCHY } from '../middleware/auth-middleware';
import { validatePasswordStrength } from '../middleware/security-enhanced';
import { storage } from '../storage';
import { db } from '../db';
import { betterAuthUser, betterAuthSession, subscriptionPlans, shops, createUserSchema, temp2faSessions } from '@shared/schema';
import { sql, eq, and, count } from 'drizzle-orm';
import { invalidateUserSecurity } from '../utils/userSecurityCache';

export const userRoutes = Router();

// Get current user's dashboard layout
userRoutes.get("/dashboard-layout", authenticateToken, async (req: any, res) => {
  try {
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, req.user.id),
      columns: { dashboardLayout: true },
    });
    res.json({ layout: user?.dashboardLayout ?? null });
  } catch (error) {
    console.error('Get dashboard layout error:', error);
    res.status(500).json({ message: 'Failed to get dashboard layout' });
  }
});

// Update current user's dashboard layout (self-service)
userRoutes.patch("/dashboard-layout", authenticateToken, async (req: any, res) => {
  try {
    const { cardOrder, cardSizes, cardVisibility } = req.body ?? {};
    const layout: {
      cardOrder?: string[];
      cardSizes?: Record<string, number>;
      cardVisibility?: Record<string, boolean>;
    } = {};

    if (Array.isArray(cardOrder)) {
      const cleaned = cardOrder
        .filter((v: unknown): v is string => typeof v === 'string' && v.length <= 64)
        .slice(0, 50);
      layout.cardOrder = cleaned;
    }

    if (cardSizes && typeof cardSizes === 'object' && !Array.isArray(cardSizes)) {
      const sizes: Record<string, number> = {};
      for (const [k, v] of Object.entries(cardSizes)) {
        if (typeof k !== 'string' || k.length > 64) continue;
        if (typeof v !== 'number' || !Number.isFinite(v)) continue;
        sizes[k] = Math.max(1, Math.min(12, Math.round(v)));
      }
      layout.cardSizes = sizes;
    }

    if (cardVisibility && typeof cardVisibility === 'object' && !Array.isArray(cardVisibility)) {
      const visibility: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(cardVisibility)) {
        if (typeof k !== 'string' || k.length > 64) continue;
        if (typeof v !== 'boolean') continue;
        visibility[k] = v;
      }
      layout.cardVisibility = visibility;
    }

    if (
      layout.cardOrder === undefined &&
      layout.cardSizes === undefined &&
      layout.cardVisibility === undefined
    ) {
      return res.status(400).json({ message: 'cardOrder, cardSizes, or cardVisibility is required' });
    }

    // Merge with existing layout so a partial update (e.g. only sizes) does not wipe the other field
    const existing = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, req.user.id),
      columns: { dashboardLayout: true },
    });
    const merged = {
      ...(existing?.dashboardLayout ?? {}),
      ...layout,
    };

    await db.update(betterAuthUser)
      .set({ dashboardLayout: merged, updatedAt: new Date() })
      .where(eq(betterAuthUser.id, req.user.id));

    res.json({ layout: merged });
  } catch (error) {
    console.error('Update dashboard layout error:', error);
    res.status(500).json({ message: 'Failed to update dashboard layout' });
  }
});

// Get current user's remembered shop selection (null = "All Shops")
userRoutes.get("/shop-preference", authenticateToken, async (req: any, res) => {
  try {
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, req.user.id),
      columns: { lastSelectedShopId: true },
    });
    res.json({ shopId: user?.lastSelectedShopId ?? null });
  } catch (error) {
    console.error('Get shop preference error:', error);
    res.status(500).json({ message: 'Failed to get shop preference' });
  }
});

// Update current user's remembered shop selection.
// Body: { shopId: string | null }. Non-null values must belong to the caller's tenant.
userRoutes.patch("/shop-preference", authenticateToken, async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { shopId } = req.body ?? {};

    if (shopId !== null && typeof shopId !== 'string') {
      return res.status(400).json({ message: 'shopId must be a string or null' });
    }

    if (shopId) {
      const shop = await db
        .select({ id: shops.id })
        .from(shops)
        .where(and(eq(shops.id, shopId), eq(shops.tenantId, tenantId)))
        .limit(1);
      if (shop.length === 0) {
        return res.status(400).json({ message: 'Shop not found or does not belong to your organization' });
      }
    }

    await db.update(betterAuthUser)
      .set({ lastSelectedShopId: shopId ?? null, updatedAt: new Date() })
      .where(eq(betterAuthUser.id, req.user.id));

    res.json({ shopId: shopId ?? null });
  } catch (error) {
    console.error('Update shop preference error:', error);
    res.status(500).json({ message: 'Failed to update shop preference' });
  }
});

// Update current user's profile (self-service)
userRoutes.patch("/profile", authenticateToken, async (req: any, res) => {
  console.log('📝 [Profile] Update request received:', {
    userId: req.user.id,
    body: req.body
  });
  try {
    const { firstName, lastName, email, language, timezone, theme, menuExpanded, avatarUrl } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Validate input
    const hasValidField =
      (firstName !== undefined && firstName !== null && firstName.trim() !== '') ||
      (lastName !== undefined && lastName !== null && lastName.trim() !== '') ||
      (email !== undefined && email !== null && email.trim() !== '') ||
      (language !== undefined && language !== null && typeof language === 'string' && language.trim() !== '') ||
      (timezone !== undefined && timezone !== null && typeof timezone === 'string' && timezone.trim() !== '') ||
      (theme !== undefined && theme !== null && typeof theme === 'string' && ['light', 'dark', 'system'].includes(theme)) ||
      (menuExpanded !== undefined && menuExpanded !== null && typeof menuExpanded === 'boolean') ||
      (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl === 'string' && avatarUrl.trim() !== '');

    if (!hasValidField) {
      return res.status(400).json({ message: 'At least one field with a valid value is required' });
    }

    // Check if user exists
    const existingUser = await db.query.betterAuthUser.findFirst({
      where: and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, tenantId)
      ),
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    // Check if email is already taken by another user
    if (email && email !== existingUser.email) {
      const emailCheck = await db.query.betterAuthUser.findFirst({
        where: and(
          eq(betterAuthUser.email, email),
          eq(betterAuthUser.tenantId, tenantId)
        ),
      });

      if (emailCheck) {
        return res.status(400).json({ message: 'Email is already in use' });
      }

      // Email changed — require re-verification
      updateData.emailVerified = false;
    }

    if (firstName !== undefined && firstName.trim()) updateData.firstName = firstName.trim();
    if (lastName !== undefined && lastName.trim()) updateData.lastName = lastName.trim();
    if (email !== undefined && email.trim()) updateData.email = email.trim();
    if (language !== undefined && language !== null && typeof language === 'string' && language.trim() !== '') updateData.language = language.trim();
    if (timezone !== undefined && timezone !== null && typeof timezone === 'string' && timezone.trim() !== '') updateData.timezone = timezone.trim();
    if (theme !== undefined && theme !== null && typeof theme === 'string' && ['light', 'dark', 'system'].includes(theme)) updateData.theme = theme;
    if (menuExpanded !== undefined && menuExpanded !== null && typeof menuExpanded === 'boolean') updateData.menuExpanded = menuExpanded;
    if (avatarUrl !== undefined) {
      if (typeof avatarUrl !== 'string' || avatarUrl.length > 2048) {
        return res.status(400).json({ message: 'avatarUrl must be a string of 2048 characters or fewer' });
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(avatarUrl);
      } catch {
        return res.status(400).json({ message: 'avatarUrl must be a well-formed URL' });
      }
      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ message: 'avatarUrl must use the https:// scheme' });
      }
      updateData.avatarUrl = avatarUrl;
    }

    // Also update the name field for compatibility
    if (firstName !== undefined || lastName !== undefined) {
      const newFirstName = firstName !== undefined ? firstName : existingUser.firstName;
      const newLastName = lastName !== undefined ? lastName : existingUser.lastName;
      updateData.name = `${newFirstName || ''} ${newLastName || ''}`.trim();
    }

    console.log('📝 [Profile] Update data:', updateData);

    // Update user profile
    const updateResult = await db.update(betterAuthUser)
      .set(updateData)
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, tenantId)
      ))
      .returning();

    console.log('✅ [Profile] Update result:', updateResult);

    // Fetch updated user to return
    const updatedUser = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, userId),
    });

    console.log('✅ [Profile] Updated user from DB:', {
      id: updatedUser?.id,
      name: updatedUser?.name,
      firstName: updatedUser?.firstName,
      lastName: updatedUser?.lastName,
      email: updatedUser?.email
    });

    // Invalidate security cache — language or other cached fields may have changed
    invalidateUserSecurity(userId, 'profile_update', {
      tenantId,
      req,
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Lightweight list of assignable users in the tenant (id/name/email/role only).
// Used for provider/assignee dropdowns (e.g. appointments). Available to any
// authenticated member of the tenant — no users-management plan/permission gate.
// Returns ALL tenant users (Owner, Administrator, Manager, Employee — active and inactive)
// so any team member can be assigned as the provider for an appointment.
userRoutes.get("/assignable", authenticateToken, async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const rows = await db
      .select({
        id: betterAuthUser.id,
        name: betterAuthUser.name,
        email: betterAuthUser.email,
        role: betterAuthUser.role,
        isActive: betterAuthUser.isActive,
      })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.tenantId, tenantId));

    // Order by role hierarchy (Owner → Administrator → Manager → Employee),
    // then name/email for stable display.
    const roleOrder: Record<string, number> = {
      Owner: 0,
      Administrator: 1,
      Manager: 2,
      Employee: 3,
    };
    rows.sort((a, b) => {
      const ra = roleOrder[a.role ?? ''] ?? 99;
      const rb = roleOrder[b.role ?? ''] ?? 99;
      if (ra !== rb) return ra - rb;
      const an = (a.name || a.email || '').toLowerCase();
      const bn = (b.name || b.email || '').toLowerCase();
      return an.localeCompare(bn);
    });

    res.json({ users: rows });
  } catch (error) {
    console.error('Get assignable users error:', error);
    res.status(500).json({ message: 'Failed to get assignable users' });
  }
});

// Get users for tenant
userRoutes.get("/", authenticateToken, requirePlanFeature('allowUsersManagement'), requirePermission('users.view'), async (req: any, res) => {
  try {
    const { search, role, status, showInactive } = req.query;

    const filters = {
      search: search as string | undefined,
      role: (role && ['Owner', 'Administrator', 'Manager', 'Employee'].includes(role as string))
        ? role as 'Owner' | 'Administrator' | 'Manager' | 'Employee'
        : undefined,
      status: (status === 'active' || status === 'inactive') ? status : undefined,
      showInactive: showInactive === 'true'
    };

    const users = await storage.getAllUsers(req.user.tenantId, filters);

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
});

// Create new user
userRoutes.post("/", authenticateToken, requirePlanFeature('allowUsersManagement'), requirePermission('users.create'), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Validate user limits before creating
    try {
      await storage.validateUserCreation(tenantId);
    } catch (limitError: any) {
      return res.status(403).json({ message: limitError.message });
    }

    // Validate and sanitize input via schema (prevents mass-assignment of sensitive fields)
    let parsedBody: any;
    try {
      parsedBody = createUserSchema.parse(req.body);
    } catch (validationError: any) {
      return res.status(400).json({ message: validationError.errors?.[0]?.message || 'Invalid input' });
    }

    // Role must be strictly below the current user's level (anti-escalation)
    const assignable = getAssignableRoles(req.user.role);
    if (parsedBody.role && !assignable.includes(parsedBody.role)) {
      return res.status(403).json({ message: `You can only create users with roles below your own level (${assignable.join(', ') || 'none'})` });
    }

    // Check for duplicate email within the tenant
    const existingUser = await storage.getUserByEmail(parsedBody.email, tenantId);
    if (existingUser) {
      return res.status(400).json({ message: "User's email is already registered" });
    }

    const user = await storage.createUserAsAdmin(parsedBody, tenantId);

    res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error: any) {
    console.error('Create user error:', error);

    // Handle PostgreSQL duplicate key error (including Drizzle-wrapped errors)
    const dbError = error?.cause ?? error;
    if (dbError?.code === '23505' && dbError?.constraint === 'better_auth_user_email_unique') {
      return res.status(400).json({
        message: "User's email is already registered"
      });
    }

    // Log detailed error for server-side debugging
    console.error('Create user failed:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      tenantId: req.user.tenantId
    });

    res.status(500).json({ message: 'Failed to create user' });
  }
});

// Get user statistics
userRoutes.get("/stats", authenticateToken, requirePlanFeature('allowUsersManagement'), requirePermission('users.view'), async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Get user statistics with role breakdown
    const stats = await db
      .select({
        totalUsers: sql<number>`count(*)::int`,
        activeUsers: sql<number>`count(*) filter (where ${betterAuthUser.isActive} = true)::int`,
        inactiveUsers: sql<number>`count(*) filter (where ${betterAuthUser.isActive} = false)::int`,
        ownerCount: sql<number>`count(*) filter (where ${betterAuthUser.role} = 'Owner')::int`,
        adminCount: sql<number>`count(*) filter (where ${betterAuthUser.role} = 'Administrator')::int`,
        managerCount: sql<number>`count(*) filter (where ${betterAuthUser.role} = 'Manager')::int`,
        employeeCount: sql<number>`count(*) filter (where ${betterAuthUser.role} = 'Employee')::int`,
      })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.tenantId, tenantId));

    const result = stats[0];

    res.json({
      totalUsers: result.totalUsers,
      activeUsers: result.activeUsers,
      inactiveUsers: result.inactiveUsers,
      usersByRole: {
        Owner: result.ownerCount,
        Administrator: result.adminCount,
        Manager: result.managerCount,
        Employee: result.employeeCount,
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Failed to get user statistics' });
  }
});

// Get user limits and plan information
userRoutes.get("/limits", authenticateToken, requirePlanFeature('allowUsersManagement'), requirePermission('users.view'), async (req: any, res) => {
  try {
    const limits = await storage.checkUserLimits(req.user.tenantId);
    res.json(limits);
  } catch (error) {
    console.error('Get user limits error:', error);
    res.status(500).json({ message: 'Failed to get user limits' });
  }
});

// Update user (full update)
userRoutes.put("/:userId", authenticateToken, requirePlanFeature('allowUsersManagement'), requirePermission('users.edit'), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, role, isActive } = req.body;

    // Validate input
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ message: 'First name, last name, email, and role are required' });
    }

    // Role must be strictly below the current user's level (anti-escalation)
    const assignable = getAssignableRoles(req.user.role);
    if (!assignable.includes(role)) {
      return res.status(403).json({ message: `You can only assign roles below your own level (${assignable.join(', ') || 'none'})` });
    }

    // Check if user exists and belongs to the same tenant
    const existingUser = await db.query.betterAuthUser.findFirst({
      where: and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ),
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Disallow editing Owner accounts via this endpoint
    if (existingUser.role === 'Owner') {
      return res.status(403).json({ message: 'Owner account is view-only and cannot be edited' });
    }

    // Cannot edit users at or above your own role level (prevents horizontal privilege abuse)
    const currentLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const targetLevel = ROLE_HIERARCHY[existingUser.role] || 0;
    if (targetLevel >= currentLevel) {
      return res.status(403).json({ message: 'You cannot edit users at or above your own role level' });
    }

    // If the role is being changed, require users.manage_roles permission
    if (role !== existingUser.role) {
      const effectivePerms = await getEffectivePermissions(req.user.role, req.user.tenantId);
      if (effectivePerms['users.manage_roles'] !== true) {
        return res.status(403).json({ message: 'You do not have permission to change user roles' });
      }
    }

    // Check if email is already taken by another user in the same tenant
    if (email !== existingUser.email) {
      const emailCheck = await db.query.betterAuthUser.findFirst({
        where: and(
          eq(betterAuthUser.email, email),
          eq(betterAuthUser.tenantId, req.user.tenantId)
        ),
      });

      if (emailCheck) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
    }

    // When activating a previously inactive user, check user limits
    const targetIsActive = isActive ?? true;
    const wasInactive = existingUser.isActive === false;
    if (targetIsActive && wasInactive) {
      try {
        await storage.validateUserCreation(req.user.tenantId);
      } catch (limitError: any) {
        return res.status(403).json({
          message: limitError.message || 'User limit reached for your current plan. Please upgrade to activate more users.',
          code: 'USER_LIMIT_REACHED'
        });
      }
    }

    // Build update data
    const updateData: Record<string, any> = {
      firstName,
      lastName,
      email,
      role,
      isActive: targetIsActive,
      updatedAt: new Date(),
    };

    // If activating a user that was suspended by downgrade, clear the suspension flag
    if (targetIsActive && existingUser.suspendedByDowngrade) {
      updateData.suspendedByDowngrade = false;
      updateData.suspendedAt = null;
    }

    // Update user
    await db.update(betterAuthUser)
      .set(updateData)
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ));

    // Invalidate security cache — role or status may have changed
    invalidateUserSecurity(userId, 'role_change', {
      tenantId: req.user.tenantId,
      performedBy: req.user.id,
      req,
    });

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// Update user status (active/inactive)
userRoutes.patch("/:userId/status", authenticateToken, requirePlanFeature('allowUsersManagement'), requirePermission('users.toggle_status'), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean value' });
    }

    // Check if user exists and belongs to the same tenant
    const user = await db.query.betterAuthUser.findFirst({
      where: and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ),
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deactivating the current user
    if (userId === req.user.id && !isActive) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    // Cannot toggle status for users at or above your own role level
    const callerLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const targetStatusLevel = ROLE_HIERARCHY[user.role] || 0;
    if (targetStatusLevel >= callerLevel) {
      return res.status(403).json({ message: 'You cannot change the status of users at or above your own role level' });
    }

    // When activating a user, check if the user limit has been reached
    if (isActive) {
      try {
        await storage.validateUserCreation(req.user.tenantId);
      } catch (limitError: any) {
        return res.status(403).json({
          message: limitError.message || 'User limit reached for your current plan. Please upgrade to activate more users.',
          code: 'USER_LIMIT_REACHED'
        });
      }
    }

    // Update user status
    const updateData: Record<string, any> = {
      isActive,
      updatedAt: new Date(),
    };

    // If activating a user that was suspended by downgrade, clear the suspension flag
    if (isActive && user.suspendedByDowngrade) {
      updateData.suspendedByDowngrade = false;
      updateData.suspendedAt = null;
    }

    await db.update(betterAuthUser)
      .set(updateData)
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ));

    // On deactivation, revoke all active sessions AND any in-flight temp 2FA
    // sessions so a user who already passed credential check cannot still
    // complete /verify-2fa within the 10-minute window.
    if (!isActive) {
      await db.delete(betterAuthSession)
        .where(eq(betterAuthSession.userId, userId))
        .catch(err => console.warn('⚠️ [User Status] Failed to revoke sessions:', err));
      await db.delete(temp2faSessions)
        .where(eq(temp2faSessions.userId, userId))
        .catch(err => console.warn('⚠️ [User Status] Failed to revoke temp 2FA sessions:', err));
    }

    // Invalidate security cache — isActive changed
    invalidateUserSecurity(userId, 'status_change', {
      tenantId: req.user.tenantId,
      performedBy: req.user.id,
      req,
    });

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      userId,
      isActive
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Failed to update user status' });
  }
});

// Delete user
userRoutes.delete("/:userId", authenticateToken, requirePlanFeature('allowUsersManagement'), requirePermission('users.delete'), async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists and belongs to the same tenant
    const user = await db.query.betterAuthUser.findFirst({
      where: and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ),
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting the current user
    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Cannot delete users at or above your own role level
    const callerDelLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const targetDelLevel = ROLE_HIERARCHY[user.role] || 0;
    if (targetDelLevel >= callerDelLevel) {
      return res.status(403).json({ message: 'You cannot delete users at or above your own role level' });
    }

    // Delete user (this will cascade to related records)
    await db.delete(betterAuthUser)
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ));

    // Invalidate security cache for deleted user
    invalidateUserSecurity(userId, 'user_deleted', {
      tenantId: req.user.tenantId,
      performedBy: req.user.id,
      req,
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// Set password for a user (Manager+)
// Owner accounts can only have their password set by the same owner
userRoutes.post("/:userId/set-password", authenticateToken, requirePlanFeature('allowUsersManagement'), requirePermission('users.edit'), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { password, confirmPassword } = req.body;
    const tenantId = req.user.tenantId;
    const currentUserRole = req.user.role;
    const currentUserId = req.user.id;

    if (!password || !confirmPassword) {
      return res.status(400).json({ message: 'Password and confirmation are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    // Validate password strength using shared validator
    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.valid) {
      return res.status(400).json({ message: 'Password does not meet security requirements', errors: strengthCheck.errors });
    }

    // Find the target user
    const targetUser = await db.query.betterAuthUser.findFirst({
      where: and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, tenantId)
      ),
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Owner accounts can only have their password set by the same owner
    if (targetUser.role === 'Owner' && currentUserId !== targetUser.id) {
      return res.status(403).json({ message: 'Owner account password can only be reset by the owner themselves' });
    }

    // Cannot set passwords for users at or above your own role level (unless it's yourself)
    if (currentUserId !== targetUser.id) {
      const callerLevel = ROLE_HIERARCHY[currentUserRole] || 0;
      const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
      if (targetLevel >= callerLevel) {
        return res.status(403).json({ message: 'You cannot set passwords for users at or above your own role level' });
      }
    }

    // Hash new password using Better Auth's native hashing (scrypt)
    const { hashPassword } = await import('better-auth/crypto');
    const hashedPassword = await hashPassword(password);

    // Update password in the credential account
    await db.execute(
      sql`UPDATE better_auth_account SET password = ${hashedPassword}, updated_at = NOW() WHERE user_id = ${userId} AND provider_id = 'credential'`
    );

    // Invalidate all existing sessions for the target user (except current user's session if setting own password)
    if (currentUserId !== userId) {
      await db.delete(betterAuthSession)
        .where(eq(betterAuthSession.userId, userId));
      // Also revoke in-flight temp 2FA sessions so a stale post-credential
      // temp token cannot complete login after the password has been changed.
      await db.delete(temp2faSessions)
        .where(eq(temp2faSessions.userId, userId))
        .catch(err => console.warn('⚠️ [Set Password] Failed to revoke temp 2FA sessions:', err));
    }

    console.log(`✅ [Set Password] Password set for user ${targetUser.email} by ${req.user.email}`);
    res.json({ message: 'Password has been set successfully' });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ message: 'Failed to set password' });
  }
});
