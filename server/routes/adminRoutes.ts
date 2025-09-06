import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { betterAuthUser, tenants, companies, forms } from '@shared/schema';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';

export const adminRoutes = Router();

// Get session statistics
adminRoutes.get("/sessions/stats", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const stats = await db.select({
      totalSessions: sql<number>`count(*)`,
      activeSessions: sql<number>`count(*) filter (where expires_at > now())`,
      expiredSessions: sql<number>`count(*) filter (where expires_at <= now())`,
    }).from(refreshTokens);

    res.json(stats[0]);
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({ message: 'Failed to get session statistics' });
  }
});


// Get all sessions (admin view)
adminRoutes.get("/sessions", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { page = 1, limit = 50, userId, deviceId, ipAddress } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`1=1`;
    const params: any[] = [];

    if (userId) {
      whereClause = sql`${whereClause} AND ${refreshTokens.userId} = ${userId}`;
    }

    if (deviceId) {
      whereClause = sql`${whereClause} AND ${refreshTokens.deviceId} = ${deviceId}`;
    }

    if (ipAddress) {
      whereClause = sql`${whereClause} AND ${refreshTokens.ipAddress} = ${ipAddress}`;
    }

    const refreshTokenSessions = await db.query.refreshTokens.findMany({
      where: whereClause,
      with: {
        user: {
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: sql`${refreshTokens.createdAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(refreshTokens).where(whereClause);

    res.json({
      sessions: refreshTokenSessions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get admin sessions error:', error);
    res.status(500).json({ message: 'Failed to get sessions' });
  }
});


// Delete specific session (admin)
adminRoutes.delete("/sessions", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID required' });
    }

    // Delete session
    const deletedSession = await db.delete(refreshTokens)
      .where(sql`${refreshTokens.id} = ${sessionId}`)
      .returning();

    if (deletedSession.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete admin session error:', error);
    res.status(500).json({ message: 'Failed to delete session' });
  }
});

// Get user statistics
adminRoutes.get("/users/stats", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const userStats = await db.select({
      totalUsers: sql<number>`count(*)`,
      activeUsers: sql<number>`count(*) filter (where is_active = true)`,
      verifiedUsers: sql<number>`count(*) filter (where email_verified = true)`,
      unverifiedUsers: sql<number>`count(*) filter (where email_verified = false)`,
    }).from(betterAuthUser).where(sql`${betterAuthUser.tenantId} = ${req.user.tenantId}`);

    const userStatsByRole = await db.select({
      role: betterAuthUser.role,
      count: sql<number>`count(*)`,
    }).from(betterAuthUser).where(sql`${betterAuthUser.tenantId} = ${req.user.tenantId}`).groupBy(betterAuthUser.role);

    res.json({
      totalUsers: userStats[0].totalUsers,
      activeUsers: userStats[0].activeUsers,
      usersByRole: userStatsByRole.reduce((acc, curr) => {
        acc[curr.role] = curr.count;
        return acc;
      }, {} as Record<string, number>),
      verifiedUsers: userStats[0].verifiedUsers,
      unverifiedUsers: userStats[0].unverifiedUsers,
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Failed to get user statistics' });
  }
});

// Get user limits
adminRoutes.get("/users/limits", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    // Get current user count for this tenant
    const userCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(betterAuthUser).where(sql`${betterAuthUser.tenantId} = ${req.user.tenantId}`);

    // For now, we'll use a simple limit system
    // In a real app, this would come from subscription data
    const maxUsers = 100; // Default limit
    const currentUsers = userCount[0].count;
    const canAddUser = currentUsers < maxUsers;

    res.json({
      canAddUser,
      currentUsers,
      maxUsers,
      planName: 'Professional', // This would come from subscription data
    });
  } catch (error) {
    console.error('Get user limits error:', error);
    res.status(500).json({ message: 'Failed to get user limits' });
  }
});

// Get user management data
adminRoutes.get("/users", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { page = 1, limit = 50, role, emailVerified, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${betterAuthUser.tenantId} = ${req.user.tenantId}`;

    if (role) {
      whereClause = sql`${whereClause} AND ${betterAuthUser.role} = ${role}`;
    }

    if (emailVerified !== undefined) {
      whereClause = sql`${whereClause} AND ${betterAuthUser.emailVerified} = ${emailVerified === 'true'}`;
    }

    if (search) {
      whereClause = sql`${whereClause} AND (
        ${betterAuthUser.email} ILIKE ${`%${search}%`} OR
        ${betterAuthUser.firstName} ILIKE ${`%${search}%`} OR
        ${betterAuthUser.lastName} ILIKE ${`%${search}%`}
      )`;
    }

    const userResults = await db.query.betterAuthUser.findMany({
      where: whereClause,
      with: {
        tenant: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: sql`${betterAuthUser.createdAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(betterAuthUser).where(whereClause);

    res.json({
      users: userResults.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        tenantId: user.tenantId,
        tenant: user.tenant,
        createdAt: user.createdAt,
        lastLogin: user.lastLoginAt,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
});

// Update user (full update)
adminRoutes.put("/users/:userId", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
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

    // Check if user exists
    const existingUser = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.id} = ${userId}`,
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is already taken by another user
    if (email !== existingUser.email) {
      const emailCheck = await db.query.betterAuthUser.findFirst({
        where: sql`${betterAuthUser.email} = ${email}`,
      });

      if (emailCheck) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
    }

    // Prevent owner from being demoted if they're the only owner
    if (existingUser.role === 'Owner' && role !== 'Owner') {
      const ownerCount = await db.select({
        count: sql<number>`count(*)`,
      }).from(betterAuthUser).where(sql`${betterAuthUser.role} = 'Owner'`);

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
      .where(sql`${betterAuthUser.id} = ${userId}`);

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// Update user status (active/inactive)
adminRoutes.patch("/users/:userId/status", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean value' });
    }

    // Check if user exists
    const user = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.id} = ${userId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deactivating the current user
    if (userId === req.user.userId && !isActive) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    // Prevent deactivating the only owner
    if (user.role === 'Owner' && !isActive) {
      const ownerCount = await db.select({
        count: sql<number>`count(*)`,
      }).from(betterAuthUser).where(sql`${betterAuthUser.role} = 'Owner' AND ${betterAuthUser.isActive} = true`);

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
      .where(sql`${betterAuthUser.id} = ${userId}`);

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

// Update user role
adminRoutes.patch("/users/:userId/role", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['Owner', 'Administrator', 'Manager', 'Employee'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Check if user exists
    const user = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.id} = ${userId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent owner from being demoted if they're the only owner
    if (user.role === 'Owner' && role !== 'Owner') {
      const ownerCount = await db.select({
        count: sql<number>`count(*)`,
      }).from(betterAuthUser).where(sql`${betterAuthUser.role} = 'Owner'`);

      if (ownerCount[0].count <= 1) {
        return res.status(400).json({ message: 'Cannot demote the only owner' });
      }
    }

    // Update user role
    await db.update(betterAuthUser)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(sql`${betterAuthUser.id} = ${userId}`);

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// Delete user (admin)
adminRoutes.delete("/users/:userId", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.id} = ${userId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting the current user
    if (user.id === req.user.userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Delete user (this will cascade to related records)
    await db.delete(betterAuthUser)
      .where(sql`${betterAuthUser.id} = ${userId}`);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// Get system statistics
adminRoutes.get("/stats", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const [
      userStats,
      sessionStats,
      companyStats,
      formStats,
    ] = await Promise.all([
      // User statistics
      db.select({
        totalUsers: sql<number>`count(*)`,
        verifiedUsers: sql<number>`count(*) filter (where email_verified = true)`,
        unverifiedUsers: sql<number>`count(*) filter (where email_verified = false)`,
        twoFactorUsers: sql<number>`count(*) filter (where two_factor_enabled = true)`,
      }).from(betterAuthUser),

      // Session statistics
      db.select({
        totalSessions: sql<number>`count(*)`,
        activeSessions: sql<number>`count(*) filter (where expires_at > now())`,
        expiredSessions: sql<number>`count(*) filter (where expires_at <= now())`,
      }).from(refreshTokens),

      // Company statistics
      db.select({
        totalCompanies: sql<number>`count(*)`,
      }).from(companies),

      // Form statistics
      db.select({
        totalForms: sql<number>`count(*)`,
        publishedForms: sql<number>`count(*) filter (where published = true)`,
        draftForms: sql<number>`count(*) filter (where published = false)`,
      }).from(forms),
    ]);

    res.json({
      users: userStats[0],
      sessions: sessionStats[0],
      companies: companyStats[0],
      forms: formStats[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'Failed to get system statistics' });
  }
});

// Get activity logs (if you have an activity log table)
adminRoutes.get("/activity", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { page = 1, limit = 50, userId, action, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // This is a placeholder - you would need to implement an activity log table
    // For now, we'll return session activity as a proxy
    let whereClause = sql`1=1`;

    if (userId) {
      whereClause = sql`${whereClause} AND ${refreshTokens.userId} = ${userId}`;
    }

    if (startDate) {
      whereClause = sql`${whereClause} AND ${refreshTokens.createdAt} >= ${new Date(startDate as string)}`;
    }

    if (endDate) {
      whereClause = sql`${whereClause} AND ${refreshTokens.createdAt} <= ${new Date(endDate as string)}`;
    }

    const activities = await db.query.refreshTokens.findMany({
      where: whereClause,
      with: {
        user: {
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: sql`${refreshTokens.createdAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(refreshTokens).where(whereClause);

    res.json({
      activities: activities.map(activity => ({
        id: activity.id,
        type: 'session_created',
        userId: activity.userId,
        user: activity.user,
        details: {
          deviceName: activity.deviceName,
          ipAddress: activity.ipAddress,
          userAgent: activity.userAgent,
        },
        timestamp: activity.createdAt,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get admin activity error:', error);
    res.status(500).json({ message: 'Failed to get activity logs' });
  }
});

// System health check
adminRoutes.get("/health", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    // Database connectivity check
    const dbCheck = await db.select({ count: sql<number>`count(*)` }).from(betterAuthUser);

    const health = {
      database: {
        status: 'healthy',
        details: `Connected successfully (${dbCheck[0].count} users found)`,
      },
      authentication: {
        status: 'healthy',
        details: 'Better Auth is handling authentication and session management',
      },
      timestamp: new Date().toISOString(),
    };

    const overallStatus = health.database.status === 'healthy' ? 'healthy' : 'unhealthy';

    res.status(overallStatus === 'healthy' ? 200 : 503).json({
      status: overallStatus,
      ...health,
    });
  } catch (error) {
    console.error('Admin health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});