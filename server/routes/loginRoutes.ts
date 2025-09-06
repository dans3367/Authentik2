import { Router } from 'express';
import { db } from '../db';
import { users, betterAuthUser, betterAuthSession } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { authenticator } from 'otplib';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth-middleware';
import { getOrCreateUser } from './twoFactorRoutes';

export const loginRoutes = Router();

// 2FA verification state storage (in production, use Redis)
const twoFactorPendingVerifications = new Map<string, {
  userId: string;
  tenantId: string;
  verified: boolean;
  expiresAt: number;
}>();

// Clean up expired verifications every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionToken, verification] of twoFactorPendingVerifications.entries()) {
    if (verification.expiresAt < now) {
      twoFactorPendingVerifications.delete(sessionToken);
    }
  }
}, 5 * 60 * 1000);

// Check if user requires 2FA verification after login
loginRoutes.post('/check-2fa-requirement', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    console.log(`🔍 [2FA Check] Checking requirement for user ID: ${userId}, tenant: ${tenantId}`);

    // Get or create user record to check 2FA status
    let user;
    try {
      user = await getOrCreateUser(userId, tenantId);
      console.log(`✅ [2FA Check] User found/created: ${user.email}, 2FA enabled: ${user.twoFactorEnabled}, has secret: ${!!user.twoFactorSecret}`);
    } catch (error) {
      console.error('❌ [2FA Check] Error getting user for 2FA check:', error);
      return res.status(500).json({ 
        message: 'Failed to check user 2FA status' 
      });
    }

    // Check if user has 2FA enabled
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      console.log(`ℹ️ [2FA Check] No 2FA required for user ${user.email}`);
      return res.json({
        requiresTwoFactor: false,
        message: 'No 2FA required',
        debug: {
          twoFactorEnabled: user.twoFactorEnabled,
          hasSecret: !!user.twoFactorSecret
        }
      });
    }

    // User has 2FA enabled - check if already verified for this session
    const sessionToken = req.cookies?.['better-auth.session_token'];
    if (!sessionToken) {
      console.log(`❌ [2FA Check] No session token found`);
      return res.status(401).json({ 
        message: 'No session found' 
      });
    }

    const verification = twoFactorPendingVerifications.get(sessionToken);
    if (verification && verification.verified && verification.expiresAt > Date.now()) {
      console.log(`✅ [2FA Check] 2FA already verified for session`);
      return res.json({
        requiresTwoFactor: false,
        twoFactorVerified: true,
        message: '2FA already verified for this session'
      });
    }

    // 2FA required and not yet verified
    console.log(`🔐 [2FA Check] 2FA verification required for user ${user.email}`);
    
    // Store pending verification
    twoFactorPendingVerifications.set(sessionToken, {
      userId,
      tenantId,
      verified: false,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    });

    res.json({
      requiresTwoFactor: true,
      twoFactorVerified: false,
      message: 'Please verify your 2FA code to continue',
      debug: {
        twoFactorEnabled: user.twoFactorEnabled,
        hasSecret: !!user.twoFactorSecret,
        userEmail: user.email
      }
    });

  } catch (error) {
    console.error('❌ [2FA Check] Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify 2FA for current session
loginRoutes.post('/verify-session-2fa', authenticateToken, async (req: any, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        message: '2FA token is required' 
      });
    }

    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Get user to check 2FA secret
    let user;
    try {
      user = await getOrCreateUser(userId, tenantId);
    } catch (error) {
      console.error('Error getting user for 2FA verification:', error);
      return res.status(500).json({ 
        message: 'Failed to verify 2FA' 
      });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ 
        message: '2FA is not enabled for this account' 
      });
    }

    // Verify the 2FA token
    const isValidToken = authenticator.verify({
      token,
      secret: user.twoFactorSecret,
      window: 1 // Allow 1 step tolerance for clock drift
    });

    if (!isValidToken) {
      return res.status(400).json({ 
        message: 'Invalid 2FA code. Please try again.' 
      });
    }

    // Mark session as 2FA verified
    const sessionToken = req.cookies?.['better-auth.session_token'];
    if (!sessionToken) {
      return res.status(401).json({ 
        message: 'No session found' 
      });
    }

    twoFactorPendingVerifications.set(sessionToken, {
      userId,
      tenantId,
      verified: true,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    });

    // Update last login time
    await db.update(users)
      .set({ 
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    res.json({
      success: true,
      message: '2FA verification successful',
      verified: true
    });

  } catch (error) {
    console.error('Session 2FA verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current 2FA verification status
loginRoutes.get('/2fa-status', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Get user to check 2FA settings
    let user;
    try {
      user = await getOrCreateUser(userId, tenantId);
    } catch (error) {
      console.error('Error getting user for 2FA status:', error);
      return res.status(500).json({ 
        message: 'Failed to get 2FA status' 
      });
    }

    console.log(`🔍 [2FA Status] Checking user: ${user.email}, twoFactorEnabled: ${user.twoFactorEnabled}, hasSecret: ${!!user.twoFactorSecret}`);

    // Check if user has 2FA enabled
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      console.log(`ℹ️ [2FA Status] User ${user.email} does not have 2FA enabled`);
      return res.json({
        requiresTwoFactor: false,
        twoFactorEnabled: false,
        verified: true, // No 2FA means always verified
        debug: {
          userEmail: user.email,
          twoFactorEnabled: user.twoFactorEnabled,
          hasSecret: !!user.twoFactorSecret
        }
      });
    }

    console.log(`🔐 [2FA Status] User ${user.email} has 2FA enabled`);

    // Check if current session is 2FA verified
    const sessionToken = req.cookies?.['better-auth.session_token'];
    if (!sessionToken) {
      console.log(`❌ [2FA Status] No session token found for user ${user.email}`);
      return res.json({
        requiresTwoFactor: true,
        twoFactorEnabled: true,
        verified: false,
        debug: {
          userEmail: user.email,
          sessionToken: 'none'
        }
      });
    }

    const verification = twoFactorPendingVerifications.get(sessionToken);
    const isVerified = verification && verification.verified && verification.expiresAt > Date.now();

    console.log(`📊 [2FA Status] Session verification for ${user.email}:`, {
      sessionToken: sessionToken.substring(0, 8) + '...',
      verification: verification ? 'found' : 'not found',
      isVerified
    });

    const response = {
      requiresTwoFactor: !isVerified,
      twoFactorEnabled: true,
      verified: isVerified,
      debug: {
        userId,
        tenantId,
        userEmail: user.email,
        sessionToken: sessionToken.substring(0, 8) + '...',
        verification: verification ? 'found' : 'not found',
        isVerified,
        verificationExpiresAt: verification?.expiresAt
      }
    };

    console.log(`📊 [2FA Status] Response:`, response);
    res.json(response);

  } catch (error) {
    console.error('2FA status check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Middleware to require 2FA verification for protected routes
export function requireTwoFactorVerification(req: any, res: any, next: any) {
  const sessionToken = req.cookies?.['better-auth.session_token'];
  
  if (!sessionToken) {
    return res.status(401).json({ 
      message: 'Authentication required',
      requiresTwoFactor: false
    });
  }

  // Check if this session needs 2FA and if it's verified
  const verification = twoFactorPendingVerifications.get(sessionToken);
  
  // If there's no verification record, or it's not verified, or it's expired
  if (!verification || !verification.verified || verification.expiresAt < Date.now()) {
    // We need to check if the user has 2FA enabled
    // This will be done by the frontend calling /check-2fa-requirement
    return res.status(403).json({ 
      message: '2FA verification required',
      requiresTwoFactor: true,
      code: 'TWO_FACTOR_REQUIRED'
    });
  }

  next();
}
