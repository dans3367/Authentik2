import { Router } from 'express';
import { db } from '../db';
import { and, eq } from 'drizzle-orm';
import { promotions, tenants, companies, masterEmailDesign, blogDesign } from '@shared/schema';
import rateLimit from 'express-rate-limit';
import { sanitizeEmailHtml } from './email';

export const publicPromotionRoutes = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

publicPromotionRoutes.use(limiter);

async function getBrandingForTenant(tenantId: string, tenantName: string) {
  const company = await db.query.companies.findFirst({
    where: eq(companies.tenantId, tenantId),
  });

  const blogDesignRow = await db.query.blogDesign.findFirst({
    where: eq(blogDesign.tenantId, tenantId),
  });

  const designRow = blogDesignRow || await db.query.masterEmailDesign.findFirst({
    where: eq(masterEmailDesign.tenantId, tenantId),
  });

  let socialLinks: Record<string, string> | null = null;
  if (designRow?.socialLinks) {
    try {
      const parsed = JSON.parse(designRow.socialLinks);
      if (parsed && typeof parsed === 'object') socialLinks = parsed;
    } catch {}
  }

  return {
    companyName: designRow?.companyName || company?.name || tenantName,
    headerMode: designRow?.headerMode || 'logo',
    logoUrl: designRow?.logoUrl || null,
    logoSize: designRow?.logoSize || 'medium',
    logoAlignment: designRow?.logoAlignment || 'center',
    bannerUrl: designRow?.bannerUrl || null,
    showCompanyName: designRow?.showCompanyName || 'true',
    primaryColor: designRow?.primaryColor || '#3B82F6',
    secondaryColor: designRow?.secondaryColor || '#1E40AF',
    accentColor: designRow?.accentColor || '#10B981',
    fontFamily: designRow?.fontFamily || 'Arial, sans-serif',
    headerText: designRow?.headerText || null,
    footerText: designRow?.footerText || null,
    socialLinks,
    website: company?.website || null,
  };
}

/**
 * GET /api/public/promotions/:tenantSlug/:promotionId/terms
 * Returns the promotion's Terms & Conditions HTML plus tenant branding for the blog-style view.
 */
publicPromotionRoutes.get('/:tenantSlug/:promotionId/terms', async (req, res) => {
  try {
    const { tenantSlug, promotionId } = req.params;

    const tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.slug, tenantSlug), eq(tenants.isActive, true)),
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Publication not found' });
    }

    const promotion = await db.query.promotions.findFirst({
      where: and(
        eq(promotions.id, promotionId),
        eq(promotions.tenantId, tenant.id),
      ),
    });

    if (!promotion || !promotion.termsContent || !promotion.termsContent.replace(/<[^>]*>/g, '').trim()) {
      return res.status(404).json({ message: 'Terms not found' });
    }

    const branding = await getBrandingForTenant(tenant.id, tenant.name);
    const sanitizedTerms = sanitizeEmailHtml(promotion.termsContent);

    res.json({
      tenant: { name: tenant.name, slug: tenant.slug },
      branding,
      promotion: {
        id: promotion.id,
        title: promotion.title,
        termsContent: sanitizedTerms,
        updatedAt: promotion.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Public Promotion] Error fetching terms:', error);
    res.status(500).json({ message: 'Failed to load promotion terms' });
  }
});
