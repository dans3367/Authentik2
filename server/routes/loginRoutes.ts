import { Router } from 'express';
import { db } from '../db';
import { betterAuthUser, betterAuthSession, temp2faSessions } from '@shared/schema';
import { eq, and, sql, lt } from 'drizzle-orm';
import { authenticator } from 'otplib';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth-middleware';
import { auth, getAuthSecret } from '../auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { triggerTransactionalEmail } from '../lib/trigger';
import { randomBytes } from 'crypto';

export const loginRoutes = Router();

// Rate limiting for resend verification
const resendRateLimit = new Map<string, { count: number; resetAt: number; nextAllowedAt: number }>();

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of resendRateLimit.entries()) {
    if (data.resetAt < now) {
      resendRateLimit.delete(email);
    }
  }
}, 5 * 60 * 1000);

// Resend verification email endpoint
loginRoutes.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email address is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limiting
    const now = Date.now();
    const rateLimitData = resendRateLimit.get(normalizedEmail);

    if (rateLimitData) {
      // Check if we're still in cooldown period
      if (now < rateLimitData.nextAllowedAt) {
        const retryAfterMinutes = Math.ceil((rateLimitData.nextAllowedAt - now) / 60000);
        return res.status(429).json({
          message: `Please wait ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? 's' : ''} before requesting another verification email`,
          retryAfter: retryAfterMinutes,
          nextAllowedAt: new Date(rateLimitData.nextAllowedAt).toISOString()
        });
      }

      // Reset counter if past reset time
      if (now >= rateLimitData.resetAt) {
        resendRateLimit.delete(normalizedEmail);
      }
    }

    console.log('📧 [Resend Verification] Request for email:', normalizedEmail);

    // Find user by email
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, normalizedEmail)
    });

    // Always return success to prevent email enumeration
    // But only send email if user exists and is not verified
    if (user) {
      if (user.emailVerified) {
        console.log('ℹ️ [Resend Verification] User already verified:', normalizedEmail);
        return res.json({
          message: 'Verification email sent successfully',
          success: true,
          alreadyVerified: true
        });
      }

      // Generate new verification token (JWT)
      const secret = getAuthSecret();
      const verificationToken = jwt.sign(
        {
          email: user.email,
          iat: Math.floor(Date.now() / 1000)
        },
        secret,
        { expiresIn: '24h' }
      );

      console.log('✅ [Resend Verification] Generated token for:', user.email);

      // Persist the token on the user row so the verify-email endpoint can
      // enforce single-use: only the latest token is valid, and it is
      // cleared after consumption.
      await db.update(betterAuthUser)
        .set({
          emailVerificationToken: verificationToken,
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          updatedAt: new Date()
        })
        .where(eq(betterAuthUser.id, user.id));

      // Dispatch verification email via Trigger.dev + SES
      // Failures are logged internally but never surfaced to the client to
      // prevent account-existence enumeration via differing error responses.
      try {
        const triggerResult = await triggerTransactionalEmail({
          type: 'verification',
          recipientEmail: user.email,
          recipientName: user.firstName,
          verificationToken: verificationToken,
          baseUrl: process.env.BASE_URL || 'http://localhost:5002',
          appName: process.env.APP_NAME || 'Zendwise',
        });
        if (triggerResult.success) {
          console.log('✅ [Resend Verification] Verification email task dispatched, runId:', triggerResult.runId);
        } else {
          console.error('❌ [Resend Verification] Failed to dispatch email task:', triggerResult.error);
        }
      } catch (emailError) {
        console.error('❌ [Resend Verification] Failed to dispatch email task:', emailError);
      }

      // Update rate limiting - 2 minutes cooldown between requests
      const nextAllowedAt = now + (2 * 60 * 1000); // 2 minutes
      const resetAt = now + (60 * 60 * 1000); // 1 hour
      const currentData = resendRateLimit.get(normalizedEmail);

      resendRateLimit.set(normalizedEmail, {
        count: (currentData?.count || 0) + 1,
        resetAt: currentData?.resetAt || resetAt,
        nextAllowedAt: nextAllowedAt
      });

      return res.json({
        message: 'Verification email sent successfully',
        success: true,
        nextAllowedAt: new Date(nextAllowedAt).toISOString()
      });
    } else {
      console.log('⚠️ [Resend Verification] User not found:', normalizedEmail);
      // Return success anyway to prevent email enumeration
      return res.json({
        message: 'Verification email sent successfully',
        success: true
      });
    }

  } catch (error) {
    console.error('❌ [Resend Verification] Error:', error);
    res.status(500).json({
      message: 'Internal server error',
      success: false
    });
  }
});

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
          headers: req.headers as any
        });
      } else {
        console.log('🔍 [Verify Login] signInEmail not available, no other method available');
        return res.status(500).json({ message: 'Authentication method not available' });
      }
      console.log('🔍 [Verify Login] Better Auth result received');

    } catch (authError: any) {
      console.error('❌ [Verify Login] Better Auth error:', authError);
      console.error('❌ [Verify Login] Auth error details:', authError?.message);
      return res.status(500).json({ message: 'Authentication service error' });
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

      // Since Better Auth already authenticated the user and returned a session token,
      // we need to manually set the session cookie for the frontend to recognize it
      console.log('✅ [Login] Setting Better Auth session cookie:', authSessionToken.substring(0, 8) + '...');

      // Set the exact cookie that Better Auth expects
      res.cookie('better-auth.session_token', authSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (Better Auth default)
        path: '/',
        // Allow cookies to be sent from any origin in development
        ...(process.env.NODE_ENV !== 'production' && { domain: undefined })
      });

      return res.json({
        success: true,
        has2FA: false,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    }

    // Step 4: User has 2FA enabled - create temporary 2FA session
    console.log(`🔐 [Login] 2FA required for user ${userRecord.email}`);

    // For 2FA flow, we create our own temporary session token
    // since Better Auth doesn't provide one during 2FA verification
    const sessionToken = `temp_${user.id}_${Date.now()}_${randomBytes(16).toString('base64url')}`;

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

// Clean up expired temporary 2FA sessions every 5 minutes
setInterval(async () => {
  try {
    const now = new Date();
    // Use drizzle's lt() function instead of raw SQL to properly handle Date objects
    const result = await db.delete(temp2faSessions)
      .where(lt(temp2faSessions.expiresAt, now));

    if (result.rowCount && result.rowCount > 0) {
      console.log(`🧹 [Cleanup] Removed ${result.rowCount} expired temporary 2FA sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up expired temp 2FA sessions:', error);
  }
}, 5 * 60 * 1000);

// Check if user requires 2FA verification before login
loginRoutes.post('/check-2fa-requirement', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Step 1: Validate credentials using Better Auth (but don't create full session)
    let loginResult;
    try {
      loginResult = await auth.api.signInEmail({
        body: { email, password },
        headers: req.headers as any
      });
    } catch (authError: any) {
      console.error('❌ [2FA Check] Better Auth error:', authError);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if authentication was successful
    if (!loginResult || !loginResult.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = loginResult.user;
    console.log(`🔍 [2FA Check] Credentials valid for user: ${user.email}`);

    // Get user record to check 2FA status
    let userRecord;
    try {
      userRecord = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, user.id)
      });

      if (!userRecord) {
        return res.status(500).json({
          success: false,
          message: 'User record not found'
        });
      }
    } catch (error) {
      console.error('❌ [2FA Check] Error getting user record:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get user information'
      });
    }

    // Check if user has 2FA enabled
    if (!userRecord.twoFactorEnabled || !userRecord.twoFactorSecret) {
      console.log(`✅ [2FA Check] No 2FA required for user ${userRecord.email}`);
      return res.json({
        success: true,
        requires2FA: false
      });
    }

    // User has 2FA enabled - create temporary session for verification
    console.log(`🔐 [2FA Check] 2FA required for user ${userRecord.email}`);

    const sessionToken = `temp_${userRecord.id}_${Date.now()}_${randomBytes(16).toString('base64url')}`;

    // Delete any existing temp 2FA session for this user
    try {
      await db.delete(temp2faSessions)
        .where(eq(temp2faSessions.userId, userRecord.id));
    } catch (deleteError) {
      console.error('❌ [2FA Check] Failed to delete existing sessions:', deleteError);
    }

    // Create new temporary 2FA session
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    try {
      await db.insert(temp2faSessions).values({
        sessionToken,
        userId: userRecord.id,
        tenantId: userRecord.tenantId,
        expiresAt
      });
    } catch (insertError) {
      console.error('❌ [2FA Check] Failed to create temp session:', insertError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create session'
      });
    }

    return res.json({
      success: true,
      requires2FA: true,
      tempSessionToken: sessionToken
    });

  } catch (error) {
    console.error('2FA check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
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

    // After successful 2FA verification, create a database-backed session directly.
    // Credentials were already validated at initial login; 2FA code was just verified above.
    console.log('✅ [2FA] Creating database-backed session after 2FA verification');

    const sessionToken = randomBytes(32).toString('base64url');
    const sessionId = randomBytes(16).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      await db.insert(betterAuthSession).values({
        id: sessionId,
        token: sessionToken,
        userId: user.id,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiresAt,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });

      res.cookie('better-auth.session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });
      console.log('✅ [2FA] Database session created successfully');
    } catch (sessionError) {
      console.error('❌ [2FA] Failed to create session in database:', sessionError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create session after 2FA verification. Please try logging in again.'
      });
    }

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

    // Update the temp 2FA session in database to mark as verified with extended expiry
    const newExpiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
    await db.update(temp2faSessions)
      .set({
        verified: true,
        expiresAt: newExpiresAt
      })
      .where(eq(temp2faSessions.sessionToken, sessionToken));

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

    // Query database for 2FA verification status
    const verification = await db.query.temp2faSessions.findFirst({
      where: and(
        eq(temp2faSessions.sessionToken, sessionToken),
        eq(temp2faSessions.verified, true)
      )
    });
    const isVerified = verification && verification.expiresAt > new Date();

    console.log(`📊 [2FA Status] Session verification for ${user.email}:`, {
      sessionToken: sessionToken.substring(0, 8) + '...',
      verification: verification ? 'found' : 'not found',
      isVerified
    });

    const response = {
      requiresTwoFactor: !isVerified,
      twoFactorEnabled: true,
      verified: isVerified
    };

    console.log(`📊 [2FA Status] Response:`, response);
    res.json(response);

  } catch (error) {
    console.error('2FA status check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Middleware to require 2FA verification for protected routes
export async function requireTwoFactorVerification(req: any, res: any, next: any) {
  const sessionToken = req.cookies?.['better-auth.session_token'];

  if (!sessionToken) {
    return res.status(401).json({
      message: 'Authentication required',
      requiresTwoFactor: false
    });
  }

  try {
    // Query database for 2FA verification status
    const verification = await db.query.temp2faSessions.findFirst({
      where: and(
        eq(temp2faSessions.sessionToken, sessionToken),
        eq(temp2faSessions.verified, true)
      )
    });

    // If there's no verification record, or it's expired
    if (!verification || verification.expiresAt < new Date()) {
      // We need to check if the user has 2FA enabled
      // This will be done by the frontend calling /check-2fa-requirement
      return res.status(403).json({
        message: '2FA verification required',
        requiresTwoFactor: true,
        code: 'TWO_FACTOR_REQUIRED'
      });
    }

    next();
  } catch (error) {
    console.error('2FA verification middleware error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

// Custom email verification endpoint that creates a session automatically
loginRoutes.get('/verify-email', async (req, res) => {
  try {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({
        message: 'Verification token is required'
      });
    }

    console.log('📧 [Verify Email] Starting email verification for token:', token.substring(0, 20) + '...');

    // Decode JWT token to get email
    let email: string;
    try {
      const jwt = await import('jsonwebtoken');
      const secret = getAuthSecret();
      const decoded = jwt.default.verify(token, secret, { algorithms: ['HS256'] }) as { email: string; iat: number; exp: number };
      email = decoded.email;
      console.log('✅ [Verify Email] JWT decoded, email:', email);
    } catch (jwtError: any) {
      console.error('❌ [Verify Email] JWT verification failed:', jwtError.message);
      return res.status(400).json({
        message: 'Invalid or expired verification token'
      });
    }

    // Find user by email
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, email.toLowerCase())
    });

    if (!user) {
      console.log('❌ [Verify Email] User not found:', email);
      return res.status(400).json({
        message: 'User not found'
      });
    }

    console.log('✅ [Verify Email] Found user:', user.email);

    // Enforce single-use: the presented token must match the one stored on
    // the user row. After successful verification the stored token is
    // cleared, so any replay of the same (or an older) token is rejected.
    if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
      console.log('❌ [Verify Email] Token already used or does not match stored token for:', user.email);
      return res.status(400).json({
        message: 'Verification token has already been used or is invalid'
      });
    }

    // Check if user is already verified
    if (user.emailVerified) {
      console.log('ℹ️ [Verify Email] User already verified:', user.email);
      // Clear the stale token but do not create a new session
      await db.update(betterAuthUser)
        .set({
          emailVerificationToken: null,
          emailVerificationExpires: null,
          updatedAt: new Date()
        })
        .where(eq(betterAuthUser.id, user.id));
      return res.json({
        message: 'Email already verified',
        success: true,
        alreadyVerified: true
      });
    } else {
      // Mark email as verified and clear the single-use token atomically
      await db.update(betterAuthUser)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          updatedAt: new Date()
        })
        .where(eq(betterAuthUser.id, user.id));

      console.log('✅ [Verify Email] Email verified for user:', user.email);
    }

    // Create a Better Auth session for the user automatically
    console.log('🔐 [Verify Email] Creating session for user:', user.email);

    // Generate a unique session ID and token
    const sessionId = `session_${Date.now()}_${randomBytes(12).toString('base64url')}`;
    const sessionToken = `${sessionId}_token_${randomBytes(18).toString('base64url')}`;
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create session in database
    const [newSession] = await db.insert(betterAuthSession)
      .values({
        id: sessionId,
        userId: user.id,
        token: sessionToken,
        expiresAt: sessionExpiresAt,
        ipAddress: req.ip || req.connection.remoteAddress || null,
        userAgent: req.get('User-Agent') || null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    console.log('✅ [Verify Email] Session created:', newSession.id);

    // Set the session cookie
    res.cookie('better-auth.session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    console.log('✅ [Verify Email] Session cookie set');

    // Return success response with user info
    // Note: Session token is set via httpOnly cookie only - not exposed in response body
    res.json({
      message: 'Email verified successfully',
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: true
      }
    });

  } catch (error) {
    console.error('❌ [Verify Email] Error:', error);
    res.status(500).json({
      message: 'Internal server error during email verification'
    });
  }
});

// Change email for unverified users endpoint
// Allows authenticated users whose email is NOT yet verified to change their email
// and receive a new verification email at the updated address.
const changeEmailRateLimit = new Map<string, { nextAllowedAt: number }>();

loginRoutes.post('/change-email-unverified', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { newEmail } = req.body;

    if (!newEmail || typeof newEmail !== 'string') {
      return res.status(400).json({ message: 'A valid new email address is required' });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = newEmail.toLowerCase().trim();

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // Rate limiting – 2-minute cooldown per user
    const now = Date.now();
    const rl = changeEmailRateLimit.get(userId);
    if (rl && now < rl.nextAllowedAt) {
      const retrySeconds = Math.ceil((rl.nextAllowedAt - now) / 1000);
      return res.status(429).json({
        message: `Please wait ${retrySeconds} seconds before changing your email again`,
        retryAfter: retrySeconds,
      });
    }

    // Fetch current user
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, userId),
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only allow if user is NOT yet verified
    if (user.emailVerified) {
      return res.status(400).json({ message: 'Your email is already verified. Use the account settings to change your email.' });
    }

    // Prevent setting the same email
    if (user.email.toLowerCase() === normalizedEmail) {
      return res.status(400).json({ message: 'New email is the same as your current email' });
    }

    // Check that the new email is not already taken
    const existingUser = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, normalizedEmail),
    });

    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    console.log(`📧 [Change Email] Changing email for user ${userId}: ${user.email} → ${normalizedEmail}`);

    // Update the user's email
    await db.update(betterAuthUser)
      .set({
        email: normalizedEmail,
        emailVerified: false,
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, userId));

    // Generate new verification token
    const secret = getAuthSecret();
    const verificationToken = jwt.sign(
      { email: normalizedEmail, iat: Math.floor(Date.now() / 1000) },
      secret,
      { expiresIn: '24h' },
    );

    // Dispatch verification email
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const triggerResult = await triggerTransactionalEmail({
        type: 'verification',
        recipientEmail: normalizedEmail,
        recipientName: user.firstName || user.name?.split(' ')[0],
        verificationToken: verificationToken,
        baseUrl: process.env.BASE_URL || 'http://localhost:5002',
        appName: process.env.APP_NAME || 'Zendwise',
      });

      if (triggerResult.success) {
        emailSent = true;
        console.log('✅ [Change Email] Verification email dispatched, runId:', triggerResult.runId);
      } else {
        emailError = triggerResult.error ? String(triggerResult.error) : 'Unknown dispatch error';
        console.error('❌ [Change Email] Failed to dispatch verification email:', triggerResult.error);
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error('❌ [Change Email] Failed to dispatch verification email:', err);
      // Don't fail the overall operation – the email was changed successfully
    }

    // Set rate limit
    changeEmailRateLimit.set(userId, { nextAllowedAt: now + 2 * 60 * 1000 });

    console.log(`✅ [Change Email] Email changed successfully for user ${userId}`);

    return res.json({
      success: true,
      message: emailSent
        ? 'Email changed successfully. A new verification email has been sent.'
        : 'Email changed successfully. However, the verification email could not be sent.',
      email: normalizedEmail,
      emailDispatch: {
        sent: emailSent,
        ...(emailError ? { error: emailError } : {}),
      },
    });
  } catch (error) {
    console.error('❌ [Change Email] Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
