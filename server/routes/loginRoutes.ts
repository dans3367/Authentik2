import { Router } from 'express';
import { db } from '../db';
import { betterAuthUser, betterAuthSession, betterAuthAccount, betterAuthVerification, temp2faSessions } from '@shared/schema';
import { eq, and, sql, lt, not } from 'drizzle-orm';
import { authenticator } from 'otplib';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth-middleware';
import { auth, getAuthSecret } from '../auth';
// bcrypt removed — Better Auth uses scrypt via hashPassword
import jwt from 'jsonwebtoken';
import { triggerTransactionalEmail } from '../lib/trigger';
import { randomBytes } from 'crypto';
import { twoFactorRateLimiter, passwordResetRateLimiter, loginRateLimiter, verifyEmailRateLimiter, resendVerificationRateLimiter } from '../middleware/security';
import { validatePasswordStrength } from '../middleware/security-enhanced';
import { invalidateUserSecurity } from '../utils/userSecurityCache';
import { accountLockout } from '../utils/accountLockout';
import { redactEmail } from '../utils/logger';

const sleepMs = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Hard cap on failed TOTP attempts per temp session token. After this many
// wrong codes we delete the temp 2FA session row so the attacker has to
// restart the login flow (which re-trips loginRateLimiter + accountLockout).
// Keeps TOTP brute-force bounded even if attacker rotates IPs past
// twoFactorRateLimiter.
const MAX_2FA_ATTEMPTS_PER_TEMP_SESSION = 5;
const twoFactorAttemptCounts = new Map<string, number>();
function bumpTwoFactorAttempts(token: string): number {
  const next = (twoFactorAttemptCounts.get(token) || 0) + 1;
  twoFactorAttemptCounts.set(token, next);
  // Opportunistic bound on map size — entries without a matching temp session
  // will never be cleared otherwise.
  if (twoFactorAttemptCounts.size > 5000) {
    const keys = Array.from(twoFactorAttemptCounts.keys()).slice(0, 1000);
    keys.forEach(k => twoFactorAttemptCounts.delete(k));
  }
  return next;
}
function clearTwoFactorAttempts(token: string) {
  twoFactorAttemptCounts.delete(token);
}

export const loginRoutes = Router();

function getAuthOrigin(req: any) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

async function completeBrowserSignIn(req: any, res: any, email: string, password: string) {
  // Only forward a minimal, audited set of headers into the internal Better
  // Auth handler. Client-supplied `cookie` is intentionally NOT forwarded —
  // an attacker could otherwise seed Better Auth with their own rate-limit
  // or session state, and there is no legitimate reason for the internal
  // sign-in call to inherit the client's cookie jar. Origin/referer are
  // pinned to our own auth origin so Better Auth's trustedOrigins check
  // passes regardless of what the client sent.
  const authOrigin = getAuthOrigin(req);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: authOrigin,
    referer: authOrigin,
  };

  const userAgent = req.headers['user-agent'];
  if (typeof userAgent === 'string') {
    headers['user-agent'] = userAgent;
  }

  const forwardedFor = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress;
  if (forwardedFor) {
    headers['x-forwarded-for'] = String(forwardedFor);
  }

  const signInUrl = `${authOrigin}/api/auth/sign-in/email`;
  console.log(`🔍 [completeBrowserSignIn] Making internal request to: ${signInUrl}`);

  const signInRequest = new Request(signInUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
  });

  const signInResponse = await auth.handler(signInRequest);
  console.log(`🔍 [completeBrowserSignIn] Better Auth response status: ${signInResponse.status}`);

  if (!signInResponse.ok) {
    const errorText = await signInResponse.text().catch(() => '');
    throw new Error(errorText || 'Failed to create authenticated session');
  }

  // Extract Set-Cookie headers from the Web Response object returned by auth.handler()
  // auth.handler() returns a standard Web API Response — cookies are in its headers,
  // NOT set via Express's res.setHeader. We must read them from the Response and
  // forward them onto the Express response so the browser receives them.
  const responseCookies: string[] = [];
  const rawSetCookie = signInResponse.headers.getSetCookie?.();
  if (rawSetCookie && rawSetCookie.length > 0) {
    responseCookies.push(...rawSetCookie);
  } else {
    // Fallback: some environments don't support getSetCookie(), try get()
    const cookieHeader = signInResponse.headers.get('set-cookie');
    if (cookieHeader) {
      // Multiple cookies may be comma-separated; split carefully (cookies contain '=' and ';')
      responseCookies.push(cookieHeader);
    }
  }

  console.log(`🔍 [completeBrowserSignIn] Extracted ${responseCookies.length} cookies from auth response:`, responseCookies.map(c => c.split(';')[0]));

  if (responseCookies.length > 0) {
    const existingCookies = (res.getHeader('set-cookie') as string | string[] | undefined) || [];
    const allCookies = Array.isArray(existingCookies)
      ? [...existingCookies, ...responseCookies]
      : existingCookies ? [existingCookies, ...responseCookies] : responseCookies;
    res.setHeader('Set-Cookie', allCookies);
  }
}

// Cooldown between consecutive resend-verification requests for the same user.
// Enforced against better_auth_user.last_verification_email_sent so the limit
// survives process restarts and is consistent across workers. Previously this
// was tracked in an unbounded in-memory Map.
const RESEND_VERIFICATION_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

// Resend verification email endpoint
loginRoutes.post('/resend-verification', resendVerificationRateLimiter, async (req, res) => {
  // Constant-time response: all code paths must take roughly the same
  // duration to prevent timing side-channels that reveal account existence
  // or rate-limit state.
  const MINIMUM_RESPONSE_MS = 200;
  const startTime = Date.now();
  const equalizeTiming = async () => {
    const elapsed = Date.now() - startTime;
    if (elapsed < MINIMUM_RESPONSE_MS) {
      await new Promise(resolve => setTimeout(resolve, MINIMUM_RESPONSE_MS - elapsed));
    }
  };

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email address is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    console.log('📧 [Resend Verification] Request for email:', redactEmail(normalizedEmail));

    // Find user by email
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, normalizedEmail)
    });

    // Enforce the cooldown against the persisted timestamp. Only applies to
    // real, unverified users — matches the prior in-memory semantics where
    // rate-limit entries were only ever created for that cohort.
    if (user && !user.emailVerified && user.lastVerificationEmailSent) {
      const lastSentMs = user.lastVerificationEmailSent.getTime();
      const cooldownEndsAt = lastSentMs + RESEND_VERIFICATION_COOLDOWN_MS;
      if (Date.now() < cooldownEndsAt) {
        // Return the same 200 response as all other paths to prevent
        // account-existence enumeration via differing status codes.
        await equalizeTiming();
        return res.json({
          message: 'Verification email sent successfully',
          success: true
        });
      }
    }

    // Only send email if user exists and is NOT yet verified.
    // All other paths (no user, already verified) do nothing but still
    // return the same shaped response after the same delay.
    if (user && !user.emailVerified) {
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

      console.log('✅ [Resend Verification] Generated token for user:', user.id);

      // Persist the token on the user row so the verify-email endpoint can
      // enforce single-use: only the latest token is valid, and it is
      // cleared after consumption. Also stamp lastVerificationEmailSent so
      // the next request hits the cooldown above.
      await db.update(betterAuthUser)
        .set({
          emailVerificationToken: verificationToken,
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastVerificationEmailSent: new Date(),
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
    } else if (user) {
      console.log('ℹ️ [Resend Verification] User already verified:', redactEmail(normalizedEmail));
    } else {
      console.log('⚠️ [Resend Verification] User not found:', redactEmail(normalizedEmail));
    }

    // Enforce minimum response time so all paths (no user, verified,
    // unverified) are indistinguishable by timing.
    await equalizeTiming();

    // Identical response shape for every path — no extra fields that
    // leak state (e.g. nextAllowedAt was previously only on the
    // "unverified" path).
    return res.json({
      message: 'Verification email sent successfully',
      success: true
    });

  } catch (error) {
    console.error('❌ [Resend Verification] Error:', error);
    res.status(500).json({
      message: 'Internal server error',
      success: false
    });
  }
});

// Clean up expired temporary 2FA sessions every 5 minutes
setInterval(async () => {
  try {
    const now = new Date();
    // Use drizzle's lt() function instead of raw SQL to properly handle Date objects
    const deletedSessions = await db.delete(temp2faSessions)
      .where(lt(temp2faSessions.expiresAt, now))
      .returning({ id: temp2faSessions.id });

    if (deletedSessions.length > 0) {
      console.log(`🧹 [Cleanup] Removed ${deletedSessions.length} expired temporary 2FA sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up expired temp 2FA sessions:', error);
  }
}, 5 * 60 * 1000);

// Check if user requires 2FA verification before login
// Verifies credentials WITHOUT creating a Better Auth session to avoid orphaned
// sessions. Uses better-auth/crypto to check the password hash directly.
loginRoutes.post('/check-2fa-requirement', loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const requestIp = req.ip || req.socket?.remoteAddress || 'unknown';

    // Identity-based lockout. Complements the IP-based loginRateLimiter so a
    // distributed credential-stuffing attack against a single account still
    // hits progressive delays and temporary lockouts.
    const lockStatus = accountLockout.isLocked(normalizedEmail);
    if (lockStatus.locked) {
      const retryAfterSec = Math.ceil((lockStatus.remainingTime || 0) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please try again later.',
        retryAfter: retryAfterSec,
      });
    }

    // Uniform "Invalid credentials" response for every auth failure below,
    // including the disabled-account case. Differentiating the message would
    // let an attacker who already has the correct password enumerate which
    // accounts are disabled.
    const invalidCredentials = async () => {
      const result = accountLockout.recordFailedAttempt(normalizedEmail, requestIp);
      if (result.shouldDelay && result.delayMs) {
        await sleepMs(result.delayMs);
      }
      if (result.locked) {
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Please try again later.',
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    };

    // Step 1: Look up user and their credential account directly — no session created
    const userRecord = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, normalizedEmail)
    });

    if (!userRecord) {
      return await invalidCredentials();
    }

    // Fetch the credential account that holds the password hash
    const [credentialAccount] = await db.select()
      .from(betterAuthAccount)
      .where(and(
        eq(betterAuthAccount.userId, userRecord.id),
        eq(betterAuthAccount.providerId, 'credential')
      ))
      .limit(1);

    if (!credentialAccount?.password) {
      return await invalidCredentials();
    }

    // Verify password using Better Auth's native scrypt hash — no session side-effects
    const { verifyPassword } = await import('better-auth/crypto');
    const passwordValid = await verifyPassword({
      password,
      hash: credentialAccount.password,
    });

    if (!passwordValid) {
      return await invalidCredentials();
    }

    // Inactive accounts return the same generic response as bad credentials
    // to avoid leaking account status to a holder of a valid password.
    if (!userRecord.isActive) {
      return await invalidCredentials();
    }

    // Credentials confirmed valid — clear the failed-attempt counter.
    accountLockout.recordSuccessfulLogin(normalizedEmail, requestIp);

    console.log(`🔍 [2FA Check] Credentials valid for user: ${userRecord.id}`);

    // Step 2: Check if user has 2FA enabled
    if (!userRecord.twoFactorEnabled || !userRecord.twoFactorSecret) {
      // No 2FA — create the browser session through Better Auth itself so the
      // client receives the exact cookies Better Auth expects.
      console.log(`✅ [2FA Check] No 2FA required for user ${userRecord.id}`);

      await completeBrowserSignIn(req, res, email, password);
      console.log('✅ [2FA Check] Better Auth cookies forwarded for non-2FA user');

      return res.json({
        success: true,
        requires2FA: false,
        sessionEstablished: true,
      });
    }

    // Step 3: 2FA required — create temporary session (no Better Auth session involved)
    console.log(`🔐 [2FA Check] 2FA required for user ${userRecord.id}`);

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

// 2FA verification endpoint — completes login after TOTP validation.
// Credentials were already verified in check-2fa-requirement; the temp session
// token proves that. We create the session directly here instead of
// re-authenticating with email/password (which would be a security risk if the
// temp token were leaked).
loginRoutes.post('/verify-2fa', twoFactorRateLimiter, async (req, res) => {
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
      // Per-temp-session failure counter. The token lives for 10 minutes and
      // is scoped to one login attempt, so an attacker rotating IPs past the
      // twoFactorRateLimiter still can't grind TOTP forever — after the cap
      // we nuke the temp session and force a fresh login.
      const attempts = bumpTwoFactorAttempts(tempSessionToken);
      if (attempts >= MAX_2FA_ATTEMPTS_PER_TEMP_SESSION) {
        await db.delete(temp2faSessions)
          .where(eq(temp2faSessions.id, tempSession.id))
          .catch(err => console.warn('⚠️ [2FA] Failed to delete temp session after cap:', err));
        clearTwoFactorAttempts(tempSessionToken);
        return res.status(401).json({
          success: false,
          message: 'Too many invalid codes. Please log in again.',
        });
      }
      return res.status(400).json({
        message: 'Invalid 2FA code. Please try again.'
      });
    }

    // Step 4: 2FA verification successful — delete temp session and create a
    // real session directly. Credentials were already verified during
    // check-2fa-requirement so no re-authentication is needed.
    clearTwoFactorAttempts(tempSessionToken);
    await db.delete(temp2faSessions)
      .where(eq(temp2faSessions.id, tempSession.id));

    // Create session directly (same approach as verify-email)
    const sessionId = `session_${Date.now()}_${randomBytes(12).toString('base64url')}`;
    const newSessionToken = `${sessionId}_token_${randomBytes(18).toString('base64url')}`;
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(betterAuthSession).values({
      id: sessionId,
      userId: user.id,
      token: newSessionToken,
      expiresAt: sessionExpiresAt,
      ipAddress: req.ip || req.connection.remoteAddress || null,
      userAgent: req.get('User-Agent') || null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Set the session cookie
    res.cookie('better-auth.session_token', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    console.log('✅ [2FA] Session created directly after verification for user:', user.id);

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

// Step-up 2FA verification for an already-authenticated session. The login
// flow's /verify-2fa deletes the temp row on success, so after normal login
// there is no row keyed by the Better-Auth session cookie. This endpoint
// (re)creates that row so protected UI gates (TwoFactorGuard / use2FA) can
// consult it via /2fa-status.
loginRoutes.post('/verify-session-2fa', twoFactorRateLimiter, authenticateToken, async (req: any, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        message: '2FA token is required'
      });
    }

    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const sessionToken: string | undefined = req.cookies?.['better-auth.session_token'];

    if (!sessionToken) {
      return res.status(401).json({
        message: 'No session found'
      });
    }

    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, userId)
    }).catch(err => {
      console.error('Error getting user for session 2FA verification:', err);
      return null;
    });

    if (!user) {
      return res.status(500).json({ message: 'User not found' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        message: '2FA is not enabled for this account'
      });
    }

    const isValidToken = authenticator.verify({
      token,
      secret: user.twoFactorSecret
    });

    if (!isValidToken) {
      return res.status(400).json({
        message: 'Invalid 2FA code. Please try again.'
      });
    }

    // Mark this browser session as 2FA-verified. We DELETE any stale row for
    // the same sessionToken first because `sessionToken` is UNIQUE; then
    // INSERT a fresh row. Leaves any other in-flight login temp rows for the
    // user untouched (those use a different sessionToken value).
    const verifiedExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    try {
      await db.delete(temp2faSessions)
        .where(eq(temp2faSessions.sessionToken, sessionToken));

      await db.insert(temp2faSessions).values({
        sessionToken,
        userId: user.id,
        tenantId,
        verified: true,
        expiresAt: verifiedExpiresAt,
      });
    } catch (dbError) {
      console.error('❌ [Session 2FA] Failed to persist verification state:', dbError);
      return res.status(500).json({ message: 'Failed to record 2FA verification' });
    }

    await db.update(betterAuthUser)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
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

    console.log(`🔍 [2FA Status] Checking user: ${user.id}, twoFactorEnabled: ${user.twoFactorEnabled}, hasSecret: ${!!user.twoFactorSecret}`);

    // Check if user has 2FA enabled
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      console.log(`ℹ️ [2FA Status] User ${user.id} does not have 2FA enabled`);
      return res.json({
        requiresTwoFactor: false,
        twoFactorEnabled: false,
        verified: true, // No 2FA means always verified
      });
    }

    console.log(`🔐 [2FA Status] User ${user.id} has 2FA enabled`);

    // Check if current session is 2FA verified
    const sessionToken = req.cookies?.['better-auth.session_token'];
    if (!sessionToken) {
      console.log(`❌ [2FA Status] No session token found for user ${user.id}`);
      return res.json({
        requiresTwoFactor: true,
        twoFactorEnabled: true,
        verified: false,
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

    console.log(`📊 [2FA Status] Session verification for user ${user.id}:`, {
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

// Custom email verification endpoint that creates a session automatically
loginRoutes.get('/verify-email', verifyEmailRateLimiter, async (req, res) => {
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
      console.log('✅ [Verify Email] JWT decoded, email:', redactEmail(email));
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
      console.log('❌ [Verify Email] User not found:', redactEmail(email));
      return res.status(400).json({
        message: 'User not found'
      });
    }

    console.log('✅ [Verify Email] Found user:', user.id);

    // Enforce single-use: the presented token must match the one stored on
    // the user row. After successful verification the stored token is
    // cleared, so any replay of the same (or an older) token is rejected.
    if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
      console.log('❌ [Verify Email] Token already used or does not match stored token for user:', user.id);
      return res.status(400).json({
        message: 'Verification token has already been used or is invalid'
      });
    }

    // Check if user is already verified
    if (user.emailVerified) {
      console.log('ℹ️ [Verify Email] User already verified:', user.id);
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

      console.log('✅ [Verify Email] Email verified for user:', user.id);

      // Dispatch the welcome email — fire-and-forget so a failure here never
      // blocks verification or session creation. Only sent on the fresh
      // verification path, not the already-verified branch above.
      try {
        const welcomeResult = await triggerTransactionalEmail({
          type: 'welcome',
          recipientEmail: user.email,
          recipientName: user.firstName || user.name?.split(' ')[0],
          baseUrl: process.env.BASE_URL || 'http://localhost:5002',
          appName: process.env.APP_NAME || 'Zendwise',
        });
        if (welcomeResult.success) {
          console.log('✅ [Verify Email] Welcome email dispatched, runId:', welcomeResult.runId);
        } else {
          console.error('❌ [Verify Email] Failed to dispatch welcome email:', welcomeResult.error);
        }
      } catch (welcomeError) {
        console.error('❌ [Verify Email] Failed to dispatch welcome email:', welcomeError);
      }
    }

    // If 2FA is enabled on this account (e.g. user verified their email after
    // changing it via /change-email-unverified), DO NOT auto-create a session
    // — that would bypass the 2FA gate. Mark the email verified and require
    // the user to log in normally so the TOTP challenge runs.
    if (user.twoFactorEnabled) {
      console.log('🔐 [Verify Email] User has 2FA enabled — skipping auto session creation');
      return res.json({
        message: 'Email verified successfully. Please log in to continue.',
        success: true,
        requires2FA: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: true,
        },
      });
    }

    // Create a Better Auth session for the user automatically
    console.log('🔐 [Verify Email] Creating session for user:', user.id);

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

// Clean up expired change-email rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of changeEmailRateLimit) {
    if (now >= value.nextAllowedAt) {
      changeEmailRateLimit.delete(key);
    }
  }
}, 10 * 60 * 1000);

loginRoutes.post('/change-email-unverified', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { newEmail, password } = req.body;

    if (!newEmail || typeof newEmail !== 'string') {
      return res.status(400).json({ message: 'A valid new email address is required' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'Password is required to change your email' });
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

    // Verify password before allowing email change
    const [credentialAccount] = await db.select()
      .from(betterAuthAccount)
      .where(and(
        eq(betterAuthAccount.userId, userId),
        eq(betterAuthAccount.providerId, 'credential')
      ))
      .limit(1);

    if (!credentialAccount?.password) {
      return res.status(400).json({ message: 'Password verification failed' });
    }

    const { verifyPassword } = await import('better-auth/crypto');
    const passwordValid = await verifyPassword({
      password,
      hash: credentialAccount.password,
    });

    if (!passwordValid) {
      return res.status(401).json({ message: 'Incorrect password' });
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

    console.log(`📧 [Change Email] Changing email for user ${userId}: ${redactEmail(user.email)} → ${redactEmail(normalizedEmail)}`);

    // Update the user's email
    await db.update(betterAuthUser)
      .set({
        email: normalizedEmail,
        emailVerified: false,
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, userId));

    // Invalidate all existing sessions for this user (except current) to prevent
    // stale sessions from being used with the old email
    const currentSessionToken = req.cookies?.['better-auth.session_token'];
    if (currentSessionToken) {
      const baseToken = currentSessionToken.indexOf('.') > 0
        ? currentSessionToken.substring(0, currentSessionToken.indexOf('.'))
        : currentSessionToken;
      // Delete all sessions except the current one
      await db.delete(betterAuthSession)
        .where(and(
          eq(betterAuthSession.userId, userId),
          not(eq(betterAuthSession.token, baseToken))
        ));
    } else {
      // No current session token — invalidate all sessions
      await db.delete(betterAuthSession)
        .where(eq(betterAuthSession.userId, userId));
    }

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

// Forgot password - send reset link
loginRoutes.post('/forgot-password', passwordResetRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    // Find user
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, normalizedEmail),
    });

    if (!user) {
      console.log('⚠️ [Forgot Password] No user found for:', redactEmail(normalizedEmail));
      return res.json(successResponse);
    }

    if (!user.isActive) {
      console.log('⚠️ [Forgot Password] Inactive user:', redactEmail(normalizedEmail));
      return res.json(successResponse);
    }

    // Generate a secure reset token (JWT with 1-hour expiry)
    const secret = getAuthSecret();
    const resetToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        purpose: 'password-reset',
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      { expiresIn: '1h' }
    );

    // Store the token in betterAuthVerification table for single-use enforcement
    const tokenId = randomBytes(16).toString('base64url');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing password-reset tokens for this user
    await db.delete(betterAuthVerification)
      .where(eq(betterAuthVerification.identifier, `password-reset:${user.id}`));

    // Insert new token
    await db.insert(betterAuthVerification).values({
      id: tokenId,
      identifier: `password-reset:${user.id}`,
      value: resetToken,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ [Forgot Password] Reset token stored for user:', user.id);

    // Send password reset email
    try {
      const triggerResult = await triggerTransactionalEmail({
        type: 'password-reset',
        recipientEmail: user.email,
        recipientName: user.firstName || user.name?.split(' ')[0],
        resetToken,
        baseUrl: process.env.BASE_URL || 'http://localhost:5002',
        appName: process.env.APP_NAME || 'Zendwise',
      });
      if (triggerResult.success) {
        console.log('✅ [Forgot Password] Reset email dispatched, runId:', triggerResult.runId);
      } else {
        console.error('❌ [Forgot Password] Failed to dispatch reset email:', triggerResult.error);
      }
    } catch (emailError) {
      console.error('❌ [Forgot Password] Failed to dispatch reset email:', emailError);
    }

    return res.json(successResponse);
  } catch (error) {
    console.error('❌ [Forgot Password] Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset password - verify token and set new password
loginRoutes.post('/reset-password', passwordResetRateLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Validate password strength server-side
    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.valid) {
      return res.status(400).json({
        message: 'Password does not meet security requirements',
        errors: strengthCheck.errors,
      });
    }

    // Verify JWT token
    const secret = getAuthSecret();
    let decoded: { sub: string; email: string; purpose: string };
    try {
      decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;
    } catch (jwtError: any) {
      console.error('❌ [Reset Password] JWT verification failed:', jwtError.message);
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    // Enforce single-use: check that token exists in verification table
    const [storedVerification] = await db.select()
      .from(betterAuthVerification)
      .where(and(
        eq(betterAuthVerification.identifier, `password-reset:${decoded.sub}`),
        eq(betterAuthVerification.value, token),
      ))
      .limit(1);

    if (!storedVerification) {
      return res.status(400).json({ message: 'Reset token has already been used or is invalid' });
    }

    if (new Date() > storedVerification.expiresAt) {
      // Clean up expired token
      await db.delete(betterAuthVerification)
        .where(eq(betterAuthVerification.id, storedVerification.id));
      return res.status(400).json({ message: 'Reset token has expired. Please request a new one.' });
    }

    // Find user
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, decoded.sub),
    });

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Hash new password using Better Auth's native scrypt hashing
    const { hashPassword } = await import('better-auth/crypto');
    const hashedPassword = await hashPassword(password);

    // Delete the used reset token (single-use enforcement)
    await db.delete(betterAuthVerification)
      .where(eq(betterAuthVerification.id, storedVerification.id));

    // Update password in the credential account (Better Auth stores password hash here)
    try {
      await db.execute(
        sql`UPDATE better_auth_account SET password = ${hashedPassword} WHERE user_id = ${user.id} AND provider_id = 'credential'`
      );
      console.log('✅ [Reset Password] Password updated for user:', user.id);
    } catch (updateError) {
      console.error('❌ [Reset Password] Failed to update password:', updateError);
      return res.status(500).json({ message: 'Failed to update password' });
    }

    // Invalidate all existing sessions for this user
    await db.delete(betterAuthSession)
      .where(eq(betterAuthSession.userId, user.id));

    // Update tokenValidAfter to invalidate any cached tokens
    await db.update(betterAuthUser)
      .set({
        tokenValidAfter: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, user.id));

    // Invalidate security cache — password was reset and all sessions revoked
    invalidateUserSecurity(user.id, 'password_reset', {
      tenantId: user.tenantId,
    });

    return res.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    console.error('❌ [Reset Password] Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
