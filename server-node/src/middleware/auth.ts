import { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/auth';

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
 * Middleware to authenticate requests using better-auth
 */
export async function authenticateRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get session token from cookie or Authorization header
    let sessionToken = req.cookies['better-auth.session_token'];
    
    if (!sessionToken && req.headers.authorization) {
      // Try to extract from Authorization header if cookie not present
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        sessionToken = authHeader.substring(7);
      }
    }

    if (!sessionToken) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    // Verify the session using better-auth
    const session = await auth.api.getSession({
      headers: {
        cookie: `better-auth.session_token=${sessionToken}`
      }
    });

    if (!session || !session.user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Attach user and session to request
    req.user = {
      id: session.user.id,
      email: session.user.email,
      tenantId: session.user.tenantId || '', // Assuming tenantId is stored in user
      ...session.user
    };
    req.session = session.session;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
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
    const sessionToken = req.cookies['better-auth.session_token'] || 
                        (req.headers.authorization?.startsWith('Bearer ') ? 
                         req.headers.authorization.substring(7) : null);

    if (sessionToken) {
      const session = await auth.api.getSession({
        headers: {
          cookie: `better-auth.session_token=${sessionToken}`
        }
      });

      if (session && session.user) {
        req.user = {
          id: session.user.id,
          email: session.user.email,
          tenantId: session.user.tenantId || '',
          ...session.user
        };
        req.session = session.session;
      }
    }

    next();
  } catch (error) {
    console.warn('Optional auth error:', error);
    // Don't fail the request, just continue without auth
    next();
  }
}
