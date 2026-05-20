import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePuck, Render } from "@puckeditor/core";
import type { Plugin } from "@puckeditor/core";
import { newsletterTemplates, type NewsletterTemplate } from "./templates";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Full-screen preview overlay for a template.
 * Rendered via portal to document.body so it escapes the sidebar's overflow.
 */
function TemplatePreviewModal({
  template,
  onClose,
  onApply,
}: {
  template: NewsletterTemplate;
  onClose: () => void;
  onApply: () => void;
}) {
  const { config } = usePuck();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const dk = theme === 'dark';

  // Close on Escape & prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 20px",
      }}
      onClick={onClose}
    >
      {/* Single modal card */}
      <div
        style={{
          width: "640px",
          maxWidth: "100%",
          maxHeight: "100%",
          background: dk ? "hsl(215, 25%, 12%)" : "#fff",
          borderRadius: "12px",
          boxShadow: dk ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.2)",
          border: dk ? "1px solid hsl(215, 20%, 22%)" : "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 12px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: 600, fontSize: "16px", color: dk ? "#e5e7eb" : "#111827" }}>
              {t(`puckEditor.templates.items.${template.id}.name`, template.name)}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: "4px",
                background: template.category === "product"
                  ? dk ? "hsl(40, 50%, 20%)" : "#fef3c7"
                  : dk ? "hsl(215, 40%, 20%)" : "#dbeafe",
                color: template.category === "product"
                  ? dk ? "#fbbf24" : "#92400e"
                  : dk ? "#93c5fd" : "#1e40af",
                textTransform: "capitalize",
              }}
            >
              {t(`puckEditor.templates.categories.${template.category}`, template.category)}
            </span>
          </div>
          {/* X close button */}
          <button
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              color: dk ? "#9ca3af" : "#6b7280",
              fontSize: "18px",
              lineHeight: 1,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = dk ? "hsl(215, 20%, 18%)" : "#f3f4f6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            &#x2715;
          </button>
        </div>

        <p
          style={{
            margin: "0",
            padding: "0 20px 12px",
            fontSize: "13px",
            lineHeight: "1.4",
            color: dk ? "#9ca3af" : "#6b7280",
            flexShrink: 0,
          }}
        >
          {t(`puckEditor.templates.items.${template.id}.description`, template.description)}
        </p>

        {/* Scrollable preview */}
        <div
          style={{
            flex: "1 1 0%",
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            borderTop: dk ? "1px solid hsl(215, 20%, 22%)" : "1px solid #e5e7eb",
            borderBottom: dk ? "1px solid hsl(215, 20%, 22%)" : "1px solid #e5e7eb",
            background: dk ? "hsl(215, 20%, 8%)" : "#f9fafb",
            padding: "24px 20px",
          }}
        >
          <div
            style={{
              maxWidth: "580px",
              margin: "0 auto",
              background: dk ? "hsl(215, 20%, 14%)" : "#fff",
              borderRadius: "6px",
              border: dk ? "1px solid hsl(215, 20%, 22%)" : "1px solid #e5e7eb",
              padding: "20px",
            }}
          >
            <Render config={config} data={template.data} />
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            padding: "14px 20px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 500,
              color: dk ? "#d1d5db" : "#374151",
              background: dk ? "hsl(215, 20%, 16%)" : "#fff",
              border: dk ? "1px solid hsl(215, 20%, 25%)" : "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {t("puckEditor.templates.close", "Close")}
          </button>
          <button
            onClick={onApply}
            style={{
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              background: "#2563eb",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {t("puckEditor.templates.useThis", "Use this template")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Templates panel rendered inside the Puck sidebar plugin tab.
 */
function TemplatesPanel() {
  const { dispatch } = usePuck();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const dk = theme === 'dark';
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<NewsletterTemplate | null>(null);
  const [filter, setFilter] = useState<"all" | "newsletter" | "product">("all");

  const filterLabels: Record<string, string> = {
    all: t("puckEditor.templates.filters.all", "All"),
    newsletter: t("puckEditor.templates.filters.newsletter", "Newsletter"),
    product: t("puckEditor.templates.filters.product", "Product"),
  };

  const filtered =
    filter === "all"
      ? newsletterTemplates
      : newsletterTemplates.filter((t) => t.category === filter);

  const applyTemplate = (template: NewsletterTemplate) => {
    dispatch({
      type: "setData",
      data: {
        content: template.data.content,
        root: template.data.root,
        zones: template.data.zones || {},
      },
    });
    setConfirmId(null);
    setPreviewTemplate(null);
  };

  return (
    <div style={{ padding: "12px", fontSize: "13px" }}>
      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "12px",
          borderBottom: dk ? "1px solid hsl(215, 20%, 22%)" : "1px solid #e5e7eb",
          paddingBottom: "8px",
        }}
      >
        {(["all", "newsletter", "product"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: filter === f ? 600 : 400,
              color: filter === f ? (dk ? "#93c5fd" : "#2563eb") : (dk ? "#9ca3af" : "#6b7280"),
              background: filter === f ? (dk ? "hsl(215, 30%, 18%)" : "#eff6ff") : "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.map((template) => (
          <div
            key={template.id}
            style={{
              border: dk ? "1px solid hsl(215, 20%, 22%)" : "1px solid #e5e7eb",
              borderRadius: "8px",
              overflow: "hidden",
              background: dk ? "hsl(215, 20%, 14%)" : "#fff",
            }}
          >
            {/* Thumbnail */}
            <div
              style={{
                width: "100%",
                height: "100px",
                background: `url(${template.thumbnail}) center/cover no-repeat`,
                borderBottom: dk ? "1px solid hsl(215, 20%, 22%)" : "1px solid #e5e7eb",
              }}
            />
            {/* Info */}
            <div style={{ padding: "10px 12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "13px", color: dk ? "#e5e7eb" : "#111827" }}>
                  {t(`puckEditor.templates.items.${template.id}.name`, template.name)}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 500,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background:
                      template.category === "product"
                        ? dk ? "hsl(40, 50%, 20%)" : "#fef3c7"
                        : dk ? "hsl(215, 40%, 20%)" : "#dbeafe",
                    color:
                      template.category === "product"
                        ? dk ? "#fbbf24" : "#92400e"
                        : dk ? "#93c5fd" : "#1e40af",
                  }}
                >
                  {t(`puckEditor.templates.categories.${template.category}`, template.category)}
                </span>
              </div>
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "12px",
                  lineHeight: "1.4",
                  color: dk ? "#9ca3af" : "#6b7280",
                }}
              >
                {t(`puckEditor.templates.items.${template.id}.description`, template.description)}
              </p>

              {confirmId === template.id ? (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => applyTemplate(template)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#fff",
                      background: "#dc2626",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    {t("puckEditor.templates.replaceContent", "Replace content")}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: dk ? "#d1d5db" : "#374151",
                      background: dk ? "hsl(215, 20%, 18%)" : "#f3f4f6",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => setPreviewTemplate(template)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: dk ? "#d1d5db" : "#4b5563",
                      background: dk ? "hsl(215, 20%, 16%)" : "#f9fafb",
                      border: dk ? "1px solid hsl(215, 20%, 25%)" : "1px solid #d1d5db",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    {t("puckEditor.templates.preview", "Preview")}
                  </button>
                  <button
                    onClick={() => setConfirmId(template.id)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: dk ? "#93c5fd" : "#2563eb",
                      background: dk ? "hsl(215, 30%, 18%)" : "#eff6ff",
                      border: dk ? "1px solid hsl(215, 40%, 30%)" : "1px solid #bfdbfe",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    {t("puckEditor.templates.useTemplate", "Use template")}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onApply={() => applyTemplate(previewTemplate)}
        />
      )}
    </div>
  );
}

/**
 * Puck plugin that adds a "Templates" tab to the left sidebar.
 */
export function templatesPlugin(t?: (key: string, fallback?: string) => any): Plugin {
  return {
    name: "templates",
    label: t?.("puckEditor.templates.label", "Templates") || "Templates",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    render: () => <TemplatesPanel />,
  };
}
