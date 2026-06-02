import { Router } from 'express';
import { db } from '../db';
import { betterAuthUser, betterAuthSession, betterAuthAccount, betterAuthVerification, temp2faSessions } from '@shared/schema';
import { eq, and, sql, lt, not } from 'drizzle-orm';
import { authenticator } from 'otplib';
import { z } from 'zod';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { getAuthSecret } from '../auth';
// bcrypt removed — Better Auth uses scrypt via hashPassword
import jwt from 'jsonwebtoken';
import { triggerTransactionalEmail } from '../lib/trigger';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { twoFactorRateLimiter, forgotPasswordRateLimiter, resetPasswordRateLimiter, loginRateLimiter, verifyEmailRateLimiter, resendVerificationRateLimiter } from '../middleware/security';
import { validatePasswordStrength } from '../middleware/security-enhanced';
import { invalidateUserSecurity } from '../utils/userSecurityCache';
import { accountLockout } from '../utils/accountLockout';
import { redactEmail } from '../utils/logger';
import { runScheduledJob } from '../utils/scheduledJobs';
import { checkCooldown, armCooldown, pruneMemoryCooldowns } from '../utils/sharedCooldown';
import { cookiesShouldBeSecure } from '../utils/cookieSecurity';
import { setSessionCookie } from '../utils/sessionCookie';

const sleepMs = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Hard cap on failed TOTP attempts per temp session row. After this many
// wrong codes we delete the temp 2FA session row so the attacker has to
// restart the login flow (which re-trips loginRateLimiter + accountLockout).
// Keeps TOTP brute-force bounded even if the attacker rotates IPs past
// twoFactorRateLimiter.
//
// The counter lives on the row itself (temp_2fa_sessions.attempt_count) and
// is incremented atomically via UPDATE ... RETURNING. Previously this was an
// in-process Map with an opportunistic 5000-key cap; an attacker could
// inflate the map (by spraying /check-2fa-requirement) to evict their own
// counter and get free retries, and the counter also reset on every
// process restart / deploy.
const MAX_2FA_ATTEMPTS_PER_TEMP_SESSION = 5;

// HttpOnly cookie used to carry the temp 2FA session token between
// /check-2fa-requirement and /verify-2fa. The token is no longer returned in
// the JSON body (where it could leak via logs/telemetry/referer/extensions)
// — the browser holds it only as a Secure, SameSite=Strict, HttpOnly cookie
// scoped to the auth endpoint.
const TEMP_2FA_COOKIE_NAME = 'temp_2fa_session';
const TEMP_2FA_COOKIE_PATH = '/api/auth';

function tempCookieOptions(maxAgeMs?: number) {
  const opts: Record<string, any> = {
    httpOnly: true,
    secure: cookiesShouldBeSecure(),
    sameSite: 'strict' as const,
    path: TEMP_2FA_COOKIE_PATH,
  };
  if (typeof maxAgeMs === 'number') opts.maxAge = maxAgeMs;
  return opts;
}

function clearTempTwoFactorCookie(res: any) {
  res.clearCookie(TEMP_2FA_COOKIE_NAME, tempCookieOptions());
}

// Derive the client identity that the temp 2FA session is bound to. We hash
// `${ip}|${ua}` with SHA-256 so the stored value is opaque (not directly
// usable to track or impersonate) and fixed-size. The exact same derivation
// must be used at /check-2fa-requirement and /verify-2fa.
function computeClientBinding(req: any): string {
  const ip =
    (typeof req.ip === 'string' && req.ip) ||
    req.socket?.remoteAddress ||
    'unknown';
  const ua = (typeof req.get === 'function' && req.get('user-agent')) || '';
  return createHash('sha256').update(`${ip}|${ua}`).digest('hex');
}

function bindingMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
export const loginRoutes = Router();

// NOTE: an earlier `completeBrowserSignIn(req, res, email, password, …)`
// helper used to forward the credential check into Better Auth's internal
// `/sign-in/email` handler so non-2FA users got Better-Auth-issued cookies.
// It was removed because /check-2fa-requirement now writes the session row
// directly (matching /verify-2fa and /verify-email). Keeping the helper
// around invited regressions on the x-forwarded-for header (see fix #7)
// and made the success path depend on Better Auth's pre-conditions never
// changing. Direct insertion is simpler and audit-friendly.

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
          // Typed-key discipline: BETTER_AUTH_SECRET is reused across email
          // verification, password reset, etc. Stamping an explicit purpose
          // claim (and enforcing it on the verify side) prevents a token
          // minted for one flow from being replayed against another.
          purpose: 'email-verification',
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
        .where(and(eq(betterAuthUser.id, user.id), eq(betterAuthUser.tenantId, user.tenantId)));

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

// Clean up expired temporary 2FA sessions every 5 minutes.
// Wrapped in runScheduledJob so that only one worker / pod performs the
// DELETE per interval (Redis-lock leader election when REDIS_URL is set,
// otherwise gated by RUN_SCHEDULED_JOBS=true).
runScheduledJob('temp-2fa-cleanup', 5 * 60 * 1000, async () => {
  const now = new Date();
  const deletedSessions = await db.delete(temp2faSessions)
    .where(lt(temp2faSessions.expiresAt, now))
    .returning({ id: temp2faSessions.id });
  if (deletedSessions.length > 0) {
    console.log(`🧹 [Cleanup] Removed ${deletedSessions.length} expired temporary 2FA sessions`);
  }
});

// Check if user requires 2FA verification before login
// Verifies credentials WITHOUT creating a Better Auth session to avoid orphaned
// sessions. Uses better-auth/crypto to check the password hash directly.
loginRoutes.post('/check-2fa-requirement', loginRateLimiter, async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const requestIp = req.ip || req.socket?.remoteAddress || 'unknown';
    // Coerce: only a literal `true` enables the long-lived cookie. Any other
    // value (including missing/undefined from older clients) falls back to a
    // session-only cookie, which is the safer default.
    const remember = rememberMe === true;

    // Identity-based lockout. Complements the IP-based loginRateLimiter so a
    // distributed credential-stuffing attack against a single account still
    // hits progressive delays and temporary lockouts.
    const lockStatus = await accountLockout.isLocked(normalizedEmail);
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
      const result = await accountLockout.recordFailedAttempt(normalizedEmail, requestIp);
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
    await accountLockout.recordSuccessfulLogin(normalizedEmail, requestIp);

    console.log(`🔍 [2FA Check] Credentials valid for user: ${userRecord.id}`);

    // Step 2: Check if user has 2FA enabled
    if (!userRecord.twoFactorEnabled || !userRecord.twoFactorSecret) {
      // No 2FA — create the session DIRECTLY (same path as /verify-2fa).
      //
      // Previously this called Better Auth's internal /sign-in/email
      // handler, which:
      //   * re-runs the password hash check we just performed,
      //   * runs through Better Auth's own (separate) IP-keyed rate
      //     limiter — which could be poisoned by a spoofed
      //     x-forwarded-for header, and
      //   * silently breaks if Better Auth ever changes pre-conditions
      //     (e.g. starts demanding email-verified=true).
      //
      // Since we have already authenticated the user, just write the
      // session row ourselves and set the cookie. This is the same
      // approach already used by /verify-2fa and /verify-email, so the
      // three success paths now agree.
      console.log(`✅ [2FA Check] No 2FA required for user ${userRecord.id}, creating session directly`);

      const sessionId = `session_${Date.now()}_${randomBytes(12).toString('base64url')}`;
      const newSessionToken = `${sessionId}_token_${randomBytes(18).toString('base64url')}`;
      const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(betterAuthSession).values({
        id: sessionId,
        userId: userRecord.id,
        token: newSessionToken,
        expiresAt: sessionExpiresAt,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.get('User-Agent') || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // CRITICAL: the cookie value MUST be HMAC-signed in the format
      // Better Auth expects (`${token}.${base64(HMAC-SHA256(secret,token))}`).
      // Setting the raw token here produces a cookie that Better Auth's
      // `/api/auth/get-session` (via `ctx.getSignedCookie`) rejects, leaving
      // the browser logged-in-by-row but logged-out-by-useSession — the
      // "user logs in but is not redirected to dashboard" regression.
      setSessionCookie(res, newSessionToken, { rememberMe: remember });

      await db.update(betterAuthUser)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(and(eq(betterAuthUser.id, userRecord.id), eq(betterAuthUser.tenantId, userRecord.tenantId)));

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
        .where(and(eq(temp2faSessions.userId, userRecord.id), eq(temp2faSessions.tenantId, userRecord.tenantId)));
    } catch (deleteError) {
      console.error('❌ [2FA Check] Failed to delete existing sessions:', deleteError);
    }

    // Create new temporary 2FA session, bound to the originating client
    // identity (SHA-256 over `${ip}|${ua}`). /verify-2fa will require the
    // same binding to redeem the token, so a leaked token cannot be used
    // from a different device/network.
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const clientBinding = computeClientBinding(req);
    try {
      await db.insert(temp2faSessions).values({
        sessionToken,
        userId: userRecord.id,
        tenantId: userRecord.tenantId,
        clientBinding,
        expiresAt
      });
    } catch (insertError) {
      console.error('❌ [2FA Check] Failed to create temp session:', insertError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create session'
      });
    }

    // Carry the temp session token in an HttpOnly, Secure, SameSite=Strict
    // cookie scoped to /api/auth instead of returning it in the JSON body.
    // This keeps the token out of JS, response logs, referer headers, and
    // any telemetry that snapshots response payloads.
    res.cookie(TEMP_2FA_COOKIE_NAME, sessionToken, tempCookieOptions(10 * 60 * 1000));

    return res.json({
      success: true,
      requires2FA: true,
      // `tempSessionToken` is intentionally NOT returned in the body anymore.
      // The client redeems the cookie at /verify-2fa.
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
loginRoutes.post('/verify-2fa', twoFactorRateLimiter, async (req: any, res) => {
  try {
    const { token, rememberMe } = req.body;
    const remember = rememberMe === true;

    // Read the temp session token from the HttpOnly cookie set by
    // /check-2fa-requirement. Body fallback is intentionally NOT supported:
    // accepting the token from the body would re-enable the leak vectors
    // (logs, referer, telemetry, history) this binding is meant to close.
    const tempSessionToken: string | undefined = req.cookies?.[TEMP_2FA_COOKIE_NAME];

    if (!token) {
      return res.status(400).json({
        message: '2FA token is required'
      });
    }

    if (!tempSessionToken || typeof tempSessionToken !== 'string') {
      clearTempTwoFactorCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Temporary session token is required. Please log in again.'
      });
    }

    // Step 1: Find the temporary 2FA session
    const tempSession = await db.query.temp2faSessions.findFirst({
      where: eq(temp2faSessions.sessionToken, tempSessionToken)
    });

    if (!tempSession) {
      clearTempTwoFactorCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired temporary session'
      });
    }

    // Check if temporary session has expired
    if (new Date() > tempSession.expiresAt) {
      // Clean up expired session
      await db.delete(temp2faSessions)
        .where(and(eq(temp2faSessions.id, tempSession.id), eq(temp2faSessions.tenantId, tempSession.tenantId)));
      clearTempTwoFactorCookie(res);

      return res.status(401).json({
        success: false,
        message: 'Temporary session expired. Please log in again.'
      });
    }

    // Enforce client-identity binding. The temp session row was stamped with
    // a SHA-256 of `${ip}|${ua}` at /check-2fa-requirement; the redeemer must
    // present the same values. If the binding doesn't match (token leak,
    // device change, anonymizer rotation), nuke the row and force a fresh
    // login flow rather than letting the holder grind TOTP from elsewhere.
    const currentBinding = computeClientBinding(req);
    if (!bindingMatches(tempSession.clientBinding, currentBinding)) {
      console.warn(
        `🚫 [2FA] Client binding mismatch for tempSession ${tempSession.id} user=${tempSession.userId}. Revoking temp session.`
      );
      await db.delete(temp2faSessions)
        .where(and(eq(temp2faSessions.id, tempSession.id), eq(temp2faSessions.tenantId, tempSession.tenantId)))
        .catch(err => console.warn('⚠️ [2FA] Failed to delete bound temp session:', err));
      clearTempTwoFactorCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Session is no longer valid. Please log in again.'
      });
    }

    // Step 2: Get user to check 2FA secret
    let user;
    try {
      user = await db.query.betterAuthUser.findFirst({
        where: and(eq(betterAuthUser.id, tempSession.userId), eq(betterAuthUser.tenantId, tempSession.tenantId))
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

    // Re-check post-credential security state. The credentials check in
    // /check-2fa-requirement passed up to 10 minutes ago; in the meantime
    // the account may have been deactivated, or the password may have been
    // reset (which bumps tokenValidAfter and is meant to invalidate any
    // in-flight auth state). Reject the verification and clean up the temp
    // session row in either case so a stale temp token cannot complete login.
    const tempCreatedAt = tempSession.createdAt ?? new Date(0);
    const tokenValidAfter = user.tokenValidAfter ?? null;
    if (!user.isActive || (tokenValidAfter && tokenValidAfter > tempCreatedAt)) {
      await db.delete(temp2faSessions)
        .where(and(eq(temp2faSessions.id, tempSession.id), eq(temp2faSessions.tenantId, tempSession.tenantId)))
        .catch(err => console.warn('⚠️ [2FA] Failed to delete stale temp session:', err));
      clearTempTwoFactorCookie(res);
      console.log(`🚫 [2FA] Rejecting verify-2fa for user ${user.id}: isActive=${user.isActive}, tokenValidAfter=${tokenValidAfter?.toISOString()}, tempCreatedAt=${tempCreatedAt.toISOString()}`);
      return res.status(401).json({
        success: false,
        message: 'Session is no longer valid. Please log in again.'
      });
    }

    // Step 3: Verify the 2FA token
    const isValidToken = authenticator.verify({
      token,
      secret: user.twoFactorSecret
    });

    if (!isValidToken) {
      // Atomically bump the on-row failure counter. UPDATE ... RETURNING
      // gives us the post-increment value in a single round trip with no
      // TOCTOU between read and write, so parallel requests sharing the
      // same temp token cannot smuggle in extra attempts. The counter is
      // also durable across restarts and shared across workers — unlike
      // the previous in-process Map which could be evicted or zeroed.
      const [bumped] = await db.update(temp2faSessions)
        .set({ attemptCount: sql`${temp2faSessions.attemptCount} + 1` })
        .where(and(eq(temp2faSessions.id, tempSession.id), eq(temp2faSessions.tenantId, tempSession.tenantId)))
        .returning({ attemptCount: temp2faSessions.attemptCount });
      const attempts = bumped?.attemptCount ?? MAX_2FA_ATTEMPTS_PER_TEMP_SESSION;
      if (attempts >= MAX_2FA_ATTEMPTS_PER_TEMP_SESSION) {
        await db.delete(temp2faSessions)
          .where(and(eq(temp2faSessions.id, tempSession.id), eq(temp2faSessions.tenantId, tempSession.tenantId)))
          .catch(err => console.warn('⚠️ [2FA] Failed to delete temp session after cap:', err));
        clearTempTwoFactorCookie(res);
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
    await db.delete(temp2faSessions)
      .where(and(eq(temp2faSessions.id, tempSession.id), eq(temp2faSessions.tenantId, tempSession.tenantId)));
    clearTempTwoFactorCookie(res);

    // Create session directly (same approach as verify-email). Session row
    // always lasts 7 days server-side — `rememberMe` only controls whether
    // the browser cookie is persistent (7-day Max-Age) or session-only
    // (dropped on browser close).
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

    // CRITICAL: see setSessionCookie() — the cookie value MUST be
    // HMAC-signed in `${token}.${signature}` form, otherwise Better
    // Auth's `/api/auth/get-session` refuses it and `useSession()`
    // reports the user as logged out even though the DB row exists.
    // Cookie attributes (HttpOnly, SameSite=Lax, Secure, Path=/) match
    // Better Auth's own defaults; `rememberMe=false` produces a session
    // cookie (no Max-Age) that drops on browser close.
    setSessionCookie(res, newSessionToken, { rememberMe: remember });

    console.log('✅ [2FA] Session created directly after verification for user:', user.id);

    // Update last login time
    await db.update(betterAuthUser)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(betterAuthUser.id, user.id), eq(betterAuthUser.tenantId, user.tenantId)));

    // Deliberately do NOT echo the user's email / name back in the response
    // body. The session cookie already authenticates the browser; the
    // client should fetch profile data through the normal authenticated
    // endpoints (/api/auth/me etc.) rather than receiving a redundant copy
    // that lives in network captures / frontend stores. Only return the id
    // so the client can finalise its post-login UX.
    res.json({
      success: true,
      message: '2FA verification successful',
      verified: true,
      user: {
        id: user.id,
      },
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
loginRoutes.post('/verify-session-2fa', twoFactorRateLimiter, authenticateToken, requireTenant, async (req: any, res) => {
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
      where: and(eq(betterAuthUser.id, userId), eq(betterAuthUser.tenantId, tenantId))
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
        .where(and(
          eq(temp2faSessions.sessionToken, sessionToken),
          eq(temp2faSessions.tenantId, tenantId)
        ));

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
      .where(and(eq(betterAuthUser.id, user.id), eq(betterAuthUser.tenantId, tenantId)));

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
loginRoutes.get('/2fa-status', authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Get user to check 2FA settings
    let user;
    try {
      user = await db.query.betterAuthUser.findFirst({
        where: and(eq(betterAuthUser.id, userId), eq(betterAuthUser.tenantId, tenantId))
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
        eq(temp2faSessions.tenantId, tenantId),
        eq(temp2faSessions.verified, true)
      )
    });
    const isVerified = verification && verification.expiresAt > new Date();

    // Deliberately do NOT log any prefix / substring of `sessionToken`.
    // First-N characters still narrow the brute-force search space and let
    // anyone with log access confirm a token's presence — the user id is
    // sufficient for debugging.
    console.log(`📊 [2FA Status] Session verification for user ${user.id}:`, {
      verification: verification ? 'found' : 'not found',
      isVerified,
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

// Helper: decode + validate the verification JWT without consuming it.
// Used by both the GET (preview) and POST (consume) handlers so they
// behave identically up to the side-effect.
async function decodeVerificationToken(token: string): Promise<
  | { ok: true; email: string }
  | { ok: false; status: number; message: string }
> {
  try {
    const jwtMod = await import('jsonwebtoken');
    const secret = getAuthSecret();
    const decoded = jwtMod.default.verify(token, secret, { algorithms: ['HS256'] }) as { email: string; purpose?: string };
    if (decoded.purpose !== 'email-verification') {
      return { ok: false, status: 400, message: 'Invalid or expired verification token' };
    }
    return { ok: true, email: decoded.email };
  } catch (err: any) {
    return { ok: false, status: 400, message: 'Invalid or expired verification token' };
  }
}

// GET /verify-email — preview endpoint.
//
// This endpoint is intentionally SIDE-EFFECT FREE. Email link-preview /
// inbox-scanner / corporate URL-rewriter services (Microsoft SafeLinks,
// Outlook safe-link scanning, Gmail link prefetch, etc.) routinely issue
// GETs on any URL that appears in an email. If the GET consumed the
// single-use token, those scanners would either burn the link before the
// real user clicks it or — worse — receive an auth session of their own.
//
// We only validate the token signature/purpose and report whether it
// looks redeemable, so the client can render a "Click to verify" button
// that POSTs to /verify-email to actually consume the token.
loginRoutes.get('/verify-email', verifyEmailRateLimiter, async (req, res) => {
  const token = req.query.token as string;
  if (!token) {
    return res.status(400).json({ message: 'Verification token is required' });
  }
  const decoded = await decodeVerificationToken(token);
  if (!decoded.ok) {
    return res.status(decoded.status).json({ message: decoded.message });
  }
  // Surface only that the token has a valid signature/purpose. We do not
  // touch the user row or look up emailVerificationToken here — doing so
  // would let a scanner-issued GET fingerprint account state.
  return res.json({
    success: true,
    tokenValid: true,
    requiresConfirmation: true,
    message: 'Click the verify button to confirm your email.',
  });
});

// POST /verify-email — actually consume the single-use token.
//
// Requires an explicit user action (button click in the UI). Marks the
// email verified, clears the stored token, and DOES NOT create a session
// — the user is redirected to log in normally. Auto-creating a session
// here would mean a forwarded verification email logs the recipient into
// the original user's account.
loginRoutes.post('/verify-email', verifyEmailRateLimiter, async (req, res) => {
  try {
    const token = (req.body?.token as string) || (req.query.token as string);

    if (!token) {
      return res.status(400).json({
        message: 'Verification token is required'
      });
    }

    // Do not log a token prefix — it still narrows the search space if logs leak.
    console.log('📧 [Verify Email] Starting email verification');

    const decoded = await decodeVerificationToken(token);
    if (!decoded.ok) {
      console.error('❌ [Verify Email] JWT decode/validate failed');
      return res.status(decoded.status).json({ message: decoded.message });
    }
    const email = decoded.email;
    console.log('✅ [Verify Email] JWT decoded, email:', redactEmail(email));

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
        .where(and(eq(betterAuthUser.id, user.id), eq(betterAuthUser.tenantId, user.tenantId)));
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
        .where(and(eq(betterAuthUser.id, user.id), eq(betterAuthUser.tenantId, user.tenantId)));

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

    // No automatic session creation here — regardless of whether the user
    // has 2FA enabled. We only mark the email verified; the user must log
    // in normally afterwards. This eliminates two attack/abuse paths:
    //   1. An email-scanner / link-preview GET (now a POST anyway) granting
    //      itself a 7-day session.
    //   2. A forwarded verification email logging the recipient into the
    //      original user's account.
    return res.json({
      message: 'Email verified successfully. Please log in to continue.',
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: true,
      },
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
//
// The per-user 2-minute cooldown is enforced via the shared sharedCooldown
// helper, which is Redis-backed when REDIS_URL is set so the limit is
// effective across workers / pods (previously a per-process Map could be
// defeated by load-balancing across N workers giving N× attempts).
const CHANGE_EMAIL_COOLDOWN_MS = 2 * 60 * 1000;
const CHANGE_EMAIL_BUCKET = 'change-email';

// Periodically prune the in-memory cooldown map (only relevant when Redis
// is unavailable). Leader-elected so it doesn't duplicate across workers.
runScheduledJob('shared-cooldown-prune', 10 * 60 * 1000, async () => {
  pruneMemoryCooldowns();
});

loginRoutes.post('/change-email-unverified', authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!userId || !tenantId) {
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

    // Rate limiting – 2-minute cooldown per user, backed by Redis when
    // available so the cooldown holds across workers.
    const cdCheck = await checkCooldown(CHANGE_EMAIL_BUCKET, userId);
    if (!cdCheck.allowed) {
      return res.status(429).json({
        message: `Please wait ${cdCheck.retryAfterSec} seconds before changing your email again`,
        retryAfter: cdCheck.retryAfterSec,
      });
    }

    // Fetch current user
    const user = await db.query.betterAuthUser.findFirst({
      where: and(eq(betterAuthUser.id, userId), eq(betterAuthUser.tenantId, tenantId)),
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

    // Generate the new verification JWT FIRST so it can be persisted in the
    // same UPDATE that flips the email — /verify-email enforces single-use
    // by comparing the presented JWT against user.emailVerificationToken, so
    // the row must end up holding the token we are about to email out. A
    // stale token left over from the previous email would otherwise:
    //   (a) reject the freshly-emailed link (functional break), and
    //   (b) remain replayable against the new email record if the JWT
    //       lookup happens to resolve to this user later.
    const secret = getAuthSecret();
    const verificationToken = jwt.sign(
      {
        email: normalizedEmail,
        // See /resend-verification — explicit purpose claim so this JWT can
        // only be redeemed by /verify-email, never cross-used against
        // another endpoint signing with the same secret.
        purpose: 'email-verification',
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      { expiresIn: '24h' },
    );
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const verificationSentAt = new Date();

    // Atomically: change the email, clear the verified flag, and rotate the
    // single-use verification token + expiry + last-sent timestamp.
    await db.update(betterAuthUser)
      .set({
        email: normalizedEmail,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpiresAt,
        lastVerificationEmailSent: verificationSentAt,
        updatedAt: new Date(),
      })
      .where(and(eq(betterAuthUser.id, userId), eq(betterAuthUser.tenantId, tenantId)));

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

    // Arm the next cooldown window. We arm AFTER the heavy work so a
    // failure path (e.g. DB error) doesn't lock the user out of a retry,
    // matching the original semantics.
    await armCooldown(CHANGE_EMAIL_BUCKET, userId, CHANGE_EMAIL_COOLDOWN_MS);

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
//
// Timing-equalised: every code path (no user / inactive user / valid user)
// returns the same JSON after the same minimum elapsed time. Token mint,
// DB writes, and email dispatch happen AFTER the response is queued so
// network latency to SES/Trigger cannot leak account existence. Mirrors
// /resend-verification's pattern.
loginRoutes.post('/forgot-password', forgotPasswordRateLimiter, async (req, res) => {
  const MINIMUM_RESPONSE_MS = 250;
  const startTime = Date.now();
  const equalizeTiming = async () => {
    const elapsed = Date.now() - startTime;
    if (elapsed < MINIMUM_RESPONSE_MS) {
      await sleepMs(MINIMUM_RESPONSE_MS - elapsed);
    }
  };

  // Always return success to prevent email enumeration
  const successResponse = {
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  };

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      await equalizeTiming();
      return res.status(400).json({ message: 'Email address is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up user. This DB hit happens on EVERY path so it doesn't add a
    // distinguishing latency on its own.
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, normalizedEmail),
    });

    // Decide whether to actually issue a reset, but DO NOT do the
    // token-mint/DB-write/email-dispatch work inline — that would create a
    // measurable latency delta between the "real user" path and the
    // no-user / inactive-user path.
    const shouldIssueReset = !!user && user.isActive;

    // Kick off the heavy work in the background. We await `equalizeTiming`
    // BEFORE responding so all paths take roughly the same wall-clock time
    // from the client's perspective.
    if (shouldIssueReset && user) {
      void (async () => {
        try {
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

          const tokenId = randomBytes(16).toString('base64url');
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

          await db.delete(betterAuthVerification)
            .where(eq(betterAuthVerification.identifier, `password-reset:${user.id}`));

          await db.insert(betterAuthVerification).values({
            id: tokenId,
            identifier: `password-reset:${user.id}`,
            value: resetToken,
            expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

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
        } catch (bgErr) {
          console.error('❌ [Forgot Password] Background work failed:', bgErr);
        }
      })();
    } else if (!user) {
      console.log('⚠️ [Forgot Password] No user found for:', redactEmail(normalizedEmail));
    } else {
      console.log('⚠️ [Forgot Password] Inactive user:', redactEmail(normalizedEmail));
    }

    await equalizeTiming();
    return res.json(successResponse);
  } catch (error) {
    console.error('❌ [Forgot Password] Error:', error);
    // Even on error, equalise timing and return the same success shape so
    // the error path can't be used as an enumeration oracle either.
    await equalizeTiming();
    return res.json(successResponse);
  }
});

// Reset password - verify token and set new password
loginRoutes.post('/reset-password', resetPasswordRateLimiter, async (req, res) => {
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

    // Also revoke any in-flight temp 2FA sessions — otherwise an attacker who
    // passed /check-2fa-requirement with the old password (or who triggered
    // this reset themselves) could still complete login via /verify-2fa
    // within the 10-minute temp session window.
    await db.delete(temp2faSessions)
      .where(and(eq(temp2faSessions.userId, user.id), eq(temp2faSessions.tenantId, user.tenantId)))
      .catch(err => console.warn('⚠️ [Reset Password] Failed to delete temp 2FA sessions:', err));

    // Update tokenValidAfter to invalidate any cached tokens
    await db.update(betterAuthUser)
      .set({
        tokenValidAfter: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(betterAuthUser.id, user.id), eq(betterAuthUser.tenantId, user.tenantId)));

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
