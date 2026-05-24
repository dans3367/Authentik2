import { lazy, Suspense } from "react";
import { ComponentConfig } from "@puckeditor/core";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";

const LazyPanelFieldWrapper = lazy(() =>
  import("./runtime").then((m) => ({ default: m.PanelFieldWrapper }))
);
const LazyInlineCanvasEditor = lazy(() =>
  import("./runtime").then((m) => ({ default: m.InlineCanvasEditor }))
);
const LazyAiTextCreator = lazy(() =>
  import("@/components/puck/AiTextCreator").then((m) => ({ default: m.AiTextCreator }))
);

export type RichTextProps = WithLayout<{
  html: string;
  maxWidth?: string;
  _aiCreator?: string;
}>;

const EDITOR_STYLES = `
  .puck-richtext-editor { outline: none; min-height: 40px; overflow-wrap: break-word; word-break: break-word; }
  .puck-richtext-editor h1 { font-size: 28px; font-weight: 700; margin: 0 0 12px 0; line-height: 1.3; }
  .puck-richtext-editor h2 { font-size: 22px; font-weight: 700; margin: 0 0 10px 0; line-height: 1.3; }
  .puck-richtext-editor h3 { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; line-height: 1.3; }
  .puck-richtext-editor p { margin: 0 0 10px 0; line-height: 1.6; }
  .puck-richtext-editor ul { margin: 0 0 10px 0; padding-left: 24px; list-style-type: disc; }
  .puck-richtext-editor ol { margin: 0 0 10px 0; padding-left: 24px; list-style-type: decimal; }
  .puck-richtext-editor li { margin-bottom: 4px; line-height: 1.5; }
  .puck-richtext-editor li p { margin: 0; }
  .puck-richtext-editor strong { font-weight: 700; }
  .puck-richtext-editor em { font-style: italic; }
  .puck-richtext-editor u { text-decoration: underline; }
  .puck-richtext-editor hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
  .puck-richtext-editor blockquote { border-left: 3px solid #d1d5db; padding-left: 12px; margin: 0 0 10px 0; color: #6b7280; }
  .puck-richtext-editor a { color: #3b82f6; text-decoration: underline; }
  .puck-richtext-editor .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left; color: #9ca3af; pointer-events: none; height: 0;
  }
  .puck-richtext-editor .notion-resizable-image-wrapper { display: block; margin: 8px 0; text-align: center; }
  .puck-richtext-editor .notion-resizable-image { position: relative; display: inline-block; border-radius: 4px; overflow: hidden; line-height: 0; transition: box-shadow 0.15s; }
  .puck-richtext-editor .notion-resizable-image img { border-radius: 4px; display: block; pointer-events: none; user-select: none; }
  .puck-richtext-editor .notion-resizable-image.selected { box-shadow: 0 0 0 2px #6366f1; }
  .puck-richtext-editor .notion-resizable-image.resizing { box-shadow: 0 0 0 2px #8b5cf6; user-select: none; }
  .puck-richtext-editor .notion-resize-handle { position: absolute; top: 0; bottom: 0; width: 20px; display: flex; align-items: center; justify-content: center; cursor: col-resize; z-index: 5; opacity: 0; transition: opacity 0.15s; }
  .puck-richtext-editor .notion-resizable-image:hover .notion-resize-handle,
  .puck-richtext-editor .notion-resizable-image.selected .notion-resize-handle,
  .puck-richtext-editor .notion-resizable-image.resizing .notion-resize-handle { opacity: 1; }
  .puck-richtext-editor .notion-resize-handle-left { left: 0; }
  .puck-richtext-editor .notion-resize-handle-right { right: 0; }
  .puck-richtext-editor .notion-resize-handle-bar { width: 4px; height: 40px; max-height: 50%; border-radius: 4px; background: rgba(255,255,255,0.85); box-shadow: 0 0 4px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08); transition: background 0.15s, transform 0.15s; }
  .puck-richtext-editor .notion-resize-handle:hover .notion-resize-handle-bar { background: #fff; transform: scaleY(1.15); box-shadow: 0 0 6px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.12); }
  .puck-richtext-editor .notion-resizable-image.resizing .notion-resize-handle-bar { background: #a78bfa; }
  .handlebar-variable-node { display: inline; }
  .handlebar-pill { display: inline-flex; align-items: center; gap: 1px; padding: 1px 7px; background: linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%); border: 1px solid #bfdbfe; border-radius: 5px; font-size: 0.875em; line-height: 1.5; vertical-align: baseline; cursor: default; user-select: all; transition: background 0.15s, border-color 0.15s, box-shadow 0.15s; }
  .handlebar-pill:hover { background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border-color: #93c5fd; box-shadow: 0 1px 3px rgba(59,130,246,0.12); }
  .ProseMirror-selectednode .handlebar-pill { background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
  .handlebar-pill-braces { font-family: 'JetBrains Mono','Fira Code','Cascadia Code',monospace; font-size: 0.8em; font-weight: 600; color: #6366f1; opacity: 0.6; }
  .handlebar-pill-label { font-weight: 600; color: #3b82f6; white-space: nowrap; font-size: 0.92em; }
`;

function PanelLoadingFallback() {
  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        background: "#fff",
        padding: "12px",
        fontSize: "12px",
        color: "#6b7280",
      }}
    >
      Loading rich text editor…
    </div>
  );
}

function CanvasLoadingFallback() {
  return (
    <div
      style={{
        minHeight: "40px",
        padding: "8px 0",
        fontSize: "14px",
        color: "#6b7280",
      }}
    >
      Loading editor…
    </div>
  );
}

function AiLoadingFallback() {
  return (
    <div
      style={{
        marginTop: "4px",
        padding: "10px 12px",
        borderRadius: "8px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        fontSize: "12px",
        color: "#6b7280",
      }}
    >
      Loading AI Creator…
    </div>
  );
}

const RichTextInner: ComponentConfig<RichTextProps> = {
  fields: {
    html: {
      type: "custom",
      label: "Content",
      render: ({ value, onChange }) => (
        <Suspense fallback={<PanelLoadingFallback />}>
          <LazyPanelFieldWrapper value={value} onChange={onChange} />
        </Suspense>
      ),
    },
    _aiCreator: {
      type: "custom",
      label: "AI Creator",
      render: () => (
        <Suspense fallback={<AiLoadingFallback />}>
          <LazyAiTextCreator fieldName="html" />
        </Suspense>
      ),
    },
    maxWidth: { type: "text" },
  },
  defaultProps: {
    html: "<p>Start typing your rich text content here…</p>",
    maxWidth: undefined,
  },
  render: ({ html, maxWidth, puck, id }: any) => {
    const isEditing = !!(puck as any)?.isEditing;

    if (!isEditing) {
      return (
        <Section maxWidth={maxWidth}>
          <style>{EDITOR_STYLES}</style>
          <div className="puck-richtext-editor" style={{ color: "#0f0f0f" }} dangerouslySetInnerHTML={{ __html: html || "" }} />
        </Section>
      );
    }

    return (
      <Section maxWidth={maxWidth}>
        <Suspense fallback={<CanvasLoadingFallback />}>
          <LazyInlineCanvasEditor html={html ?? ""} ownId={id} />
        </Suspense>
      </Section>
    );
  },
};

export const RichText = withLayout(RichTextInner);
