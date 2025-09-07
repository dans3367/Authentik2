import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { betterAuthSession, betterAuthUser, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { auth } from '../auth';

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
    // Use Better Auth's built-in session verification
    const session = await auth.api.getSession({ 
      headers: req.headers as any
    });

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
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (userRecord.name) {
      const nameParts = userRecord.name.split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ') || undefined;
    }

    // Create authenticated user object using Better Auth session data
    const authUser: AuthUser = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name || undefined,
      firstName,
      lastName,
      role: userRecord.role || 'Employee',
      tenantId: userRecord.tenantId || '29c69b4f-3129-4aa4-a475-7bf892e5c5b9'
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

  // Validate tenant ID format (should be UUID or contain valid UUID)
  const uuidRegexExact = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uuidRegexExtract = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

  // Check if it's a perfect UUID or the default tenant ID
  if (uuidRegexExact.test(req.user.tenantId) || req.user.tenantId === '29c69b4f-3129-4aa4-a475-7bf892e5c5b9') {
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

  // Check if it's a perfect UUID or the default tenant ID
  if (uuidRegexExact.test(req.user.tenantId) || req.user.tenantId === '29c69b4f-3129-4aa4-a475-7bf892e5c5b9') {
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

  // Skip tenant existence check for default tenant (for development/testing)
  if (req.user.tenantId !== '29c69b4f-3129-4aa4-a475-7bf892e5c5b9') {
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
