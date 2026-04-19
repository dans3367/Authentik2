import type { Promotion } from '@shared/schema';

export function getPromotionTermsUrl(tenantSlug: string, promotionId: string): string {
  const baseUrl = process.env.APP_URL || 'http://localhost:5002';
  return `${baseUrl}/p/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(promotionId)}/terms`;
}

export function hasPromotionTerms(promotion: Pick<Promotion, 'termsContent'> | null | undefined): boolean {
  const raw = promotion?.termsContent;
  if (!raw) return false;
  const stripped = raw.replace(/<[^>]*>/g, '').trim();
  return stripped.length > 0;
}

/**
 * Append a "Terms and Conditions" link (pointing to the tenant blog terms page) to
 * the end of the promotion's HTML content. Safe no-op when the promotion has no
 * terms configured.
 */
export function appendPromotionTermsLink(
  html: string,
  promotion: Pick<Promotion, 'id' | 'termsContent'> | null | undefined,
  tenantSlug: string,
  linkColor: string = '#3B82F6',
): string {
  if (!promotion?.id || !hasPromotionTerms(promotion) || !tenantSlug) return html;
  const url = getPromotionTermsUrl(tenantSlug, promotion.id);
  const safeColor = /^#[0-9a-f]{3,8}$/i.test(linkColor) ? linkColor : '#3B82F6';
  const block = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;line-height:1.5;color:#6b7280;">
      <a href="${url}" style="color:${safeColor};text-decoration:underline;">Terms and Conditions</a>
    </div>`;
  return `${html}${block}`;
}
