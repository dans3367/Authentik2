/**
 * Cloudflare Turnstile verification utility
 *
 * Verifies CAPTCHA tokens with Cloudflare's siteverify endpoint.
 * Gracefully degrades if TURNSTILE_SECRET_KEY is not configured.
 */

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<{ success: boolean; errorCodes?: string[] }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Graceful degradation: if no secret key configured, skip verification
  if (!secret) {
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY not configured — skipping verification');
    return { success: true };
  }

  const body: Record<string, string> = { secret, response: token };
  if (remoteIp) body.remoteip = remoteIp;

  // Attempt verification with one retry on network failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
        signal: AbortSignal.timeout(5000),
      });

      const data: TurnstileVerifyResponse = await res.json();

      if (!data.success) {
        console.warn('[Turnstile] Verification failed:', data['error-codes']);
      }

      return {
        success: data.success,
        errorCodes: data['error-codes'],
      };
    } catch (error) {
      console.error(`[Turnstile] Verification request failed (attempt ${attempt}/2):`, error);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  // Fail closed: reject submission when Cloudflare is unreachable
  console.error('[Turnstile] All verification attempts failed — rejecting submission');
  return { success: false, errorCodes: ['network-error'] };
}
