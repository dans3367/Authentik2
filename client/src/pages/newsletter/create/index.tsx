import { useState, useEffect, useCallback } from "react";
import { Puck } from "@puckeditor/core";
import { useQuery } from "@tanstack/react-query";
import config, { initialData } from "@/config/puck";
import { UserData } from "@/config/puck/types";
import { Monitor, Tablet, Smartphone, ZoomIn, ZoomOut, Mail } from "lucide-react";
import { SendPreviewDialog } from "@/components/SendPreviewDialog";
import { extractPuckEmailHtml } from "@/utils/puck-to-email-html";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";

export default function NewsletterCreatePage() {
  const [data, setData] = useState<UserData>(initialData);
  const [isClient, setIsClient] = useState(false);
  const [isEdit, setIsEdit] = useState(true);
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [zoom, setZoom] = useState(100);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Stores the email-safe HTML captured from the editor DOM before switching to preview
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewViewport, setPreviewViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");

  // Fetch the tenant's master email design (same as Management > Email Design)
  const { data: emailDesign } = useQuery<{
    companyName: string;
    logoUrl?: string;
    logoSize?: string;
    showCompanyName?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    headerText?: string;
    footerText?: string;
    socialLinks?: { facebook?: string; twitter?: string; instagram?: string; linkedin?: string };
  }>({
    queryKey: ["/api/master-email-design"],
    queryFn: async () => {
      const response = await fetch('/api/master-email-design', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch email design');
      return response.json();
    },
  });

  const getHtmlContent = useCallback(() => {
    return extractPuckEmailHtml();
  }, []);

  useEffect(() => {
    setIsClient(true);

    // Always start with a clean canvas for new newsletters
    localStorage.removeItem("newsletter-puck-data");
  }, []);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    document.body.dataset.puckViewport = viewport;

    return () => {
      delete document.body.dataset.puckViewport;
    };
  }, [viewport, isClient]);

  const handlePublish = async (data: UserData) => {
    // Save to localStorage
    localStorage.setItem("newsletter-puck-data", JSON.stringify(data));
    setData(data);
    setIsEdit(false);
    alert("Newsletter published successfully!");
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 100));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 25));
  };

  const handleZoomReset = () => {
    setZoom(100);
  };

  if (!isClient) {
    return null;
  }

  const viewportWidths = {
    mobile: "360px",
    tablet: "768px",
    desktop: "100%",
  };

  if (isEdit) {
    return (
      <>
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          <Puck
            config={config}
            data={data}
            onPublish={handlePublish}
            headerPath="/newsletter/create"
            iframe={{
              enabled: false,
            }}
            overrides={{
              preview: ({ children }: { children: React.ReactNode }) => {
                const primaryColor = emailDesign?.primaryColor || '#3B82F6';
                const companyName = emailDesign?.companyName || '';
                const logoUrl = emailDesign?.logoUrl;
                const headerText = emailDesign?.headerText;
                const footerText = emailDesign?.footerText || '';
                const socialLinks = emailDesign?.socialLinks;
                const fontFamily = emailDesign?.fontFamily || 'Arial, Helvetica, sans-serif';
                const logoSizeMap: Record<string, string> = { small: '64px', medium: '96px', large: '128px', xlarge: '160px' };
                const logoHeight = logoSizeMap[emailDesign?.logoSize || 'medium'] || '48px';
                const showName = (emailDesign?.showCompanyName ?? 'true') === 'true';

                return (
                  <div style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    padding: viewport !== "desktop" ? "20px" : "0",
                    background: viewport !== "desktop" ? "#f5f5f5" : "#f7fafc",
                    overflow: "auto",
                  }}>
                    <div style={{
                      width: viewport === "desktop" ? "100%" : viewportWidths[viewport],
                      maxWidth: viewport === "desktop" ? "620px" : viewportWidths[viewport],
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)",
                      background: "#fff",
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: "top center",
                      transition: "transform 0.2s ease-out",
                      margin: "0 auto",
                      fontFamily,
                    }}>
                      {/* Branded email header from master email design */}
                      <div style={{
                        padding: "40px 32px",
                        textAlign: "center",
                        backgroundColor: primaryColor,
                        color: "#ffffff",
                      }}>
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={companyName}
                            style={{ height: logoHeight, width: "auto", marginBottom: "20px", objectFit: "contain", display: "block", margin: "0 auto 20px auto" }}
                          />
                        ) : (companyName && showName) ? (
                          <div style={{
                            height: "48px",
                            width: "48px",
                            backgroundColor: "rgba(255,255,255,0.2)",
                            borderRadius: "50%",
                            margin: "0 auto 16px auto",
                            lineHeight: "48px",
                            fontSize: "20px",
                            fontWeight: "bold",
                            color: "#ffffff",
                            textAlign: "center",
                          }}>
                            {companyName.charAt(0)}
                          </div>
                        ) : null}
                        {companyName && showName && (
                          <h1 style={{
                            margin: "0 0 10px 0",
                            fontSize: "24px",
                            fontWeight: "bold",
                            letterSpacing: "-0.025em",
                            color: "#ffffff",
                            fontFamily,
                          }}>
                            {companyName}
                          </h1>
                        )}
                        {headerText && (
                          <p style={{
                            margin: "0 auto",
                            fontSize: "16px",
                            opacity: 0.95,
                            maxWidth: "400px",
                            lineHeight: "1.5",
                            color: "#ffffff",
                          }}>
                            {headerText}
                          </p>
                        )}
                      </div>

                      {/* Puck editor content */}
                      <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" as const }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: "24px 20px", fontSize: "16px", lineHeight: "1.625", color: "#334155" }}>
                              {children}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Branded email footer from master email design */}
                      <div style={{
                        backgroundColor: "#f8fafc",
                        padding: "32px",
                        textAlign: "center",
                        borderTop: "1px solid #e2e8f0",
                        color: "#64748b",
                      }}>
                        {socialLinks && (socialLinks.facebook || socialLinks.twitter || socialLinks.instagram || socialLinks.linkedin) && (
                          <div style={{ marginBottom: "24px" }}>
                            {[
                              socialLinks.facebook && "Facebook",
                              socialLinks.twitter && "Twitter",
                              socialLinks.instagram && "Instagram",
                              socialLinks.linkedin && "LinkedIn",
                            ].filter(Boolean).map((name, i, arr) => (
                              <span key={name} style={{ color: "#64748b", fontSize: "13px", fontWeight: 500 }}>
                                {name}{i < arr.length - 1 ? " | " : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {footerText && (
                          <p style={{ margin: "0 0 16px 0", fontSize: "12px", lineHeight: "1.5", color: "#64748b" }}>
                            {footerText}
                          </p>
                        )}
                        {companyName && showName && (
                          <div style={{ fontSize: "12px", lineHeight: "1.5", color: "#94a3b8" }}>
                            <p style={{ margin: 0 }}>Sent via {companyName}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              },
              headerActions: ({ children }: { children: React.ReactNode }) => (
                <>
                  <div style={{ display: "flex", gap: "4px", marginRight: "8px" }}>
                    <button
                      onClick={() => setViewport("mobile")}
                      style={{
                        padding: "8px",
                        background: viewport === "mobile" ? "#2563eb" : "#fff",
                        color: viewport === "mobile" ? "#fff" : "#000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Mobile view"
                      data-testid="viewport-mobile"
                    >
                      <Smartphone size={16} />
                      <span style={{ fontSize: "12px" }}>360px</span>
                    </button>
                    <button
                      onClick={() => setViewport("tablet")}
                      style={{
                        padding: "8px",
                        background: viewport === "tablet" ? "#2563eb" : "#fff",
                        color: viewport === "tablet" ? "#fff" : "#000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Tablet view"
                      data-testid="viewport-tablet"
                    >
                      <Tablet size={16} />
                      <span style={{ fontSize: "12px" }}>768px</span>
                    </button>
                    <button
                      onClick={() => setViewport("desktop")}
                      style={{
                        padding: "8px",
                        background: viewport === "desktop" ? "#2563eb" : "#fff",
                        color: viewport === "desktop" ? "#fff" : "#000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Desktop view"
                      data-testid="viewport-desktop"
                    >
                      <Monitor size={16} />
                      <span style={{ fontSize: "12px" }}>Full</span>
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "4px", marginRight: "8px", alignItems: "center" }}>
                    <button
                      onClick={handleZoomOut}
                      disabled={zoom <= 25}
                      style={{
                        padding: "8px",
                        background: "#fff",
                        color: zoom <= 25 ? "#9ca3af" : "#000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        cursor: zoom <= 25 ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Zoom out"
                      data-testid="zoom-out"
                    >
                      <ZoomOut size={16} />
                    </button>
                    <button
                      onClick={handleZoomReset}
                      style={{
                        padding: "8px 12px",
                        background: "#fff",
                        color: "#000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 500,
                        minWidth: "60px",
                      }}
                      title="Reset zoom"
                      data-testid="zoom-reset"
                    >
                      {zoom}%
                    </button>
                    <button
                      onClick={handleZoomIn}
                      disabled={zoom >= 100}
                      style={{
                        padding: "8px",
                        background: "#fff",
                        color: zoom >= 100 ? "#9ca3af" : "#000",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        cursor: zoom >= 100 ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Zoom in"
                      data-testid="zoom-in"
                    >
                      <ZoomIn size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => setPreviewOpen(true)}
                    style={{
                      padding: "4px 12px",
                      marginRight: "8px",
                      background: "#7c3aed",
                      color: "white",
                      border: "1px solid #7c3aed",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12px",
                      fontWeight: 500,
                      height: "32px",
                      boxSizing: "border-box",
                      whiteSpace: "nowrap",
                    }}
                    data-testid="button-send-preview"
                  >
                    <Mail size={16} />
                    Send Preview
                  </button>
                  <button
                    onClick={() => {
                      // Capture email-safe HTML from the live editor DOM before unmounting it
                      const bodyHtml = extractPuckEmailHtml();
                      const fullHtml = wrapInEmailPreview(bodyHtml, {
                        companyName: emailDesign?.companyName || '',
                        primaryColor: emailDesign?.primaryColor,
                        logoUrl: emailDesign?.logoUrl,
                        logoSize: emailDesign?.logoSize,
                        showCompanyName: emailDesign?.showCompanyName,
                        headerText: emailDesign?.headerText,
                        footerText: emailDesign?.footerText,
                        fontFamily: emailDesign?.fontFamily,
                        socialLinks: emailDesign?.socialLinks,
                      });
                      setPreviewHtml(fullHtml);
                      setIsEdit(false);
                    }}
                    style={{
                      padding: "8px 16px",
                      marginRight: "8px",
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                    data-testid="button-preview"
                  >
                    Preview
                  </button>
                  {children}
                </>
              ),
            }}
          />
        </div>
        <SendPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          getHtmlContent={getHtmlContent}
          subject={data.root?.props?.title || "Newsletter Preview"}
        />
      </>
    );
  }

  // ── Preview mode: render email-safe HTML inside a sandboxed iframe ──
  const previewViewportWidths: Record<string, string> = {
    mobile: "360px",
    tablet: "768px",
    desktop: "620px",
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f0f0f0" }}>
      {/* Toolbar */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
          Email Preview
        </h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Viewport switcher */}
          {(["mobile", "tablet", "desktop"] as const).map((vp) => {
            const Icon = vp === "mobile" ? Smartphone : vp === "tablet" ? Tablet : Monitor;
            const label = vp === "mobile" ? "360px" : vp === "tablet" ? "768px" : "620px";
            return (
              <button
                key={vp}
                onClick={() => setPreviewViewport(vp)}
                style={{
                  padding: "6px 10px",
                  background: previewViewport === vp ? "#2563eb" : "#fff",
                  color: previewViewport === vp ? "#fff" : "#000",
                  border: "1px solid #e5e7eb",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
          <button
            onClick={() => setIsEdit(true)}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginLeft: "8px",
            }}
            data-testid="button-edit"
          >
            Back to Editor
          </button>
        </div>
      </div>

      {/* Email preview iframe */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "24px",
          overflow: "auto",
        }}
      >
        <div
          style={{
            width: previewViewportWidths[previewViewport],
            maxWidth: "100%",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)",
            borderRadius: "8px",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <iframe
            srcDoc={previewHtml}
            title="Email Preview"
            sandbox="allow-same-origin"
            style={{
              width: "100%",
              height: "100%",
              minHeight: "600px",
              border: "none",
              display: "block",
            }}
            onLoad={(e) => {
              // Auto-resize iframe to fit content
              const iframe = e.currentTarget;
              try {
                const doc = iframe.contentDocument;
                if (doc?.body) {
                  iframe.style.height = doc.body.scrollHeight + "px";
                }
              } catch {
                // sandbox may block access in some cases
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
