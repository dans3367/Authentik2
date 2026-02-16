import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Puck } from "@puckeditor/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import config, { initialData } from "@/config/puck";
import { UserData } from "@/config/puck/types";
import { Monitor, Smartphone, ZoomIn, ZoomOut, Mail, Save, ArrowLeft, Loader2, X } from "lucide-react";
import { SendPreviewDialog } from "@/components/SendPreviewDialog";
import { SendNewsletterWizardModal } from "@/components/SendNewsletterWizardModal";
import { extractPuckEmailHtml } from "@/utils/puck-to-email-html";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";
import { useLocation, useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AUTOSAVE_INTERVAL = 20000;

export default function NewsletterCreatePage() {
  const params = useParams<{ id?: string }>();
  const editId = params?.id;
  const isEditMode = !!editId;

  const [data, setData] = useState<UserData>(initialData);
  const [isClient, setIsClient] = useState(false);
  const [isEdit, setIsEdit] = useState(true);
  const [viewport, setViewport] = useState<"mobile" | "desktop">("desktop");
  const [zoom, setZoom] = useState(100);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewViewport, setPreviewViewport] = useState<"mobile" | "desktop">("desktop");
  const [, setLocation] = useLocation();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const dataRef = useRef<UserData>(data);
  const [justSaved, setJustSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newsletterId, setNewsletterId] = useState<string | null>(editId || null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showSendWizard, setShowSendWizard] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => { dataRef.current = data; }, [data]);

  // Load existing newsletter when editing
  const { data: existingNewsletter, isLoading: isLoadingNewsletter } = useQuery({
    queryKey: ['/api/newsletters', editId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/newsletters/${editId}`);
      return response.json();
    },
    enabled: isEditMode,
  });

  // Populate state from existing newsletter
  useEffect(() => {
    if (existingNewsletter?.newsletter) {
      const nl = existingNewsletter.newsletter;
      setTitle(nl.title || "");
      setSubject(nl.subject || "");
      setNewsletterId(nl.id);
      if (nl.puckData) {
        try {
          const parsed = JSON.parse(nl.puckData);
          setData(parsed);
        } catch {
          // puckData was invalid JSON, start fresh
        }
      }
    }
  }, [existingNewsletter]);

  // Fetch the tenant's master email design (same as Management > Email Design)
  const { data: emailDesign } = useQuery<{
    companyName: string;
    headerMode?: string;
    logoUrl?: string;
    logoSize?: string;
    logoAlignment?: string;
    bannerUrl?: string;
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

  // Save newsletter to database (create or update)
  const saveToDatabase = useCallback(async (status: 'draft' | 'ready_to_send' | 'scheduled' = 'draft') => {
    const htmlContent = extractPuckEmailHtml();
    const puckDataJson = JSON.stringify(dataRef.current);
    const currentTitle = title.trim() || "Untitled Newsletter";
    const currentSubject = subject.trim() || currentTitle;

    setIsSaving(true);
    try {
      if (newsletterId) {
        // Update existing
        const response = await apiRequest('PUT', `/api/newsletters/${newsletterId}`, {
          title: currentTitle,
          subject: currentSubject,
          content: htmlContent,
          puckData: puckDataJson,
          status,
        });
        const result = await response.json();
        setHasUnsavedChanges(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 4000);
        queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
        queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
        return result;
      } else {
        // Create new
        const response = await apiRequest('POST', '/api/newsletters', {
          title: currentTitle,
          subject: currentSubject,
          content: htmlContent,
          puckData: puckDataJson,
          status,
        });
        const result = await response.json();
        setNewsletterId(result.id);
        setHasUnsavedChanges(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 4000);
        queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
        queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
        return result;
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save newsletter",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [newsletterId, title, subject, toast, queryClient]);

  const handleSaveDraft = useCallback(async () => {
    try {
      await saveToDatabase('draft');
      toast({ title: "Draft Saved", description: "Newsletter draft saved successfully." });
    } catch {
      // Error already handled in saveToDatabase
    }
  }, [saveToDatabase, toast]);

  useEffect(() => {
    setIsClient(true);
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

  // Auto-save to database periodically
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const interval = setInterval(async () => {
      try {
        await saveToDatabase('draft');
      } catch {
        // Silent fail on auto-save
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [hasUnsavedChanges, saveToDatabase]);

  // Warn on browser close / refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // Intercept in-app link clicks
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || !anchor.href) return;
      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigation(url.pathname);
          setShowExitDialog(true);
        }
      } catch { /* ignore invalid URLs */ }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [hasUnsavedChanges]);

  // Browser back button guard
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      setPendingNavigation("__back__");
      setShowExitDialog(true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasUnsavedChanges]);

  const handlePublish = async (publishData: UserData) => {
    setData(publishData);
    dataRef.current = publishData;
    try {
      await saveToDatabase('ready_to_send');
      setHasUnsavedChanges(false);
      setShowSendWizard(true);
    } catch {
      // Error handled in saveToDatabase
    }
  };

  const handleSegmentSelected = async (segmentData: {
    segmentListId: string | null;
    recipientType: "all" | "selected" | "tags";
    selectedContactIds: string[];
    selectedTagIds: string[];
  }) => {
    if (!newsletterId) return;
    try {
      await apiRequest('PUT', `/api/newsletters/${newsletterId}`, {
        recipientType: segmentData.recipientType,
        selectedContactIds: segmentData.selectedContactIds,
        selectedTagIds: segmentData.selectedTagIds,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/newsletter-stats'] });
      toast({ title: "Recipients Selected", description: "Your newsletter recipients have been saved." });
      setShowSendWizard(false);
      setLocation('/newsletter');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save recipients",
        variant: "destructive",
      });
    }
  };

  const handleDataChange = useCallback((newData: UserData) => {
    setData(newData);
    setHasUnsavedChanges(true);
  }, []);

  const handleConfirmExit = useCallback(() => {
    setHasUnsavedChanges(false);
    setShowExitDialog(false);
    const nav = pendingNavigation;
    setPendingNavigation(null);
    if (nav === "__back__") {
      window.history.go(-2);
    } else if (nav) {
      setLocation(nav);
    }
  }, [pendingNavigation, setLocation]);

  const handleCancelExit = useCallback(() => {
    setShowExitDialog(false);
    setPendingNavigation(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 10, 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 10, 25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  const iframeConfig = useMemo(() => ({ enabled: false }), []);

  const puckOverrides = useMemo(() => ({
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
      const headerMode = emailDesign?.headerMode || 'logo';
      const bannerUrl = emailDesign?.bannerUrl;
      const useBanner = headerMode === 'banner' && !!bannerUrl;
      const logoAlign = (emailDesign?.logoAlignment || 'center') as 'left' | 'center' | 'right';
      const logoML = logoAlign === 'center' ? 'auto' : logoAlign === 'right' ? 'auto' : '0';
      const logoMR = logoAlign === 'center' ? 'auto' : logoAlign === 'right' ? '0' : 'auto';
      const viewportWidths: Record<string, string> = { mobile: "360px", desktop: "100%" };

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
            {useBanner ? (
              <>
                <img
                  src={bannerUrl}
                  alt={companyName}
                  style={{ display: "block", width: "100%", height: "auto", border: 0 }}
                />
                {(showName && companyName || headerText) && (
                  <div style={{
                    padding: "16px 24px",
                    textAlign: "center",
                    backgroundColor: primaryColor,
                    color: "#ffffff",
                  }}>
                    {companyName && showName && (
                      <h1 style={{
                        margin: "0 0 4px 0",
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
                )}
              </>
            ) : (
              <div style={{
                padding: "40px 24px",
                textAlign: logoAlign,
                backgroundColor: primaryColor,
                color: "#ffffff",
              }}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={companyName}
                    style={{ height: logoHeight, width: "auto", objectFit: "contain", display: "block", margin: `0 ${logoMR} 20px ${logoML}` }}
                  />
                ) : (companyName && showName) ? (
                  <div style={{
                    height: "48px",
                    width: "48px",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    borderRadius: "50%",
                    margin: `0 ${logoMR} 16px ${logoML}`,
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
                    margin: `0 ${logoMR} 0 ${logoML}`,
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
            )}

            {/* Puck editor content */}
            <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" as const }}>
              <tbody>
                <tr>
                  <td style={{ padding: 0, fontSize: "16px", lineHeight: "1.625", color: "#334155" }}>
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
        <div style={{ display: "flex", marginRight: "auto", alignItems: "center", minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: justSaved ? "#22c55e" : isSaving ? "#3b82f6" : "#9ca3af",
              whiteSpace: "nowrap",
              transition: "color 0.3s ease",
            }}
          >
            {isSaving ? "Saving..." : justSaved ? "Saved" : hasUnsavedChanges ? "Unsaved changes" : ""}
          </span>
        </div>
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
          onClick={handleSaveDraft}
          disabled={isSaving}
          style={{
            padding: "4px 12px",
            marginRight: "8px",
            background: "#059669",
            color: "white",
            border: "1px solid #059669",
            borderRadius: "4px",
            cursor: isSaving ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            fontWeight: 500,
            height: "32px",
            boxSizing: "border-box",
            whiteSpace: "nowrap",
            opacity: isSaving ? 0.7 : 1,
          }}
          data-testid="button-save-draft"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Draft
        </button>
        <button
          onClick={() => {
            const bodyHtml = extractPuckEmailHtml();
            const fullHtml = wrapInEmailPreview(bodyHtml, {
              companyName: emailDesign?.companyName || '',
              headerMode: emailDesign?.headerMode,
              primaryColor: emailDesign?.primaryColor,
              logoUrl: emailDesign?.logoUrl,
              logoSize: emailDesign?.logoSize,
              logoAlignment: emailDesign?.logoAlignment,
              bannerUrl: emailDesign?.bannerUrl,
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
  }), [emailDesign, viewport, zoom, handleZoomIn, handleZoomOut, handleZoomReset, justSaved, title, subject, hasUnsavedChanges, isSaving, handleSaveDraft]);

  if (!isClient || (isEditMode && isLoadingNewsletter)) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  const exitDialog = (
    <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Page?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. If you leave now, your draft will be permanently deleted. Are you sure you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelExit}>Stay on Page</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmExit} className="bg-red-600 hover:bg-red-700">Leave & Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isEdit) {
    return (
      <>
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
          {/* Top bar with close X */}
          <div style={{
            display: "flex",
            alignItems: "center",
            height: "40px",
            padding: "0 12px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            flexShrink: 0,
          }}>
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setHasUnsavedChanges(true); }}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTitle(false); if (e.key === 'Escape') setIsEditingTitle(false); }}
                autoFocus
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  outline: "none",
                  background: "#f9fafb",
                  minWidth: "200px",
                }}
              />
            ) : (
              <span
                onClick={() => setIsEditingTitle(true)}
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: title ? "#374151" : "#9ca3af",
                  cursor: "pointer",
                  padding: "2px 4px",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                title="Click to edit title"
              >
                {title || "Untitled Newsletter"}
              </span>
            )}
            <button
              onClick={() => {
                if (hasUnsavedChanges) {
                  setPendingNavigation('/newsletter');
                  setShowExitDialog(true);
                } else {
                  setLocation('/newsletter');
                }
              }}
              style={{
                padding: "4px",
                background: "transparent",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
                marginLeft: "auto",
              }}
              title="Close editor"
              data-testid="button-close"
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111827'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Puck
              config={config}
              data={data}
              onChange={handleDataChange}
              onPublish={handlePublish}
              iframe={iframeConfig}
              overrides={puckOverrides}
            />
          </div>
        </div>
        <SendPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          getHtmlContent={getHtmlContent}
          subject={subject || data.root?.props?.title || "Newsletter Preview"}
        />
        <SendNewsletterWizardModal
          isOpen={showSendWizard}
          onClose={() => setShowSendWizard(false)}
          newsletterId={newsletterId}
          newsletterTitle={title || "Untitled Newsletter"}
          onSegmentSelected={handleSegmentSelected}
        />
        {exitDialog}
      </>
    );
  }

  // ── Preview mode: render email-safe HTML inside a sandboxed iframe ──
  const previewViewportWidths: Record<string, string> = {
    mobile: "360px",
    desktop: "620px",
  };

  return (
    <>
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
          {(["mobile", "desktop"] as const).map((vp) => {
            const Icon = vp === "mobile" ? Smartphone : Monitor;
            const label = vp === "mobile" ? "360px" : "620px";
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
    <SendNewsletterWizardModal
      isOpen={showSendWizard}
      onClose={() => setShowSendWizard(false)}
      newsletterId={newsletterId}
      newsletterTitle={title || "Untitled Newsletter"}
      onSegmentSelected={handleSegmentSelected}
    />
    {exitDialog}
    </>
  );
}
