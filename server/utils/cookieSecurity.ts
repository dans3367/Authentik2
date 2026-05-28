/**
 * Derive whether outgoing cookies should be marked Secure.
 *
 * Priority (highest first):
 *   1. COOKIES_SECURE=true  → always Secure (explicit opt-in).
 *   2. COOKIES_SECURE=false → never Secure (explicit override, e.g.
 *      reverse-proxied dev tunnels that need cleartext cookies).
 *   3. BASE_URL starts with https:// → Secure (infer from public URL).
 *   4. NODE_ENV === 'production' → Secure (defensive default).
 *   5. Otherwise → false.
 *
 * Tying Secure purely to NODE_ENV (as the codebase did historically)
 * silently downgrades cookie security in any staging / preview env that
 * forgets to set NODE_ENV=production, even when the env is served over
 * HTTPS. Centralising the rule here means every Set-Cookie site agrees.
 */
export function cookiesShouldBeSecure(): boolean {
  if (process.env.COOKIES_SECURE === 'true') return true;
  if (process.env.COOKIES_SECURE === 'false') return false;
  if (process.env.BASE_URL?.startsWith('https://')) return true;
  return process.env.NODE_ENV === 'production';
}
