import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { betterAuthSession, betterAuthUser } from '@shared/schema';
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
    const user = session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Parse user name for firstName/lastName
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (user.name) {
      const nameParts = user.name.split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ') || undefined;
    }

    // Create authenticated user object
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      firstName,
      lastName,
      role: user.role || 'Employee',
      tenantId: user.tenantId || 'default'
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
