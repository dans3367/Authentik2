/**
 * Newsletter Reactions Routes
 * 
 * Public endpoint for recipients to react to newsletters via emoji buttons in emails.
 * Authenticated endpoint for fetching reaction stats on the dashboard.
 */

import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and } from 'drizzle-orm';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { newsletters, newsletterReactions, NEWSLETTER_REACTION_TYPES } from '@shared/schema';
import type { NewsletterReactionType } from '@shared/schema';

export const newsletterReactionRoutes = Router();

// ── Reaction metadata ──────────────────────────────────────────────────────

const REACTION_META: Record<NewsletterReactionType, { emoji: string; label: string }> = {
    love_it: { emoji: '❤️', label: 'Love it' },
    liked_it: { emoji: '👍', label: 'Liked it' },
    cool: { emoji: '😎', label: 'Cool' },
    dont_agree: { emoji: '🤔', label: "Don't agree" },
    dislike: { emoji: '👎', label: 'Dislike' },
};

// ── Public: Submit a reaction (called from email links) ────────────────────

/**
 * GET /api/newsletter-reactions/react
 * 
 * Public endpoint. The reaction link in the email encodes:
 *   ?token=<reactionToken>&type=<reactionType>&nid=<newsletterId>
 * 
 * This serves an HTML page that records the reaction and shows a thank-you message.
 * Using GET so it works as a simple link click in email clients.
 */
newsletterReactionRoutes.get('/react', async (req, res) => {
    const { token, type, nid } = req.query;

    // Validate inputs
    if (!token || !type || !nid) {
        return res.status(400).send(buildReactionPage('error', 'Invalid reaction link. Missing required parameters.'));
    }

    const reactionType = String(type) as NewsletterReactionType;
    if (!NEWSLETTER_REACTION_TYPES.includes(reactionType)) {
        return res.status(400).send(buildReactionPage('error', 'Invalid reaction type.'));
    }

    const newsletterId = String(nid);
    const reactionToken = String(token);

    try {
        // Find the newsletter
        const newsletter = await db.query.newsletters.findFirst({
            where: eq(newsletters.id, newsletterId),
        });

        if (!newsletter) {
            return res.status(404).send(buildReactionPage('error', 'Newsletter not found.'));
        }

        if (!newsletter.reactionsEnabled) {
            return res.status(400).send(buildReactionPage('error', 'Reactions are not enabled for this newsletter.'));
        }

        // Extract tenant ID from the newsletter
        const tenantId = newsletter.tenantId;

        // Decode the email from the token (format: base64(email):randomPart)
        let recipientEmail: string;
        try {
            const tokenParts = reactionToken.split(':');
            recipientEmail = Buffer.from(tokenParts[0], 'base64url').toString('utf-8');
        } catch {
            return res.status(400).send(buildReactionPage('error', 'Invalid reaction token.'));
        }

        // Check if this user already reacted (upsert: update their reaction)
        const existingReaction = await db.query.newsletterReactions.findFirst({
            where: and(
                eq(newsletterReactions.newsletterId, newsletterId),
                eq(newsletterReactions.recipientEmail, recipientEmail),
            ),
        });

        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
        const userAgent = req.headers['user-agent'] || null;

        if (existingReaction) {
            // Update existing reaction
            await db.update(newsletterReactions)
                .set({
                    reactionType: reactionType,
                    ipAddress: ipAddress,
                    userAgent: userAgent,
                    reactedAt: new Date(),
                })
                .where(eq(newsletterReactions.id, existingReaction.id));
        } else {
            // Insert new reaction
            await db.insert(newsletterReactions).values({
                tenantId,
                newsletterId,
                recipientEmail,
                reactionType: reactionType,
                reactionToken,
                ipAddress: ipAddress,
                userAgent: userAgent,
                reactedAt: new Date(),
            });
        }

        const meta = REACTION_META[reactionType];
        const updatedMsg = existingReaction ? ' Your previous reaction has been updated.' : '';
        return res.send(buildReactionPage(
            'success',
            `Thank you for your feedback!${updatedMsg}`,
            meta.emoji,
            meta.label,
        ));
    } catch (error: any) {
        console.error('[Newsletter Reactions] Error recording reaction:', error);

        // Handle unique constraint violation (race condition)
        if (error.code === '23505') {
            const meta = REACTION_META[reactionType];
            return res.send(buildReactionPage('success', 'Your reaction has been recorded!', meta.emoji, meta.label));
        }

        return res.status(500).send(buildReactionPage('error', 'Something went wrong. Please try again later.'));
    }
});

// ── Authenticated: Get reaction stats for a newsletter ─────────────────────

/**
 * GET /api/newsletter-reactions/:newsletterId/stats
 * 
 * Returns aggregated reaction counts and recent reactions for a specific newsletter.
 */
newsletterReactionRoutes.get('/:newsletterId/stats', authenticateToken, requireTenant, async (req: any, res) => {
    try {
        const { newsletterId } = req.params;
        const tenantId = req.user.tenantId;

        // Verify newsletter belongs to tenant
        const newsletter = await db.query.newsletters.findFirst({
            where: and(eq(newsletters.id, newsletterId), eq(newsletters.tenantId, tenantId)),
        });

        if (!newsletter) {
            return res.status(404).json({ message: 'Newsletter not found' });
        }

        // Get aggregated counts per reaction type
        const countResults = await db.execute(sql`
      SELECT reaction_type, COUNT(*) as count
      FROM newsletter_reactions
      WHERE newsletter_id = ${newsletterId} AND tenant_id = ${tenantId}
      GROUP BY reaction_type
      ORDER BY count DESC
    `);

        // Build counts object with all types initialized to 0
        const counts: Record<string, number> = {};
        let totalReactions = 0;
        for (const type of NEWSLETTER_REACTION_TYPES) {
            counts[type] = 0;
        }
        for (const row of countResults.rows as any[]) {
            counts[row.reaction_type] = parseInt(row.count, 10);
            totalReactions += parseInt(row.count, 10);
        }

        // Get recent reactions (last 20)
        const recentReactions = await db.execute(sql`
      SELECT id, recipient_email, reaction_type, reacted_at
      FROM newsletter_reactions
      WHERE newsletter_id = ${newsletterId} AND tenant_id = ${tenantId}
      ORDER BY reacted_at DESC
      LIMIT 20
    `);

        // Calculate sentiment score (1=very negative, 5=very positive)
        const sentimentWeights: Record<string, number> = {
            love_it: 5,
            liked_it: 4,
            cool: 3,
            dont_agree: 2,
            dislike: 1,
        };
        let sentimentScore = 0;
        if (totalReactions > 0) {
            let weightedSum = 0;
            for (const [type, count] of Object.entries(counts)) {
                weightedSum += (sentimentWeights[type] || 3) * count;
            }
            sentimentScore = Math.round((weightedSum / totalReactions) * 10) / 10;
        }

        // Determine dominant sentiment
        let dominantReaction: string | null = null;
        let maxCount = 0;
        for (const [type, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantReaction = type;
            }
        }

        res.json({
            newsletterId,
            reactionsEnabled: newsletter.reactionsEnabled,
            totalReactions,
            counts,
            sentimentScore,
            dominantReaction,
            recentReactions: (recentReactions.rows as any[]).map(r => ({
                id: r.id,
                recipientEmail: r.recipient_email,
                reactionType: r.reaction_type,
                reactedAt: r.reacted_at,
            })),
            reactionMeta: REACTION_META,
        });
    } catch (error) {
        console.error('[Newsletter Reactions] Error fetching stats:', error);
        res.status(500).json({ message: 'Failed to fetch reaction stats' });
    }
});

// ── Authenticated: Toggle reactions for a newsletter ───────────────────────

/**
 * PUT /api/newsletter-reactions/:newsletterId/toggle
 * 
 * Enable or disable reactions for a specific newsletter.
 */
newsletterReactionRoutes.put('/:newsletterId/toggle', authenticateToken, requireTenant, async (req: any, res) => {
    try {
        const { newsletterId } = req.params;
        const { enabled } = req.body;
        const tenantId = req.user.tenantId;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ message: 'enabled must be a boolean' });
        }

        const newsletter = await db.query.newsletters.findFirst({
            where: and(eq(newsletters.id, newsletterId), eq(newsletters.tenantId, tenantId)),
        });

        if (!newsletter) {
            return res.status(404).json({ message: 'Newsletter not found' });
        }

        await db.update(newsletters)
            .set({ reactionsEnabled: enabled, updatedAt: new Date() })
            .where(eq(newsletters.id, newsletterId));

        res.json({
            message: `Reactions ${enabled ? 'enabled' : 'disabled'} for newsletter`,
            newsletterId,
            reactionsEnabled: enabled,
        });
    } catch (error) {
        console.error('[Newsletter Reactions] Error toggling reactions:', error);
        res.status(500).json({ message: 'Failed to toggle reactions' });
    }
});

// ── HTML Page Builder ──────────────────────────────────────────────────────

function buildReactionPage(
    status: 'success' | 'error',
    message: string,
    emoji?: string,
    label?: string,
): string {
    const isSuccess = status === 'success';
    const bgGradient = isSuccess
        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isSuccess ? 'Thank You!' : 'Oops!'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: ${bgGradient};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 48px 40px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      animation: fadeUp 0.6s ease-out;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .emoji {
      font-size: 72px;
      margin-bottom: 20px;
      animation: bounceIn 0.8s ease-out 0.3s both;
    }
    @keyframes bounceIn {
      0% { opacity: 0; transform: scale(0.3); }
      50% { opacity: 1; transform: scale(1.1); }
      70% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    .label {
      font-size: 14px;
      font-weight: 600;
      color: #7c3aed;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 12px;
      line-height: 1.3;
    }
    p {
      font-size: 16px;
      color: #64748b;
      line-height: 1.6;
    }
    .close-note {
      margin-top: 24px;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${isSuccess ? (emoji || '🎉') : '😕'}</div>
    ${isSuccess && label ? `<div class="label">${label}</div>` : ''}
    <h1>${isSuccess ? 'Thank You!' : 'Something Went Wrong'}</h1>
    <p>${message}</p>
    <p class="close-note">You can safely close this page.</p>
  </div>
</body>
</html>`;
}
