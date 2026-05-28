// ---------------------------------------------------------------------------
// Session cookie signing helper.
//
// Better Auth signs the `better-auth.session_token` cookie with the format:
//
//     ${rawToken}.${HMAC-SHA256(secret, rawToken).base64}
//
// and its `/api/auth/get-session` endpoint rejects any cookie that lacks a
// valid signature (the cookie is read via `ctx.getSignedCookie(...)` which
// returns `null` when the dotted signature is missing or doesn't verify).
//
// That means routes that manually persist a session row and call
// `res.cookie('better-auth.session_token', token, ...)` with the RAW token
// produce a cookie that Better Auth's session lookup refuses, so the
// browser ends up holding a session cookie that `useSession()` reports as
// "not logged in" — the symptom that surfaced as: "user logs in but is
// not redirected to dashboard".
//
// This module centralises the signing so every site that issues a session
// cookie (login completion, 2FA verification, impersonation callback)
// agrees on the format Better Auth expects.
// ---------------------------------------------------------------------------
import { createHmac } from 'crypto';
import type { Response } from 'express';
import { getAuthSecret } from '../auth';
import { cookiesShouldBeSecure } from './cookieSecurity';

export const SESSION_COOKIE_NAME = 'better-auth.session_token';

/**
 * Compute Better Auth's signed-cookie value for a session token.
 *
 * Result format: `${token}.${base64(HMAC-SHA256(secret, token))}`
 *
 * NOTE: Better Auth's `signCookieValue` additionally URL-encodes the
 * final string before placing it in the Set-Cookie header. Express's
 * `res.cookie(name, value)` already URL-encodes the value via its
 * default `encode` option, so callers using `setSessionCookie` below
 * MUST NOT pre-encode. Direct `res.cookie` callers similarly do not
 * need to encode.
 */
export function signSessionToken(rawToken: string): string {
  const signature = createHmac('sha256', getAuthSecret())
    .update(rawToken)
    .digest('base64');
  return `${rawToken}.${signature}`;
}

export interface SetSessionCookieOptions {
  /**
   * When false the cookie is session-only (no `Max-Age` / `Expires`) so the
   * browser drops it on close. When true the cookie persists for 7 days,
   * mirroring the server-side session row's expiry. Ignored when an
   * explicit `maxAgeMs` is provided.
   */
  rememberMe?: boolean;
  /**
   * Explicit Max-Age in milliseconds. Overrides `rememberMe`. Use this for
   * special-case session windows (e.g. 1-hour impersonation cookies).
   */
  maxAgeMs?: number;
}

/**
 * Convenience wrapper: signs `rawToken` and sets the standard Better-Auth
 * session cookie with the same attributes Better Auth itself uses
 * (HttpOnly, SameSite=Lax, Secure-when-appropriate, Path=/).
 */
export function setSessionCookie(
  res: Response,
  rawToken: string,
  { rememberMe = false, maxAgeMs }: SetSessionCookieOptions = {},
): void {
  const signedValue = signSessionToken(rawToken);
  const opts: Record<string, any> = {
    httpOnly: true,
    secure: cookiesShouldBeSecure(),
    sameSite: 'lax',
    path: '/',
  };
  if (typeof maxAgeMs === 'number') {
    opts.maxAge = maxAgeMs;
  } else if (rememberMe) {
    opts.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  }
  res.cookie(SESSION_COOKIE_NAME, signedValue, opts);
}
