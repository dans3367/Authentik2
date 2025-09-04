import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { storage } from '../storage';
import { db } from '../db';
import { users, subscriptionPlans } from '@shared/schema';
import { sql, eq, and, count } from 'drizzle-orm';

export const userRoutes = Router();

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
        activeUsers: sql<number>`count(*) filter (where ${users.isActive} = true)::int`,
        inactiveUsers: sql<number>`count(*) filter (where ${users.isActive} = false)::int`,
        ownerCount: sql<number>`count(*) filter (where ${users.role} = 'Owner')::int`,
        adminCount: sql<number>`count(*) filter (where ${users.role} = 'Administrator')::int`,
        managerCount: sql<number>`count(*) filter (where ${users.role} = 'Manager')::int`,
        employeeCount: sql<number>`count(*) filter (where ${users.role} = 'Employee')::int`,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

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