import { Router } from 'express';
import { authenticateToken, requireRole } from './authRoutes';
import { storage } from '../storage';

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