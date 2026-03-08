import { useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Calendar, ArrowLeft, Globe, ExternalLink } from "lucide-react";

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

interface NewsletterDetail {
  id: string;
  title: string;
  subject: string;
  content: string;
  webSlug: string;
  publishedAt: string;
  createdAt: string;
}

interface PublicNewsletterViewResponse {
  tenant: { name: string; slug: string };
  branding: Branding;
  newsletter: NewsletterDetail;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Unpublished";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Unpublished";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const logoSizeMap: Record<string, string> = {
  small: "36px",
  medium: "48px",
  large: "60px",
  xlarge: "72px",
};

export default function PublicNewsletterView() {
  const params = useParams<{ tenantSlug: string; newsletterSlug?: string; newsletterId?: string }>();
  const { tenantSlug, newsletterSlug, newsletterId } = params;
  const [, navigate] = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const isPreviewRoute = Boolean(newsletterId);

  const { data, isLoading, isError } = useQuery<PublicNewsletterViewResponse>({
    queryKey: ["public-newsletter", tenantSlug, newsletterSlug, newsletterId],
    queryFn: async () => {
      const endpoint = isPreviewRoute
        ? `/api/public/newsletters/preview/${tenantSlug}/${newsletterId}`
        : `/api/public/newsletters/${tenantSlug}/${newsletterSlug}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!tenantSlug && (!!newsletterSlug || !!newsletterId),
  });

  // Set page title
  useEffect(() => {
    if (data) {
      document.title = `${data.newsletter.title} — ${data.branding.companyName || data.tenant.name}`;
    }
  }, [data]);

  // Process newsletter content: strip outer HTML/body wrappers so it renders inline
  useEffect(() => {
    if (data && contentRef.current) {
      let html = data.newsletter.content || "";
      // Strip doctype, html, head, body wrappers if present (content was stored as full email HTML)
      html = html.replace(/<!DOCTYPE[^>]*>/i, "");
      html = html.replace(/<html[^>]*>/i, "").replace(/<\/html>/i, "");
      html = html.replace(/<head[^>]*>[\s\S]*?<\/head>/i, "");
      html = html.replace(/<body[^>]*>/i, "").replace(/<\/body>/i, "");
      contentRef.current.innerHTML = html;
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <Globe className="h-16 w-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Newsletter Not Found</h1>
        <p className="text-gray-500 text-center max-w-md">
          This newsletter doesn't exist or is no longer available.
        </p>
      </div>
    );
  }

  const { branding, newsletter, tenant } = data;
  const logoHeight = logoSizeMap[branding.logoSize] || "48px";
  const displayDate = newsletter.publishedAt || newsletter.createdAt;

  return (
    <div className="min-h-screen bg-gray-100" style={{ fontFamily: branding.fontFamily }}>
      {/* Boxed layout container */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

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
                  All Newsletters
                </button>
                {(branding.showCompanyName || 'true') === 'true' && branding.companyName && (
                  <span className="text-white font-semibold text-sm">
                    {branding.companyName}
                  </span>
                )}
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
                All Newsletters
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
              </div>
            </div>
          )}

          {/* Article */}
          <div className="px-6 md:px-10 py-10">
            {/* Title section */}
            <div className="mb-8">
              <div className="flex items-center text-sm text-gray-400 mb-4">
                <Calendar className="h-4 w-4 mr-2" />
                {formatDate(displayDate)}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-3">
                {newsletter.title}
              </h1>
              {newsletter.subject !== newsletter.title && (
                <p className="text-lg text-gray-500 leading-relaxed">
                  {newsletter.subject}
                </p>
              )}
              <div
                className="mt-6 h-1 w-16 rounded-full"
                style={{ backgroundColor: branding.primaryColor }}
              />
            </div>

            {/* Newsletter content */}
            <div
              ref={contentRef}
              className="newsletter-web-content prose prose-gray max-w-none"
              style={{
                fontFamily: branding.fontFamily,
                fontSize: "16px",
                lineHeight: "1.75",
                color: "#334155",
              }}
            />

            {/* Back to all newsletters */}
            <div className="mt-10 text-center">
              <button
                onClick={() => navigate(`/n/${tenant.slug}`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to all newsletters
              </button>
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-gray-200 px-6 py-8 text-center">
            {branding.socialLinks && (
              <div className="flex items-center justify-center gap-4 mb-4">
                {branding.socialLinks.facebook && (
                  <a href={branding.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">Facebook</a>
                )}
                {branding.socialLinks.twitter && (
                  <a href={branding.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">Twitter</a>
                )}
                {branding.socialLinks.instagram && (
                  <a href={branding.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">Instagram</a>
                )}
                {branding.socialLinks.linkedin && (
                  <a href={branding.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">LinkedIn</a>
                )}
              </div>
            )}
            {branding.website && (
              <a
                href={branding.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {branding.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {branding.footerText && (
              <p className="text-xs text-gray-400 mt-2">{branding.footerText}</p>
            )}
            {!branding.footerText && branding.companyName && (
              <p className="text-xs text-gray-400 mt-2">
                &copy; {new Date().getFullYear()} {branding.companyName}. All rights reserved.
              </p>
            )}
          </footer>
        </div>
      </div>

      {/* Scoped styles for newsletter content */}
      <style>{`
        .newsletter-web-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }
        .newsletter-web-content a {
          color: ${branding.primaryColor};
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .newsletter-web-content a:hover {
          opacity: 0.8;
        }
        .newsletter-web-content table {
          width: 100%;
          border-collapse: collapse;
        }
        .newsletter-web-content td {
          vertical-align: top;
        }
        .newsletter-web-content h1, .newsletter-web-content h2, .newsletter-web-content h3 {
          color: #1e293b;
          font-weight: 700;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .newsletter-web-content p {
          margin-bottom: 1em;
        }
        .newsletter-web-content blockquote {
          border-left: 3px solid ${branding.primaryColor};
          padding-left: 1em;
          margin-left: 0;
          color: #64748b;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
