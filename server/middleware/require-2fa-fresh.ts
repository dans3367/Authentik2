/**
 * Step-up freshness gate.
 *
 * /verify-session-2fa stamps a `temp_2fa_sessions` row with
 * verified=true and a 24-hour expiry. That's an appropriate window for
 * \"this browser has done 2FA recently\" UI gates (TwoFactorGuard etc.),
 * but it's too long for genuinely sensitive operations — deleting an
 * account, changing billing email, mass-managing users, etc. should
 * re-challenge the user within minutes, not within a day.
 *
 * `require2FAFresh(maxAgeMs)` returns an Express middleware that:
 *   1. Verifies a 2FA-verified row exists for the current session.
 *   2. Verifies its `createdAt` (== last successful step-up) is no
 *      older than `maxAgeMs`.
 *   3. Rejects with 401 + { code: 'TWO_FACTOR_REVERIFICATION_REQUIRED' }
 *      otherwise so the client can prompt for a fresh TOTP code.
 *
 * If the user does not have 2FA enabled at all, the gate falls through
 * (no second factor exists to require). Callers that want to require
 * 2FA-enabled-AND-fresh should pair this with a separate
 * `requireTwoFactorEnabled` check.
 */

import { Response, NextFunction } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { betterAuthUser, temp2faSessions } from '@shared/schema';
import type { AuthRequest } from './auth-middleware';

export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export function require2FAFresh(maxAgeMs: number = FIFTEEN_MINUTES_MS) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // If 2FA isn't even enabled for the account, there's nothing to be
      // \"fresh\" about. Let the request through so this middleware can be
      // applied broadly without breaking accounts without TOTP enrolled.
      const user = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, req.user.id),
      });
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return next();
      }

      const sessionToken: string | undefined = (req as any).cookies?.['better-auth.session_token'];
      if (!sessionToken) {
        return res.status(401).json({
          message: 'Re-verify 2FA to perform this action.',
          code: 'TWO_FACTOR_REVERIFICATION_REQUIRED',
        });
      }

      const verifiedRow = await db.query.temp2faSessions.findFirst({
        where: and(
          eq(temp2faSessions.sessionToken, sessionToken),
          eq(temp2faSessions.verified, true),
        ),
      });

      const verifiedAt = verifiedRow?.createdAt;
      if (!verifiedRow || !verifiedAt) {
        return res.status(401).json({
          message: 'Re-verify 2FA to perform this action.',
          code: 'TWO_FACTOR_REVERIFICATION_REQUIRED',
        });
      }

      const ageMs = Date.now() - verifiedAt.getTime();
      if (ageMs > maxAgeMs) {
        return res.status(401).json({
          message: 'This action requires a fresh 2FA code.',
          code: 'TWO_FACTOR_REVERIFICATION_REQUIRED',
          maxAgeSec: Math.floor(maxAgeMs / 1000),
          verifiedAgeSec: Math.floor(ageMs / 1000),
        });
      }

      return next();
    } catch (err) {
      console.error('[require2FAFresh] error', err);
      return res.status(500).json({ message: 'Failed to evaluate 2FA freshness' });
    }
  };
}
