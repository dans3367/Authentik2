/**
 * Newsletter Reaction HTML Builder
 * 
 * Generates the reaction buttons HTML block to be appended to newsletter emails.
 * Each recipient gets a unique reaction token so their vote is attributed to them.
 */

/**
 * Generate a reaction token for a specific recipient.
 * Format: base64url(email):randomPart
 */
export function generateReactionToken(email: string): string {
    const emailEncoded = Buffer.from(email, 'utf-8').toString('base64url');
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `${emailEncoded}:${randomPart}`;
}

/**
 * Build the HTML for the reaction buttons section to be inserted into newsletter emails.
 * Uses inline styles for maximum email client compatibility.
 */
export function buildReactionButtonsHtml(
    baseUrl: string,
    newsletterId: string,
    recipientEmail: string,
): string {
    const reactionToken = generateReactionToken(recipientEmail);

    const reactions = [
        { type: 'love_it', emoji: '❤️', label: 'Love it' },
        { type: 'liked_it', emoji: '👍', label: 'Liked it' },
        { type: 'cool', emoji: '😎', label: 'Cool' },
        { type: 'dont_agree', emoji: '🤔', label: "Don't agree" },
        { type: 'dislike', emoji: '👎', label: 'Dislike' },
    ];

    const buttonHtml = reactions.map(r => {
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
