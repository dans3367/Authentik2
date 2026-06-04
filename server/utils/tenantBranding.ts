import { eq } from 'drizzle-orm';
import { db } from '../db';
import { companies, masterEmailDesign, blogDesign } from '@shared/schema';

// Resolve a tenant's public-facing branding (logo, company name, colors, social
// links) from company + blog/email design settings. Shared by the public
// newsletter pages and the public booking page.
export async function getBrandingForTenant(tenantId: string, tenantName: string) {
  const company = await db.query.companies.findFirst({
    where: eq(companies.tenantId, tenantId),
  });

  // Prefer blog design settings; fall back to email design if blog design hasn't been configured
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
    pageBackgroundColor: (designRow as any)?.pageBackgroundColor || '#F3F4F6',
    fontFamily: designRow?.fontFamily || 'Arial, sans-serif',
    headerText: designRow?.headerText || null,
    footerText: designRow?.footerText || null,
    socialLinks,
    website: company?.website || null,
  };
}

export type TenantBranding = Awaited<ReturnType<typeof getBrandingForTenant>>;
