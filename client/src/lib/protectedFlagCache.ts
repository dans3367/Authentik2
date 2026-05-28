// ---------------------------------------------------------------------------
// Short-lived localStorage flag cache for ProtectedRoute gating signals
// (onboarding completion, active subscription).
//
// Previous behaviour: `localStorage.setItem('subscriptionActive:<id>', 'true')`
// with no TTL meant a canceled / lapsed subscription kept granting access for
// the entire tab lifetime (and across reloads) until the key was manually
// cleared. Same shape for onboarding.
//
// Values are now wrapped as `{ v: true, exp: <ms-epoch> }`:
//   * Reads transparently return false on expiry (or any parse error) and
//     evict the stale key.
//   * Writes always stamp a fresh expiry.
//   * Legacy plain-`'true'` values are treated as expired and refreshed on
//     the next successful network check, so no migration step is needed.
//
// Tuned to 1 hour: short enough that a billing change in Stripe propagates
// quickly, long enough that day-to-day navigation skips the network.
// ---------------------------------------------------------------------------

export const PROTECTED_FLAG_TTL_MS = 60 * 60 * 1000;

export function readCachedFlag(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    // Reject legacy `'true'` values — they have no expiry, so we must
    // re-validate against the server at least once.
    if (raw === 'true') return false;
    const parsed = JSON.parse(raw) as { v?: boolean; exp?: number };
    if (!parsed || parsed.v !== true || typeof parsed.exp !== 'number') return false;
    if (Date.now() > parsed.exp) {
      localStorage.removeItem(key);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function writeCachedFlag(key: string): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ v: true, exp: Date.now() + PROTECTED_FLAG_TTL_MS }),
    );
  } catch {
    // Storage full / disabled — silent, we'll just re-check next time.
  }
}

export function clearCachedFlag(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Convenience builders so call sites don't drift on key naming.
export const onboardingCacheKey = (userId: string) => `onboardingCompleted:${userId}`;
export const subscriptionCacheKey = (userId: string) => `subscriptionActive:${userId}`;
