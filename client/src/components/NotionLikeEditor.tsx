import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Image } from "@tiptap/extension-image";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Link } from "@tiptap/extension-link";
import { Underline } from "@tiptap/extension-underline";
import { Highlight } from "@tiptap/extension-highlight";
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Code,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Minus,
    ImageIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Link as LinkIcon,
    Type,
    Palette,
    ChevronDown,
    ListChecks,
    Braces,
} from "lucide-react";
import "./NotionLikeEditor.css";

// ── Slash Command Menu ─────────────────────────────────────────────────────────

interface SlashCommand {
    title: string;
    description: string;
    icon: React.ReactNode;
    command: (editor: any) => void;
}

const SLASH_COMMANDS: SlashCommand[] = [
    {
        title: "Text",
        description: "Plain text block",
        icon: <Type className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setParagraph().run(),
    },
    {
        title: "Heading 1",
        description: "Large heading",
        icon: <Heading1 className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
        title: "Heading 2",
        description: "Medium heading",
        icon: <Heading2 className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
        title: "Heading 3",
        description: "Small heading",
        icon: <Heading3 className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
    },
    {
        title: "Bullet List",
        description: "Unordered list",
        icon: <List className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
        title: "Numbered List",
        description: "Ordered list",
        icon: <ListOrdered className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
        title: "Quote",
        description: "Block quote",
        icon: <Quote className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setBlockquote().run(),
    },
    {
        title: "Code Block",
        description: "Fenced code block",
        icon: <Code className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setCodeBlock().run(),
    },
    {
        title: "Divider",
        description: "Horizontal rule",
        icon: <Minus className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
        title: "Image",
        description: "Embed an image from URL",
        icon: <ImageIcon className="w-4 h-4" />,
        command: (editor) => {
            const url = window.prompt("Enter image URL");
            if (url) {
                editor.chain().focus().setImage({ src: url }).run();
            }
        },
    },
];

function SlashCommandMenu({
    query,
    onSelect,
    selectedIndex,
    position,
}: {
    query: string;
    onSelect: (cmd: SlashCommand) => void;
    selectedIndex: number;
    position: { top: number; left: number };
}) {
    const menuRef = useRef<HTMLDivElement>(null);
    const filtered = SLASH_COMMANDS.filter(
        (cmd) =>
            cmd.title.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const el = menuRef.current?.querySelector('.notion-slash-item-active') as HTMLElement;
        if (el) el.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    if (filtered.length === 0) return null;

    return (
        <div
            ref={menuRef}
            className="notion-slash-menu"
            style={{ top: position.top, left: position.left }}
        >
            <div className="notion-slash-menu-label">Blocks</div>
            {filtered.map((cmd, i) => (
                <button
                    key={cmd.title}
                    className={`notion-slash-item ${i === selectedIndex ? "notion-slash-item-active" : ""}`}
                    onClick={() => onSelect(cmd)}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <div className="notion-slash-item-icon">{cmd.icon}</div>
                    <div className="notion-slash-item-text">
                        <span className="notion-slash-item-title">{cmd.title}</span>
                        <span className="notion-slash-item-desc">{cmd.description}</span>
                    </div>
                </button>
            ))}
        </div>
    );
}

// ── Custom Floating Toolbar ─────────────────────────────────────────────────────

const TEXT_COLORS = [
    { label: "Default", value: "" },
    { label: "Gray", value: "#6b7280" },
    { label: "Brown", value: "#92400e" },
    { label: "Orange", value: "#ea580c" },
    { label: "Yellow", value: "#ca8a04" },
    { label: "Cyan", value: "#06b6d4" },
    { label: "Blue", value: "#3b82f6" },
    { label: "Purple", value: "#8b5cf6" },
    { label: "Pink", value: "#ec4899" },
    { label: "Red", value: "#ef4444" },
];

const HIGHLIGHT_COLORS = [
    { label: "None", value: "" },
    { label: "Gray", value: "#374151" },
    { label: "Brown", value: "#78350f" },
    { label: "Orange", value: "#c2410c" },
    { label: "Yellow", value: "#a16207" },
    { label: "Green", value: "#15803d" },
    { label: "Cyan", value: "#0e7490" },
    { label: "Purple", value: "#7c3aed" },
    { label: "Pink", value: "#be185d" },
    { label: "Red", value: "#b91c1c" },
];

function FloatingToolbar({
    editor,
    onLinkClick,
}: {
    editor: any;
    onLinkClick: () => void;
}) {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [visible, setVisible] = useState(false);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const colorBtnRef = useRef<HTMLButtonElement>(null);
    const [recentColors, setRecentColors] = useState<string[]>([]);
    const [turnIntoOpen, setTurnIntoOpen] = useState(false);

    useEffect(() => {
        if (!editor) return;

        const updatePosition = () => {
            const { state } = editor;
            const { from, to } = state.selection;

            // Only show when there is a text selection (not just cursor)
            if (from === to || !editor.view.hasFocus()) {
                setVisible(false);
                return;
            }

            // Get coordinates of the selection
            const coords = editor.view.coordsAtPos(from);
            const endCoords = editor.view.coordsAtPos(to);
            const editorRect = editor.view.dom.closest('.notion-editor-area')?.getBoundingClientRect()
                || editor.view.dom.getBoundingClientRect();

            // Position toolbar above the selection with some spacing
            const centerX = (coords.left + endCoords.right) / 2 - editorRect.left;
            const toolbarHeight = 36;
            const spacing = 8;
            const topY = coords.top - editorRect.top - toolbarHeight - spacing;

            // If toolbar would be cut off at top, show it below the selection instead
            const showBelow = topY < 4;
            const finalTop = showBelow
                ? endCoords.bottom - editorRect.top + spacing
                : topY;

            setPosition({
                top: finalTop,
                left: Math.max(8, centerX - 150), // roughly half toolbar width
            });
            setVisible(true);
        };

        editor.on("selectionUpdate", updatePosition);
        editor.on("blur", () => { setVisible(false); setColorPickerOpen(false); setTurnIntoOpen(false); });

        return () => {
            editor.off("selectionUpdate", updatePosition);
            editor.off("blur", () => setVisible(false));
        };
    }, [editor]);

    if (!visible || !position) return null;

    return (
        <div
            ref={toolbarRef}
            className="notion-bubble-menu"
            style={{
                position: "absolute",
                top: position.top,
                left: position.left,
                zIndex: 50,
            }}
            onMouseDown={(e) => e.preventDefault()}
        >
            {/* Turn Into dropdown */}
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => { setTurnIntoOpen((v) => !v); setColorPickerOpen(false); }}
                    className="notion-bubble-btn"
                    style={{ gap: '3px', width: 'auto', padding: '0 8px', fontSize: '12px', fontWeight: 600 }}
                    title="Turn into"
                >
                    <span style={{ color: '#d1d5db', whiteSpace: 'nowrap' }}>
                        {editor.isActive('heading', { level: 1 }) ? 'Heading 1'
                            : editor.isActive('heading', { level: 2 }) ? 'Heading 2'
                            : editor.isActive('heading', { level: 3 }) ? 'Heading 3'
                            : editor.isActive('bulletList') ? 'Bulleted list'
                            : editor.isActive('orderedList') ? 'Numbered list'
                            : editor.isActive('blockquote') ? 'Quote'
                            : editor.isActive('codeBlock') ? 'Code block'
                            : 'Text'}
                    </span>
                    <ChevronDown className="w-3 h-3" style={{ opacity: 0.6 }} />
                </button>
                {turnIntoOpen && (
                    <div className="notion-turninto-menu" onMouseDown={(e) => e.preventDefault()}>
                        <div className="notion-turninto-label">Turn Into</div>
                        {[
                            { label: 'Text', icon: <Type className="w-4 h-4" />, active: editor.isActive('paragraph') && !editor.isActive('bulletList') && !editor.isActive('orderedList') && !editor.isActive('blockquote') && !editor.isActive('codeBlock'), action: () => editor.chain().focus().setParagraph().run() },
                            { label: 'Heading 1', icon: <Heading1 className="w-4 h-4" />, active: editor.isActive('heading', { level: 1 }), action: () => editor.chain().focus().setHeading({ level: 1 }).run() },
                            { label: 'Heading 2', icon: <Heading2 className="w-4 h-4" />, active: editor.isActive('heading', { level: 2 }), action: () => editor.chain().focus().setHeading({ level: 2 }).run() },
                            { label: 'Heading 3', icon: <Heading3 className="w-4 h-4" />, active: editor.isActive('heading', { level: 3 }), action: () => editor.chain().focus().setHeading({ level: 3 }).run() },
                            { label: 'Bulleted list', icon: <List className="w-4 h-4" />, active: editor.isActive('bulletList'), action: () => editor.chain().focus().toggleBulletList().run() },
                            { label: 'Numbered list', icon: <ListOrdered className="w-4 h-4" />, active: editor.isActive('orderedList'), action: () => editor.chain().focus().toggleOrderedList().run() },
                            { label: 'Blockquote', icon: <Quote className="w-4 h-4" />, active: editor.isActive('blockquote'), action: () => editor.chain().focus().toggleBlockquote().run() },
                            { label: 'Code block', icon: <Code className="w-4 h-4" />, active: editor.isActive('codeBlock'), action: () => editor.chain().focus().toggleCodeBlock().run() },
                        ].map((item) => (
                            <button
                                key={item.label}
                                className={`notion-turninto-item ${item.active ? 'active' : ''}`}
                                onClick={() => { item.action(); setTurnIntoOpen(false); }}
                            >
                                <span className="notion-turninto-item-icon">{item.icon}</span>
                                <span className="notion-turninto-item-label">{item.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="notion-bubble-divider" />
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`notion-bubble-btn ${editor.isActive("bold") ? "active" : ""}`}
                title="Bold"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`notion-bubble-btn ${editor.isActive("italic") ? "active" : ""}`}
                title="Italic"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`notion-bubble-btn ${editor.isActive("underline") ? "active" : ""}`}
                title="Underline"
            >
                <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`notion-bubble-btn ${editor.isActive("strike") ? "active" : ""}`}
                title="Strikethrough"
            >
                <Strikethrough className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`notion-bubble-btn ${editor.isActive("code") ? "active" : ""}`}
                title="Inline code"
            >
                <Code className="w-4 h-4" />
            </button>
            <div className="notion-bubble-divider" />
            <button
                onClick={() => {
                    if (editor.isActive("link")) {
                        editor.chain().focus().unsetLink().run();
                    } else {
                        onLinkClick();
                    }
                }}
                className={`notion-bubble-btn ${editor.isActive("link") ? "active" : ""}`}
                title="Link"
            >
                <LinkIcon className="w-4 h-4" />
            </button>
            <div className="notion-bubble-divider" />
            <div style={{ position: 'relative' }}>
                <button
                    ref={colorBtnRef}
                    onClick={() => setColorPickerOpen((v) => !v)}
                    className={`notion-bubble-btn ${editor.getAttributes("textStyle").color ? "active" : ""}`}
                    title="Text color"
                    style={{ gap: '4px', width: 'auto', padding: '0 8px' }}
                >
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        fontWeight: 700,
                        fontSize: '14px',
                        color: editor.getAttributes("textStyle").color || '#d1d5db',
                        border: `2px solid ${editor.getAttributes("textStyle").color || '#6b7280'}`,
                        borderRadius: '50%',
                        lineHeight: 1,
                    }}>A</span>
                    <ChevronDown className="w-3 h-3" style={{ opacity: 0.6 }} />
                </button>
                {colorPickerOpen && (
                    <div className="notion-color-picker" onMouseDown={(e) => e.preventDefault()}>
                        {/* Recently Used */}
                        {recentColors.length > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                                <div className="notion-color-picker-label">Recently Used</div>
                                <div className="notion-color-picker-grid">
                                    {recentColors.slice(0, 5).map((color, i) => (
                                        <button
                                            key={`recent-${i}`}
                                            className="notion-color-swatch-text"
                                            title="Recent color"
                                            onClick={() => {
                                                editor.chain().focus().setColor(color).run();
                                                setColorPickerOpen(false);
                                            }}
                                        >
                                            <span style={{ color, border: `2px solid ${color}` }}>A</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Text Color */}
                        <div style={{ marginBottom: '10px' }}>
                            <div className="notion-color-picker-label">Text Color</div>
                            <div className="notion-color-picker-grid">
                                {TEXT_COLORS.map((c) => (
                                    <button
                                        key={c.label}
                                        className={`notion-color-swatch-text ${!c.value && !editor.getAttributes("textStyle").color ? "active" : c.value && editor.getAttributes("textStyle").color === c.value ? "active" : ""}`}
                                        title={c.label}
                                        onClick={() => {
                                            if (c.value) {
                                                editor.chain().focus().setColor(c.value).run();
                                                setRecentColors((prev) => {
                                                    const filtered = prev.filter((col) => col !== c.value);
                                                    return [c.value, ...filtered].slice(0, 5);
                                                });
                                            } else {
                                                editor.chain().focus().unsetColor().run();
                                            }
                                            setColorPickerOpen(false);
                                        }}
                                    >
                                        <span style={{
                                            color: c.value || '#e2e8f0',
                                            border: c.value ? `2px solid ${c.value}` : 'none',
                                        }}>A</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Highlight Color */}
                        <div>
                            <div className="notion-color-picker-label">Highlight Color</div>
                            <div className="notion-color-picker-grid">
                                {HIGHLIGHT_COLORS.map((c) => (
                                    <button
                                        key={`hl-${c.label}`}
                                        className={`notion-color-swatch-highlight ${!c.value && !editor.getAttributes("highlight")?.color ? "active" : c.value && editor.getAttributes("highlight")?.color === c.value ? "active" : ""}`}
                                        title={c.label}
                                        onClick={() => {
                                            if (c.value) {
                                                editor.chain().focus().setHighlight({ color: c.value }).run();
                                            } else {
                                                editor.chain().focus().unsetHighlight().run();
                                            }
                                            setColorPickerOpen(false);
                                        }}
                                    >
                                        <span style={{ backgroundColor: c.value || '#374151' }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="notion-bubble-divider" />
            <button
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                className={`notion-bubble-btn ${editor.isActive({ textAlign: "left" }) ? "active" : ""}`}
                title="Align left"
            >
                <AlignLeft className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                className={`notion-bubble-btn ${editor.isActive({ textAlign: "center" }) ? "active" : ""}`}
                title="Align center"
            >
                <AlignCenter className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                className={`notion-bubble-btn ${editor.isActive({ textAlign: "right" }) ? "active" : ""}`}
                title="Align right"
            >
                <AlignRight className="w-4 h-4" />
            </button>
        </div>
    );
}

// ── Main Editor Component ───────────────────────────────────────────────────────

export interface NotionLikeEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
}

export default function NotionLikeEditor({
    content,
    onChange,
    placeholder = 'Type \'/\' for commands, or start writing...',
    className = "",
}: NotionLikeEditorProps) {
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashQuery, setSlashQuery] = useState("");
    const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 });
    const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
    const slashStartPos = useRef<number | null>(null);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");

    const filteredCommands = SLASH_COMMANDS.filter(
        (cmd) =>
            cmd.title.toLowerCase().includes(slashQuery.toLowerCase()) ||
            cmd.description.toLowerCase().includes(slashQuery.toLowerCase())
    );

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({
                placeholder,
                showOnlyWhenEditable: true,
                showOnlyCurrent: true,
            }),
            Image.configure({
                HTMLAttributes: { class: "notion-editor-image" },
            }),
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            TextStyle,
            Color.configure({ types: ["textStyle"] }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "notion-editor-link",
                    rel: "noopener noreferrer",
                    target: "_blank",
                },
            }),
            Underline,
            Highlight.configure({ multicolor: true }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: `notion-editor-content ${className}`,
                spellcheck: "true",
            },
            handleKeyDown: (_view, event) => {
                // Handle slash menu navigation
                if (slashMenuOpen) {
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setSlashSelectedIndex((prev) =>
                            prev < filteredCommands.length - 1 ? prev + 1 : 0
                        );
                        return true;
                    }
                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setSlashSelectedIndex((prev) =>
                            prev > 0 ? prev - 1 : filteredCommands.length - 1
                        );
                        return true;
                    }
                    if (event.key === "Enter") {
                        event.preventDefault();
                        if (filteredCommands[slashSelectedIndex]) {
                            handleSlashSelect(filteredCommands[slashSelectedIndex]);
                        }
                        return true;
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        setSlashMenuOpen(false);
                        return true;
                    }
                }

                return false;
            },
        },
    });

    // Track slash command trigger
    useEffect(() => {
        if (!editor) return;

        const handleTransaction = () => {
            const { state } = editor;
            const { selection } = state;
            const { $from } = selection;

            // Get the text before the cursor on the current line
            const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
            const slashMatch = textBefore.match(/\/([^\s]*)$/);

            if (slashMatch) {
                if (!slashMenuOpen) {
                    slashStartPos.current = $from.pos - slashMatch[0].length;
                }
                setSlashQuery(slashMatch[1]);
                setSlashSelectedIndex(0);
                setSlashMenuOpen(true);

                // Calculate position
                const coords = editor.view.coordsAtPos($from.pos);
                const editorRect = editor.view.dom.closest('.notion-editor-area')?.getBoundingClientRect()
                    || editor.view.dom.getBoundingClientRect();
                setSlashPosition({
                    top: coords.bottom - editorRect.top + 4,
                    left: coords.left - editorRect.left,
                });
            } else {
                if (slashMenuOpen) {
                    setSlashMenuOpen(false);
                }
            }
        };

        editor.on("transaction", handleTransaction);
        return () => {
            editor.off("transaction", handleTransaction);
        };
    }, [editor, slashMenuOpen]);

    const handleSlashSelect = useCallback(
        (cmd: SlashCommand) => {
            if (!editor || slashStartPos.current === null) return;

            // Delete the slash command text
            const { state } = editor;
            const currentPos = state.selection.$from.pos;
            editor
                .chain()
                .focus()
                .deleteRange({ from: slashStartPos.current, to: currentPos })
                .run();

            // Execute the command
            cmd.command(editor);

            setSlashMenuOpen(false);
            slashStartPos.current = null;
        },
        [editor]
    );

    const handleAddLink = useCallback(() => {
        if (!editor) return;
        if (linkUrl) {
            // Ensure URL has protocol
            const url = linkUrl.match(/^https?:\/\//) ? linkUrl : `https://${linkUrl}`;
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        } else {
            editor.chain().focus().unsetLink().run();
        }
        setLinkModalOpen(false);
        setLinkUrl("");
    }, [editor, linkUrl]);

    if (!editor) return null;

    return (
        <div className="notion-editor-wrapper">
            {/* Link input modal */}
            {linkModalOpen && (
                <div className="notion-link-modal-overlay" onClick={() => setLinkModalOpen(false)}>
                    <div className="notion-link-modal" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="Paste or type a URL..."
                            className="notion-link-input"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddLink();
                                }
                                if (e.key === "Escape") {
                                    setLinkModalOpen(false);
                                }
                            }}
                        />
                        <button onClick={handleAddLink} className="notion-link-apply-btn">
                            Apply
                        </button>
                    </div>
                </div>
            )}

            {/* Editor */}
            <div className="notion-editor-area">
                {/* Custom floating toolbar (replaces BubbleMenu) */}
                <FloatingToolbar
                    editor={editor}
                    onLinkClick={() => {
                        setLinkUrl(editor.getAttributes("link").href || "");
                        setLinkModalOpen(true);
                    }}
                />

                <EditorContent editor={editor} />

                {/* Slash Command Menu */}
                {slashMenuOpen && (
                    <SlashCommandMenu
                        query={slashQuery}
                        onSelect={handleSlashSelect}
                        selectedIndex={slashSelectedIndex}
                        position={slashPosition}
                    />
                )}
            </div>
        </div>
    );
}
