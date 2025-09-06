import { Router } from 'express';
import { db } from '../db';
import { betterAuthUser, betterAuthSession, temp2faSessions } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { authenticator } from 'otplib';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth-middleware';
import { auth } from '../auth';

export const loginRoutes = Router();

// New login verification endpoint that follows the flow in the image
loginRoutes.post('/verify-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Step 1: Check credentials using Better Auth
    let loginResult;
    try {
      console.log('🔍 [Verify Login] Available auth methods:', Object.keys(auth.api || {}));
      console.log('🔍 [Verify Login] Auth object:', typeof auth.api);

      // Try the correct Better Auth method - check if signInEmail exists
      if (auth.api.signInEmail) {
        loginResult = await auth.api.signInEmail({
          body: { email, password },
        });
      } else {
        console.log('🔍 [Verify Login] signInEmail not available, no other method available');
        return res.status(500).json({ message: 'Authentication method not available' });
      }
      console.log('🔍 [Verify Login] Better Auth result received');
    } catch (authError: any) {
      console.error('❌ [Verify Login] Better Auth error:', authError);
      console.error('❌ [Verify Login] Auth error details:', authError?.message);
      return res.status(500).json({ message: 'Authentication service error: ' + authError.message });
    }

    // Check if authentication was successful
    if (!loginResult || !loginResult.user) {
      console.log('❌ [Verify Login] Invalid credentials for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Step 2: Credentials are valid, extract user from Better Auth response
    const user = loginResult.user;
    const authSessionToken = loginResult.token; // Better Auth session token

    console.log('✅ [Verify Login] User found:', { id: user.id, email: user.email });

    // Get user record directly from better_auth_user table
    let userRecord;
    try {
      userRecord = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, user.id)
      });

      if (!userRecord) {
        console.error('❌ [Login] User not found in better_auth_user table');
        return res.status(500).json({ 
          success: false, 
          message: 'User record not found' 
        });
      }
    } catch (error) {
      console.error('Error getting user for 2FA check:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to check user status' 
      });
    }

    // Step 3: Check if user has 2FA enabled
    if (!userRecord.twoFactorEnabled || !userRecord.twoFactorSecret) {
      // No 2FA enabled - create normal session and redirect to dashboard
      console.log(`✅ [Login] No 2FA required for user ${userRecord.email}`);
      
      // Check if session was created in database
      console.log('🔍 [Login] Checking for session token in database:', authSessionToken.substring(0, 8) + '...');
      const sessionCheck = await db.query.betterAuthSession.findFirst({
        where: eq(betterAuthSession.token, authSessionToken)
      });
      
      if (!sessionCheck) {
        console.log('⚠️ [Login] Session not found in database, creating manually');
        // Create session manually if Better Auth didn't create it
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        await db.insert(betterAuthSession).values({
          id: sessionId,
          token: authSessionToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'] || null
        });
        console.log('✅ [Login] Created session in database:', sessionId);
      } else {
        console.log('✅ [Login] Session already exists in database:', sessionCheck.id);
      }
      
      // Set Better Auth session cookie with correct name format
      // Better Auth expects 'better_auth_session_token' not 'better-auth.session_token'
      res.cookie('better_auth_session_token', authSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });
      
      // Also set the alternative cookie name for compatibility
      res.cookie('better-auth.session_token', authSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      return res.json({
        success: true,
        has2FA: false,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token: authSessionToken // Include token in response for frontend
      });
    }

    // Step 4: User has 2FA enabled - create temporary 2FA session
    console.log(`🔐 [Login] 2FA required for user ${userRecord.email}`);
    
    // For 2FA flow, we create our own temporary session token
    // since Better Auth doesn't provide one during 2FA verification
    const sessionToken = `temp_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    console.log('🔍 [Login] Created temporary session token for 2FA:', sessionToken.substring(0, 8) + '...');

    // Delete any existing temp 2FA session for this user
    try {
      await db.delete(temp2faSessions)
        .where(eq(temp2faSessions.userId, user.id));
      console.log('✅ [Login] Deleted existing temp sessions for user', user.id);
    } catch (deleteError) {
      console.error('❌ [Login] Failed to delete existing sessions:', deleteError);
    }

    // Create new temporary 2FA session
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    try {
      await db.insert(temp2faSessions).values({
        sessionToken,
        userId: user.id,
        tenantId: userRecord.tenantId,
        expiresAt
      });
      console.log('✅ [Login] Created temp 2FA session for user', user.id);
    } catch (insertError) {
      console.error('❌ [Login] Failed to create temp session:', insertError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to create session' 
      });
    }

    return res.json({
      success: true,
      has2FA: true,
      tempSessionToken: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error('Login verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

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
  const entries = Array.from(twoFactorPendingVerifications.entries());
  for (const [sessionToken, verification] of entries) {
    if (verification.expiresAt < now) {
      twoFactorPendingVerifications.delete(sessionToken);
    }
  }
}, 5 * 60 * 1000);

// Clean up expired temporary 2FA sessions every 5 minutes
setInterval(async () => {
  try {
    const now = new Date();
    const result = await db.delete(temp2faSessions)
      .where(sql`${temp2faSessions.expiresAt} < ${now}`);
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`🧹 [Cleanup] Removed ${result.rowCount} expired temporary 2FA sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up expired temp 2FA sessions:', error);
  }
}, 5 * 60 * 1000);

// Check if user requires 2FA verification after login
loginRoutes.post('/check-2fa-requirement', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    console.log(`🔍 [2FA Check] Checking requirement for user ID: ${userId}, tenant: ${tenantId}`);

    // Get user record to check 2FA status
    let user;
    try {
      user = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, userId)
      });

      if (!user) {
        console.error('❌ [2FA Check] User not found in betterAuthUser table');
        return res.status(500).json({
          message: 'User not found'
        });
      }

      console.log(`✅ [2FA Check] User found: ${user.email}, 2FA enabled: ${user.twoFactorEnabled}, has secret: ${!!user.twoFactorSecret}`);
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

// New 2FA verification endpoint that follows the flow in the image
loginRoutes.post('/verify-2fa', async (req, res) => {
  try {
    const { token, tempSessionToken } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        message: '2FA token is required' 
      });
    }

    if (!tempSessionToken) {
      return res.status(400).json({ 
        message: 'Temporary session token is required' 
      });
    }

    // Step 1: Find the temporary 2FA session
    const tempSession = await db.query.temp2faSessions.findFirst({
      where: eq(temp2faSessions.sessionToken, tempSessionToken)
    });

    if (!tempSession) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid or expired temporary session' 
      });
    }

    // Check if temporary session has expired
    if (new Date() > tempSession.expiresAt) {
      // Clean up expired session
      await db.delete(temp2faSessions)
        .where(eq(temp2faSessions.id, tempSession.id));
      
      return res.status(401).json({ 
        success: false,
        message: 'Temporary session expired. Please log in again.' 
      });
    }

    // Step 2: Get user to check 2FA secret
    let user;
    try {
      user = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, tempSession.userId)
      });

      if (!user) {
        console.error('User not found in betterAuthUser table for 2FA verification');
        return res.status(500).json({
          success: false,
          message: 'User not found'
        });
      }
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

    // Step 3: Verify the 2FA token
    const isValidToken = authenticator.verify({
      token,
      secret: user.twoFactorSecret
    });

    if (!isValidToken) {
      return res.status(400).json({ 
        message: 'Invalid 2FA code. Please try again.' 
      });
    }

    // Step 4: 2FA verification successful - delete temp session and create normal session
    await db.delete(temp2faSessions)
      .where(eq(temp2faSessions.id, tempSession.id));

    // Create a proper Better Auth session in the database
    const newSessionToken = `auth_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    await db.insert(betterAuthSession).values({
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      token: newSessionToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || null
    });

    // Set Better Auth session cookies with both possible names
    res.cookie('better_auth_session_token', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });
    
    res.cookie('better-auth.session_token', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    // Update last login time
    await db.update(betterAuthUser)
      .set({ 
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(betterAuthUser.id, user.id));

    res.json({
      success: true,
      message: '2FA verification successful',
      verified: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
      }
    });

  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Legacy endpoint for backward compatibility
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
      user = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, userId)
      });

      if (!user) {
        console.error('User not found in betterAuthUser table for session 2FA verification');
        return res.status(500).json({
          message: 'User not found'
        });
      }
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
      secret: user.twoFactorSecret
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
    await db.update(betterAuthUser)
      .set({ 
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(betterAuthUser.id, user.id));

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
      user = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, userId)
      });

      if (!user) {
        console.error('User not found in betterAuthUser table for 2FA status');
        return res.status(500).json({
          message: 'User not found'
        });
      }
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
