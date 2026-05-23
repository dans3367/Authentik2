import { useEffect, useMemo, useRef, useState } from "react";
import { Puck, blocksPlugin, outlinePlugin } from "@puckeditor/core";
import type { TFunction } from "i18next";
import { Monitor, Smartphone, ZoomIn, ZoomOut, Mail, Save, Loader2, Rocket, Eye } from "lucide-react";
import { createConfig } from "@/config/puck";
import { templatesPlugin } from "@/config/puck/templates-plugin";
import { usePreviewColors } from "@/components/puck/PreviewWrapper";
import type { UserData } from "@/config/puck/puck-shared";
import "@puckeditor/core/puck.css";

interface SaveStatusIndicatorProps {
  justSavedRef: React.MutableRefObject<boolean>;
  isSavingRef: React.MutableRefObject<boolean>;
  hasUnsavedChangesRef: React.MutableRefObject<boolean>;
  t: (key: string, fallback: string) => string;
}

function SaveStatusIndicator({ justSavedRef, isSavingRef, hasUnsavedChangesRef, t }: SaveStatusIndicatorProps) {
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

type EmailDesign = any;

function PuckEmailPreview({
  children,
  emailDesign,
  viewport,
  zoom,
}: {
  children: React.ReactNode;
  emailDesign: EmailDesign;
  viewport: "mobile" | "desktop";
  zoom: number;
}) {
  const { bodyBg, contentBg, footerTextColor } = usePreviewColors();

  const primaryColor = emailDesign?.primaryColor || "#3B82F6";
  const companyName = emailDesign?.companyName || "";
  const logoUrl = emailDesign?.logoUrl;
  const headerText = emailDesign?.headerText;
  const footerText = emailDesign?.footerText || "";
  const socialLinks = emailDesign?.socialLinks;
  const fontFamily = emailDesign?.fontFamily || "Arial, Helvetica, sans-serif";
  const logoSizeMap: Record<string, string> = { small: "64px", medium: "96px", large: "128px", xlarge: "160px" };
  const logoHeight = logoSizeMap[emailDesign?.logoSize || "medium"] || "48px";
  const showName = (emailDesign?.showCompanyName ?? "true") === "true";
  const headerMode = emailDesign?.headerMode || "logo";
  const bannerUrl = emailDesign?.bannerUrl;
  const useBanner = headerMode === "banner" && !!bannerUrl;
  const logoAlign = (emailDesign?.logoAlignment || "center") as "left" | "center" | "right";
  const logoML = logoAlign === "center" ? "auto" : logoAlign === "right" ? "auto" : "0";
  const logoMR = logoAlign === "center" ? "auto" : logoAlign === "right" ? "0" : "auto";
  const viewportWidths: Record<string, string> = { mobile: "360px", desktop: "100%" };

  return (
    <div style={{ width: "100%", minHeight: "100%", display: "flex", justifyContent: "center", alignItems: "stretch", padding: viewport !== "desktop" ? "20px" : "0", background: bodyBg, overflow: "auto" }}>
      <div style={{ width: viewport === "desktop" ? "100%" : viewportWidths[viewport], maxWidth: viewport === "desktop" ? "620px" : viewportWidths[viewport], boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)", background: contentBg, transform: `scale(${zoom / 100})`, transformOrigin: "top center", transition: "transform 0.2s ease-out", margin: "0 auto", fontFamily, display: "flex", flexDirection: "column" }}>
        {useBanner ? (
          <>
            <img src={bannerUrl} alt={companyName} style={{ display: "block", width: "100%", height: "auto", border: 0 }} />
            {(showName && companyName) || headerText ? (
              <div style={{ padding: "16px 24px", textAlign: "center", backgroundColor: primaryColor, color: "#ffffff" }}>
                {companyName && showName ? <h1 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: "bold", letterSpacing: "-0.025em", color: "#ffffff", fontFamily }}>{companyName}</h1> : null}
                {headerText ? <p style={{ margin: "0 auto", fontSize: "16px", opacity: 0.95, maxWidth: "400px", lineHeight: "1.5", color: "#ffffff" }}>{headerText}</p> : null}
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ padding: "40px 24px", textAlign: logoAlign, backgroundColor: primaryColor, color: "#ffffff" }}>
            {logoUrl ? <img src={logoUrl} alt={companyName} style={{ height: logoHeight, width: "auto", objectFit: "contain", display: "block", margin: `0 ${logoMR} 20px ${logoML}` }} /> : (companyName && showName) ? <div style={{ height: "48px", width: "48px", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "50%", margin: `0 ${logoMR} 16px ${logoML}`, lineHeight: "48px", fontSize: "20px", fontWeight: "bold", color: "#ffffff", textAlign: "center" }}>{companyName.charAt(0)}</div> : null}
            {companyName && showName ? <h1 style={{ margin: "0 0 10px 0", fontSize: "24px", fontWeight: "bold", letterSpacing: "-0.025em", color: "#ffffff", fontFamily }}>{companyName}</h1> : null}
            {headerText ? <p style={{ margin: `0 ${logoMR} 0 ${logoML}`, fontSize: "16px", opacity: 0.95, maxWidth: "400px", lineHeight: "1.5", color: "#ffffff" }}>{headerText}</p> : null}
          </div>
        )}

        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: "collapse", border: "none", flex: 1 }}>
          <tbody>
            <tr>
              <td style={{ padding: 0, fontSize: "16px", lineHeight: "1.625", color: "#334155", verticalAlign: "top" }}>{children}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ backgroundColor: contentBg, padding: "32px", textAlign: "center", borderTop: "1px solid #e2e8f0", color: footerTextColor, marginTop: "auto" }}>
          {socialLinks && (socialLinks.facebook || socialLinks.twitter || socialLinks.instagram || socialLinks.linkedin) ? (
            <div style={{ marginBottom: "24px" }}>
              {[socialLinks.facebook && "Facebook", socialLinks.twitter && "Twitter", socialLinks.instagram && "Instagram", socialLinks.linkedin && "LinkedIn"].filter(Boolean).map((name, i, arr) => (
                <span key={String(name)} style={{ color: footerTextColor, fontSize: "13px", fontWeight: 500 }}>
                  {name}{i < arr.length - 1 ? " | " : ""}
                </span>
              ))}
            </div>
          ) : null}
          {footerText ? <p style={{ margin: "0 0 16px 0", fontSize: "12px", lineHeight: "1.5", color: footerTextColor }}>{footerText}</p> : null}
          {companyName && showName ? <div style={{ fontSize: "12px", lineHeight: "1.5", color: footerTextColor, opacity: 0.7 }}><p style={{ margin: 0 }}>Sent via {companyName}</p></div> : null}
        </div>
      </div>
    </div>
  );
}

export interface ClassicPuckEditorProps {
  data: UserData;
  onChange: (newData: UserData) => void;
  onPublish: (publishData: UserData) => void | Promise<void>;
  emailDesign: any;
  viewport: "mobile" | "desktop";
  zoom: number;
  isDark: boolean;
  t: TFunction;
  justSaved: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onSetViewport: (viewport: "mobile" | "desktop") => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onOpenPreview: () => void;
  onSaveDraft: () => Promise<void>;
  onRenderPreview: () => void;
}

export default function ClassicPuckEditor(props: ClassicPuckEditorProps) {
  const {
    data,
    onChange,
    onPublish,
    emailDesign,
    viewport,
    zoom,
    isDark,
    t,
    justSaved,
    isSaving,
    hasUnsavedChanges,
    onSetViewport,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onOpenPreview,
    onSaveDraft,
    onRenderPreview,
  } = props;

  const translatedConfig = useMemo(() => createConfig(t), [t]);
  const iframeConfig = useMemo(() => ({ enabled: false }), []);
  const plugins = useMemo(() => ([
    { ...blocksPlugin(), label: t("puckEditor.sidebar.blocks", { defaultValue: "Blocks" }) },
    { ...outlinePlugin(), label: t("puckEditor.sidebar.outline", { defaultValue: "Outline" }) },
    templatesPlugin((key, fallback) => t(key, { defaultValue: fallback })),
  ]), [t]);

  const justSavedRef = useRef(justSaved);
  justSavedRef.current = justSaved;
  const isSavingRef = useRef(isSaving);
  isSavingRef.current = isSaving;
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;
  const handleSaveDraftRef = useRef(onSaveDraft);
  handleSaveDraftRef.current = onSaveDraft;

  const overrides = useMemo(() => ({
    preview: ({ children }: { children: React.ReactNode }) => (
      <PuckEmailPreview emailDesign={emailDesign} viewport={viewport} zoom={zoom}>
        {children}
      </PuckEmailPreview>
    ),
    headerActions: () => (
      <>
        <div style={{ display: "flex", marginRight: "auto", alignItems: "center", minWidth: 0, flex: 1 }}>
          <SaveStatusIndicator justSavedRef={justSavedRef} isSavingRef={isSavingRef} hasUnsavedChangesRef={hasUnsavedChangesRef} t={(key, fallback) => String(t(key, { defaultValue: fallback }))} />
        </div>
        <div style={{ display: "flex", gap: "4px", marginRight: "8px" }}>
          <button onClick={() => onSetViewport("mobile")} style={{ padding: "8px", background: viewport === "mobile" ? "#2563eb" : isDark ? "var(--card)" : "#fff", color: viewport === "mobile" ? "#fff" : isDark ? "#d1d5db" : "#000", border: isDark ? "1px solid var(--border)" : "1px solid #e5e7eb", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }} title={String(t("newsletter.create.mobileView", { defaultValue: "Mobile view" }))} data-testid="viewport-mobile"><Smartphone size={16} /><span style={{ fontSize: "12px" }}>360px</span></button>
          <button onClick={() => onSetViewport("desktop")} style={{ padding: "8px", background: viewport === "desktop" ? "#2563eb" : isDark ? "var(--card)" : "#fff", color: viewport === "desktop" ? "#fff" : isDark ? "#d1d5db" : "#000", border: isDark ? "1px solid var(--border)" : "1px solid #e5e7eb", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }} title={String(t("newsletter.create.desktopView", { defaultValue: "Desktop view" }))} data-testid="viewport-desktop"><Monitor size={16} /><span style={{ fontSize: "12px" }}>{String(t("newsletter.create.full", { defaultValue: "Full" }))}</span></button>
        </div>
        <div style={{ display: "flex", gap: "4px", marginRight: "8px", alignItems: "center" }}>
          <button onClick={onZoomOut} disabled={zoom <= 25} style={{ padding: "8px", background: isDark ? "var(--card)" : "#fff", color: zoom <= 25 ? "#9ca3af" : isDark ? "#d1d5db" : "#000", border: isDark ? "1px solid var(--border)" : "1px solid #e5e7eb", borderRadius: "4px", cursor: zoom <= 25 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px" }} title={String(t("newsletter.create.zoomOut", { defaultValue: "Zoom out" }))} data-testid="zoom-out"><ZoomOut size={16} /></button>
          <button onClick={onZoomReset} style={{ padding: "8px 12px", background: isDark ? "var(--card)" : "#fff", color: isDark ? "#d1d5db" : "#000", border: isDark ? "1px solid var(--border)" : "1px solid #e5e7eb", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: 500, minWidth: "60px" }} title={String(t("newsletter.create.resetZoom", { defaultValue: "Reset zoom" }))} data-testid="zoom-reset">{zoom}%</button>
          <button onClick={onZoomIn} disabled={zoom >= 100} style={{ padding: "8px", background: isDark ? "var(--card)" : "#fff", color: zoom >= 100 ? "#9ca3af" : isDark ? "#d1d5db" : "#000", border: isDark ? "1px solid var(--border)" : "1px solid #e5e7eb", borderRadius: "4px", cursor: zoom >= 100 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px" }} title={String(t("newsletter.create.zoomIn", { defaultValue: "Zoom in" }))} data-testid="zoom-in"><ZoomIn size={16} /></button>
        </div>
        <button onClick={onOpenPreview} style={{ padding: "4px 12px", marginRight: "8px", background: "#7c3aed", color: "white", border: "1px solid #7c3aed", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 500, height: "32px", boxSizing: "border-box", whiteSpace: "nowrap" }} data-testid="button-send-preview"><Mail size={16} />{String(t("newsletter.create.sendPreview", { defaultValue: "Send Preview" }))}</button>
        <SaveDraftButton isSavingRef={isSavingRef} handleSaveDraftRef={handleSaveDraftRef} t={(key, fallback) => String(t(key, { defaultValue: fallback }))} />
        <button onClick={onRenderPreview} style={{ padding: "4px 12px", marginRight: "8px", background: "#4b5563", color: "white", border: "1px solid #4b5563", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 500, height: "32px", boxSizing: "border-box", whiteSpace: "nowrap" }} data-testid="button-preview"><Eye size={16} />{String(t("newsletter.create.preview", { defaultValue: "Preview" }))}</button>
        <button onClick={() => onPublish(data)} style={{ padding: "4px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600, height: "32px", boxSizing: "border-box", whiteSpace: "nowrap" }} data-testid="button-ready"><Rocket size={16} />{String(t("newsletter.create.ready", { defaultValue: "Ready" }))}</button>
      </>
    ),
  }), [data, emailDesign, viewport, zoom, isDark, t, onSetViewport, onZoomOut, onZoomReset, onZoomIn, onOpenPreview, onRenderPreview, onPublish]);

  return <Puck config={translatedConfig} data={data} onChange={onChange} onPublish={onPublish} iframe={iframeConfig} overrides={overrides} plugins={plugins} />;
}
