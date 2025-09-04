import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { users, refreshTokens, tenants } from '@shared/schema';
import { authenticateToken, requireRole } from './authRoutes';
import { SessionCleanupService } from '../services/sessionCleanup';

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

// Get session cleanup status
adminRoutes.get("/sessions/cleanup/status", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const cleanupService = new SessionCleanupService();
    const status = cleanupService.getStatus();

    res.json({
      isRunning: status.isRunning,
      lastRun: status.lastRun,
      nextRun: status.nextRun,
      totalCleaned: status.totalCleaned,
      errors: status.errors,
    });
  } catch (error) {
    console.error('Get cleanup status error:', error);
    res.status(500).json({ message: 'Failed to get cleanup status' });
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

// Manual session cleanup
adminRoutes.post("/sessions/cleanup", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { olderThanHours = 24 } = req.body;

    const cutoffDate = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));

    // Delete expired sessions
    const deletedSessions = await db.delete(refreshTokens)
      .where(sql`${refreshTokens.expiresAt} < ${cutoffDate}`)
      .returning();

    // Also delete sessions that are expired based on current time
    const expiredSessions = await db.delete(refreshTokens)
      .where(sql`${refreshTokens.expiresAt} < now()`)
      .returning();

    const totalDeleted = deletedSessions.length + expiredSessions.length;

    res.json({
      message: 'Session cleanup completed',
      deletedCount: totalDeleted,
      cutoffDate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Session cleanup error:', error);
    res.status(500).json({ message: 'Session cleanup failed' });
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

// Get user management data
adminRoutes.get("/users", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { page = 1, limit = 50, role, emailVerified, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`1=1`;

    if (role) {
      whereClause = sql`${whereClause} AND ${users.role} = ${role}`;
    }

    if (emailVerified !== undefined) {
      whereClause = sql`${whereClause} AND ${users.emailVerified} = ${emailVerified === 'true'}`;
    }

    if (search) {
      whereClause = sql`${whereClause} AND (
        ${users.email} ILIKE ${`%${search}%`} OR
        ${users.firstName} ILIKE ${`%${search}%`} OR
        ${users.lastName} ILIKE ${`%${search}%`}
      )`;
    }

    const users = await db.query.users.findMany({
      where: whereClause,
      with: {
        company: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: sql`${users.createdAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(db.users).where(whereClause);

    res.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        companyId: user.companyId,
        company: user.company,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
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

// Update user role
adminRoutes.patch("/users/:userId/role", authenticateToken, requireRole('Administrator'), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['Owner', 'Administrator', 'Manager', 'Employee'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: sql`${users.id} = ${userId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user role
    await db.update(users)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${userId}`);

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
    const user = await db.query.users.findFirst({
      where: sql`${users.id} = ${userId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting the current user
    if (user.id === req.user.userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Delete user (this will cascade to related records)
    await db.delete(users)
      .where(sql`${users.id} = ${userId}`);

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
      }).from(db.users),

      // Session statistics
      db.select({
        totalSessions: sql<number>`count(*)`,
        activeSessions: sql<number>`count(*) filter (where expires_at > now())`,
        expiredSessions: sql<number>`count(*) filter (where expires_at <= now())`,
      }).from(refreshTokens),

      // Company statistics
      db.select({
        totalCompanies: sql<number>`count(*)`,
      }).from(db.companies),

      // Form statistics
      db.select({
        totalForms: sql<number>`count(*)`,
        publishedForms: sql<number>`count(*) filter (where published = true)`,
        draftForms: sql<number>`count(*) filter (where published = false)`,
      }).from(db.forms),
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
    const healthChecks = await Promise.allSettled([
      // Database connectivity
      db.select({ count: sql<number>`count(*)` }).from(db.users),
      
      // Session cleanup service
      Promise.resolve(new SessionCleanupService().getStatus()),
    ]);

    const [dbCheck, sessionCleanupCheck] = healthChecks;

    const health = {
      database: {
        status: dbCheck.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        error: dbCheck.status === 'rejected' ? dbCheck.reason?.message : null,
      },
      sessionCleanup: {
        status: sessionCleanupCheck.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        details: sessionCleanupCheck.status === 'fulfilled' ? sessionCleanupCheck.value : null,
        error: sessionCleanupCheck.status === 'rejected' ? sessionCleanupCheck.reason?.message : null,
      },
      timestamp: new Date().toISOString(),
    };

    const overallStatus = health.database.status === 'healthy' && health.sessionCleanup.status === 'healthy' ? 'healthy' : 'unhealthy';

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