import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and, desc, isNotNull } from 'drizzle-orm';
import { newsletters, tenants, companies, masterEmailDesign, blogDesign } from '@shared/schema';
import rateLimit from 'express-rate-limit';
import { sanitizeEmailHtml } from './email';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { getBrandingForTenant } from '../utils/tenantBranding';

export const publicNewsletterRoutes = Router();

const publicNewsletterRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

publicNewsletterRoutes.use(publicNewsletterRateLimiter);

/**
 * GET /api/public/newsletters/preview/:tenantSlug/:newsletterId
 * Preview route — requires authentication and tenant membership to prevent
 * unauthorized access to draft/unpublished newsletters.
 */
publicNewsletterRoutes.get('/preview/:tenantSlug/:newsletterId', authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { tenantSlug, newsletterId } = req.params;

    const tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.slug, tenantSlug), eq(tenants.isActive, true)),
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Publication not found' });
    }

    if (tenant.id !== req.user.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.id, newsletterId),
        eq(newsletters.tenantId, tenant.id),
        sql`${newsletters.deletedAt} IS NULL`,
      ),
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    const branding = await getBrandingForTenant(tenant.id, tenant.name);

    const sanitizedContent = newsletter.content ? sanitizeEmailHtml(newsletter.content) : '';

    res.json({
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
      },
      branding,
      newsletter: {
        id: newsletter.id,
        title: newsletter.title,
        subject: newsletter.subject,
        content: sanitizedContent,
        webSlug: newsletter.webSlug,
        publishedAt: newsletter.publishedAt,
        createdAt: newsletter.createdAt,
        preview: true,
      },
    });
  } catch (error) {
    console.error('[Public Newsletter] Error fetching preview newsletter:', error);
    res.status(500).json({ message: 'Failed to load newsletter preview' });
  }
});

/**
 * GET /api/public/newsletters/:tenantSlug
 * Returns the tenant branding info + list of published newsletters for the blog page.
 */
publicNewsletterRoutes.get("/:tenantSlug", async (req, res) => {
  try {
    const { tenantSlug } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const offset = (page - 1) * limit;

    // Look up tenant by slug
    const tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.slug, tenantSlug), eq(tenants.isActive, true)),
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Publication not found' });
    }

    const branding = await getBrandingForTenant(tenant.id, tenant.name);

    // Fetch published newsletters (only those with publishedAt set, not soft-deleted)
    const publishedNewsletters = await db
      .select({
        id: newsletters.id,
        title: newsletters.title,
        subject: newsletters.subject,
        webSlug: newsletters.webSlug,
        publishedAt: newsletters.publishedAt,
        createdAt: newsletters.createdAt,
      })
      .from(newsletters)
      .where(
        and(
          eq(newsletters.tenantId, tenant.id),
          isNotNull(newsletters.publishedAt),
          sql`${newsletters.deletedAt} IS NULL`,
          sql`${newsletters.webSlug} IS NOT NULL`,
        )
      )
      .orderBy(desc(newsletters.publishedAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsletters)
      .where(
        and(
          eq(newsletters.tenantId, tenant.id),
          isNotNull(newsletters.publishedAt),
          sql`${newsletters.deletedAt} IS NULL`,
          sql`${newsletters.webSlug} IS NOT NULL`,
        )
      );

    res.json({
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
      },
      branding,
      newsletters: publishedNewsletters,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('[Public Newsletter] Error fetching tenant newsletters:', error);
    res.status(500).json({ message: 'Failed to load newsletters' });
  }
});

/**
 * GET /api/public/newsletters/:tenantSlug/:webSlug
 * Returns a single published newsletter with full HTML content for web viewing.
 */
publicNewsletterRoutes.get("/:tenantSlug/:webSlug", async (req, res) => {
  try {
    const { tenantSlug, webSlug } = req.params;

    // Look up tenant by slug
    const tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.slug, tenantSlug), eq(tenants.isActive, true)),
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Publication not found' });
    }

    // Fetch the specific newsletter
    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.tenantId, tenant.id),
        eq(newsletters.webSlug, webSlug),
        isNotNull(newsletters.publishedAt),
        sql`${newsletters.deletedAt} IS NULL`,
      ),
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    const branding = await getBrandingForTenant(tenant.id, tenant.name);

    const sanitizedContent = newsletter.content ? sanitizeEmailHtml(newsletter.content) : '';

    res.json({
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
      },
      branding,
      newsletter: {
        id: newsletter.id,
        title: newsletter.title,
        subject: newsletter.subject,
        content: sanitizedContent,
        webSlug: newsletter.webSlug,
        publishedAt: newsletter.publishedAt,
        createdAt: newsletter.createdAt,
      },
    });
  } catch (error) {
    console.error('[Public Newsletter] Error fetching newsletter:', error);
    res.status(500).json({ message: 'Failed to load newsletter' });
  }
});
