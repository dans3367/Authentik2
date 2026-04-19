export type PromotionType = 'newsletter' | 'survey' | 'birthday' | 'announcement' | 'sale' | 'event';

export interface PromotionTypeTheme {
  border: string;        // Border color (Tailwind *-300 range)
  bgStart: string;       // Gradient start (Tailwind *-50)
  bgEnd: string;         // Gradient end (Tailwind *-100)
  accent: string;        // Link/accent color (Tailwind *-500/600)
  titleColor: string;    // Heading color (Tailwind *-900)
  bodyColor: string;     // Body text color
}

const THEMES: Record<PromotionType, PromotionTypeTheme> = {
  newsletter: { border: '#93c5fd', bgStart: '#eff6ff', bgEnd: '#dbeafe', accent: '#2563eb', titleColor: '#1e3a8a', bodyColor: '#1e40af' },
  survey:     { border: '#86efac', bgStart: '#f0fdf4', bgEnd: '#dcfce7', accent: '#16a34a', titleColor: '#14532d', bodyColor: '#166534' },
  birthday:   { border: '#f9a8d4', bgStart: '#fdf2f8', bgEnd: '#fce7f3', accent: '#db2777', titleColor: '#831843', bodyColor: '#9d174d' },
  announcement: { border: '#c4b5fd', bgStart: '#f5f3ff', bgEnd: '#ede9fe', accent: '#7c3aed', titleColor: '#4c1d95', bodyColor: '#5b21b6' },
  sale:       { border: '#fdba74', bgStart: '#fff7ed', bgEnd: '#ffedd5', accent: '#ea580c', titleColor: '#7c2d12', bodyColor: '#9a3412' },
  event:      { border: '#a5b4fc', bgStart: '#eef2ff', bgEnd: '#e0e7ff', accent: '#4f46e5', titleColor: '#312e81', bodyColor: '#3730a3' },
};

export function getPromotionTypeTheme(type: string | null | undefined): PromotionTypeTheme {
  return THEMES[(type as PromotionType)] ?? THEMES.newsletter;
}

/**
 * Render the inline-styled email wrapper that surrounds promotion content.
 * Used in both the admin preview (React) and the actual email HTML so what
 * the user sees in the wizard matches what recipients receive.
 */
export function renderPromotionEmailWrapper(params: {
  type: string | null | undefined;
  title: string;
  description?: string | null;
  contentHtml: string;
  termsUrl?: string | null;
  footerNote?: string;
}): string {
  const theme = getPromotionTypeTheme(params.type);
  const { title, description, contentHtml, termsUrl, footerNote } = params;
  const termsBlock = termsUrl
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid ${theme.border};text-align:center;font-size:12px;line-height:1.5;color:${theme.bodyColor};">
        <a href="${termsUrl}" style="color:${theme.accent};text-decoration:underline;">Terms and Conditions</a>
      </div>`
    : '';
  const footerBlock = footerNote
    ? `<hr style="margin:32px 0 16px;border:none;border-top:1px solid ${theme.border};" />
       <p style="margin:0;font-size:0.85rem;color:${theme.bodyColor};opacity:0.75;text-align:center;">${footerNote}</p>`
    : '';
  const descBlock = description
    ? `<p style="margin:0 0 20px;color:${theme.bodyColor};font-size:1rem;line-height:1.5;">${description}</p>`
    : '';

  return `<div style="max-width:600px;margin:20px auto;padding:32px 24px;background:linear-gradient(135deg, ${theme.bgStart} 0%, ${theme.bgEnd} 100%);border:2px solid ${theme.border};border-radius:12px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <h2 style="font-size:1.5rem;font-weight:700;margin:0 0 16px;color:${theme.titleColor};">${title}</h2>
    ${descBlock}
    <div style="color:${theme.bodyColor};font-size:1rem;line-height:1.6;">${contentHtml}</div>
    ${termsBlock}
    ${footerBlock}
  </div>`;
}
