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
    return { success: true };
  }

  try {
    const body: Record<string, string> = { secret, response: token };
    if (remoteIp) body.remoteip = remoteIp;

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
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
    console.error('[Turnstile] Verification request failed:', error);
    // On network error, allow submission to avoid blocking legitimate users
    return { success: true };
  }
}
