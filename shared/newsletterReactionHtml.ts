/**
 * Newsletter Reaction HTML Builder
 * 
 * Shared module for generating reaction buttons HTML to be appended to newsletter emails.
 * Each recipient gets a unique reaction token so their vote is attributed to them.
 * 
 * IMPORTANT: This is the single source of truth for reaction token generation and HTML building.
 * Both server/ and src/trigger/ import from this shared module to ensure consistency.
 */

import { createHmac, randomBytes } from 'crypto';

/** Reaction types supported by the newsletter system */
export const REACTION_TYPES = ['love_it', 'liked_it', 'cool', 'dont_agree', 'dislike'] as const;
export type ReactionType = typeof REACTION_TYPES[number];

/** Reaction configuration for building buttons */
export const REACTIONS: ReadonlyArray<{ type: ReactionType; emoji: string; label: string }> = [
    { type: 'love_it', emoji: '❤️', label: 'Love it' },
    { type: 'liked_it', emoji: '👍', label: 'Liked it' },
    { type: 'cool', emoji: '😎', label: 'Cool' },
    { type: 'dont_agree', emoji: '🤔', label: "Don't agree" },
    { type: 'dislike', emoji: '👎', label: 'Dislike' },
] as const;

function getReactionTokenSecret(): string | null {
    return process.env.NEWSLETTER_REACTION_TOKEN_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || null;
}

/**
 * Generate a reaction token for a specific recipient.
 * Format: base64url(recipientId|newsletterId|expiresAtMs|nonce).base64url(hmac(payload))
 *
 * Security: token does not embed email (PII) and cannot be forged without the server secret.
 */
export function generateReactionToken(recipientId: string, newsletterId: string): string {
    const secret = getReactionTokenSecret();

    if (!secret) {
        throw new Error('Missing reaction token secret. Set NEWSLETTER_REACTION_TOKEN_SECRET (or SESSION_SECRET/JWT_SECRET).');
    }

    const ttlDaysRaw = Number(process.env.NEWSLETTER_REACTION_TOKEN_TTL_DAYS || '90');
    const ttlDays = Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0 ? Math.floor(ttlDaysRaw) : 90;
    const expiresAtMs = Date.now() + (ttlDays * 24 * 60 * 60 * 1000);
    const nonce = randomBytes(16).toString('base64url');
    const payload = `${recipientId}|${newsletterId}|${expiresAtMs}|${nonce}`;
    const payloadEncoded = Buffer.from(payload, 'utf-8').toString('base64url');
    const signature = createHmac('sha256', secret).update(payloadEncoded).digest('base64url');

    return `${payloadEncoded}.${signature}`;
}

/**
 * Build the HTML for the reaction buttons section to be inserted into newsletter emails.
 * Uses inline styles for maximum email client compatibility.
 */
export function buildReactionButtonsHtml(
    baseUrl: string,
    newsletterId: string,
    recipientId: string,
): string {
    const reactionToken = generateReactionToken(recipientId, newsletterId);

    const buttonHtml = REACTIONS.map(r => {
        const url = `${baseUrl}/api/newsletter-reactions/react?token=${encodeURIComponent(reactionToken)}&type=${r.type}&nid=${encodeURIComponent(newsletterId)}`;
        return `
      <td style="padding: 0 4px;">
        <a href="${url}" target="_blank" style="display: inline-block; text-decoration: none; text-align: center; padding: 8px 6px; min-width: 56px; border-radius: 12px; background-color: #f1f5f9; border: 1px solid #e2e8f0; transition: all 0.2s;">
          <span style="display: block; font-size: 24px; line-height: 1.2;">${r.emoji}</span>
          <span style="display: block; font-size: 10px; color: #64748b; margin-top: 2px; white-space: nowrap;">${r.label}</span>
        </a>
      </td>`;
    }).join('');

    return `
    <!-- Newsletter Reaction Buttons -->
    <div style="padding: 24px 24px 8px 24px; text-align: center; background-color: #ffffff; border-top: 1px solid #f1f5f9;">
      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #475569; letter-spacing: 0.025em;">
        How did you like this newsletter?
      </p>
      <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
        <tr>
          ${buttonHtml}
        </tr>
      </table>
      <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">
        Click an emoji to share your feedback
      </p>
    </div>`;
}
