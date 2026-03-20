import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Calendar, ArrowRight, Globe, ExternalLink, Sun, Moon } from "lucide-react";

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
  pageBackgroundColor?: string;
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

export default function PublicNewsletterHub() {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug;
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const { dark, toggle: toggleTheme } = useBlogTheme();

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
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${dark ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
        <Globe className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Publication Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          The newsletter publication you're looking for doesn't exist or is no longer available.
        </p>
      </div>
    );
  }

  const { branding, newsletters, pagination, tenant } = data;
  const logoHeight = logoSizeMap[branding.logoSize] || "56px";

  return (
    <div className={`min-h-screen ${dark ? 'dark' : ''}`} style={{ fontFamily: branding.fontFamily }}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
      {/* Boxed layout container */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors duration-300">

          {/* Header */}
          {(branding.headerMode || 'logo') === 'banner' && branding.bannerUrl ? (
            <>
              <img
                src={branding.bannerUrl}
                alt={branding.companyName}
                className="w-full h-auto object-cover"
                style={{ maxHeight: '220px' }}
              />
              <div className="px-6 py-8 text-center relative" style={{ backgroundColor: branding.primaryColor }}>
                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                  aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
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
            <div className="px-6 py-10 relative" style={{ backgroundColor: branding.primaryColor }}>
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
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
                <Globe className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">No newsletters published yet</h2>
                <p className="text-gray-500 dark:text-gray-400">Check back soon for updates.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {newsletters.map((nl) => (
                    <article
                      key={nl.id}
                      onClick={() => navigate(`/n/${tenant.slug}/${nl.webSlug}`)}
                      className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20 transition-all duration-200 cursor-pointer"
                    >
                      {/* Color bar */}
                      <div className="h-1.5" style={{ backgroundColor: branding.primaryColor }} />
                      <div className="p-5">
                        <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 mb-3">
                          <Calendar className="h-3.5 w-3.5 mr-1.5" />
                          {formatDate(nl.publishedAt)}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-2">
                          {nl.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
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
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page >= pagination.totalPages}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
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
                {branding.website.replace(/^https?:\/\//, '')}
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
    </div>
  );
}
