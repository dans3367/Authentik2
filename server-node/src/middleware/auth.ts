import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    [key: string]: any;
  };
  session?: any;
}

/**
 * Simple authentication middleware for server-node
 * Since server-node receives validated requests from main server,
 * we just need to extract user info from headers or create a default user
 */
export async function authenticateRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    console.log('🔍 [Server-Node Auth] Authenticating request for:', req.path);

    // For newsletter endpoint, use a simplified authentication
    if (req.path === '/api/newsletter/send') {
      console.log('🧪 [Server-Node Auth] Newsletter endpoint detected - using simplified auth');

      // Extract user info from request body (sent by main server)
      const { user_id, tenant_id } = req.body;

      if (user_id && tenant_id) {
        console.log('✅ [Server-Node Auth] Using user info from request body');
        req.user = {
          id: user_id,
          email: 'temporal-user@example.com', // Default email for temporal operations
          tenantId: tenant_id
        };
        return next();
      }

      // Fallback: create a default user for debugging
      console.log('⚠️ [Server-Node Auth] Using default user for debugging');
      req.user = {
        id: 'debug-user',
        email: 'debug@example.com',
        tenantId: 'debug-tenant'
      };
      return next();
    }

    // For other endpoints, try to extract from headers
    let userId = req.headers['x-user-id'] as string;
    let tenantId = req.headers['x-tenant-id'] as string;

    if (userId && tenantId) {
      console.log('✅ [Server-Node Auth] Using user info from headers');
      req.user = {
        id: userId,
        email: req.headers['x-user-email'] as string || 'temporal-user@example.com',
        tenantId: tenantId
      };
      return next();
    }

    // For health checks and other endpoints, create a minimal user
    console.log('ℹ️ [Server-Node Auth] Creating minimal user for non-critical endpoint');
    req.user = {
      id: 'system-user',
      email: 'system@example.com',
      tenantId: 'system-tenant'
    };

    next();
  } catch (error) {
    console.error('❌ [Server-Node Auth] Authentication error:', error);
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

/**
 * Optional middleware - only authenticate if token is present
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // For server-node, we don't need complex authentication
    // Just create a basic user if needed
    if (!req.user) {
      req.user = {
        id: 'optional-user',
        email: 'optional@example.com',
        tenantId: 'optional-tenant'
      };
    }

    next();
  } catch (error) {
    console.warn('Optional auth error:', error);
    // Don't fail the request, just continue without auth
    next();
  }
}


