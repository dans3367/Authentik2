import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import type { UserData } from "@/config/puck/puck-shared";
// Lazy load editor implementations to avoid loading both bundles
const LazyClassicPuckEditor = lazy(() => import("@/components/puck/ClassicPuckEditor"));
const LazyNotionEditor = lazy(() => import("@/components/NotionLikeEditor"));
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { initialData } from "@/config/puck/initial-data";
import { rootFieldErrors } from "@/config/puck/root-field-errors";
import { Monitor, Smartphone, ZoomIn, ZoomOut, Mail, Save, ArrowLeft, Loader2, X, Rocket, Eye, Sparkles, ChevronDown, RefreshCw, Type, ArrowLeftToLine, Check } from "lucide-react";
import { SendPreviewDialog } from "@/components/SendPreviewDialog";
import { SendNewsletterWizardModal } from "@/components/SendNewsletterWizardModal";
import { extractPuckEmailHtml } from "@/utils/puck-to-email-html";
import { wrapInEmailPreview } from "@/utils/email-preview-wrapper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation, useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { transformTitleAndSubject, type NewsletterMetaTransformAction } from "@/lib/aiApi";
import { normalizeAiHtml } from "@/lib/aiHtmlNormalization";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/contexts/ThemeContext";
import phoneMockup from "@assets/phone_14.svg";
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
 * Remove "Photo by … (on Unsplash|Pexels)" attribution from notion-editor HTML.
 * Defensive: covers newsletters created before the server stopped emitting credits.
 */
function stripNotionPhotoCredits(html: string): string {
  if (!html) return html;
  let out = html;
  out = out.replace(/<figcaption[^>]*>[^<]*photo\s+by[^<]*<\/figcaption>/gi, '');
  out = out.replace(/<figure[^>]*>\s*(<img[^>]*>)\s*<\/figure>/gi, '<p>$1</p>');
  out = out.replace(/<p[^>]*>\s*Photo\s+by\s+[^<]*?<\/p>/gi, '');
  out = out.replace(/\s*(?:—|–|-|·|\|)?\s*Photo\s+by\s+[^<.]*?(?:\s+on\s+(?:Unsplash|Pexels))?\s*(?=<\/p>|<br\s*\/?>)/gi, '');
  return out;
}

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

function TitleSubjectAiMenu({
  processingAction,
  onTransform,
  t,
  surface,
}: {
  processingAction: NewsletterMetaTransformAction | null;
  onTransform: (action: NewsletterMetaTransformAction, instruction?: string) => void;
  t: (key: string, fallback: string) => string;
  surface: {
    controlBg: string;
    controlBorder: string;
    chromeHover: string;
    text: string;
    textSoft: string;
    textMuted: string;
    cardBg: string;
    border: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const isProcessing = Boolean(processingAction);
  const canApplyDirection = direction.trim().length >= 3 && !isProcessing;
  const actions: Array<{ action: NewsletterMetaTransformAction; label: string; icon: React.ReactNode }> = [
    { action: "regenerate", label: t("newsletter.create.aiMeta.regenerate", "Regenerate"), icon: <RefreshCw size={14} /> },
    { action: "formal", label: t("newsletter.create.aiMeta.formal", "More formal"), icon: <Type size={14} /> },
    { action: "casual", label: t("newsletter.create.aiMeta.casual", "Less formal"), icon: <Sparkles size={14} /> },
    { action: "shorten", label: t("newsletter.create.aiMeta.shorten", "Shorter"), icon: <ArrowLeftToLine size={14} /> },
  ];

  useEffect(() => {
    if (isProcessing) setOpen(true);
  }, [isProcessing]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => {
          if (!isProcessing) setOpen((value) => !value);
        }}
        disabled={isProcessing}
        title={t("newsletter.create.aiMeta.button", "Generate title & subject with AI")}
        aria-label={t("newsletter.create.aiMeta.button", "Generate title & subject with AI")}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          height: '30px',
          padding: '0 9px',
          border: `1px solid ${open ? surface.controlBorder : 'transparent'}`,
          borderRadius: '999px',
          background: open ? surface.controlBg : 'transparent',
          color: open ? surface.text : surface.textMuted,
          cursor: isProcessing ? 'default' : 'pointer',
          opacity: isProcessing ? 0.7 : 1,
          fontSize: '12px',
          fontWeight: 600,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        <span>{t("newsletter.create.aiMeta.ai", "AI")}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '300px',
            maxWidth: 'calc(100vw - 32px)',
            padding: '8px',
            border: `1px solid ${surface.border}`,
            borderRadius: '10px',
            background: surface.cardBg,
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.02)',
            zIndex: 60,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px 8px', color: surface.text, fontSize: '12px', fontWeight: 700 }}>
            <Sparkles size={14} />
            <span>{t("newsletter.create.aiMeta.menuTitle", "Title & subject")}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px' }}>
            {actions.map((item) => (
              <button
                key={item.action}
                type="button"
                disabled={isProcessing}
                onClick={() => onTransform(item.action)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  height: '34px',
                  padding: '0 9px',
                  border: '1px solid transparent',
                  borderRadius: '7px',
                  background: 'transparent',
                  color: surface.textSoft,
                  cursor: isProcessing ? 'default' : 'pointer',
                  opacity: isProcessing ? 0.55 : 1,
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'left',
                }}
                onMouseEnter={(event) => { if (!isProcessing) event.currentTarget.style.background = surface.chromeHover; }}
                onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}
              >
                {processingAction === item.action ? <Loader2 size={14} className="animate-spin" /> : item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const nextDirection = direction.trim();
              if (!nextDirection || isProcessing) return;
              onTransform("custom", nextDirection);
              setDirection("");
            }}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${surface.border}` }}
          >
            <input
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              disabled={isProcessing}
              placeholder={t("newsletter.create.aiMeta.directionPlaceholder", "Tell AI how to rewrite...")}
              style={{
                width: '100%',
                minWidth: 0,
                height: '34px',
                padding: '0 10px',
                border: `1px solid ${surface.controlBorder}`,
                borderRadius: '7px',
                background: surface.controlBg,
                color: surface.text,
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!canApplyDirection}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                height: '34px',
                padding: '0 9px',
                border: `1px solid ${surface.controlBorder}`,
                borderRadius: '7px',
                background: surface.controlBg,
                color: surface.text,
                cursor: canApplyDirection ? 'pointer' : 'default',
                opacity: canApplyDirection ? 1 : 0.5,
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {processingAction === "custom" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {t("newsletter.create.aiMeta.apply", "Apply")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function NewsletterEmailClientPreviewDialog({
  open,
  onOpenChange,
  previewMode,
  onPreviewModeChange,
  previewHtml,
  title,
  subject,
  senderName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewMode: "desktop" | "mobile";
  onPreviewModeChange: (mode: "desktop" | "mobile") => void;
  previewHtml: string;
  title: string;
  subject: string;
  senderName: string;
}) {
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const previewResizeObserverRef = useRef<ResizeObserver | null>(null);

  // Size the preview iframe to its content and hide its own scrollbar, so the
  // email scrolls only via the surrounding device frame. Re-measures as
  // late-loading images change the document height (otherwise content gets cut).
  const handlePreviewIframeLoad = useCallback((minHeight: number) => {
    const iframe = previewIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) return;

    if (!doc.getElementById("np-hide-scrollbar")) {
      const style = doc.createElement("style");
      style.id = "np-hide-scrollbar";
      style.textContent =
        "html,body{scrollbar-width:none;-ms-overflow-style:none;}" +
        "html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;width:0;height:0;}";
      doc.head?.appendChild(style);
    }

    const resize = () => {
      const body = previewIframeRef.current?.contentDocument?.body;
      if (!body || !previewIframeRef.current) return;
      const height = Math.max(body.scrollHeight, body.offsetHeight);
      previewIframeRef.current.style.height = `${Math.max(height, minHeight)}px`;
    };
    resize();

    doc.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", resize, { once: true });
    });

    previewResizeObserverRef.current?.disconnect();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(resize);
      observer.observe(doc.body);
      previewResizeObserverRef.current = observer;
    }
  }, []);

  useEffect(() => () => previewResizeObserverRef.current?.disconnect(), []);

  const displayTitle = title.trim() || "Newsletter";
  const displaySubject = subject.trim() || displayTitle || "Newsletter Preview";
  const displaySender = senderName.trim() || "Your Business";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[900px] max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Email Client Preview</DialogTitle>
          <DialogDescription className="text-sm">
            This is how your newsletter will appear in an email client.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-1 px-4 sm:px-6 pb-2 flex-shrink-0">
          <Button
            variant={previewMode === "desktop" ? "default" : "outline"}
            size="sm"
            onClick={() => onPreviewModeChange("desktop")}
            className="text-xs"
          >
            <Monitor className="w-3.5 h-3.5 mr-1" />
            Desktop
          </Button>
          <Button
            variant={previewMode === "mobile" ? "default" : "outline"}
            size="sm"
            onClick={() => onPreviewModeChange("mobile")}
            className="text-xs"
          >
            <Smartphone className="w-3.5 h-3.5 mr-1" />
            Mobile
          </Button>
        </div>
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 flex justify-center items-start overflow-auto flex-1 min-h-0">
          {previewMode === "mobile" ? (
            <div
              className="relative mx-auto w-full max-w-[340px] transition-all duration-300"
              style={{ aspectRatio: "436 / 878" }}
            >
              <img
                src={phoneMockup}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 w-full h-full pointer-events-none select-none z-20"
              />
              <div
                className="absolute overflow-y-auto overflow-x-hidden bg-white text-slate-900 z-10 select-none scrollbar-hide"
                style={{
                  top: "4.04%",
                  left: "6.84%",
                  right: "6.46%",
                  bottom: "2.71%",
                  borderRadius: "12.7% / 5.86%",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                } as React.CSSProperties}
              >
                <div className="h-10 shrink-0 bg-gray-50" />
                <div className="bg-white px-3 py-2 border-b text-xs text-gray-600 space-y-0.5">
                  <div><span className="font-medium text-gray-500">From:</span> {displaySender}</div>
                  <div><span className="font-medium text-gray-500">To:</span> Subscriber</div>
                  <div><span className="font-medium text-gray-500">Subject:</span> {displaySubject}</div>
                </div>
                <iframe
                  ref={previewIframeRef}
                  srcDoc={previewHtml}
                  title="Newsletter mobile email preview"
                  className="w-full border-0"
                  style={{
                    minHeight: "600px",
                    pointerEvents: "none",
                  }}
                  sandbox="allow-same-origin"
                  onLoad={() => handlePreviewIframeLoad(600)}
                />
              </div>
            </div>
          ) : (
            <div
              className="border rounded-lg shadow-inner bg-gray-100 transition-all duration-300 dark:bg-gray-800 dark:border-gray-700"
              style={{ width: "100%", maxWidth: "800px" }}
            >
              <div className="bg-gray-200 px-3 py-2 flex items-center gap-2 text-xs text-gray-500 border-b dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center truncate">
                  Newsletter - {displayTitle}
                </div>
              </div>
              <div className="bg-white px-3 py-2 border-b text-xs text-gray-600 space-y-0.5 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600">
                <div><span className="font-medium text-gray-500">From:</span> {displaySender}</div>
                <div><span className="font-medium text-gray-500">To:</span> Subscriber</div>
                <div><span className="font-medium text-gray-500">Subject:</span> {displaySubject}</div>
              </div>
              <iframe
                ref={previewIframeRef}
                srcDoc={previewHtml}
                title="Newsletter email preview"
                className="w-full border-0"
                style={{
                  minHeight: "700px",
                  pointerEvents: "none",
                }}
                sandbox="allow-same-origin"
                onLoad={() => handlePreviewIframeLoad(700)}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Preview wrapper that reads root colors via usePuck selector.
 * Only re-renders when colors change — isolates color updates from the blocks panel.
 */
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
  const [emailClientPreviewOpen, setEmailClientPreviewOpen] = useState(false);
  const [emailClientPreviewMode, setEmailClientPreviewMode] = useState<"mobile" | "desktop">("desktop");
  const [emailClientPreviewHtml, setEmailClientPreviewHtml] = useState("");
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
  const titleRef = useRef(title);
  const subjectRef = useRef(subject);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showSendWizard, setShowSendWizard] = useState(false);
  const [dataReady, setDataReady] = useState(!isEditMode);
  const [initialRecipientType, setInitialRecipientType] = useState<"all" | "selected" | "tags">("all");
  const [initialSelectedContactIds, setInitialSelectedContactIds] = useState<string[]>([]);
  const [initialSelectedTagIds, setInitialSelectedTagIds] = useState<string[]>([]);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [publishToBlog, setPublishToBlog] = useState(true);
  const [titleError, _setTitleError] = useState(false);
  const setTitleError = useCallback((v: boolean) => {
    _setTitleError(v);
    rootFieldErrors.title = v;
  }, []);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const queryClient = useQueryClient();
  const editorSurface = {
    appBg: "var(--input)",
    chromeBg: "var(--input)",
    chromeHover: isDark ? "hsl(215, 20%, 18%)" : "#f3f4f6",
    border: "var(--border)",
    borderStrong: isDark ? "hsl(215, 20%, 28%)" : "#d1d5db",
    text: isDark ? "#f3f4f6" : "#111827",
    textSoft: isDark ? "#d1d5db" : "#374151",
    textMuted: isDark ? "#9ca3af" : "#6b7280",
    textSubtle: isDark ? "#64748b" : "#94a3b8",
    cardBg: isDark ? "var(--card)" : "#ffffff",
    cardBgAlt: isDark ? "var(--muted)" : "#f8fafc",
    cardShadow: isDark
      ? "0 0 0 1px var(--border), 0 18px 42px rgba(0,0,0,0.35)"
      : "0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)",
    controlBg: isDark ? "hsl(215, 20%, 16%)" : "#ffffff",
    controlBorder: isDark ? "hsl(215, 20%, 25%)" : "#e5e7eb",
    previewFrameBg: isDark ? "hsl(215, 22%, 12%)" : "#ffffff",
  };

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
  // Whether the AI is rewriting the title + subject from the editor content
  const [metaAiAction, setMetaAiAction] = useState<NewsletterMetaTransformAction | null>(null);
  const generatingMeta = Boolean(metaAiAction);
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
            setNotionHtmlContent(normalizeAiHtml(stripNotionPhotoCredits(parsed.notionHtml)));
          } else {
            setDetectedEditorType('classic');
            // Ensure root props include title/subject from DB for the Puck fields
            if (parsed.root?.props) {
              parsed.root.props.title = nl.title || parsed.root.props.title || "";
              parsed.root.props.subject = nl.subject || parsed.root.props.subject || "";
            }
            setData(parsed);
            // Keep dataRef in sync. Puck's onChange only fires after user edits,
            // so without this the ref stays at initialData and the "Back to Editor"
            // button from the preview pane wipes the content.
            dataRef.current = parsed;
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

  // Block editing newsletters that are pending review, sending, or already sent
  useEffect(() => {
    if (existingNewsletter?.newsletter) {
      const status = existingNewsletter.newsletter.status;
      if (['pending_review', 'sending', 'sent'].includes(status)) {
        toast({
          title: "Cannot edit",
          description: status === 'pending_review'
            ? "This newsletter is pending review and cannot be edited. Recall it from review first."
            : "This newsletter has already been sent and cannot be edited.",
          variant: "destructive",
        });
        setLocation(`/newsletters/${existingNewsletter.newsletter.id}`);
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
    socialLinks?: { facebook?: string; twitter?: string; instagram?: string; linkedin?: string } | string;
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
      return normalizeAiHtml(notionHtmlContent);
    }
    return extractPuckEmailHtml();
  }, [editorType, notionHtmlContent]);

  const parsedSocialLinks = useMemo(() => {
    const raw = emailDesign?.socialLinks;
    if (!raw) return undefined;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    return raw;
  }, [emailDesign?.socialLinks]);

  const buildEmailClientPreviewHtml = useCallback(() => {
    const bodyHtml = getHtmlContent();
    const currentRootProps = dataRef.current?.root?.props;

    return wrapInEmailPreview(bodyHtml, {
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
      socialLinks: parsedSocialLinks,
      contentBackgroundColor: currentRootProps?.backgroundColor,
      bodyBackgroundColor: currentRootProps?.bodyBackgroundColor,
      footerTextColor: currentRootProps?.footerTextColor,
    });
  }, [emailDesign, getHtmlContent, parsedSocialLinks]);

  const openEmailClientPreview = useCallback(() => {
    setEmailClientPreviewHtml(buildEmailClientPreviewHtml());
    setEmailClientPreviewMode("desktop");
    setEmailClientPreviewOpen(true);
  }, [buildEmailClientPreviewHtml]);

  useEffect(() => {
    if (emailClientPreviewOpen) {
      setEmailClientPreviewHtml(buildEmailClientPreviewHtml());
    }
  }, [buildEmailClientPreviewHtml, emailClientPreviewOpen]);

  // Rewrite BOTH the newsletter title and the subject line from the main editor content
  // and the current field values. The subject prompt stays optimized to read like editorial
  // newsletter content (not marketing) so it avoids spam / Promotions-folder cues.
  const handleTransformMeta = useCallback(async (action: NewsletterMetaTransformAction = "regenerate", instruction?: string) => {
    if (generatingMeta) return;

    const html = getHtmlContent();
    const plainText = (html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (plainText.length < 20 && !title.trim() && !subject.trim()) {
      toast({
        title: t("newsletter.create.aiMeta.notEnoughTitle", "Not enough content"),
        description: t("newsletter.create.aiMeta.notEnoughDesc", "Add some content to the editor before generating with AI."),
        variant: "destructive",
      });
      return;
    }

    const nextInstruction = instruction?.trim();
    if (action === "custom" && !nextInstruction) {
      toast({
        title: t("newsletter.create.aiMeta.directionRequiredTitle", "Add a direction"),
        description: t("newsletter.create.aiMeta.directionRequiredDesc", "Tell AI how to rewrite the title and subject first."),
        variant: "destructive",
      });
      return;
    }

    setMetaAiAction(action);
    try {
      const res = await transformTitleAndSubject({
        content: html,
        title,
        subject,
        action,
        instruction: nextInstruction,
      });
      if (res.success && (res.title || res.subject)) {
        if (res.title) {
          setTitle(res.title);
          setTitleError(false);
        }
        if (res.subject) {
          setSubject(res.subject);
        }
        setHasUnsavedChanges(true);
      } else {
        toast({
          title: t("newsletter.create.aiMeta.failedTitle", "Generation failed"),
          description: res.error || t("newsletter.create.aiMeta.failedDesc", "Could not generate. Please try again."),
          variant: "destructive",
        });
      }
    } finally {
      setMetaAiAction(null);
    }
  }, [generatingMeta, getHtmlContent, subject, title, toast, t]);

  // Save newsletter to database (create or update)
  // Returns true on success, false on validation failure. Throws on API error.
  const saveToDatabase = useCallback(async (status: 'draft' | 'ready_to_send' | 'scheduled' = 'draft', { silent = false }: { silent?: boolean } = {}) => {
    const normalizedNotionHtml = editorType === 'notion' ? normalizeAiHtml(notionHtmlContent) : "";
    const htmlContent = editorType === 'notion' ? normalizedNotionHtml : extractPuckEmailHtml();
    const puckDataJson = editorType === 'notion' ? JSON.stringify({ notionHtml: normalizedNotionHtml }) : JSON.stringify(dataRef.current);
    const currentTitle = titleRef.current.trim();
    if (!currentTitle) {
      if (!silent) {
        setTitleError(true);
        toast({
          title: t("newsletter.create.validationError", "Validation Error"),
          description: t("newsletter.create.titleRequired", "Newsletter Name is required"),
          variant: "destructive",
        });
      }
      return false;
    }
    setTitleError(false);
    const currentSubject = subjectRef.current.trim() || currentTitle;

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
  }, [reactionsEnabled, publishToBlog, toast, queryClient, editorType, notionHtmlContent]);

  const handleSaveDraft = useCallback(async () => {
    try {
      const result = await saveToDatabase('draft');
      if (result) {
        toast({ title: t("newsletter.create.draftSaved", "Draft Saved"), description: t("newsletter.create.draftSavedDesc", "Newsletter draft saved successfully.") });
      }
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
        await saveToDatabase('draft', { silent: true });
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

  const handlePublish = useCallback(async (publishData: UserData) => {
    // Validate required fields
    const currentTitle = titleRef.current.trim();
    const currentSubject = subjectRef.current.trim();
    
    if (!currentTitle) {
      setTitleError(true);
      toast({
        title: t("newsletter.create.validationError", "Validation Error"),
        description: t("newsletter.create.titleRequired", "Newsletter Name is required"),
        variant: "destructive",
      });
      return;
    }
    setTitleError(false);

    if (!currentSubject) {
      toast({
        title: t("newsletter.create.validationError", "Validation Error"),
        description: t("newsletter.create.subjectRequired", "Email Subject Line is required"),
        variant: "destructive",
      });
      return;
    }
    
    setData(publishData);
    dataRef.current = publishData;
    try {
      await saveToDatabase('ready_to_send');
      setHasUnsavedChanges(false);
      setShowSendWizard(true);
    } catch {
      // Error handled in saveToDatabase
    }
  }, [saveToDatabase]);

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
    const rootProps = newData?.root?.props;
    if (rootProps?.title !== undefined) {
      titleRef.current = rootProps.title;
      if (rootProps.title.trim()) {
        if (rootFieldErrors.title) rootFieldErrors.title = false;
        if (titleError) {
          _setTitleError(false);
          // Sync data state so the Puck remount from key change has current data
          setData(newData);
        }
      }
    }
    if (rootProps?.subject !== undefined) subjectRef.current = rootProps.subject;
  }, [titleError]);

  const handleConfirmExit = useCallback(() => {
    setHasUnsavedChanges(false);
    setShowExitDialog(false);
    rootFieldErrors.title = false;
    _setTitleError(false);
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

  if (!isClient || (isEditMode && isLoadingNewsletter)) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: editorSurface.appBg }}>
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
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: editorSurface.appBg, color: editorSurface.text }}>
          {/* Top bar with close X */}
          <div style={{
            display: "flex",
            alignItems: "center",
            height: "40px",
            padding: "0 12px",
            borderBottom: `1px solid ${editorSurface.border}`,
            background: editorSurface.chromeBg,
            flexShrink: 0,
            justifyContent: "flex-end",
          }}>
            <button
              onClick={() => {
                if (hasUnsavedChanges) {
                  setPendingNavigation(basePath);
                  setShowExitDialog(true);
                } else {
                  setLocation(basePath);
                }
                rootFieldErrors.title = false;
                _setTitleError(false);
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
                color: editorSurface.textMuted,
              }}
              title="Close editor"
              data-testid="button-close"
              onMouseEnter={(e) => { e.currentTarget.style.background = editorSurface.chromeHover; e.currentTarget.style.color = editorSurface.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = editorSurface.textMuted; }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: editorSurface.appBg }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: editorSurface.textMuted }} />
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
                    borderBottom: `1px solid ${editorSurface.border}`,
                    background: editorSurface.chromeBg,
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
                      onClick={openEmailClientPreview}
                      style={{
                        padding: '6px 12px',
                        background: editorSurface.controlBg,
                        color: editorSurface.textSoft,
                        border: `1px solid ${editorSurface.controlBorder}`,
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
                      <Eye size={14} />
                      {t("newsletter.create.preview", "Preview")}
                    </button>
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
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: editorSurface.appBg }}>
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

                      // The email card mirrors the real sent email, so its surface
                      // stays light regardless of the app's light/dark theme.
                      const emailInk = {
                        surface: '#ffffff',
                        titleText: '#111827',
                        metaText: '#6b7280',
                        bodyText: '#334155',
                        border: '#e2e8f0',
                        footerText: '#64748b',
                        footerSubtle: '#94a3b8',
                        shadow: '0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)',
                      };

                      return (
                        <div style={{
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '24px 20px',
                          minHeight: '100%',
                        }}>
                          {/* Newsletter subject & internal title — separate from the email card */}
                          <div style={{
                            width: '100%',
                            maxWidth: '620px',
                            marginBottom: '10px',
                            padding: '20px 24px 16px',
                            background: emailInk.surface,
                            borderRadius: '2px',
                            boxShadow: emailInk.shadow,
                            fontFamily,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="newsletter-create-title-input"
                                type="text"
                                value={title}
                                onChange={(e) => { setTitle(e.target.value); setHasUnsavedChanges(true); if (titleError && e.target.value.trim()) setTitleError(false); }}
                                placeholder="Newsletter Name *"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  border: 'none',
                                  outline: 'none',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  color: emailInk.metaText,
                                  background: 'transparent',
                                  padding: 0,
                                  margin: 0,
                                  fontFamily,
                                  lineHeight: 1.35,
                                }}
                              />
                              <TitleSubjectAiMenu
                                processingAction={metaAiAction}
                                onTransform={handleTransformMeta}
                                t={t}
                                surface={editorSurface}
                              />
                            </div>
                            <input
                              className="newsletter-create-subject-input"
                              type="text"
                              value={subject}
                              onChange={(e) => { setSubject(e.target.value); setHasUnsavedChanges(true); }}
                              placeholder="Email subject line..."
                              style={{
                                width: '100%',
                                border: 'none',
                                outline: 'none',
                                fontSize: '26px',
                                fontWeight: 700,
                                color: emailInk.titleText,
                                background: 'transparent',
                                padding: 0,
                                margin: '8px 0 0 0',
                                fontFamily,
                                lineHeight: 1.18,
                              }}
                            />
                          </div>

                          <div className="newsletter-email-canvas" style={{
                            width: '100%',
                            maxWidth: '620px',
                            boxShadow: emailInk.shadow,
                            background: emailInk.surface,
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
                            <div className="notion-editor-embedded" style={{ padding: '20px 24px 32px 24px', fontSize: '16px', lineHeight: '1.625', color: emailInk.bodyText }}>
                              {dataReady ? (
                                <LazyNotionEditor
                                  key={puckKeyRef.current}
                                  content={notionHtmlContent}
                                  onChange={(html) => {
                                    setNotionHtmlContent(normalizeAiHtml(html));
                                    setHasUnsavedChanges(true);
                                  }}
                                  placeholder={undefined}
                                  className="notion-editor-embedded"
                                />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: editorSurface.textMuted }} />
                                </div>
                              )}
                            </div>

                            {/* Branded email footer */}
                            <div style={{
                              backgroundColor: emailInk.surface,
                              padding: '32px',
                              textAlign: 'center',
                              borderTop: `1px solid ${emailInk.border}`,
                              color: emailInk.footerText,
                            }}>
                              {socialLinks && (socialLinks.facebook || socialLinks.twitter || socialLinks.instagram || socialLinks.linkedin) && (
                                <div style={{ marginBottom: '24px' }}>
                                  {[
                                    socialLinks.facebook && 'Facebook',
                                    socialLinks.twitter && 'Twitter',
                                    socialLinks.instagram && 'Instagram',
                                    socialLinks.linkedin && 'LinkedIn',
                                  ].filter(Boolean).map((name, i, arr) => (
                                    <span key={name} style={{ color: emailInk.footerText, fontSize: '13px', fontWeight: 500 }}>
                                      {name}{i < arr.length - 1 ? ' | ' : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {footerText && (
                                <p style={{ margin: '0 0 16px 0', fontSize: '12px', lineHeight: '1.5', color: emailInk.footerText }}>
                                  {footerText}
                                </p>
                              )}
                              {companyName && showName && (
                                <div style={{ fontSize: '12px', lineHeight: '1.5', color: emailInk.footerSubtle }}>
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
                  <LazyClassicPuckEditor
                    key={puckKeyRef.current}
                    data={data}
                    onChange={handleDataChange}
                    onPublish={handlePublish}
                    emailDesign={emailDesign}
                    viewport={viewport}
                    zoom={zoom}
                    isDark={isDark}
                    t={t}
                    justSaved={justSaved}
                    isSaving={isSaving}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onSetViewport={setViewport}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onZoomReset={handleZoomReset}
                    onOpenPreview={() => setPreviewOpen(true)}
                    onSaveDraft={handleSaveDraft}
                    onRenderPreview={() => {
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
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: editorSurface.appBg }}>
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: editorSurface.textMuted }} />
                  </div>
                )
              )}
            </Suspense>
          </div>
        </div>
        <NewsletterEmailClientPreviewDialog
          open={emailClientPreviewOpen}
          onOpenChange={setEmailClientPreviewOpen}
          previewMode={emailClientPreviewMode}
          onPreviewModeChange={setEmailClientPreviewMode}
          previewHtml={emailClientPreviewHtml}
          title={title}
          subject={subject}
          senderName={emailDesign?.companyName || ""}
        />
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
          newsletterTitle={titleRef.current || `Untitled ${emailType === 'advertise' ? 'Advertisement' : 'Newsletter'}`}
          newsletterReviewStatus={existingNewsletter?.newsletter?.reviewStatus}
          shopId={existingNewsletter?.newsletter?.shopId || null}
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
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: isDark ? editorSurface.appBg : (dataRef.current?.root?.props?.bodyBackgroundColor || "#f7fafc"), color: editorSurface.text }}>
        {/* Toolbar */}
        <div
          style={{
            background: editorSurface.chromeBg,
            borderBottom: `1px solid ${editorSurface.border}`,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: editorSurface.text }}>
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
                    background: previewViewport === vp ? "#2563eb" : editorSurface.controlBg,
                    color: previewViewport === vp ? "#fff" : editorSurface.textSoft,
                    border: `1px solid ${previewViewport === vp ? "#2563eb" : editorSurface.controlBorder}`,
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
              boxShadow: isDark ? "0 18px 48px rgba(0,0,0,0.38), 0 0 0 1px hsla(215, 20%, 28%, 0.9)" : "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)",
              borderRadius: "8px",
              overflow: "hidden",
              background: editorSurface.previewFrameBg,
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
        newsletterTitle={titleRef.current || `Untitled ${emailType === 'advertise' ? 'Advertisement' : 'Newsletter'}`}
        newsletterReviewStatus={existingNewsletter?.newsletter?.reviewStatus}
        shopId={existingNewsletter?.newsletter?.shopId || null}
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
