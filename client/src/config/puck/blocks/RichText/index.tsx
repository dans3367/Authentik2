import { useEffect, useRef, useCallback, useState } from "react";
import { ComponentConfig, createUsePuck } from "@puckeditor/core";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";
import { AiTextCreator } from "@/components/puck/AiTextCreator";

const usePuck = createUsePuck();

/* ── Shared TipTap extensions ── */
const makeTiptapExtensions = (placeholder?: string) => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Underline,
  Link.configure({ openOnClick: false }),
  ...(placeholder
    ? [Placeholder.configure({ placeholder, showOnlyWhenEditable: true })]
    : []),
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
  .puck-richtext-editor ul, .puck-richtext-editor ol { margin: 0 0 10px 0; padding-left: 24px; }
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
  .puck-panel-content .tiptap ul, .puck-panel-content .tiptap ol { margin: 0 0 8px; padding-left: 20px; }
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
`;

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
  const suppressSync = useRef(false);

  const editor = useEditor({
    extensions: makeTiptapExtensions("Write or paste content…"),
    content: value || "",
    editable: true,
    onUpdate: ({ editor: ed }) => {
      if (!suppressSync.current) {
        onChange(ed.getHTML());
      }
      forceUpdate((n) => n + 1);
    },
    onSelectionUpdate: () => forceUpdate((n) => n + 1),
    editorProps: {
      attributes: { style: "outline:none;" },
    },
  });

  // Sync external value changes (e.g. from canvas editor blur or AI insert)
  useEffect(() => {
    if (!editor) return;
    if (suppressSync.current) { suppressSync.current = false; return; }
    if (value !== editor.getHTML()) {
      suppressSync.current = true;
      editor.commands.setContent(value || "");
      suppressSync.current = false;
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
 * Owns its own state; pushes to Puck on blur so there's no
 * keystroke→dispatch→re-render→cursor-jump loop.
 * External HTML changes (AI insert) are synced in via the html prop.
 */
function InlineRichTextEditor({ html }: { html: string }) {
  const selectedItem = usePuck((s: any) => s.selectedItem);
  const dispatch = usePuck((s: any) => s.dispatch);
  const suppressSync = useRef(false);

  const pushToPuck = useCallback(
    (newHtml: string) => {
      if (!selectedItem) return;
      const targetId = selectedItem.props.id;
      const updateItem = (item: any) =>
        item.props.id === targetId
          ? { ...item, props: { ...item.props, html: newHtml } }
          : item;

      dispatch({
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
    [selectedItem, dispatch]
  );

  const editor = useEditor({
    extensions: makeTiptapExtensions("Start typing or use AI Creator to generate content…"),
    content: html || "",
    editable: true,
    onBlur: ({ editor: ed }) => {
      pushToPuck(ed.getHTML());
    },
    editorProps: {
      attributes: { class: "puck-richtext-editor" },
    },
  });

  // Sync external html changes (e.g. AI Creator insert) into editor.
  // Only runs when `html` prop changes from Puck; we use suppressSync
  // to avoid re-syncing our own blur push.
  useEffect(() => {
    if (!editor) return;
    if (suppressSync.current) {
      suppressSync.current = false;
      return;
    }
    const current = editor.getHTML();
    if (html !== current) {
      editor.commands.setContent(html || "");
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

    if (isEditing) {
      return (
        <Section maxWidth={maxWidth}>
          <InlineRichTextEditor html={html ?? ""} />
        </Section>
      );
    }

    // Non-edit mode (email output / preview): emit raw HTML
    return (
      <Section maxWidth={maxWidth}>
        <div dangerouslySetInnerHTML={{ __html: html || "" }} />
      </Section>
    );
  },
};

export const RichText = withLayout(RichTextInner);
