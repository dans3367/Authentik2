import { useEffect, useRef, useCallback, useState } from "react";
import { ComponentConfig, createUsePuck } from "@puckeditor/core";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { HandlebarVariable } from "@/extensions/HandlebarVariable";
import { ResizableImage } from "@/components/ResizableImage";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";
import { AiTextCreator } from "@/components/puck/AiTextCreator";

/* ── TipTap extensions created ONCE at module level ── */
const canvasExtensions = [
  StarterKit.configure({ 
    heading: { levels: [1, 2, 3] },
    blockquote: {
      HTMLAttributes: {
        style: "border-left: 3px solid #d1d5db; padding-left: 12px; margin: 0 0 10px 0; color: #6b7280;"
      }
    }
  }),
  TextAlign.configure({ types: ["heading", "paragraph", "image"] }),
  Underline,
  Link.configure({ openOnClick: false }),
  HandlebarVariable,
  ResizableImage,
  Placeholder.configure({
    placeholder: "Start typing or use AI Creator to generate content… Type {{ for variables",
    showOnlyWhenEditable: true,
  }),
];

const panelExtensions = [
  StarterKit.configure({ 
    heading: { levels: [1, 2, 3] },
    blockquote: {
      HTMLAttributes: {
        style: "border-left: 3px solid #d1d5db; padding-left: 10px; margin: 0 0 8px 0; color: #6b7280;"
      }
    }
  }),
  TextAlign.configure({ types: ["heading", "paragraph", "image"] }),
  Underline,
  Link.configure({ openOnClick: false }),
  HandlebarVariable,
  ResizableImage,
  Placeholder.configure({
    placeholder: "Write or paste content… Type {{ for variables",
    showOnlyWhenEditable: true,
  }),
];

export type RichTextProps = WithLayout<{
  html: string;
  maxWidth?: string;
  _aiCreator?: string;
}>;

/* ── CSS for the TipTap editor inside the Puck canvas ── */
const EDITOR_STYLES = `
  .puck-richtext-editor { outline: none; min-height: 40px; }
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
  /* Resizable image styles for canvas editor */
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
  /* Handlebar variable pill */
  .handlebar-variable-node { display: inline; }
  .handlebar-pill { display: inline-flex; align-items: center; gap: 1px; padding: 1px 7px; background: linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%); border: 1px solid #bfdbfe; border-radius: 5px; font-size: 0.875em; line-height: 1.5; vertical-align: baseline; cursor: default; user-select: all; transition: background 0.15s, border-color 0.15s, box-shadow 0.15s; }
  .handlebar-pill:hover { background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border-color: #93c5fd; box-shadow: 0 1px 3px rgba(59,130,246,0.12); }
  .ProseMirror-selectednode .handlebar-pill { background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
  .handlebar-pill-braces { font-family: 'JetBrains Mono','Fira Code','Cascadia Code',monospace; font-size: 0.8em; font-weight: 600; color: #6366f1; opacity: 0.6; }
  .handlebar-pill-label { font-weight: 600; color: #3b82f6; white-space: nowrap; font-size: 0.92em; }
`;

/* ── CSS for the panel (properties-pane) TipTap editor ── */
const PANEL_STYLES = `
  .puck-panel-editor-wrap { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; background: #fff; }
  .puck-panel-toolbar { display: flex; flex-wrap: wrap; gap: 1px; padding: 4px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
  .puck-panel-toolbar button {
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    border: none; background: transparent; border-radius: 4px; cursor: pointer; color: #475569;
    font-size: 13px; font-weight: 600; line-height: 1; padding: 0; transition: background 0.15s;
  }
  .puck-panel-toolbar button:hover { background: #e2e8f0; }
  .puck-panel-toolbar button.active { background: #6366f1; color: #fff; }
  .puck-panel-toolbar button:disabled { opacity: 0.35; cursor: default; }
  .puck-panel-toolbar .sep { width: 1px; background: #d1d5db; margin: 2px 3px; align-self: stretch; }
  .puck-panel-content .tiptap { outline: none; padding: 8px 10px; min-height: 120px; max-height: 300px; overflow-y: auto; font-size: 13px; line-height: 1.6; }
  .puck-panel-content .tiptap h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
  .puck-panel-content .tiptap h2 { font-size: 17px; font-weight: 700; margin: 0 0 6px; }
  .puck-panel-content .tiptap h3 { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
  .puck-panel-content .tiptap p { margin: 0 0 8px; }
  .puck-panel-content .tiptap ul { margin: 0 0 8px; padding-left: 20px; list-style-type: disc; }
  .puck-panel-content .tiptap ol { margin: 0 0 8px; padding-left: 20px; list-style-type: decimal; }
  .puck-panel-content .tiptap li { margin-bottom: 2px; }
  .puck-panel-content .tiptap li p { margin: 0; }
  .puck-panel-content .tiptap strong { font-weight: 700; }
  .puck-panel-content .tiptap em { font-style: italic; }
  .puck-panel-content .tiptap u { text-decoration: underline; }
  .puck-panel-content .tiptap s { text-decoration: line-through; }
  .puck-panel-content .tiptap hr { border: none; border-top: 1px solid #e2e8f0; margin: 10px 0; }
  .puck-panel-content .tiptap blockquote { border-left: 3px solid #d1d5db; padding-left: 10px; margin: 0 0 8px; color: #6b7280; }
  .puck-panel-content .tiptap a { color: #3b82f6; text-decoration: underline; }
  .puck-panel-content .tiptap .is-editor-empty:first-child::before {
    content: attr(data-placeholder); float: left; color: #9ca3af; pointer-events: none; height: 0;
  }
  /* Resizable image styles for panel editor */
  .puck-panel-content .tiptap .notion-resizable-image-wrapper { display: block; margin: 6px 0; text-align: center; }
  .puck-panel-content .tiptap .notion-resizable-image { position: relative; display: inline-block; border-radius: 4px; overflow: hidden; line-height: 0; transition: box-shadow 0.15s; }
  .puck-panel-content .tiptap .notion-resizable-image img { border-radius: 4px; display: block; pointer-events: none; user-select: none; }
  .puck-panel-content .tiptap .notion-resizable-image.selected { box-shadow: 0 0 0 2px #6366f1; }
  .puck-panel-content .tiptap .notion-resizable-image.resizing { box-shadow: 0 0 0 2px #8b5cf6; user-select: none; }
  .puck-panel-content .tiptap .notion-resize-handle { position: absolute; top: 0; bottom: 0; width: 20px; display: flex; align-items: center; justify-content: center; cursor: col-resize; z-index: 5; opacity: 0; transition: opacity 0.15s; }
  .puck-panel-content .tiptap .notion-resizable-image:hover .notion-resize-handle,
  .puck-panel-content .tiptap .notion-resizable-image.selected .notion-resize-handle,
  .puck-panel-content .tiptap .notion-resizable-image.resizing .notion-resize-handle { opacity: 1; }
  .puck-panel-content .tiptap .notion-resize-handle-left { left: 0; }
  .puck-panel-content .tiptap .notion-resize-handle-right { right: 0; }
  .puck-panel-content .tiptap .notion-resize-handle-bar { width: 4px; height: 40px; max-height: 50%; border-radius: 4px; background: rgba(255,255,255,0.85); box-shadow: 0 0 4px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08); transition: background 0.15s, transform 0.15s; }
  .puck-panel-content .tiptap .notion-resize-handle:hover .notion-resize-handle-bar { background: #fff; transform: scaleY(1.15); box-shadow: 0 0 6px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.12); }
  .puck-panel-content .tiptap .notion-resizable-image.resizing .notion-resize-handle-bar { background: #a78bfa; }
`;

/* ── CSS for the insert-image popover ── */
const IMAGE_POPOVER_STYLES = `
  .puck-img-popover-anchor { position: relative; display: inline-flex; }
  .puck-img-popover {
    position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
    z-index: 50; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12); padding: 10px; width: 260px; margin-top: 4px;
  }
  .puck-img-popover label { display: block; font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 4px; }
  .puck-img-popover input[type="text"] {
    width: 100%; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 5px;
    font-size: 12px; outline: none; box-sizing: border-box;
  }
  .puck-img-popover input[type="text"]:focus { border-color: #6366f1; }
  .puck-img-popover .puck-img-actions { display: flex; gap: 6px; margin-top: 8px; }
  .puck-img-popover .puck-img-actions button {
    flex: 1; padding: 5px 0; border: none; border-radius: 5px; font-size: 12px;
    font-weight: 600; cursor: pointer; transition: background 0.15s; width: auto; height: auto;
    display: block; color: inherit; background: #f1f5f9;
  }
  .puck-img-popover .puck-img-actions button.primary { background: #6366f1; color: #fff; }
  .puck-img-popover .puck-img-actions button.primary:hover { background: #4f46e5; }
  .puck-img-popover .puck-img-actions button:hover { background: #e2e8f0; }
`;

/**
 * Popover button for inserting images via URL.
 */
function InsertImageButton({
  onInsert,
}: {
  onInsert: (src: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleUrlInsert = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onInsert(trimmed);
    setUrl("");
    setOpen(false);
  };

  return (
    <div className="puck-img-popover-anchor" ref={popoverRef}>
      <style>{IMAGE_POPOVER_STYLES}</style>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        title="Insert Image"
      >
        🖼
      </button>
      {open && (
        <div className="puck-img-popover">
          <label>Image URL</label>
          <input
            type="text"
            placeholder="https://example.com/image.jpg"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleUrlInsert(); }}
          />
          <div className="puck-img-actions">
            <button type="button" className="primary" onClick={handleUrlInsert}>Insert</button>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mini TipTap editor with toolbar rendered inside the Puck properties pane.
 * value/onChange come from Puck's custom field interface.
 */
function PanelRichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [, forceUpdate] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: panelExtensions,
    content: value || "",
    editable: true,
    onUpdate: ({ editor: ed }) => {
      onChangeRef.current(ed.getHTML());
      forceUpdate((n) => n + 1);
    },
    onSelectionUpdate: () => forceUpdate((n) => n + 1),
    editorProps: {
      attributes: { style: "outline:none;" },
    },
  });

  // Sync external value changes (e.g. from canvas editor blur or AI insert)
  const lastExternalValue = useRef(value);
  useEffect(() => {
    if (!editor) return;
    // Only sync if the value actually changed externally
    if (value === lastExternalValue.current) return;
    lastExternalValue.current = value;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const btn = (
    active: boolean,
    onClick: () => void,
    label: string,
    title: string,
  ) => (
    <button
      type="button"
      className={active ? "active" : ""}
      onClick={(e) => { e.preventDefault(); onClick(); }}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div className="puck-panel-editor-wrap">
      <style>{PANEL_STYLES}</style>
      <div className="puck-panel-toolbar">
        {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "B", "Bold")}
        {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "I", "Italic")}
        {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "U", "Underline")}
        {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "S̶", "Strikethrough")}
        <span className="sep" />
        {btn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "H1", "Heading 1")}
        {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "H2", "Heading 2")}
        {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "H3", "Heading 3")}
        <span className="sep" />
        {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "☰", "Bullet List")}
        {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1.", "Ordered List")}
        {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "❝", "Blockquote")}
        {btn(false, () => editor.chain().focus().setHorizontalRule().run(), "―", "Horizontal Rule")}
        <InsertImageButton onInsert={(src) => editor.chain().focus().setImage({ src }).run()} />
        <span className="sep" />
        {btn(editor.isActive({ textAlign: "left" }), () => editor.chain().focus().setTextAlign("left").run(), "≡←", "Align Left")}
        {btn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), "≡", "Align Center")}
        {btn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), "→≡", "Align Right")}
        <span className="sep" />
        {btn(false, () => editor.chain().focus().undo().run(), "↩", "Undo")}
        {btn(false, () => editor.chain().focus().redo().run(), "↪", "Redo")}
      </div>
      <div className="puck-panel-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/**
 * Live TipTap editor shown in the Puck canvas.
 * Does NOT subscribe to Puck state — receives an onBlur callback from the
 * parent render function to push changes on blur only.
 */
function InlineRichTextEditor({
  html,
  onBlurChange,
}: {
  html: string;
  onBlurChange: (newHtml: string) => void;
}) {
  const onBlurRef = useRef(onBlurChange);
  onBlurRef.current = onBlurChange;

  const editor = useEditor({
    extensions: canvasExtensions,
    content: html || "",
    editable: true,
    onBlur: ({ editor: ed }) => {
      onBlurRef.current(ed.getHTML());
    },
    editorProps: {
      attributes: { class: "puck-richtext-editor" },
    },
  });

  // Sync external html changes (e.g. AI Creator insert) into editor
  const lastExternalHtml = useRef(html);
  useEffect(() => {
    if (!editor) return;
    if (html === lastExternalHtml.current) return;
    lastExternalHtml.current = html;
    const current = editor.getHTML();
    if (html !== current) {
      editor.commands.setContent(html || "", { emitUpdate: false });
    }
  }, [html, editor]);

  if (!editor) return null;

  return (
    <>
      <style>{EDITOR_STYLES}</style>
      <EditorContent editor={editor} />
    </>
  );
}

const RichTextInner: ComponentConfig<RichTextProps> = {
  fields: {
    html: {
      type: "custom",
      label: "Content",
      render: ({ value, onChange }) => (
        <PanelRichTextEditor value={value} onChange={onChange} />
      ),
    },
    _aiCreator: {
      type: "custom",
      label: "AI Creator",
      render: () => <AiTextCreator fieldName="html" />,
    },
    maxWidth: { type: "text" },
  },
  defaultProps: {
    html: "<p>Start typing your rich text content here…</p>",
    maxWidth: undefined,
  },
  render: ({ html, maxWidth, puck }) => {
    const isEditing = !!(puck as any)?.isEditing;

    // Non-edit mode (email output / preview): emit raw HTML
    if (!isEditing) {
      return (
        <Section maxWidth={maxWidth}>
          <style>{EDITOR_STYLES}</style>
          <div className="puck-richtext-editor" dangerouslySetInnerHTML={{ __html: html || "" }} />
        </Section>
      );
    }

    // Edit mode: show inline TipTap editor.
    // The canvas editor doesn't render at all in non-edit mode.
    return (
      <Section maxWidth={maxWidth}>
        <InlineCanvasEditor html={html ?? ""} />
      </Section>
    );
  },
};

/**
 * Thin wrapper that lazily accesses Puck dispatch only when the component
 * is actually mounted (i.e. a RichText block is on the canvas in edit mode).
 * Stores selectedItem/dispatch in refs so the child editor never re-renders
 * due to Puck state changes (selection, drag, hover, etc.).
 */
const lazyUsePuck = (() => {
  let hook: any = null;
  return () => {
    if (!hook) {
      hook = createUsePuck();
    }
    return hook;
  };
})();

function InlineCanvasEditor({ html }: { html: string }) {
  const usePuck = lazyUsePuck();
  const selectedItem = usePuck((s: any) => s.selectedItem);
  const dispatch = usePuck((s: any) => s.dispatch);

  // Store in refs so InlineRichTextEditor gets a stable callback
  const selectedItemRef = useRef(selectedItem);
  selectedItemRef.current = selectedItem;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const handleBlur = useCallback(
    (newHtml: string) => {
      const item = selectedItemRef.current;
      if (!item) return;
      const targetId = item.props.id;
      const updateItem = (i: any) =>
        i.props.id === targetId
          ? { ...i, props: { ...i.props, html: newHtml } }
          : i;

      dispatchRef.current({
        type: "setData",
        data: (prev: any) => {
          const updated: any = { ...prev, content: prev.content.map(updateItem) };
          if (prev.zones) {
            updated.zones = Object.fromEntries(
              Object.entries(prev.zones).map(([zone, items]: [string, any]) => [
                zone,
                Array.isArray(items) ? items.map(updateItem) : items,
              ])
            );
          }
          return updated;
        },
      });
    },
    [] // stable — reads from refs
  );

  return <InlineRichTextEditor html={html} onBlurChange={handleBlur} />;
}

export const RichText = withLayout(RichTextInner);
