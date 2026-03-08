import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Calendar, ArrowRight, Globe, ExternalLink } from "lucide-react";

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

interface NewsletterSummary {
  id: string;
  title: string;
  subject: string;
  webSlug: string;
  publishedAt: string;
  createdAt: string;
}

interface PublicNewsletterListResponse {
  tenant: { name: string; slug: string };
  branding: Branding;
  newsletters: NewsletterSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const logoSizeMap: Record<string, string> = {
  small: "40px",
  medium: "56px",
  large: "72px",
  xlarge: "96px",
};

export default function PublicNewsletterHub() {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<PublicNewsletterListResponse>({
    queryKey: ["public-newsletters", tenantSlug, page],
    queryFn: async () => {
      const res = await fetch(`/api/public/newsletters/${tenantSlug}?page=${page}&limit=12`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!tenantSlug,
  });

  // Set page title
  useEffect(() => {
    if (data) {
      document.title = `${data.branding.companyName || data.tenant.name} — Newsletters`;
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
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Publication Not Found</h1>
        <p className="text-gray-500 text-center max-w-md">
          The newsletter publication you're looking for doesn't exist or is no longer available.
        </p>
      </div>
    );
  }

  const { branding, newsletters, pagination, tenant } = data;
  const logoHeight = logoSizeMap[branding.logoSize] || "56px";

  return (
    <div className="min-h-screen bg-gray-100" style={{ fontFamily: branding.fontFamily }}>
      {/* Boxed layout container */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Header */}
          {(branding.headerMode || 'logo') === 'banner' && branding.bannerUrl ? (
            <>
              <img
                src={branding.bannerUrl}
                alt={branding.companyName}
                className="w-full h-auto object-cover"
                style={{ maxHeight: '220px' }}
              />
              <div className="px-6 py-8 text-center" style={{ backgroundColor: branding.primaryColor }}>
                {(branding.showCompanyName || 'true') === 'true' && (
                  <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
                    {branding.companyName || tenant.name}
                  </h1>
                )}
                {branding.headerText && (
                  <p className="text-white/90 text-lg max-w-xl mx-auto leading-relaxed">
                    {branding.headerText}
                  </p>
                )}
                <div className="mt-4 text-white/70 text-sm font-medium uppercase tracking-wider">
                  Newsletter Archive
                </div>
              </div>
            </>
          ) : (
            <div className="px-6 py-10" style={{ backgroundColor: branding.primaryColor }}>
              <div className={`${branding.logoAlignment === 'left' ? 'text-left' : branding.logoAlignment === 'right' ? 'text-right' : 'text-center'}`}>
                {branding.logoUrl && (
                  <img
                    src={branding.logoUrl}
                    alt={branding.companyName}
                    className={`mb-4 object-contain ${branding.logoAlignment === 'left' ? '' : branding.logoAlignment === 'right' ? 'ml-auto' : 'mx-auto'}`}
                    style={{ height: logoHeight, width: "auto" }}
                  />
                )}
                {!branding.logoUrl && branding.companyName && (
                  <div
                    className={`mb-4 rounded-full flex items-center justify-center text-2xl font-bold ${branding.logoAlignment === 'left' ? '' : branding.logoAlignment === 'right' ? 'ml-auto' : 'mx-auto'}`}
                    style={{
                      width: "56px",
                      height: "56px",
                      backgroundColor: "rgba(255,255,255,0.2)",
                      color: "#ffffff",
                    }}
                  >
                    {branding.companyName.charAt(0)}
                  </div>
                )}
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
                  {branding.companyName || tenant.name}
                </h1>
                {branding.headerText && (
                  <p className="text-white/90 text-lg max-w-xl mx-auto leading-relaxed">
                    {branding.headerText}
                  </p>
                )}
                <div className="mt-4 text-white/70 text-sm font-medium uppercase tracking-wider">
                  Newsletter Archive
                </div>
              </div>
            </div>
          )}

          {/* Newsletter Grid */}
          <div className="px-6 py-10">
            {newsletters.length === 0 ? (
              <div className="text-center py-20">
                <Globe className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">No newsletters published yet</h2>
                <p className="text-gray-500">Check back soon for updates.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {newsletters.map((nl) => (
                    <article
                      key={nl.id}
                      onClick={() => navigate(`/n/${tenant.slug}/${nl.webSlug}`)}
                      className="group bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      {/* Color bar */}
                      <div className="h-1.5" style={{ backgroundColor: branding.primaryColor }} />
                      <div className="p-5">
                        <div className="flex items-center text-xs text-gray-400 mb-3">
                          <Calendar className="h-3.5 w-3.5 mr-1.5" />
                          {formatDate(nl.publishedAt)}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
                          {nl.title}
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                          {nl.subject}
                        </p>
                        <div className="flex items-center text-sm font-medium transition-colors"
                          style={{ color: branding.primaryColor }}
                        >
                          Read more
                          <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-10">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-500">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page >= pagination.totalPages}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
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
                {branding.website.replace(/^https?:\/\//, '')}
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
    </div>
  );
}
