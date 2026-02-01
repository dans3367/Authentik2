import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';
import { storage } from '../storage';
import { db } from '../db';
import { betterAuthUser, subscriptionPlans } from '@shared/schema';
import { sql, eq, and, count } from 'drizzle-orm';

export const userRoutes = Router();

// Update current user's profile (self-service)
userRoutes.patch("/profile", authenticateToken, async (req: any, res) => {
  console.log('📝 [Profile] Update request received:', {
    userId: req.user.id,
    body: req.body
  });
  try {
    const { firstName, lastName, email } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Validate input
    if (!firstName && !lastName && !email) {
      return res.status(400).json({ message: 'At least one field (firstName, lastName, or email) is required' });
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
    }

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;

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

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Get users for tenant
userRoutes.get("/", authenticateToken, requireRole(['Owner', 'Administrator', 'Manager']), async (req: any, res) => {
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
userRoutes.post("/", authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const userData = {
      ...req.body,
      tenantId: req.user.tenantId
    };

    const user = await storage.createUser(userData);

    res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

// Get user statistics
userRoutes.get("/stats", authenticateToken, requireRole(['Owner', 'Administrator', 'Manager']), async (req: any, res) => {
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
userRoutes.get("/limits", authenticateToken, requireRole(['Owner', 'Administrator', 'Manager']), async (req: any, res) => {
  try {
    const limits = await storage.checkUserLimits(req.user.tenantId);
    res.json(limits);
  } catch (error) {
    console.error('Get user limits error:', error);
    res.status(500).json({ message: 'Failed to get user limits' });
  }
});

// Update user (full update)
userRoutes.put("/:userId", authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, role, isActive } = req.body;

    // Validate input
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ message: 'First name, last name, email, and role are required' });
    }

    if (!['Owner', 'Administrator', 'Manager', 'Employee'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
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

    // Prevent owner from being demoted if they're the only owner
    if (existingUser.role === 'Owner' && role !== 'Owner') {
      const ownerCount = await db.select({
        count: sql<number>`count(*)`,
      }).from(betterAuthUser).where(and(
        eq(betterAuthUser.role, 'Owner'),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ));

      if (ownerCount[0].count <= 1) {
        return res.status(400).json({ message: 'Cannot demote the only owner' });
      }
    }

    // Update user
    await db.update(betterAuthUser)
      .set({
        firstName,
        lastName,
        email,
        role,
        isActive: isActive ?? true,
        updatedAt: new Date(),
      })
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ));

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// Update user status (active/inactive)
userRoutes.patch("/:userId/status", authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
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

    // Disallow changing status for Owner accounts
    if (user.role === 'Owner') {
      return res.status(403).json({ message: 'Owner account status cannot be changed' });
    }

    // Prevent deactivating the only owner
    if (user.role === 'Owner' && !isActive) {
      const ownerCount = await db.select({
        count: sql<number>`count(*)`,
      }).from(betterAuthUser).where(and(
        eq(betterAuthUser.role, 'Owner'),
        eq(betterAuthUser.tenantId, req.user.tenantId),
        eq(betterAuthUser.isActive, true)
      ));

      if (ownerCount[0].count <= 1) {
        return res.status(400).json({ message: 'Cannot deactivate the only active owner' });
      }
    }

    // Update user status
    await db.update(betterAuthUser)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ));

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
userRoutes.delete("/:userId", authenticateToken, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
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

    // Disallow deleting Owner accounts entirely
    if (user.role === 'Owner') {
      return res.status(403).json({ message: 'Owner account cannot be deleted' });
    }

    // Delete user (this will cascade to related records)
    await db.delete(betterAuthUser)
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, req.user.tenantId)
      ));

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});
