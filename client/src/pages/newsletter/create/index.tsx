import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
// Lazy load editors to avoid loading both bundles
const LazyPuck = lazy(() => import("@puckeditor/core").then(m => ({ default: m.Puck })));
const LazyNotionEditor = lazy(() => import("@/components/NotionLikeEditor"));
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createConfig, initialData } from "@/config/puck";
import { UserData } from "@/config/puck/types";
import { templatesPlugin } from "@/config/puck/templates-plugin";
import { usePreviewColors } from "@/components/puck/PreviewWrapper";
import { Monitor, Smartphone, ZoomIn, ZoomOut, Mail, Save, ArrowLeft, Loader2, X, Rocket, Eye } from "lucide-react";
import { SendPreviewDialog } from "@/components/SendPreviewDialog";
import { SendNewsletterWizardModal } from "@/components/SendNewsletterWizardModal";
import { extractPuckEmailHtml } from "@/utils/puck-to-email-html";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";
import { useLocation, useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
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

/**
 * Self-updating save status indicator that reads from refs.
 * Polls refs every 300ms so puckOverrides stays referentially stable.
 */
function SaveStatusIndicator({
  justSavedRef,
  isSavingRef,
  hasUnsavedChangesRef,
  t,
}: {
  justSavedRef: React.MutableRefObject<boolean>;
  isSavingRef: React.MutableRefObject<boolean>;
  hasUnsavedChangesRef: React.MutableRefObject<boolean>;
  t: (key: string, fallback: string) => string;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 300);
    return () => clearInterval(id);
  }, []);

  const js = justSavedRef.current;
  const is = isSavingRef.current;
  const hu = hasUnsavedChangesRef.current;

  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 500,
        color: js ? "#22c55e" : is ? "#3b82f6" : "#9ca3af",
        whiteSpace: "nowrap",
        transition: "color 0.3s ease",
      }}
    >
      {is
        ? t("newsletter.create.saving", "Saving...")
        : js
        ? t("newsletter.create.saved", "Saved")
        : hu
        ? t("newsletter.create.unsavedChanges", "Unsaved changes")
        : ""}
    </span>
  );
}

/**
 * Self-updating save draft button that reads from refs.
 */
function SaveDraftButton({
  isSavingRef,
  handleSaveDraftRef,
  t,
}: {
  isSavingRef: React.MutableRefObject<boolean>;
  handleSaveDraftRef: React.MutableRefObject<() => Promise<void>>;
  t: (key: string, fallback: string) => string;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 300);
    return () => clearInterval(id);
  }, []);

  const saving = isSavingRef.current;

  return (
    <button
      onClick={() => handleSaveDraftRef.current()}
      disabled={saving}
      style={{
        padding: "4px 12px",
        marginRight: "8px",
        background: "#059669",
        color: "white",
        border: "1px solid #059669",
        borderRadius: "4px",
        cursor: saving ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        fontWeight: 500,
        height: "32px",
        boxSizing: "border-box" as const,
        whiteSpace: "nowrap" as const,
        opacity: saving ? 0.7 : 1,
      }}
      data-testid="button-save-draft"
    >
      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
      {t("newsletter.create.saveDraft", "Save Draft")}
    </button>
  );
}

/**
 * Preview wrapper that reads root colors via usePuck selector.
 * Only re-renders when colors change — isolates color updates from the blocks panel.
 */
function PuckEmailPreview({
  children,
  emailDesign,
  viewport,
  zoom,
}: {
  children: React.ReactNode;
  emailDesign: any;
  viewport: "mobile" | "desktop";
  zoom: number;
}) {
  const { bodyBg, contentBg, footerTextColor } = usePreviewColors();

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
      minHeight: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "stretch",
      padding: viewport !== "desktop" ? "20px" : "0",
      background: bodyBg,
      overflow: "auto",
    }}>
      <div style={{
        width: viewport === "desktop" ? "100%" : viewportWidths[viewport],
        maxWidth: viewport === "desktop" ? "620px" : viewportWidths[viewport],
        boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)",
        background: contentBg,
        transform: `scale(${zoom / 100})`,
        transformOrigin: "top center",
        transition: "transform 0.2s ease-out",
        margin: "0 auto",
        fontFamily,
        display: "flex",
        flexDirection: "column" as const,
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
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: "collapse" as const, border: "none", flex: 1 }}>
          <tbody>
            <tr>
              <td style={{ padding: 0, fontSize: "16px", lineHeight: "1.625", color: "#334155", verticalAlign: "top" }}>
                {children}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Branded email footer from master email design */}
        <div style={{
          backgroundColor: contentBg,
          padding: "32px",
          textAlign: "center",
          borderTop: "1px solid #e2e8f0",
          color: footerTextColor,
          marginTop: "auto",
        }}>
          {socialLinks && (socialLinks.facebook || socialLinks.twitter || socialLinks.instagram || socialLinks.linkedin) && (
            <div style={{ marginBottom: "24px" }}>
              {[
                socialLinks.facebook && "Facebook",
                socialLinks.twitter && "Twitter",
                socialLinks.instagram && "Instagram",
                socialLinks.linkedin && "LinkedIn",
              ].filter(Boolean).map((name, i, arr) => (
                <span key={name} style={{ color: footerTextColor, fontSize: "13px", fontWeight: 500 }}>
                  {name}{i < arr.length - 1 ? " | " : ""}
                </span>
              ))}
            </div>
          )}
          {footerText && (
            <p style={{ margin: "0 0 16px 0", fontSize: "12px", lineHeight: "1.5", color: footerTextColor }}>
              {footerText}
            </p>
          )}
          {companyName && showName && (
            <div style={{ fontSize: "12px", lineHeight: "1.5", color: footerTextColor, opacity: 0.7 }}>
              <p style={{ margin: 0 }}>Sent via {companyName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewsletterCreatePage() {
  const params = useParams<{ id?: string }>();
  const editId = params?.id;
  const isEditMode = !!editId;

  // Detect email type from URL path: /advertise/create → 'advertise', else 'newsletter'
  const emailType = window.location.pathname.startsWith('/advertise') ? 'advertise' : 'newsletter';
  const basePath = emailType === 'advertise' ? '/advertise' : '/newsletter';

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
  const newsletterIdRef = useRef<string | null>(newsletterId);
  useEffect(() => { newsletterIdRef.current = newsletterId; }, [newsletterId]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showSendWizard, setShowSendWizard] = useState(false);
  const [dataReady, setDataReady] = useState(!isEditMode);
  const [initialRecipientType, setInitialRecipientType] = useState<"all" | "selected" | "tags">("all");
  const [initialSelectedContactIds, setInitialSelectedContactIds] = useState<string[]>([]);
  const [initialSelectedTagIds, setInitialSelectedTagIds] = useState<string[]>([]);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [publishToBlog, setPublishToBlog] = useState(true);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t, currentLanguage } = useLanguage();
  const queryClient = useQueryClient();

  // Stable key for the Puck editor — locked at mount time so auto-save
  // (which sets newsletterId from null → real id) never remounts the editor.
  const puckKeyRef = useRef<string>(`${editId || 'new'}-loaded`);

  // Fetch blog design to determine editor type
  const { data: blogDesignData } = useQuery<{ newsletterEditorType?: string }>({
    queryKey: ["/api/blog-design"],
    queryFn: async () => {
      const response = await fetch('/api/blog-design', { credentials: 'include' });
      if (!response.ok) return { newsletterEditorType: 'classic' };
      return response.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const managementEditorType = blogDesignData?.newsletterEditorType || 'classic';

  // Read ?editor= query param (set by the editor picker modal when creating a new newsletter)
  const queryEditorType = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const val = params.get('editor');
    return val === 'classic' || val === 'notion' ? val : null;
  }, []);

  // When editing an existing newsletter, detect which editor it was originally created with
  // so we always reopen it in the correct editor regardless of the current management setting.
  const [detectedEditorType, setDetectedEditorType] = useState<'classic' | 'notion' | null>(null);

  // Priority: existing newsletter detected type > query param from picker modal > management setting
  const editorType = isEditMode && detectedEditorType
    ? detectedEditorType
    : queryEditorType || managementEditorType;

  // State for notion editor HTML content
  const [notionHtmlContent, setNotionHtmlContent] = useState<string>("");
  // Build translated Puck config — rebuilds when language changes (only needed for classic)
  const translatedConfig = useMemo(() => createConfig(t), [t, currentLanguage]);

  // dataRef is updated directly in handleDataChange and handlePublish

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
          // Detect which editor created this newsletter and always reopen with that editor
          if (parsed.notionHtml) {
            setDetectedEditorType('notion');
            setNotionHtmlContent(parsed.notionHtml);
          } else {
            setDetectedEditorType('classic');
            setData(parsed);
          }
        } catch {
          // puckData was invalid JSON, start fresh
          setDetectedEditorType('classic');
        }
      } else {
        // No puckData at all — use management default
        setDetectedEditorType(null);
      }
      // Populate recipient data for the send wizard
      if (nl.recipientType) {
        setInitialRecipientType(nl.recipientType as "all" | "selected" | "tags");
      }
      if (nl.selectedContactIds) {
        setInitialSelectedContactIds(nl.selectedContactIds);
      }
      if (nl.selectedTagIds) {
        setInitialSelectedTagIds(nl.selectedTagIds);
      }
      // Load reactions preference
      if (nl.reactionsEnabled !== undefined && nl.reactionsEnabled !== null) {
        setReactionsEnabled(nl.reactionsEnabled);
      }
      // Load publish to blog preference
      if (nl.publishToBlog !== undefined && nl.publishToBlog !== null) {
        setPublishToBlog(nl.publishToBlog);
      }
      setDataReady(true);
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
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const getHtmlContent = useCallback(() => {
    if (editorType === 'notion') {
      return notionHtmlContent;
    }
    return extractPuckEmailHtml();
  }, [editorType, notionHtmlContent]);

  // Save newsletter to database (create or update)
  const saveToDatabase = useCallback(async (status: 'draft' | 'ready_to_send' | 'scheduled' = 'draft') => {
    const htmlContent = editorType === 'notion' ? notionHtmlContent : extractPuckEmailHtml();
    const puckDataJson = editorType === 'notion' ? JSON.stringify({ notionHtml: notionHtmlContent }) : JSON.stringify(dataRef.current);
    const currentTitle = title.trim() || t("newsletter.create.untitled", "Untitled Newsletter");
    const currentSubject = subject.trim() || currentTitle;

    setIsSaving(true);
    try {
      const currentId = newsletterIdRef.current;
      if (currentId) {
        // Update existing
        const response = await apiRequest('PUT', `/api/newsletters/${currentId}`, {
          title: currentTitle,
          subject: currentSubject,
          content: htmlContent,
          puckData: puckDataJson,
          status,
          reactionsEnabled,
          publishToBlog,
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
          emailType,
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
        title: t("newsletter.create.saveFailed", "Save Failed"),
        description: error.message || t("newsletter.create.saveFailedDesc", "Failed to save newsletter"),
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [title, subject, reactionsEnabled, publishToBlog, toast, queryClient, editorType, notionHtmlContent]);

  const handleSaveDraft = useCallback(async () => {
    try {
      await saveToDatabase('draft');
      toast({ title: t("newsletter.create.draftSaved", "Draft Saved"), description: t("newsletter.create.draftSavedDesc", "Newsletter draft saved successfully.") });
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

  // Auto-save to database periodically — only for existing newsletters.
  // New newsletters must be explicitly saved first (via "Save Draft") to avoid
  // creating orphan "Untitled Newsletter" records on every editor open.
  useEffect(() => {
    if (!hasUnsavedChanges || !newsletterId) return;
    const interval = setInterval(async () => {
      try {
        await saveToDatabase('draft');
      } catch {
        // Silent fail on auto-save
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [hasUnsavedChanges, newsletterId, saveToDatabase]);

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
      toast({ title: t("newsletter.create.recipientsSelected", "Recipients Selected"), description: t("newsletter.create.recipientsSaved", "Your newsletter recipients have been saved.") });
      setShowSendWizard(false);
      setLocation(basePath);
    } catch (error: any) {
      toast({
        title: t("newsletter.create.error", "Error"),
        description: error.message || t("newsletter.create.errorSaveRecipients", "Failed to save recipients"),
        variant: "destructive",
      });
    }
  };

  const handleDataChange = useCallback((newData: UserData) => {
    dataRef.current = newData;
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

  // Refs for volatile save-state so puckOverrides stays referentially stable
  const justSavedRef = useRef(justSaved);
  justSavedRef.current = justSaved;
  const isSavingRef = useRef(isSaving);
  isSavingRef.current = isSaving;
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;
  const handleSaveDraftRef = useRef(handleSaveDraft);
  handleSaveDraftRef.current = handleSaveDraft;

  const puckOverrides = useMemo(() => ({
    preview: ({ children }: { children: React.ReactNode }) => (
      <PuckEmailPreview emailDesign={emailDesign} viewport={viewport} zoom={zoom}>
        {children}
      </PuckEmailPreview>
    ),
    headerActions: ({ children }: { children: React.ReactNode }) => (
      <>
        <div style={{ display: "flex", marginRight: "auto", alignItems: "center", minWidth: 0, flex: 1 }}>
          <SaveStatusIndicator
            justSavedRef={justSavedRef}
            isSavingRef={isSavingRef}
            hasUnsavedChangesRef={hasUnsavedChangesRef}
            t={t}
          />
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
            title={t("newsletter.create.mobileView", "Mobile view")}
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
            title={t("newsletter.create.desktopView", "Desktop view")}
            data-testid="viewport-desktop"
          >
            <Monitor size={16} />
            <span style={{ fontSize: "12px" }}>{t("newsletter.create.full", "Full")}</span>
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
            title={t("newsletter.create.zoomOut", "Zoom out")}
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
            title={t("newsletter.create.resetZoom", "Reset zoom")}
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
            title={t("newsletter.create.zoomIn", "Zoom in")}
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
          {t("newsletter.create.sendPreview", "Send Preview")}
        </button>
        <SaveDraftButton
          isSavingRef={isSavingRef}
          handleSaveDraftRef={handleSaveDraftRef}
          t={t}
        />
        <button
          onClick={() => {
            const bodyHtml = extractPuckEmailHtml();
            const currentRootProps = dataRef.current?.root?.props;
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
              contentBackgroundColor: currentRootProps?.backgroundColor,
              bodyBackgroundColor: currentRootProps?.bodyBackgroundColor,
              footerTextColor: currentRootProps?.footerTextColor,
            });
            setPreviewHtml(fullHtml);
            setIsEdit(false);
          }}
          style={{
            padding: "4px 12px",
            marginRight: "8px",
            background: "#4b5563",
            color: "white",
            border: "1px solid #4b5563",
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
          data-testid="button-preview"
        >
          <Eye size={16} />
          {t("newsletter.create.preview", "Preview")}
        </button>
        {/* Replace default Puck Publish button with custom "Ready" button */}
        <button
          onClick={() => handlePublish(dataRef.current)}
          style={{
            padding: "4px 16px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
            fontWeight: 600,
            height: "32px",
            boxSizing: "border-box",
            whiteSpace: "nowrap",
          }}
          data-testid="button-ready"
        >
          <Rocket size={16} />
          {t("newsletter.create.ready", "Ready")}
        </button>
      </>
    ),
  }), [emailDesign, viewport, zoom, handleZoomIn, handleZoomOut, handleZoomReset, t]);

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
          <AlertDialogTitle>{t("newsletter.create.leavePage", "Leave Page?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("newsletter.create.leaveDesc", "You have unsaved changes. If you leave now, your draft will be permanently deleted. Are you sure you want to continue?")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelExit}>{t("newsletter.create.stay", "Stay on Page")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmExit} className="bg-red-600 hover:bg-red-700">{t("newsletter.create.leaveDiscard", "Leave & Discard")}</AlertDialogAction>
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
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: title ? "#374151" : "#9ca3af",
                padding: "2px 4px",
              }}
            >
              {title || "Untitled Newsletter"}
            </span>
            <button
              onClick={() => {
                if (hasUnsavedChanges) {
                  setPendingNavigation(basePath);
                  setShowExitDialog(true);
                } else {
                  setLocation(basePath);
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
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#6b7280' }} />
              </div>
            }>
              {editorType === 'notion' ? (
                /* ─── Notion-like TipTap Editor ─── */
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Notion editor toolbar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderBottom: '1px solid #e5e7eb',
                    background: '#fff',
                    flexShrink: 0,
                  }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: justSaved ? '#22c55e' : isSaving ? '#3b82f6' : '#9ca3af',
                        whiteSpace: 'nowrap',
                        transition: 'color 0.3s ease',
                        minWidth: '80px',
                        textAlign: 'center',
                        marginRight: 'auto',
                      }}
                    >
                      {isSaving ? t("newsletter.create.saving", "Saving...") : justSaved ? t("newsletter.create.saved", "Saved") : hasUnsavedChanges ? t("newsletter.create.unsavedChanges", "Unsaved changes") : ""}
                    </span>
                    <button
                      onClick={() => setPreviewOpen(true)}
                      style={{
                        padding: '6px 12px',
                        background: '#7c3aed',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Mail size={14} />
                      {t("newsletter.create.sendPreview", "Send Preview")}
                    </button>
                    <button
                      onClick={handleSaveDraft}
                      disabled={isSaving}
                      style={{
                        padding: '6px 12px',
                        background: '#059669',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {t("newsletter.create.saveDraft", "Save Draft")}
                    </button>
                    <button
                      onClick={() => handlePublish(dataRef.current)}
                      style={{
                        padding: '6px 16px',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '13px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Rocket size={14} />
                      {t("newsletter.create.ready", "Ready")}
                    </button>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#f7fafc' }}>
                    {/* Email design chrome wrapper — mirrors the Puck preview override */}
                    {(() => {
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

                      return (
                        <div style={{
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '24px 20px',
                          minHeight: '100%',
                        }}>
                          {/* Newsletter name & subject — separate from the email card */}
                          <div style={{
                            width: '100%',
                            maxWidth: '620px',
                            marginBottom: '10px',
                            padding: '20px 24px 16px',
                            background: '#fff',
                            borderRadius: '2px',
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)',
                            fontFamily,
                          }}>
                            <input
                              type="text"
                              value={title}
                              onChange={(e) => { setTitle(e.target.value); setHasUnsavedChanges(true); }}
                              placeholder="Newsletter Name"
                              style={{
                                width: '100%',
                                border: 'none',
                                outline: 'none',
                                fontSize: '22px',
                                fontWeight: 700,
                                color: '#1e293b',
                                background: 'transparent',
                                padding: 0,
                                margin: '0 0 4px 0',
                                fontFamily,
                                lineHeight: 1.3,
                              }}
                            />
                            <input
                              type="text"
                              value={subject}
                              onChange={(e) => { setSubject(e.target.value); setHasUnsavedChanges(true); }}
                              placeholder="Email subject line..."
                              style={{
                                width: '100%',
                                border: 'none',
                                outline: 'none',
                                fontSize: '14px',
                                fontWeight: 400,
                                color: '#94a3b8',
                                background: 'transparent',
                                padding: 0,
                                margin: 0,
                                fontFamily,
                                lineHeight: 1.4,
                              }}
                            />
                          </div>

                          <div style={{
                            width: '100%',
                            maxWidth: '620px',
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)',
                            background: '#fff',
                            margin: '0 auto',
                            fontFamily,
                            borderRadius: '2px',
                          }}>
                            {/* Branded email header */}
                            {useBanner ? (
                              <>
                                <img
                                  src={bannerUrl}
                                  alt={companyName}
                                  style={{ display: 'block', width: '100%', height: 'auto', border: 0 }}
                                />
                                {(showName && companyName || headerText) && (
                                  <div style={{
                                    padding: '16px 24px',
                                    textAlign: 'center',
                                    backgroundColor: primaryColor,
                                    color: '#ffffff',
                                  }}>
                                    {companyName && showName && (
                                      <h1 style={{
                                        margin: '0 0 4px 0',
                                        fontSize: '24px',
                                        fontWeight: 'bold',
                                        letterSpacing: '-0.025em',
                                        color: '#ffffff',
                                        fontFamily,
                                      }}>
                                        {companyName}
                                      </h1>
                                    )}
                                    {headerText && (
                                      <p style={{
                                        margin: '0 auto',
                                        fontSize: '16px',
                                        opacity: 0.95,
                                        maxWidth: '400px',
                                        lineHeight: '1.5',
                                        color: '#ffffff',
                                      }}>
                                        {headerText}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{
                                padding: '40px 24px',
                                textAlign: logoAlign,
                                backgroundColor: primaryColor,
                                color: '#ffffff',
                              }}>
                                {logoUrl ? (
                                  <img
                                    src={logoUrl}
                                    alt={companyName}
                                    style={{ height: logoHeight, width: 'auto', objectFit: 'contain', display: 'block', margin: `0 ${logoMR} 20px ${logoML}` }}
                                  />
                                ) : (companyName && showName) ? (
                                  <div style={{
                                    height: '48px',
                                    width: '48px',
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    borderRadius: '50%',
                                    margin: `0 ${logoMR} 16px ${logoML}`,
                                    lineHeight: '48px',
                                    fontSize: '20px',
                                    fontWeight: 'bold',
                                    color: '#ffffff',
                                    textAlign: 'center',
                                  }}>
                                    {companyName.charAt(0)}
                                  </div>
                                ) : null}
                                {companyName && showName && (
                                  <h1 style={{
                                    margin: '0 0 10px 0',
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                    letterSpacing: '-0.025em',
                                    color: '#ffffff',
                                    fontFamily,
                                  }}>
                                    {companyName}
                                  </h1>
                                )}
                                {headerText && (
                                  <p style={{
                                    margin: `0 ${logoMR} 0 ${logoML}`,
                                    fontSize: '16px',
                                    opacity: 0.95,
                                    maxWidth: '400px',
                                    lineHeight: '1.5',
                                    color: '#ffffff',
                                  }}>
                                    {headerText}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Body content zone — editor lives here */}
                            <div className="notion-editor-embedded" style={{ padding: '20px 24px 32px 24px', fontSize: '16px', lineHeight: '1.625', color: '#334155' }}>
                              <LazyNotionEditor
                                content={notionHtmlContent}
                                onChange={(html) => {
                                  setNotionHtmlContent(html);
                                  setHasUnsavedChanges(true);
                                }}
                                placeholder="Type '/' for commands, or start writing your newsletter..."
                                className="notion-editor-embedded"
                              />
                            </div>

                            {/* Branded email footer */}
                            <div style={{
                              backgroundColor: '#f8fafc',
                              padding: '32px',
                              textAlign: 'center',
                              borderTop: '1px solid #e2e8f0',
                              color: '#64748b',
                            }}>
                              {socialLinks && (socialLinks.facebook || socialLinks.twitter || socialLinks.instagram || socialLinks.linkedin) && (
                                <div style={{ marginBottom: '24px' }}>
                                  {[
                                    socialLinks.facebook && 'Facebook',
                                    socialLinks.twitter && 'Twitter',
                                    socialLinks.instagram && 'Instagram',
                                    socialLinks.linkedin && 'LinkedIn',
                                  ].filter(Boolean).map((name, i, arr) => (
                                    <span key={name} style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>
                                      {name}{i < arr.length - 1 ? ' | ' : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {footerText && (
                                <p style={{ margin: '0 0 16px 0', fontSize: '12px', lineHeight: '1.5', color: '#64748b' }}>
                                  {footerText}
                                </p>
                              )}
                              {companyName && showName && (
                                <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#94a3b8' }}>
                                  <p style={{ margin: 0 }}>Sent via {companyName}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                /* ─── Classic Puck Editor ─── */
                dataReady ? (
                  <LazyPuck
                    key={puckKeyRef.current}
                    config={translatedConfig}
                    data={data}
                    onChange={handleDataChange}
                    onPublish={handlePublish}
                    iframe={iframeConfig}
                    overrides={puckOverrides}
                    plugins={[templatesPlugin()]}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#6b7280' }} />
                  </div>
                )
              )}
            </Suspense>
          </div>
        </div>
        <SendPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          getHtmlContent={getHtmlContent}
          subject={subject || dataRef.current?.root?.props?.title || "Newsletter Preview"}
          getPuckData={() => JSON.stringify(dataRef.current)}
        />
        <SendNewsletterWizardModal
          isOpen={showSendWizard}
          onClose={() => setShowSendWizard(false)}
          onSuccess={() => { setHasUnsavedChanges(false); setLocation(basePath); }}
          newsletterId={newsletterId}
          newsletterTitle={title || `Untitled ${emailType === 'advertise' ? 'Advertisement' : 'Newsletter'}`}
          newsletterReviewStatus={existingNewsletter?.newsletter?.reviewStatus}
          onSegmentSelected={handleSegmentSelected}
          initialRecipientType={initialRecipientType}
          initialSelectedContactIds={initialSelectedContactIds}
          initialSelectedTagIds={initialSelectedTagIds}
          reactionsEnabled={reactionsEnabled}
          onReactionsEnabledChange={setReactionsEnabled}
          publishToBlog={publishToBlog}
          onPublishToBlogChange={setPublishToBlog}
          itemLabel={emailType === 'advertise' ? 'Advertisement' : 'Newsletter'}
          returnPath={basePath}
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
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: dataRef.current?.root?.props?.bodyBackgroundColor || "#f7fafc" }}>
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
              onClick={() => { setData(dataRef.current); setIsEdit(true); }}
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
            padding: "24px 0",
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
        onSuccess={() => { setHasUnsavedChanges(false); setLocation(basePath); }}
        newsletterId={newsletterId}
        newsletterTitle={title || `Untitled ${emailType === 'advertise' ? 'Advertisement' : 'Newsletter'}`}
        newsletterReviewStatus={existingNewsletter?.newsletter?.reviewStatus}
        onSegmentSelected={handleSegmentSelected}
        initialRecipientType={initialRecipientType}
        initialSelectedContactIds={initialSelectedContactIds}
        initialSelectedTagIds={initialSelectedTagIds}
        reactionsEnabled={reactionsEnabled}
        onReactionsEnabledChange={setReactionsEnabled}
        itemLabel={emailType === 'advertise' ? 'Advertisement' : 'Newsletter'}
        returnPath={basePath}
      />
      {exitDialog}
    </>
  );
}
