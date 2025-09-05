import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { betterAuthSession, betterAuthUser, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
  try {
    // Check for Better Auth session token in cookies
    const sessionToken = req.cookies?.better_auth_session_token ||
                        req.cookies?.session_token;

    if (!sessionToken) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }

    // Verify session with Better Auth database
    const session = await db.query.betterAuthSession.findFirst({
      where: eq(betterAuthSession.token, sessionToken),
      with: {
        user: true
      }
    });

    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      return res.status(401).json({ message: 'Session expired' });
    }

    // Get user information from Better Auth user table
    const betterAuthUser = session.user as any; // Type assertion for Better Auth user
    if (!betterAuthUser) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Parse user name for firstName/lastName
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (betterAuthUser.name) {
      const nameParts = betterAuthUser.name.split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ') || undefined;
    }

    // Create authenticated user object using Better Auth user data directly
    // No database lookup needed - Better Auth hooks ensure tenantId is synchronized
    const authUser: AuthUser = {
      id: betterAuthUser.id,
      email: betterAuthUser.email,
      name: betterAuthUser.name || undefined,
      firstName,
      lastName,
      role: betterAuthUser.role || 'Employee',
      tenantId: betterAuthUser.tenantId || 'default-tenant-id'
    };

    req.user = authUser;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ message: 'Authentication service error' });
  }
};

export const requireRole = (requiredRole: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
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
    const requiredRoleLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({
        message: `Insufficient permissions. Required role: ${requiredRole}, your role: ${req.user.role}`
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

  // Validate tenant ID format (should be UUID or specific format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(req.user.tenantId) && req.user.tenantId !== 'default-tenant-id') {
    return res.status(400).json({
      message: 'Invalid tenant ID format',
      tenantId: req.user.tenantId
    });
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
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(req.user.tenantId) && req.user.tenantId !== 'default-tenant-id') {
    return res.status(400).json({
      message: 'Invalid tenant ID format',
      tenantId: req.user.tenantId
    });
  }

  // Skip tenant existence check for default tenant (for development/testing)
  if (req.user.tenantId !== 'default-tenant-id') {
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
