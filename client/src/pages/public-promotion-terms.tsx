import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Globe, ExternalLink, Sun, Moon, ScrollText } from "lucide-react";

interface Branding {
  companyName: string;
  headerMode: string;
  logoUrl: string | null;
  logoSize: string;
  logoAlignment: string;
  bannerUrl: string | null;
  showCompanyName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerText: string | null;
  footerText: string | null;
  socialLinks: Record<string, string> | null;
  website: string | null;
}

interface PromotionTerms {
  id: string;
  title: string;
  termsContent: string;
  updatedAt: string | null;
}

interface PublicPromotionTermsResponse {
  tenant: { name: string; slug: string };
  branding: Branding;
  promotion: PromotionTerms;
}

const logoSizeMap: Record<string, string> = {
  small: "36px",
  medium: "48px",
  large: "60px",
  xlarge: "72px",
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function useBlogTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('blog-theme') === 'dark'; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setDark(prev => {
      const next = !prev;
      try { localStorage.setItem('blog-theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  }, []);
  return { dark, toggle };
}

export default function PublicPromotionTerms() {
  const params = useParams<{ tenantSlug: string; promotionId: string }>();
  const { tenantSlug, promotionId } = params;
  const [, navigate] = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const { dark, toggle: toggleTheme } = useBlogTheme();

  const { data, isLoading, isError } = useQuery<PublicPromotionTermsResponse>({
    queryKey: ["public-promotion-terms", tenantSlug, promotionId],
    queryFn: async () => {
      const res = await fetch(`/api/public/promotions/${tenantSlug}/${promotionId}/terms`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!tenantSlug && !!promotionId,
  });

  useEffect(() => {
    if (data) {
      document.title = `Terms & Conditions — ${data.promotion.title} — ${data.branding.companyName || data.tenant.name}`;
    }
  }, [data]);

  useEffect(() => {
    if (data && contentRef.current) {
      contentRef.current.innerHTML = data.promotion.termsContent || '';
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${dark ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
        <Globe className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Terms Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          These terms don't exist or are no longer available.
        </p>
      </div>
    );
  }

  const { branding, promotion, tenant } = data;
  const logoHeight = logoSizeMap[branding.logoSize] || "48px";

  return (
    <div className={`min-h-screen ${dark ? 'dark' : ''}`} style={{ fontFamily: branding.fontFamily }}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors duration-300">

            {/* Header */}
            {(branding.headerMode || 'logo') === 'banner' && branding.bannerUrl ? (
              <>
                <img
                  src={branding.bannerUrl}
                  alt={branding.companyName}
                  className="w-full h-auto object-cover"
                  style={{ maxHeight: '200px' }}
                />
                <div
                  className="px-6 py-3 flex items-center justify-between"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  <button
                    onClick={() => navigate(`/n/${tenant.slug}`)}
                    className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to blog
                  </button>
                  <div className="flex items-center gap-3">
                    {(branding.showCompanyName || 'true') === 'true' && branding.companyName && (
                      <span className="text-white font-semibold text-sm">
                        {branding.companyName}
                      </span>
                    )}
                    <button
                      onClick={toggleTheme}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div
                className="px-6 py-3 flex items-center justify-between"
                style={{ backgroundColor: branding.primaryColor }}
              >
                <button
                  onClick={() => navigate(`/n/${tenant.slug}`)}
                  className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to blog
                </button>
                <div className="flex items-center gap-3">
                  {branding.logoUrl && (
                    <img
                      src={branding.logoUrl}
                      alt={branding.companyName}
                      className="object-contain"
                      style={{ height: logoHeight, width: "auto" }}
                    />
                  )}
                  {!branding.logoUrl && branding.companyName && (
                    <span className="text-white font-semibold text-sm">
                      {branding.companyName}
                    </span>
                  )}
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                    aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Article */}
            <div className="px-6 md:px-10 py-10">
              <div className="mb-8">
                <div className="flex items-center text-sm text-gray-400 dark:text-gray-500 mb-4">
                  <ScrollText className="h-4 w-4 mr-2" />
                  Terms &amp; Conditions
                  {promotion.updatedAt && (
                    <span className="ml-2">· Last updated {formatDate(promotion.updatedAt)}</span>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight leading-tight mb-3">
                  {promotion.title}
                </h1>
                <div
                  className="mt-6 h-1 w-16 rounded-full"
                  style={{ backgroundColor: branding.primaryColor }}
                />
              </div>

              <div
                ref={contentRef}
                className={`promotion-terms-content prose max-w-none ${dark ? 'prose-invert' : 'prose-gray'}`}
                style={{
                  fontFamily: branding.fontFamily,
                  fontSize: "16px",
                  lineHeight: "1.75",
                  color: dark ? "#cbd5e1" : "#334155",
                }}
              />

              <div className="mt-10 text-center">
                <button
                  onClick={() => navigate(`/n/${tenant.slug}`)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to blog
                </button>
              </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-gray-200 dark:border-gray-800 px-6 py-8 text-center">
              {branding.socialLinks && (
                <div className="flex items-center justify-center gap-4 mb-4">
                  {branding.socialLinks.facebook && (
                    <a href={branding.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm font-medium transition-colors">Facebook</a>
                  )}
                  {branding.socialLinks.twitter && (
                    <a href={branding.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm font-medium transition-colors">Twitter</a>
                  )}
                  {branding.socialLinks.instagram && (
                    <a href={branding.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm font-medium transition-colors">Instagram</a>
                  )}
                  {branding.socialLinks.linkedin && (
                    <a href={branding.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm font-medium transition-colors">LinkedIn</a>
                  )}
                </div>
              )}
              {branding.website && (
                <a
                  href={branding.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-3"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {branding.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {branding.footerText && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{branding.footerText}</p>
              )}
              {!branding.footerText && branding.companyName && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  &copy; {new Date().getFullYear()} {branding.companyName}. All rights reserved.
                </p>
              )}
            </footer>
          </div>
        </div>
      </div>

      <style>{`
        .promotion-terms-content a {
          color: ${branding.primaryColor};
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .promotion-terms-content a:hover { opacity: 0.8; }
        .promotion-terms-content h1, .promotion-terms-content h2, .promotion-terms-content h3 {
          color: ${dark ? '#f1f5f9' : '#1e293b'} !important;
          font-weight: 700;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .promotion-terms-content p { margin-bottom: 1em; }
        .promotion-terms-content ul, .promotion-terms-content ol { margin-left: 1.5em; margin-bottom: 1em; }
        .promotion-terms-content blockquote {
          border-left: 3px solid ${branding.primaryColor};
          padding-left: 1em;
          margin-left: 0;
          color: ${dark ? '#94a3b8' : '#64748b'} !important;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
