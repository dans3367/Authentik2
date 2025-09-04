import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { sql, eq } from 'drizzle-orm';
import { type UserRole, refreshTokens } from '@shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "your-super-secret-refresh-key";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
        tenantId: string;
        tenantSlug?: string;
      };
    }
  }
}

// Middleware to verify JWT token
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Middleware to check user permissions
export function requireRole(allowedRoles: UserRole | UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

// Middleware for admin-only operations (Owner and Administrator)
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(['Owner', 'Administrator'])(req, res, next);
}

// Middleware for manager+ operations
export function requireManager(req: Request, res: Response, next: NextFunction) {
  return requireRole(['Owner', 'Administrator', 'Manager'])(req, res, next);
}

// Utility function to extract device information from request
export function getDeviceInfo(req: Request): {
  deviceId: string;
  deviceName: string;
  userAgent?: string;
  ipAddress?: string;
} {
  const { UAParser } = require('ua-parser-js');
  const { createHash } = require('crypto');

  const userAgentString = req.get("User-Agent") || "Unknown";
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  // Create a unique device identifier based on user agent and IP
  const deviceFingerprint = `${result.browser.name}-${result.os.name}-${req.ip}`;
  const deviceId = createHash("sha256")
    .update(deviceFingerprint)
    .digest("hex")
    .substring(0, 16);

  // Generate user-friendly device name
  const browserName = result.browser.name || "Unknown Browser";
  const osName = result.os.name || "Unknown OS";
  const deviceName = `${browserName} on ${osName}`;

  return {
    deviceId,
    deviceName,
    userAgent: userAgentString,
    ipAddress: req.ip,
  };
}

// Middleware to verify refresh token
export async function verifyRefreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Find refresh token
    const refreshTokenRecord = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.token, refreshToken),
      with: {
        user: {
          with: {
            tenant: true,
          },
        },
      },
    });

    if (!refreshTokenRecord || refreshTokenRecord.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    req.user = {
      userId: refreshTokenRecord.user.id,
      email: refreshTokenRecord.user.email,
      role: refreshTokenRecord.user.role,
      tenantId: refreshTokenRecord.user.tenantId,
      tenantSlug: refreshTokenRecord.user.tenant?.slug,
    };

    next();
  } catch (error) {
    console.error('Refresh token verification error:', error);
    res.status(401).json({ message: 'Token verification failed' });
  }
}