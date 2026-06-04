import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { ResizableImage } from "./ResizableImage";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { HandlebarVariable, DEFAULT_HANDLEBAR_VARIABLES } from "@/extensions/HandlebarVariable";
import { Table as TiptapTable } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell as TiptapTableCell } from "@tiptap/extension-table-cell";
import { TableHeader as TiptapTableHeader } from "@tiptap/extension-table-header";
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
    Sparkles,
    Wand2,
    PartyPopper,
    ArrowRightFromLine,
    ArrowLeftToLine,
    Languages,
    ChevronRight,
    Loader2,
    Search,
    RefreshCw,
    X,
    Check,
    User,
    Mail,
    Phone,
    MapPin,
    Clock,
    CreditCard,
    ShoppingBag,
    Table as TableIcon,
    Rows3,
    Columns3,
    Plus,
    Trash2,
    TableCellsMerge,
    TableCellsSplit,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    GripHorizontal,
    GripVertical,
    MoreHorizontal,
    ArrowUpDown,
    PanelLeftOpen,
    PanelRightOpen,
    Copy,
    ArrowDownAZ,
    ArrowUpAZ,
    Eraser,
    Paintbrush,
    Square,
} from "lucide-react";
import { improveText, emojifyText, expandText, shortenText, makeMoreCasualText, makeMoreFormalText, translateText, generateNewsletter, transformNewsletter, type NewsletterTransformAction } from "@/lib/aiApi";
import { aiHtmlToInlineHtml, hasTopLevelAiBlocks, mergeAiBlocksWithSurroundingText, normalizeAiHtml } from "@/lib/aiHtmlNormalization";
import { apiRequest } from "@/lib/queryClient";
import "./NotionLikeEditor.css";

// ── AI HTML Normalization ───────────────────────────────────────────────────────

function findTextblockDepth($pos: any): number | null {
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
        if ($pos.node(depth).isTextblock) return depth;
    }
    return null;
}

function getWholeTextblockRange(editor: any, from: number, to: number) {
    const { doc } = editor.state;
    const $from = doc.resolve(from);
    const $to = doc.resolve(to);
    const fromDepth = findTextblockDepth($from);
    const toDepth = findTextblockDepth($to);

    if (fromDepth === null || toDepth === null) {
        const textBeforeSelection = doc.textBetween(0, from, "\n", "\n");
        const textAfterSelection = doc.textBetween(to, doc.content.size, "\n", "\n");
        return textBeforeSelection.trim() || textAfterSelection.trim()
            ? null
            : { from, to };
    }

    const textBeforeSelection = doc.textBetween($from.start(fromDepth), from, "\n", "\n");
    const textAfterSelection = doc.textBetween(to, $to.end(toDepth), "\n", "\n");

    if (textBeforeSelection.trim() || textAfterSelection.trim()) return null;

    return {
        from: $from.before(fromDepth),
        to: $to.after(toDepth),
    };
}

function getTextblockRangeWithSurroundingText(editor: any, from: number, to: number) {
    const { doc } = editor.state;
    const $from = doc.resolve(from);
    const $to = doc.resolve(to);
    const fromDepth = findTextblockDepth($from);
    const toDepth = findTextblockDepth($to);

    if (fromDepth === null || toDepth === null) return null;

    return {
        from: $from.before(fromDepth),
        to: $to.after(toDepth),
        beforeText: doc.textBetween($from.start(fromDepth), from, " ", " "),
        afterText: doc.textBetween(to, $to.end(toDepth), " ", " "),
    };
}

function prepareAiReplacement(editor: any, range: { from: number; to: number }, replacement: string, allowBlockReplace: boolean) {
    const html = normalizeAiHtml(replacement);
    if (!html) return null;

    if (!hasTopLevelAiBlocks(html)) {
        return { range, content: html };
    }

    const wholeTextblockRange = allowBlockReplace ? getWholeTextblockRange(editor, range.from, range.to) : null;
    if (wholeTextblockRange) {
        return { range: wholeTextblockRange, content: html };
    }

    const textblockRange = allowBlockReplace ? getTextblockRangeWithSurroundingText(editor, range.from, range.to) : null;
    if (textblockRange) {
        return {
            range: { from: textblockRange.from, to: textblockRange.to },
            content: mergeAiBlocksWithSurroundingText(html, textblockRange.beforeText, textblockRange.afterText),
        };
    }

    return {
        range,
        content: aiHtmlToInlineHtml(html),
    };
}

// ── Template Variables ──────────────────────────────────────────────────────────

const TEMPLATE_VARIABLES = [
    { key: 'first_name', icon: User, labelKey: 'ecards.editor.firstName' },
    { key: 'last_name', icon: User, labelKey: 'ecards.editor.lastName' },
    { key: 'email', icon: Mail, labelKey: 'ecards.editor.emailVar' },
    { key: 'phone', icon: Phone, labelKey: 'ecards.editor.phone' },
    { key: 'address', icon: MapPin, labelKey: 'ecards.editor.address' },
    { key: 'office_hours', icon: Clock, labelKey: 'ecards.editor.officeHours' },
] as const;

const CONTACT_CARD_TEMPLATE = `<p><strong>{{company_name}}</strong></p><p>\u2709 {{email}}</p><p>\u260E {{phone}}</p><p>\u{1F4CD} {{address}}</p>`;

const PRODUCT_CARD_TEMPLATE_TYPE = "product-card-template";
const PRODUCT_IMAGE_PLACEHOLDER = "https://placehold.co/280x180/f8fafc/64748b?text=Product+Photo";

const ProductAwareTable = TiptapTable.extend({
    addAttributes() {
        return {
            templateType: {
                default: null,
                parseHTML: (element: HTMLElement) =>
                    element.getAttribute("data-template-type") ||
                    (element.classList.contains("notion-product-card-template") ? PRODUCT_CARD_TEMPLATE_TYPE : null),
                renderHTML: (attributes: { templateType?: string | null }) =>
                    attributes.templateType
                        ? { "data-template-type": attributes.templateType, class: "notion-product-card-template" }
                        : {},
            },
            lockedStructure: {
                default: false,
                parseHTML: (element: HTMLElement) => element.getAttribute("data-locked-structure") === "true",
                renderHTML: (attributes: { lockedStructure?: boolean }) =>
                    attributes.lockedStructure ? { "data-locked-structure": "true" } : {},
            },
        };
    },
});

const StyledTableCell = TiptapTableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            style: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute("style"),
                renderHTML: (attributes: { style?: string | null }) =>
                    attributes.style ? { style: attributes.style } : {},
            },
        };
    },
});

const StyledTableHeader = TiptapTableHeader.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            style: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute("style"),
                renderHTML: (attributes: { style?: string | null }) =>
                    attributes.style ? { style: attributes.style } : {},
            },
        };
    },
});

function createProductCardCell() {
    return {
        type: "tableCell",
        content: [
            {
                type: "image",
                attrs: {
                    src: PRODUCT_IMAGE_PLACEHOLDER,
                    alt: "Product photo",
                    width: 240,
                },
            },
            {
                type: "heading",
                attrs: { level: 3 },
                content: [{ type: "text", text: "Product Title" }],
            },
            {
                type: "paragraph",
                content: [
                    {
                        type: "text",
                        marks: [{ type: "bold" }],
                        text: "$00.00",
                    },
                ],
            },
            {
                type: "paragraph",
                content: [
                    {
                        type: "text",
                        text: "Add product details, features, sizing, or availability here.",
                    },
                ],
            },
        ],
    };
}

function createProductCardTemplate() {
    return {
        type: "table",
        attrs: {
            templateType: PRODUCT_CARD_TEMPLATE_TYPE,
            lockedStructure: true,
        },
        content: [
            {
                type: "tableRow",
                content: [createProductCardCell(), createProductCardCell()],
            },
        ],
    };
}

// ── Slash Command Menu ─────────────────────────────────────────────────────────

interface SlashCommand {
    title: string;
    description: string;
    icon: React.ReactNode;
    command: (editor: any) => void;
    isAiGenerate?: boolean;
    isImageBrowser?: boolean;
    category?: string;
}

interface ImageSearchResult {
    provider: "unsplash" | "pexels";
    id: string;
    url: string;
    thumbUrl: string;
    alt: string;
    attribution: { name: string; profileUrl?: string };
}

function getSlashCommands(t: (key: string) => string): SlashCommand[] {
    return [
    {
        title: t('notionEditor.slash.generateWithAi'),
        description: t('notionEditor.slash.generateWithAiDesc'),
        icon: <Sparkles className="w-4 h-4" style={{ color: '#a78bfa' }} />,
        command: () => {},
        isAiGenerate: true,
    },
    {
        title: t('notionEditor.slash.text'),
        description: t('notionEditor.slash.textDesc'),
        icon: <Type className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setParagraph().run(),
    },
    {
        title: t('notionEditor.slash.heading1'),
        description: t('notionEditor.slash.heading1Desc'),
        icon: <Heading1 className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
        title: t('notionEditor.slash.heading2'),
        description: t('notionEditor.slash.heading2Desc'),
        icon: <Heading2 className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
        title: t('notionEditor.slash.heading3'),
        description: t('notionEditor.slash.heading3Desc'),
        icon: <Heading3 className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
    },
    {
        title: t('notionEditor.slash.bulletList'),
        description: t('notionEditor.slash.bulletListDesc'),
        icon: <List className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
        title: t('notionEditor.slash.numberedList'),
        description: t('notionEditor.slash.numberedListDesc'),
        icon: <ListOrdered className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
        title: t('notionEditor.slash.quote'),
        description: t('notionEditor.slash.quoteDesc'),
        icon: <Quote className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setBlockquote().run(),
    },
    {
        title: t('notionEditor.slash.codeBlock'),
        description: t('notionEditor.slash.codeBlockDesc'),
        icon: <Code className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setCodeBlock().run(),
    },
    {
        title: t('notionEditor.slash.divider'),
        description: t('notionEditor.slash.dividerDesc'),
        icon: <Minus className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
        title: t('notionEditor.slash.table'),
        description: t('notionEditor.slash.tableDesc'),
        icon: <TableIcon className="w-4 h-4" />,
        command: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
        title: t('notionEditor.slash.productCardTemplate'),
        description: t('notionEditor.slash.productCardTemplateDesc'),
        icon: <ShoppingBag className="w-4 h-4" style={{ color: '#f59e0b' }} />,
        command: (editor) => editor.chain().focus().insertContent(createProductCardTemplate()).run(),
    },
    {
        title: t('notionEditor.slash.image'),
        description: t('notionEditor.slash.imageDesc'),
        icon: <ImageIcon className="w-4 h-4" />,
        command: () => {},
        isImageBrowser: true,
    },
    {
        title: t('notionEditor.slash.firstName'),
        description: t('notionEditor.slash.firstNameDesc'),
        icon: <User className="w-4 h-4" style={{ color: '#3b82f6' }} />,
        command: (editor) => editor.chain().focus().insertContent({ type: 'handlebarVariable', attrs: { variable: 'first_name' } }).run(),
        category: "variables",
    },
    {
        title: t('notionEditor.slash.lastName'),
        description: t('notionEditor.slash.lastNameDesc'),
        icon: <User className="w-4 h-4" style={{ color: '#3b82f6' }} />,
        command: (editor) => editor.chain().focus().insertContent({ type: 'handlebarVariable', attrs: { variable: 'last_name' } }).run(),
        category: "variables",
    },
    {
        title: t('notionEditor.slash.email'),
        description: t('notionEditor.slash.emailDesc'),
        icon: <Mail className="w-4 h-4" style={{ color: '#3b82f6' }} />,
        command: (editor) => editor.chain().focus().insertContent({ type: 'handlebarVariable', attrs: { variable: 'email' } }).run(),
        category: "variables",
    },
    {
        title: t('notionEditor.slash.phone'),
        description: t('notionEditor.slash.phoneDesc'),
        icon: <Phone className="w-4 h-4" style={{ color: '#3b82f6' }} />,
        command: (editor) => editor.chain().focus().insertContent({ type: 'handlebarVariable', attrs: { variable: 'phone' } }).run(),
        category: "variables",
    },
    {
        title: t('notionEditor.slash.address'),
        description: t('notionEditor.slash.addressDesc'),
        icon: <MapPin className="w-4 h-4" style={{ color: '#3b82f6' }} />,
        command: (editor) => editor.chain().focus().insertContent({ type: 'handlebarVariable', attrs: { variable: 'address' } }).run(),
        category: "variables",
    },
    {
        title: t('notionEditor.slash.officeHours'),
        description: t('notionEditor.slash.officeHoursDesc'),
        icon: <Clock className="w-4 h-4" style={{ color: '#3b82f6' }} />,
        command: (editor) => editor.chain().focus().insertContent({ type: 'handlebarVariable', attrs: { variable: 'office_hours' } }).run(),
        category: "variables",
    },
    {
        title: t('notionEditor.slash.contactCard'),
        description: t('notionEditor.slash.contactCardDesc'),
        icon: <CreditCard className="w-4 h-4" style={{ color: '#10b981' }} />,
        command: (editor) => editor.chain().focus().insertContent(CONTACT_CARD_TEMPLATE).run(),
        category: "variables",
    },
    ];
}

// ── Handlebar Suggestion Menu ────────────────────────────────────────────────

function HandlebarMenu({
    query,
    onSelect,
    selectedIndex,
    position,
}: {
    query: string;
    onSelect: (variable: string) => void;
    selectedIndex: number;
    position: { top: number; left: number };
}) {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);
    const filtered = DEFAULT_HANDLEBAR_VARIABLES.filter(
        (v) =>
            v.label.toLowerCase().includes(query.toLowerCase()) ||
            v.key.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const el = menuRef.current?.querySelector('.handlebar-suggestion-item-active') as HTMLElement;
        if (el) el.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    if (filtered.length === 0) return null;

    // Group by category
    const categories = new Map<string, typeof filtered>();
    for (const item of filtered) {
        const cat = item.category || "Other";
        if (!categories.has(cat)) categories.set(cat, []);
        categories.get(cat)!.push(item);
    }

    let globalIdx = 0;

    return (
        <div
            ref={menuRef}
            className="notion-slash-menu"
            style={{ top: position.top, left: position.left }}
        >
            <div className="notion-slash-menu-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', background: '#eef2ff', color: '#6366f1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>{'{ }'}</span>
                {t('notionEditor.insertVariable')}
            </div>
            {Array.from(categories.entries()).map(([category, items]) => (
                <div key={category}>
                    {categories.size > 1 && (
                        <div className="notion-slash-menu-label" style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{category}</div>
                    )}
                    {items.map((item) => {
                        const idx = globalIdx++;
                        return (
                            <button
                                key={item.key}
                                className={`notion-slash-item ${idx === selectedIndex ? "notion-slash-item-active" : ""}`}
                                onClick={() => onSelect(item.key)}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <div className="notion-slash-item-icon">
                                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#3b82f6', fontWeight: 500 }}>{`{{}}`}</span>
                                </div>
                                <div className="notion-slash-item-text">
                                    <span className="notion-slash-item-title">{item.label}</span>
                                    <span className="notion-slash-item-desc">{`{{${item.key}}}`}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

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
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);
    const slashCommands = getSlashCommands(t);
    const filtered = slashCommands.filter(
        (cmd: SlashCommand) =>
            cmd.title.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const el = menuRef.current?.querySelector('.notion-slash-item-active') as HTMLElement;
        if (el) el.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    if (filtered.length === 0) return null;

    const blockItems = filtered.filter((cmd: SlashCommand) => cmd.category !== "variables");
    const variableItems = filtered.filter((cmd: SlashCommand) => cmd.category === "variables");

    let globalIndex = 0;

    return (
        <div
            ref={menuRef}
            className="notion-slash-menu"
            style={{ top: position.top, left: position.left }}
        >
            {blockItems.length > 0 && (
                <>
                    <div className="notion-slash-menu-label">{t('notionEditor.slash.blocks')}</div>
                    {blockItems.map((cmd: SlashCommand) => {
                        const idx = globalIndex++;
                        return (
                            <button
                                key={cmd.title}
                                className={`notion-slash-item ${idx === selectedIndex ? "notion-slash-item-active" : ""} ${cmd.isAiGenerate ? "notion-slash-item-ai" : ""}`}
                                onClick={() => onSelect(cmd)}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <div className={`notion-slash-item-icon ${cmd.isAiGenerate ? "notion-slash-item-icon-ai" : ""}`}>{cmd.icon}</div>
                                <div className="notion-slash-item-text">
                                    <span className={`notion-slash-item-title ${cmd.isAiGenerate ? "notion-slash-item-title-ai" : ""}`}>{cmd.title}</span>
                                    <span className="notion-slash-item-desc">{cmd.description}</span>
                                </div>
                            </button>
                        );
                    })}
                </>
            )}
            {variableItems.length > 0 && (
                <>
                    <div className="notion-slash-menu-label" style={{ marginTop: blockItems.length > 0 ? '6px' : undefined }}>{t('notionEditor.slash.variables')}</div>
                    {variableItems.map((cmd: SlashCommand) => {
                        const idx = globalIndex++;
                        return (
                            <button
                                key={cmd.title}
                                className={`notion-slash-item ${idx === selectedIndex ? "notion-slash-item-active" : ""}`}
                                onClick={() => onSelect(cmd)}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <div className="notion-slash-item-icon">{cmd.icon}</div>
                                <div className="notion-slash-item-text">
                                    <span className="notion-slash-item-title">{cmd.title}</span>
                                    <span className="notion-slash-item-desc">{cmd.description}</span>
                                </div>
                            </button>
                        );
                    })}
                </>
            )}
        </div>
    );
}

function isSafeImageUrl(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith("data:image/")) return true;

    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

function ImageBrowserModal({
    open,
    query,
    customUrl,
    results,
    isSearching,
    error,
    onQueryChange,
    onCustomUrlChange,
    onSearch,
    onPick,
    onApplyUrl,
    onClose,
    canRemove,
    onRemove,
    t,
}: {
    open: boolean;
    query: string;
    customUrl: string;
    results: ImageSearchResult[];
    isSearching: boolean;
    error: string;
    onQueryChange: (query: string) => void;
    onCustomUrlChange: (url: string) => void;
    onSearch: (query: string) => void;
    onPick: (result: ImageSearchResult) => void;
    onApplyUrl: () => void;
    onClose: () => void;
    canRemove: boolean;
    onRemove: () => void;
    t: (key: string, fallback?: string) => string;
}) {
    if (!open || typeof document === "undefined") return null;

    const canSearch = query.trim().length >= 2 && !isSearching;
    const canApplyUrl = isSafeImageUrl(customUrl);

    return createPortal(
        <div className="notion-image-browser-overlay" onMouseDown={onClose}>
            <div className="notion-image-browser" onMouseDown={(e) => e.stopPropagation()}>
                <div className="notion-image-browser-header">
                    <div>
                        <h3>{t("notionEditor.imageBrowser.title", "Choose image")}</h3>
                        <p>{t("notionEditor.imageBrowser.subtitle", "Search photos or paste an image URL.")}</p>
                    </div>
                    <div className="notion-image-browser-header-actions">
                        {canRemove && (
                            <button
                                type="button"
                                className="notion-image-browser-remove"
                                onClick={onRemove}
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>{t("notionEditor.imageBrowser.remove", "Remove image")}</span>
                            </button>
                        )}
                        <button type="button" className="notion-image-browser-close" onClick={onClose} aria-label={t("notionEditor.imageBrowser.close", "Close")}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="notion-image-browser-custom">
                    <label>{t("notionEditor.imageBrowser.urlLabel", "Image URL")}</label>
                    <div className="notion-image-browser-url-row">
                        <input
                            value={customUrl}
                            onChange={(e) => onCustomUrlChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && canApplyUrl) {
                                    e.preventDefault();
                                    onApplyUrl();
                                }
                            }}
                            placeholder="https://example.com/image.jpg"
                        />
                        <button type="button" onClick={onApplyUrl} disabled={!canApplyUrl}>
                            <Check className="w-4 h-4" />
                            <span>{t("notionEditor.imageBrowser.useUrl", "Use URL")}</span>
                        </button>
                    </div>
                </div>

                <div className="notion-image-browser-search">
                    <div className="notion-image-browser-search-input">
                        <Search className="w-4 h-4" />
                        <input
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && canSearch) {
                                    e.preventDefault();
                                    onSearch(query);
                                }
                            }}
                            placeholder={t("notionEditor.imageBrowser.searchPlaceholder", "Search photos...")}
                            autoFocus
                        />
                    </div>
                    <button type="button" onClick={() => onSearch(query)} disabled={!canSearch}>
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        <span>{t("notionEditor.imageBrowser.search", "Search")}</span>
                    </button>
                </div>

                {error && <div className="notion-image-browser-error">{error}</div>}

                <div className="notion-image-browser-results">
                    {isSearching && results.length === 0 ? (
                        <div className="notion-image-browser-grid">
                            {Array.from({ length: 9 }).map((_, index) => (
                                <div key={index} className="notion-image-browser-skeleton" />
                            ))}
                        </div>
                    ) : results.length > 0 ? (
                        <div className="notion-image-browser-grid">
                            {results.map((result) => (
                                <button
                                    key={`${result.provider}-${result.id}`}
                                    type="button"
                                    className="notion-image-browser-result"
                                    onClick={() => onPick(result)}
                                >
                                    <img src={result.thumbUrl} alt={result.alt} loading="lazy" />
                                    <span>{result.attribution?.name ? `Photo by ${result.attribution.name}` : result.provider}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="notion-image-browser-empty">
                            {query.trim().length < 2
                                ? t("notionEditor.imageBrowser.emptyQuery", "Enter a search term to find photos.")
                                : t("notionEditor.imageBrowser.emptyResults", "No results yet. Try a search.")}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Custom Floating Toolbar ─────────────────────────────────────────────────────

const TEXT_COLORS = [
    { label: "Default", value: "" },
    { label: "White", value: "#ffffff" },
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

function getTranslateLanguages(t: (key: string) => string) {
    return [
        { key: 'english', label: t('notionEditor.languages.english') },
        { key: 'spanish', label: t('notionEditor.languages.spanish') },
        { key: 'mandarin', label: t('notionEditor.languages.chinese') },
        { key: 'hindi', label: t('notionEditor.languages.hindi') },
        { key: 'bengali', label: t('notionEditor.languages.bengali') },
    ];
}

function FloatingToolbar({
    editor,
    onLinkClick,
}: {
    editor: any;
    onLinkClick: () => void;
}) {
    const { t } = useTranslation();
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [visible, setVisible] = useState(false);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const colorBtnRef = useRef<HTMLButtonElement>(null);
    const [recentColors, setRecentColors] = useState<string[]>([]);
    const [turnIntoOpen, setTurnIntoOpen] = useState(false);
    const [aiMenuOpen, setAiMenuOpen] = useState(false);
    const [aiProcessing, setAiProcessing] = useState<string | null>(null);
    const [translateSubOpen, setTranslateSubOpen] = useState(false);

    const closeAllDropdowns = () => {
        setColorPickerOpen(false);
        setTurnIntoOpen(false);
        setAiMenuOpen(false);
        setTranslateSubOpen(false);
    };

    const getSelectionInfo = () => {
        const { state } = editor;
        const { from, to } = state.selection;
        const selectedText = state.doc.textBetween(from, to, ' ');
        return { from, to, selectedText };
    };

    // Split the selection into the text runs that sit between image nodes. Each run is
    // rewritten in place while the images are left untouched, so they keep their exact
    // position instead of being deleted or pushed to the end of the rewritten text.
    const getSelectionSegments = (from: number, to: number) => {
        const imageRanges: Array<[number, number]> = [];
        editor.state.doc.nodesBetween(from, to, (node: any, pos: number) => {
            if (node.type.name === "image") {
                imageRanges.push([pos, pos + node.nodeSize]);
                return false;
            }
            return true;
        });

        const ranges: Array<[number, number]> = [];
        let cursor = from;
        for (const [rawFrom, rawTo] of imageRanges) {
            const imgFrom = Math.max(rawFrom, from);
            const imgTo = Math.min(rawTo, to);
            if (imgFrom > cursor) ranges.push([cursor, imgFrom]);
            cursor = Math.max(cursor, imgTo);
        }
        if (cursor < to) ranges.push([cursor, to]);

        return ranges
            .map(([a, b]) => ({ from: a, to: b, text: editor.state.doc.textBetween(a, b, " ") }))
            .filter((seg) => seg.text.trim().length > 0);
    };

    const runAiOnText = async (action: string, text: string, targetLanguage?: string): Promise<string | undefined> => {
        let result: any;
        switch (action) {
            case 'improve':
                result = await improveText({ text });
                return result?.success ? result.improvedText : undefined;
            case 'casual':
                result = await makeMoreCasualText({ text });
                return result?.success ? result.casualText : undefined;
            case 'formal':
                result = await makeMoreFormalText({ text });
                return result?.success ? result.formalText : undefined;
            case 'emojify':
                result = await emojifyText({ text });
                return result?.success ? result.emojifiedText : undefined;
            case 'expand':
                result = await expandText({ text });
                return result?.success ? result.expandedText : undefined;
            case 'shorten':
                result = await shortenText({ text });
                return result?.success ? result.shortenedText : undefined;
            case 'translate':
                if (!targetLanguage) return undefined;
                result = await translateText({ text, targetLanguage });
                return result?.success ? result.translatedText : undefined;
            default:
                return undefined;
        }
    };

    const handleAiAction = async (action: string, targetLanguage?: string) => {
        const { from, to, selectedText } = getSelectionInfo();
        if (!selectedText.trim()) return;

        // Break the selection into text runs around any images. Each run is rewritten
        // independently and the images are left in place, so they keep their position.
        const segments = getSelectionSegments(from, to);
        if (segments.length === 0) return;

        setAiProcessing(action);
        setAiMenuOpen(false);
        setTranslateSubOpen(false);

        try {
            const rewrites = await Promise.all(
                segments.map(async (seg) => ({
                    seg,
                    replacement: await runAiOnText(action, seg.text, targetLanguage),
                }))
            );

            // Apply replacements back-to-front so the earlier (lower) segment positions stay
            // valid as we edit — the untouched images between segments never shift.
            const allowBlockReplace = segments.length === 1;
            const applicable = rewrites
                .filter((r) => r.replacement)
                .map((r) => ({
                    ...r,
                    insertion: prepareAiReplacement(editor, r.seg, r.replacement as string, allowBlockReplace),
                }))
                .filter((r) => r.insertion)
                .sort((a, b) => b.seg.from - a.seg.from);

            if (applicable.length === 0) {
                console.error(`AI ${action} failed: no result`);
                return;
            }

            const chain = editor.chain().focus();
            for (const { insertion } of applicable) {
                chain.insertContentAt(insertion!.range, insertion!.content);
            }
            chain.run();
        } catch (error: any) {
            console.error(`AI ${action} error:`, error);
        } finally {
            setAiProcessing(null);
        }
    };

    useEffect(() => {
        if (!editor) return;

        const updatePosition = () => {
            try {
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
            } catch { /* editor view not available yet */ }
        };

        editor.on("selectionUpdate", updatePosition);
        editor.on("blur", () => { setVisible(false); closeAllDropdowns(); });

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
                    title={t('notionEditor.toolbar.turnInto')}
                >
                    <span style={{ color: '#d1d5db', whiteSpace: 'nowrap' }}>
                        {editor.isActive('heading', { level: 1 }) ? t('notionEditor.slash.heading1')
                            : editor.isActive('heading', { level: 2 }) ? t('notionEditor.slash.heading2')
                            : editor.isActive('heading', { level: 3 }) ? t('notionEditor.slash.heading3')
                            : editor.isActive('bulletList') ? t('notionEditor.toolbar.bulletedList')
                            : editor.isActive('orderedList') ? t('notionEditor.toolbar.numberedList')
                            : editor.isActive('blockquote') ? t('notionEditor.slash.quote')
                            : editor.isActive('codeBlock') ? t('notionEditor.toolbar.codeBlock')
                            : t('notionEditor.slash.text')}
                    </span>
                    <ChevronDown className="w-3 h-3" style={{ opacity: 0.6 }} />
                </button>
                {turnIntoOpen && (
                    <div className="notion-turninto-menu" onMouseDown={(e) => e.preventDefault()}>
                        <div className="notion-turninto-label">{t('notionEditor.toolbar.turnInto')}</div>
                        {[
                            { label: t('notionEditor.slash.text'), icon: <Type className="w-4 h-4" />, active: editor.isActive('paragraph') && !editor.isActive('bulletList') && !editor.isActive('orderedList') && !editor.isActive('blockquote') && !editor.isActive('codeBlock'), action: () => editor.chain().focus().setParagraph().run() },
                            { label: t('notionEditor.slash.heading1'), icon: <Heading1 className="w-4 h-4" />, active: editor.isActive('heading', { level: 1 }), action: () => editor.chain().focus().setHeading({ level: 1 }).run() },
                            { label: t('notionEditor.slash.heading2'), icon: <Heading2 className="w-4 h-4" />, active: editor.isActive('heading', { level: 2 }), action: () => editor.chain().focus().setHeading({ level: 2 }).run() },
                            { label: t('notionEditor.slash.heading3'), icon: <Heading3 className="w-4 h-4" />, active: editor.isActive('heading', { level: 3 }), action: () => editor.chain().focus().setHeading({ level: 3 }).run() },
                            { label: t('notionEditor.toolbar.bulletedList'), icon: <List className="w-4 h-4" />, active: editor.isActive('bulletList'), action: () => editor.chain().focus().toggleBulletList().run() },
                            { label: t('notionEditor.toolbar.numberedList'), icon: <ListOrdered className="w-4 h-4" />, active: editor.isActive('orderedList'), action: () => editor.chain().focus().toggleOrderedList().run() },
                            { label: t('notionEditor.toolbar.blockquote'), icon: <Quote className="w-4 h-4" />, active: editor.isActive('blockquote'), action: () => editor.chain().focus().toggleBlockquote().run() },
                            { label: t('notionEditor.toolbar.codeBlock'), icon: <Code className="w-4 h-4" />, active: editor.isActive('codeBlock'), action: () => editor.chain().focus().toggleCodeBlock().run() },
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
                title={t('notionEditor.toolbar.bold')}
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`notion-bubble-btn ${editor.isActive("italic") ? "active" : ""}`}
                title={t('notionEditor.toolbar.italic')}
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`notion-bubble-btn ${editor.isActive("underline") ? "active" : ""}`}
                title={t('notionEditor.toolbar.underline')}
            >
                <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`notion-bubble-btn ${editor.isActive("strike") ? "active" : ""}`}
                title={t('notionEditor.toolbar.strikethrough')}
            >
                <Strikethrough className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`notion-bubble-btn ${editor.isActive("code") ? "active" : ""}`}
                title={t('notionEditor.toolbar.inlineCode')}
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
                title={t('notionEditor.toolbar.link')}
            >
                <LinkIcon className="w-4 h-4" />
            </button>
            <div className="notion-bubble-divider" />
            <div style={{ position: 'relative' }}>
                <button
                    ref={colorBtnRef}
                    onClick={() => setColorPickerOpen((v) => !v)}
                    className={`notion-bubble-btn ${editor.getAttributes("textStyle").color ? "active" : ""}`}
                    title={t('notionEditor.toolbar.textColor')}
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
                                <div className="notion-color-picker-label">{t('notionEditor.toolbar.recentlyUsed')}</div>
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
                            <div className="notion-color-picker-label">{t('notionEditor.toolbar.textColorLabel')}</div>
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
                            <div className="notion-color-picker-label">{t('notionEditor.toolbar.highlightColor')}</div>
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
                title={t('notionEditor.toolbar.alignLeft')}
            >
                <AlignLeft className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                className={`notion-bubble-btn ${editor.isActive({ textAlign: "center" }) ? "active" : ""}`}
                title={t('notionEditor.toolbar.alignCenter')}
            >
                <AlignCenter className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                className={`notion-bubble-btn ${editor.isActive({ textAlign: "right" }) ? "active" : ""}`}
                title={t('notionEditor.toolbar.alignRight')}
            >
                <AlignRight className="w-4 h-4" />
            </button>
            <div className="notion-bubble-divider" />
            {/* AI Menu */}
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => { setAiMenuOpen((v) => !v); setColorPickerOpen(false); setTurnIntoOpen(false); setTranslateSubOpen(false); }}
                    className={`notion-bubble-btn ${aiProcessing ? 'active' : ''}`}
                    title={t('notionEditor.toolbar.aiTools')}
                    style={{ gap: '4px', width: 'auto', padding: '0 8px' }}
                    disabled={!!aiProcessing}
                >
                    {aiProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#a78bfa' }} />
                    ) : (
                        <Sparkles className="w-4 h-4" style={{ color: '#a78bfa' }} />
                    )}
                    <ChevronDown className="w-3 h-3" style={{ opacity: 0.6 }} />
                </button>
                {aiMenuOpen && (
                    <div className="notion-ai-menu" onMouseDown={(e) => e.preventDefault()}>
                        <div className="notion-ai-menu-label">{t('notionEditor.ai.label')}</div>
                        <button
                            className="notion-ai-menu-item"
                            onClick={() => handleAiAction('improve')}
                            disabled={!!aiProcessing}
                        >
                            <Wand2 className="w-4 h-4" />
                            <span>{t('notionEditor.ai.improve')}</span>
                        </button>
                        <button
                            className="notion-ai-menu-item"
                            onClick={() => handleAiAction('casual')}
                            disabled={!!aiProcessing}
                        >
                            <Sparkles className="w-4 h-4" />
                            <span>{t('notionEditor.ai.casual')}</span>
                        </button>
                        <button
                            className="notion-ai-menu-item"
                            onClick={() => handleAiAction('formal')}
                            disabled={!!aiProcessing}
                        >
                            <Sparkles className="w-4 h-4" />
                            <span>{t('notionEditor.ai.formal')}</span>
                        </button>
                        <button
                            className="notion-ai-menu-item"
                            onClick={() => handleAiAction('emojify')}
                            disabled={!!aiProcessing}
                        >
                            <PartyPopper className="w-4 h-4" />
                            <span>{t('notionEditor.ai.emojify')}</span>
                        </button>
                        <button
                            className="notion-ai-menu-item"
                            onClick={() => handleAiAction('expand')}
                            disabled={!!aiProcessing}
                        >
                            <ArrowRightFromLine className="w-4 h-4" />
                            <span>{t('notionEditor.ai.expand')}</span>
                        </button>
                        <button
                            className="notion-ai-menu-item"
                            onClick={() => handleAiAction('shorten')}
                            disabled={!!aiProcessing}
                        >
                            <ArrowLeftToLine className="w-4 h-4" />
                            <span>{t('notionEditor.ai.shorten')}</span>
                        </button>
                        <div className="notion-ai-menu-divider" />
                        <div style={{ position: 'relative' }}>
                            <button
                                className="notion-ai-menu-item"
                                onMouseEnter={() => setTranslateSubOpen(true)}
                                disabled={!!aiProcessing}
                            >
                                <Languages className="w-4 h-4" />
                                <span>{t('notionEditor.ai.translate')}</span>
                                <ChevronRight className="w-3 h-3" style={{ marginLeft: 'auto', opacity: 0.5 }} />
                            </button>
                            {translateSubOpen && (
                                <div
                                    className="notion-ai-submenu"
                                    onMouseLeave={() => setTranslateSubOpen(false)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    {getTranslateLanguages(t).map((lang) => (
                                        <button
                                            key={lang.key}
                                            className="notion-ai-menu-item"
                                            onClick={() => handleAiAction('translate', lang.key)}
                                            disabled={!!aiProcessing}
                                        >
                                            <span>{lang.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Full Newsletter AI Menu Bar ────────────────────────────────────────────────

function NewsletterAiMenuBar({
    processingAction,
    direction,
    error,
    onDirectionChange,
    onTransform,
    t,
}: {
    processingAction: NewsletterTransformAction | null;
    direction: string;
    error: string;
    onDirectionChange: (value: string) => void;
    onTransform: (action: NewsletterTransformAction, instruction?: string) => void;
    t: (key: string, fallback?: string) => string;
}) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const quickActions: Array<{
        action: NewsletterTransformAction;
        label: string;
        title: string;
        icon: React.ReactNode;
    }> = [
        {
            action: "regenerate",
            label: t("notionEditor.newsletterAi.regenerate", "Regenerate"),
            title: t("notionEditor.newsletterAi.regenerateTitle", "Regenerate the entire newsletter"),
            icon: <RefreshCw className="w-4 h-4" />,
        },
        {
            action: "improve",
            label: t("notionEditor.newsletterAi.improve", "Improve"),
            title: t("notionEditor.newsletterAi.improveTitle", "Improve clarity and flow"),
            icon: <Wand2 className="w-4 h-4" />,
        },
        {
            action: "formal",
            label: t("notionEditor.newsletterAi.formal", "Formal"),
            title: t("notionEditor.newsletterAi.formalTitle", "Make the newsletter more formal"),
            icon: <Type className="w-4 h-4" />,
        },
        {
            action: "casual",
            label: t("notionEditor.newsletterAi.casual", "Casual"),
            title: t("notionEditor.newsletterAi.casualTitle", "Make the newsletter more casual"),
            icon: <Sparkles className="w-4 h-4" />,
        },
        {
            action: "shorten",
            label: t("notionEditor.newsletterAi.shorten", "Shorten"),
            title: t("notionEditor.newsletterAi.shortenTitle", "Make the newsletter more concise"),
            icon: <ArrowLeftToLine className="w-4 h-4" />,
        },
        {
            action: "expand",
            label: t("notionEditor.newsletterAi.expand", "Expand"),
            title: t("notionEditor.newsletterAi.expandTitle", "Add more detail to the newsletter"),
            icon: <ArrowRightFromLine className="w-4 h-4" />,
        },
    ];
    const isProcessing = Boolean(processingAction);
    const canApplyDirection = direction.trim().length >= 3 && !isProcessing;

    useEffect(() => {
        if (isProcessing || error) {
            setOpen(true);
        }
    }, [error, isProcessing]);

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
        <div ref={menuRef} className={`notion-newsletter-ai-shell ${open ? "open" : ""}`}>
            <button
                type="button"
                className={`notion-newsletter-ai-trigger ${isProcessing ? "processing" : ""}`}
                title={t("notionEditor.newsletterAi.title", "Newsletter AI")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                    if (!isProcessing) setOpen((value) => !value);
                }}
            >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{t("notionEditor.newsletterAi.askAi", "Ask AI")}</span>
                <ChevronDown className="w-3 h-3" />
            </button>

            {open && (
                <div className="notion-newsletter-ai-popover">
                    <div className="notion-newsletter-ai-popover-header">
                        <Sparkles className="w-4 h-4" />
                        <span>{t("notionEditor.newsletterAi.title", "Newsletter AI")}</span>
                    </div>
                    <div className="notion-newsletter-ai-actions">
                        {quickActions.map((item) => (
                            <button
                                key={item.action}
                                type="button"
                                className="notion-newsletter-ai-btn"
                                disabled={isProcessing}
                                title={item.title}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => onTransform(item.action)}
                            >
                                {processingAction === item.action ? <Loader2 className="w-4 h-4 animate-spin" /> : item.icon}
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                    <form
                        className="notion-newsletter-ai-direction"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (canApplyDirection) onTransform("custom", direction);
                        }}
                    >
                        <input
                            value={direction}
                            onChange={(event) => onDirectionChange(event.target.value)}
                            placeholder={t("notionEditor.newsletterAi.directionPlaceholder", "Write a new direction...")}
                            disabled={isProcessing}
                        />
                        <button
                            type="submit"
                            disabled={!canApplyDirection}
                            title={t("notionEditor.newsletterAi.applyDirection", "Apply direction")}
                        >
                            {processingAction === "custom" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            <span>{t("notionEditor.newsletterAi.apply", "Apply")}</span>
                        </button>
                    </form>
                    {error && <div className="notion-newsletter-ai-error">{error}</div>}
                </div>
            )}
        </div>
    );
}

// ── Table Helpers: move / duplicate / sort columns & rows ────────────────────────

/** Move a column from `fromIndex` to `toIndex` by repeatedly swapping adjacent columns. */
function moveColumnTo(editor: any, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;
    const firstRow = tableNode.child(0);
    if (fromIndex < 0 || fromIndex >= firstRow.childCount) return;
    if (toIndex < 0 || toIndex >= firstRow.childCount) return;

    const { state } = editor;
    const { tr } = state;

    // Build column order array and move the element
    const order = Array.from({ length: firstRow.childCount }, (_, i) => i);
    const [removed] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, removed);

    const newRows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        const reordered = order.map((ci) => row.child(ci));
        newRows.push(row.type.create(row.attrs, reordered));
    }
    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

/** Move a row from `fromIndex` to `toIndex`. */
function moveRowTo(editor: any, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;
    if (fromIndex < 0 || fromIndex >= tableNode.childCount) return;
    if (toIndex < 0 || toIndex >= tableNode.childCount) return;

    const { state } = editor;
    const { tr } = state;

    const rows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) rows.push(tableNode.child(r));
    const [removed] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, removed);

    const newTable = tableNode.type.create(tableNode.attrs, rows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

function findTableAround(editor: any): { tableNode: any; tablePos: number } | null {
    const { state } = editor;
    const { $from } = state.selection;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
            return { tableNode: $from.node(d), tablePos: $from.before(d) };
        }
    }
    return null;
}

function isLockedProductTableNode(tableNode: any): boolean {
    return Boolean(
        tableNode?.attrs?.lockedStructure ||
        tableNode?.attrs?.templateType === PRODUCT_CARD_TEMPLATE_TYPE
    );
}

function isSelectionInLockedProductTable(editor: any): boolean {
    const found = findTableAround(editor);
    return Boolean(found && isLockedProductTableNode(found.tableNode));
}

function moveColumn(editor: any, direction: -1 | 1) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    // Find current column index from selection
    const { state } = editor;
    const { $from } = state.selection;
    let colIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        const parent = $from.node(d);
        if (parent.type.name === 'tableRow') {
            colIndex = $from.index(d);
            break;
        }
    }

    const firstRow = tableNode.child(0);
    const targetIndex = colIndex + direction;
    if (targetIndex < 0 || targetIndex >= firstRow.childCount) return;

    const { tr } = state;
    const newRows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        const cells: any[] = [];
        for (let c = 0; c < row.childCount; c++) cells.push(row.child(c));
        const temp = cells[colIndex];
        cells[colIndex] = cells[targetIndex];
        cells[targetIndex] = temp;
        newRows.push(row.type.create(row.attrs, cells));
    }
    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

function moveRow(editor: any, direction: -1 | 1) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let rowIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
            rowIndex = $from.index(d);
            break;
        }
    }

    const targetIndex = rowIndex + direction;
    if (targetIndex < 0 || targetIndex >= tableNode.childCount) return;

    const { tr } = state;
    const rows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) rows.push(tableNode.child(r));
    const temp = rows[rowIndex];
    rows[rowIndex] = rows[targetIndex];
    rows[targetIndex] = temp;

    const newTable = tableNode.type.create(tableNode.attrs, rows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

function duplicateColumn(editor: any) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let colIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'tableRow') {
            colIndex = $from.index(d);
            break;
        }
    }

    const { tr } = state;
    const newRows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        const cells: any[] = [];
        for (let c = 0; c < row.childCount; c++) {
            cells.push(row.child(c));
            if (c === colIndex) {
                const cell = row.child(c);
                cells.push(cell.type.create(cell.attrs, cell.content));
            }
        }
        newRows.push(row.type.create(row.attrs, cells));
    }
    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

function duplicateRow(editor: any) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let rowIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
            rowIndex = $from.index(d);
            break;
        }
    }

    const { tr } = state;
    const rows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        rows.push(row);
        if (r === rowIndex) {
            rows.push(row.type.create(row.attrs, row.content));
        }
    }
    const newTable = tableNode.type.create(tableNode.attrs, rows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

function sortColumn(editor: any, ascending: boolean) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let colIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'tableRow') {
            colIndex = $from.index(d);
            break;
        }
    }

    const { tr } = state;
    const headerRows: any[] = [];
    const bodyRows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        if (row.child(0).type.name === 'tableHeader') {
            headerRows.push(row);
        } else {
            bodyRows.push(row);
        }
    }
    bodyRows.sort((a: any, b: any) => {
        const aText = a.child(Math.min(colIndex, a.childCount - 1)).textContent || '';
        const bText = b.child(Math.min(colIndex, b.childCount - 1)).textContent || '';
        const cmp = aText.localeCompare(bText, undefined, { sensitivity: 'base' });
        return ascending ? cmp : -cmp;
    });
    const newTable = tableNode.type.create(tableNode.attrs, [...headerRows, ...bodyRows]);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

/** Clear content of every cell in the current column (preserves cell structure). */
function clearColumnContents(editor: any) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let colIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'tableRow') {
            colIndex = $from.index(d);
            break;
        }
    }

    const { tr } = state;
    const newRows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        const cells: any[] = [];
        for (let c = 0; c < row.childCount; c++) {
            if (c === colIndex) {
                // Create empty cell – keep attrs & type, replace content with empty paragraph
                const cell = row.child(c);
                const emptyPara = state.schema.nodes.paragraph.createAndFill();
                cells.push(cell.type.create(cell.attrs, emptyPara ? [emptyPara] : []));
            } else {
                cells.push(row.child(c));
            }
        }
        newRows.push(row.type.create(row.attrs, cells));
    }
    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

/** Clear content of every cell in the current row. */
function clearRowContents(editor: any) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let rowIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
            rowIndex = $from.index(d);
            break;
        }
    }

    const { tr } = state;
    const newRows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        if (r === rowIndex) {
            const cells: any[] = [];
            for (let c = 0; c < row.childCount; c++) {
                const cell = row.child(c);
                const emptyPara = state.schema.nodes.paragraph.createAndFill();
                cells.push(cell.type.create(cell.attrs, emptyPara ? [emptyPara] : []));
            }
            newRows.push(row.type.create(row.attrs, cells));
        } else {
            newRows.push(row);
        }
    }
    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

/** Apply a background color to every cell in the current column via the style attr. */
function colorColumn(editor: any, color: string) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let colIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'tableRow') {
            colIndex = $from.index(d);
            break;
        }
    }

    const { tr } = state;
    const newRows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        const cells: any[] = [];
        for (let c = 0; c < row.childCount; c++) {
            if (c === colIndex) {
                const cell = row.child(c);
                const style = getStyleWithBackgroundColor(cell.attrs.style, color);
                cells.push(cell.type.create({ ...cell.attrs, style }, cell.content));
            } else {
                cells.push(row.child(c));
            }
        }
        newRows.push(row.type.create(row.attrs, cells));
    }
    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

/** Apply a background color to every cell in the current row. */
function colorRow(editor: any, color: string) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let rowIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
            rowIndex = $from.index(d);
            break;
        }
    }

    const { tr } = state;
    const newRows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        if (r === rowIndex) {
            const cells: any[] = [];
            for (let c = 0; c < row.childCount; c++) {
                const cell = row.child(c);
                const style = getStyleWithBackgroundColor(cell.attrs.style, color);
                cells.push(cell.type.create({ ...cell.attrs, style }, cell.content));
            }
            newRows.push(row.type.create(row.attrs, cells));
        } else {
            newRows.push(row);
        }
    }
    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

const TABLE_BORDER_COLORS = [
    { label: 'Default', value: '' },
    { label: 'Gray', value: '#9ca3af' },
    { label: 'Dark', value: '#374151' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Green', value: '#22c55e' },
    { label: 'Yellow', value: '#eab308' },
    { label: 'Orange', value: '#f97316' },
    { label: 'Red', value: '#ef4444' },
    { label: 'Purple', value: '#a855f7' },
    { label: 'Pink', value: '#ec4899' },
] as const;

/** Replace (or remove) the border-color declaration in a cell's inline style. */
function getStyleWithBorderColor(currentStyle: string | null | undefined, color: string) {
    const remainingStyles = (currentStyle || "")
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part && !/^border-color\s*:/i.test(part));

    if (color) {
        remainingStyles.unshift(`border-color: ${color}`);
    }

    return remainingStyles.join("; ") || null;
}

/** Read the border-color from a cell style string (for showing the active swatch). */
function readBorderColor(style: string | null | undefined): string {
    const match = /border-color\s*:\s*([^;]+)/i.exec(style || "");
    return match ? match[1].trim() : "";
}

/** Rebuild the table, transforming every cell's inline style. */
function mapTableCellStyles(editor: any, transform: (style: string | null | undefined) => string | null) {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;
    const { tr } = editor.state;
    const newRows: any[] = [];
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        const cells: any[] = [];
        for (let c = 0; c < row.childCount; c++) {
            const cell = row.child(c);
            cells.push(cell.type.create({ ...cell.attrs, style: transform(cell.attrs.style) }, cell.content));
        }
        newRows.push(row.type.create(row.attrs, cells));
    }
    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);
    editor.view.dispatch(tr);
}

/** Set the border color on every cell in the table (drives the whole grid). */
function setTableBorderColor(editor: any, color: string) {
    mapTableCellStyles(editor, (style) => getStyleWithBorderColor(style, color));
}

/** Strip all background + border colors from every cell, resetting the table. */
function clearTableColors(editor: any) {
    mapTableCellStyles(editor, (style) =>
        getStyleWithBorderColor(getStyleWithBackgroundColor(style, ""), "")
    );
}

/** Set text-align on all paragraph/heading children in every cell of the column. */
function alignColumn(editor: any, alignment: 'left' | 'center' | 'right') {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let colIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'tableRow') {
            colIndex = $from.index(d);
            break;
        }
    }

    const { tr } = state;
    // Walk the table's document positions and set textAlign on block nodes inside the target column
    let pos = tablePos + 1; // inside table node
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        let cellPos = pos + 1; // inside row node
        for (let c = 0; c < row.childCount; c++) {
            const cell = row.child(c);
            if (c === colIndex) {
                // Walk blocks inside cell
                let blockPos = cellPos + 1; // inside cell node
                for (let b = 0; b < cell.childCount; b++) {
                    const block = cell.child(b);
                    if (block.type.name === 'paragraph' || block.type.name === 'heading') {
                        tr.setNodeMarkup(blockPos, undefined, { ...block.attrs, textAlign: alignment });
                    }
                    blockPos += block.nodeSize;
                }
            }
            cellPos += cell.nodeSize;
        }
        pos += row.nodeSize;
    }
    editor.view.dispatch(tr);
}

/** Set text-align on all paragraph/heading children in every cell of the row. */
function alignRow(editor: any, alignment: 'left' | 'center' | 'right') {
    const found = findTableAround(editor);
    if (!found) return;
    const { tableNode, tablePos } = found;

    const { state } = editor;
    const { $from } = state.selection;
    let rowIndex = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
            rowIndex = $from.index(d);
            break;
        }
    }

    const { tr } = state;
    let pos = tablePos + 1;
    for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        if (r === rowIndex) {
            let cellPos = pos + 1;
            for (let c = 0; c < row.childCount; c++) {
                const cell = row.child(c);
                let blockPos = cellPos + 1;
                for (let b = 0; b < cell.childCount; b++) {
                    const block = cell.child(b);
                    if (block.type.name === 'paragraph' || block.type.name === 'heading') {
                        tr.setNodeMarkup(blockPos, undefined, { ...block.attrs, textAlign: alignment });
                    }
                    blockPos += block.nodeSize;
                }
                cellPos += cell.nodeSize;
            }
        }
        pos += row.nodeSize;
    }
    editor.view.dispatch(tr);
}

const TABLE_CELL_COLORS = [
    { label: 'None', value: '' },
    { label: 'Light Gray', value: '#f3f4f6' },
    { label: 'Light Blue', value: '#dbeafe' },
    { label: 'Light Green', value: '#dcfce7' },
    { label: 'Light Yellow', value: '#fef9c3' },
    { label: 'Light Orange', value: '#ffedd5' },
    { label: 'Light Red', value: '#fee2e2' },
    { label: 'Light Purple', value: '#f3e8ff' },
    { label: 'Light Pink', value: '#fce7f3' },
] as const;

function getStyleWithBackgroundColor(currentStyle: string | null | undefined, color: string) {
    const remainingStyles = (currentStyle || "")
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part && !/^background(?:-color)?\s*:/i.test(part));

    if (color) {
        remainingStyles.unshift(`background-color: ${color}`);
    }

    return remainingStyles.join("; ") || null;
}

// ── Table Floating Controls ─────────────────────────────────────────────────────

interface ColInfo {
    left: number;
    width: number;
    index: number;
}

interface RowInfo {
    top: number;
    height: number;
    index: number;
}

function TableFloatingControls({ editor }: { editor: any }) {
    const { t } = useTranslation();
    const [isInTable, setIsInTable] = useState(false);
    const [isStructureLocked, setIsStructureLocked] = useState(false);
    const [columns, setColumns] = useState<ColInfo[]>([]);
    const [rows, setRows] = useState<RowInfo[]>([]);
    const [tablePos, setTablePos] = useState<{ top: number; left: number; width: number; height: number; bottom: number }>({
        top: 0, left: 0, width: 0, height: 0, bottom: 0,
    });
    const [openColMenu, setOpenColMenu] = useState<number | null>(null);
    const [openRowMenu, setOpenRowMenu] = useState<number | null>(null);
    const [hoveredCol, setHoveredCol] = useState<number | null>(null);
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
    // Submenu state for color/align pickers inside dropdowns
    const [colSubmenu, setColSubmenu] = useState<'color' | 'align' | null>(null);
    const [rowSubmenu, setRowSubmenu] = useState<'color' | 'align' | null>(null);
    // Table-level border color picker (popover near the bottom toolbar)
    const [borderMenuOpen, setBorderMenuOpen] = useState(false);
    const [currentBorderColor, setCurrentBorderColor] = useState<string>('');
    const menuRef = useRef<HTMLDivElement>(null);
    // The scrollable, position:relative editor area. Controls are rendered as its
    // absolutely-positioned children so they co-scroll with the table natively
    // (no JS on scroll), which keeps them glued to the table without lag.
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const areaElRef = useRef<HTMLElement | null>(null);

    // ── Drag state ───────────────────────────────────────────────────────────
    const [dragColFrom, setDragColFrom] = useState<number | null>(null);
    const [dragColTarget, setDragColTarget] = useState<number | null>(null);
    const [dragRowFrom, setDragRowFrom] = useState<number | null>(null);
    const [dragRowTarget, setDragRowTarget] = useState<number | null>(null);
    // Track mousedown origin to distinguish click from drag
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const isDragging = useRef(false);
    // Keep latest columns/rows in refs for mousemove handler
    const columnsRef = useRef(columns);
    columnsRef.current = columns;
    const rowsRef = useRef(rows);
    rowsRef.current = rows;
    const tablePosRef = useRef(tablePos);
    tablePosRef.current = tablePos;

    // ── Column drag handlers ─────────────────────────────────────────────────
    const handleColDragStart = useCallback((colIndex: number, e: React.MouseEvent) => {
        e.preventDefault();
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        isDragging.current = false;

        const onMouseMove = (ev: MouseEvent) => {
            const dx = ev.clientX - (dragStartPos.current?.x ?? 0);
            const dy = ev.clientY - (dragStartPos.current?.y ?? 0);
            // Require 5px movement to start drag (otherwise it's a click)
            if (!isDragging.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

            if (!isDragging.current) {
                isDragging.current = true;
                setDragColFrom(colIndex);
                setOpenColMenu(null);
                setOpenRowMenu(null);
            }

            // Determine which column the mouse is over. col.left is in editor-area
            // content coords, so convert the viewport mouse x into the same space.
            const ar = areaElRef.current?.getBoundingClientRect();
            const mouseX = ev.clientX - (ar?.left ?? 0) + (areaElRef.current?.scrollLeft ?? 0);
            const cols = columnsRef.current;
            let target = 0;
            for (let i = 0; i < cols.length; i++) {
                const colCenter = cols[i].left + cols[i].width / 2;
                if (mouseX > colCenter) target = i + 1;
            }
            // Clamp and adjust: if dragging right past self, subtract 1
            target = Math.max(0, Math.min(target, cols.length));
            // Convert insertion index to final position
            const finalTarget = target > colIndex ? target - 1 : target;
            setDragColTarget(Math.max(0, Math.min(finalTarget, cols.length - 1)));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isDragging.current) {
                // Perform the move
                setDragColFrom((from) => {
                    setDragColTarget((to) => {
                        if (from !== null && to !== null && from !== to) {
                            moveColumnTo(editor, from, to);
                        }
                        return null;
                    });
                    return null;
                });
                isDragging.current = false;
            }
            dragStartPos.current = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [editor]);

    // ── Row drag handlers ────────────────────────────────────────────────────
    const handleRowDragStart = useCallback((rowIndex: number, e: React.MouseEvent) => {
        e.preventDefault();
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        isDragging.current = false;

        const onMouseMove = (ev: MouseEvent) => {
            const dx = ev.clientX - (dragStartPos.current?.x ?? 0);
            const dy = ev.clientY - (dragStartPos.current?.y ?? 0);
            if (!isDragging.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

            if (!isDragging.current) {
                isDragging.current = true;
                setDragRowFrom(rowIndex);
                setOpenColMenu(null);
                setOpenRowMenu(null);
            }

            // row.top is in editor-area content coords; convert the viewport mouse y to match.
            const ar = areaElRef.current?.getBoundingClientRect();
            const mouseY = ev.clientY - (ar?.top ?? 0) + (areaElRef.current?.scrollTop ?? 0);
            const rws = rowsRef.current;
            let target = 0;
            for (let i = 0; i < rws.length; i++) {
                const rowCenter = rws[i].top + rws[i].height / 2;
                if (mouseY > rowCenter) target = i + 1;
            }
            target = Math.max(0, Math.min(target, rws.length));
            const finalTarget = target > rowIndex ? target - 1 : target;
            setDragRowTarget(Math.max(0, Math.min(finalTarget, rws.length - 1)));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (isDragging.current) {
                setDragRowFrom((from) => {
                    setDragRowTarget((to) => {
                        if (from !== null && to !== null && from !== to) {
                            moveRowTo(editor, from, to);
                        }
                        return null;
                    });
                    return null;
                });
                isDragging.current = false;
            }
            dragStartPos.current = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [editor]);

    // Helper: on column handle click (only fires if not a drag)
    const handleColClick = useCallback((colIndex: number) => {
        if (!isDragging.current) {
            setOpenColMenu((prev) => prev === colIndex ? null : colIndex);
            setColSubmenu(null);
        }
    }, []);

    const handleRowClick = useCallback((rowIndex: number) => {
        if (!isDragging.current) {
            setOpenRowMenu((prev) => prev === rowIndex ? null : rowIndex);
            setRowSubmenu(null);
        }
    }, []);

    useEffect(() => {
        if (!editor) return;
        // In tiptap v3, editor.view throws if not mounted yet — guard with try/catch
        let viewDom: HTMLElement | undefined;
        try { viewDom = editor.view?.dom; } catch { /* not mounted yet */ }
        if (!viewDom) return;

        let trackedTable: HTMLTableElement | null = null;
        let trackedImages: HTMLImageElement[] = [];
        let rafId: number | null = null;
        const scheduleUpdate = () => {
            if (rafId !== null) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                update();
            });
        };
        const onImageLoad = () => { if (editor.isActive('table')) scheduleUpdate(); };
        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => scheduleUpdate())
            : null;

        const trackTable = (table: HTMLTableElement | null) => {
            if (trackedTable === table) return;
            if (trackedTable) {
                resizeObserver?.unobserve(trackedTable);
                trackedImages.forEach((img) => img.removeEventListener('load', onImageLoad));
                trackedImages = [];
            }
            trackedTable = table;
            if (table) {
                resizeObserver?.observe(table);
                // Async-loaded images (product card placeholders) resize the table after load —
                // listen so controls reposition once the image lays out.
                trackedImages = Array.from(table.querySelectorAll('img')) as HTMLImageElement[];
                trackedImages.forEach((img) => {
                    if (!img.complete) img.addEventListener('load', onImageLoad, { once: true });
                });
            }
        };

        const update = () => {
            let dom: HTMLElement | undefined;
            try { dom = editor.view?.dom; } catch { return; }
            if (!dom) return;
            const active = editor.isActive('table');
            if (!active) {
                setIsInTable(false);
                setIsStructureLocked(false);
                setOpenColMenu(null);
                setOpenRowMenu(null);
                trackTable(null);
                return;
            }
            const activeTable = findTableAround(editor);
            if (!activeTable) {
                setIsInTable(false);
                setIsStructureLocked(false);
                setOpenColMenu(null);
                setOpenRowMenu(null);
                trackTable(null);
                return;
            }
            setIsStructureLocked(isLockedProductTableNode(activeTable.tableNode));
            const firstCell = activeTable.tableNode.firstChild?.firstChild;
            setCurrentBorderColor(readBorderColor(firstCell?.attrs?.style));

            const { state } = editor;
            const { $from } = state.selection;
            let domNode: HTMLElement | null = null;
            let tableRoot: HTMLElement | null = null;
            try {
                const nodeDom = editor.view.nodeDOM(activeTable.tablePos);
                tableRoot = nodeDom instanceof HTMLElement ? nodeDom : null;
                domNode = editor.view.domAtPos($from.start($from.depth)).node as HTMLElement;
            } catch {
                setIsInTable(false);
                setIsStructureLocked(false);
                trackTable(null);
                return;
            }
            const table = (
                tableRoot?.matches?.('table')
                    ? tableRoot
                    : tableRoot?.querySelector?.('table') ||
                    domNode?.closest?.('table')
            ) as HTMLTableElement | null;
            if (!table) {
                setIsInTable(false);
                setIsStructureLocked(false);
                trackTable(null);
                return;
            }

            trackTable(table);

            // The controls are rendered as absolutely-positioned children of the
            // scrollable, position:relative `.notion-editor-area`, so we express all
            // coords in that element's content space (viewport coord − area top + its
            // scroll offset). Absolutely-positioned children co-scroll with the area,
            // so the controls stay glued to the table with zero JS during scrolling.
            const area = viewDom.closest('.notion-editor-area') as HTMLElement | null;
            if (!area) {
                setIsInTable(false);
                trackTable(null);
                return;
            }
            areaElRef.current = area;
            setPortalTarget((prev) => (prev === area ? prev : area));
            const areaRect = area.getBoundingClientRect();
            const sTop = area.scrollTop;
            const sLeft = area.scrollLeft;
            const toContentTop = (v: number) => v - areaRect.top + sTop;
            const toContentLeft = (v: number) => v - areaRect.left + sLeft;

            const tableRect = table.getBoundingClientRect();
            setTablePos({
                top: toContentTop(tableRect.top),
                left: toContentLeft(tableRect.left),
                width: tableRect.width,
                height: tableRect.height,
                bottom: toContentTop(tableRect.bottom),
            });

            // Column positions from the first row
            const firstRow = table.querySelector('tr');
            if (firstRow) {
                const cells = Array.from(firstRow.children) as HTMLElement[];
                setColumns(cells.map((cell, i) => {
                    const cellRect = cell.getBoundingClientRect();
                    return { left: toContentLeft(cellRect.left), width: cellRect.width, index: i };
                }));
            }

            // Row positions from all rows
            const allRows = Array.from(table.querySelectorAll('tr')) as HTMLElement[];
            setRows(allRows.map((row, i) => {
                const rowRect = row.getBoundingClientRect();
                return { top: toContentTop(rowRect.top), height: rowRect.height, index: i };
            }));

            setIsInTable(true);
        };

        // No scroll listener needed: the controls are absolute children of the editor
        // area's content, so the browser scrolls them in lockstep with the table.
        // We only re-measure when the table's size/position can actually change.
        const onViewportChange = () => { if (editor.isActive('table')) scheduleUpdate(); };

        editor.on('selectionUpdate', update);
        editor.on('transaction', update);
        window.addEventListener('resize', onViewportChange);
        scheduleUpdate();
        return () => {
            editor.off('selectionUpdate', update);
            editor.off('transaction', update);
            window.removeEventListener('resize', onViewportChange);
            trackTable(null);
            resizeObserver?.disconnect();
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [editor]);

    // Close menus on outside click
    useEffect(() => {
        if (openColMenu === null && openRowMenu === null && !borderMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenColMenu(null);
                setOpenRowMenu(null);
                setBorderMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openColMenu, openRowMenu, borderMenuOpen]);

    // Focus cursor into a specific cell before running column/row commands
    const focusCellInColumn = (colIndex: number) => {
        try {
            const { state } = editor;
            const { $from } = state.selection;
            for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type.name === 'tableRow') {
                    const currentCol = $from.index(d);
                    if (currentCol !== colIndex) {
                        // Navigate to the correct column in the current row
                        let pos = $from.start(d);
                        for (let c = 0; c < colIndex; c++) {
                            pos += $from.node(d).child(c).nodeSize;
                        }
                        editor.chain().focus().setTextSelection(pos + 1).run();
                    }
                    return;
                }
            }
        } catch { /* keep current focus */ }
    };

    const focusCellInRow = (rowIndex: number) => {
        try {
            const found = findTableAround(editor);
            if (!found) return;
            const { tableNode, tablePos: tPos } = found;
            let pos = tPos + 1; // inside table
            for (let r = 0; r < rowIndex; r++) {
                pos += tableNode.child(r).nodeSize;
            }
            // pos is now at start of target row, go into its first cell
            editor.chain().focus().setTextSelection(pos + 2).run();
        } catch { /* keep current focus */ }
    };

    const handleColAction = (action: string, colIndex: number) => {
        setOpenColMenu(null);
        setColSubmenu(null);
        if (isStructureLocked && ['insertLeft', 'insertRight', 'duplicate'].includes(action)) return;
        focusCellInColumn(colIndex);
        setTimeout(() => {
            switch (action) {
                case 'insertLeft':
                    editor.chain().focus().addColumnBefore().run();
                    break;
                case 'insertRight':
                    editor.chain().focus().addColumnAfter().run();
                    break;
                case 'moveLeft':
                    moveColumn(editor, -1);
                    break;
                case 'moveRight':
                    moveColumn(editor, 1);
                    break;
                case 'duplicate':
                    duplicateColumn(editor);
                    break;
                case 'sortAsc':
                    sortColumn(editor, true);
                    break;
                case 'sortDesc':
                    sortColumn(editor, false);
                    break;
                case 'toggleHeader':
                    editor.chain().focus().toggleHeaderColumn().run();
                    break;
                case 'clearContents':
                    clearColumnContents(editor);
                    break;
                case 'delete':
                    editor.chain().focus().deleteColumn().run();
                    break;
            }
        }, 10);
    };

    const handleColColor = (colIndex: number, color: string) => {
        setOpenColMenu(null);
        setColSubmenu(null);
        focusCellInColumn(colIndex);
        setTimeout(() => colorColumn(editor, color), 10);
    };

    const handleColAlign = (colIndex: number, alignment: 'left' | 'center' | 'right') => {
        setOpenColMenu(null);
        setColSubmenu(null);
        focusCellInColumn(colIndex);
        setTimeout(() => alignColumn(editor, alignment), 10);
    };

    const handleRowAction = (action: string, rowIndex: number) => {
        setOpenRowMenu(null);
        setRowSubmenu(null);
        if (isStructureLocked && ['insertAbove', 'insertBelow', 'moveUp', 'moveDown', 'duplicate'].includes(action)) return;
        focusCellInRow(rowIndex);
        setTimeout(() => {
            switch (action) {
                case 'insertAbove':
                    editor.chain().focus().addRowBefore().run();
                    break;
                case 'insertBelow':
                    editor.chain().focus().addRowAfter().run();
                    break;
                case 'moveUp':
                    moveRow(editor, -1);
                    break;
                case 'moveDown':
                    moveRow(editor, 1);
                    break;
                case 'duplicate':
                    duplicateRow(editor);
                    break;
                case 'toggleHeader':
                    editor.chain().focus().toggleHeaderRow().run();
                    break;
                case 'clearContents':
                    clearRowContents(editor);
                    break;
                case 'delete':
                    editor.chain().focus().deleteRow().run();
                    break;
            }
        }, 10);
    };

    const handleRowColor = (rowIndex: number, color: string) => {
        setOpenRowMenu(null);
        setRowSubmenu(null);
        focusCellInRow(rowIndex);
        setTimeout(() => colorRow(editor, color), 10);
    };

    const handleRowAlign = (rowIndex: number, alignment: 'left' | 'center' | 'right') => {
        setOpenRowMenu(null);
        setRowSubmenu(null);
        focusCellInRow(rowIndex);
        setTimeout(() => alignRow(editor, alignment), 10);
    };

    const handleTableBorderColor = (color: string) => {
        setBorderMenuOpen(false);
        setCurrentBorderColor(color);
        editor.chain().focus().run();
        setTimeout(() => setTableBorderColor(editor, color), 10);
    };

    const handleClearTableColors = () => {
        setBorderMenuOpen(false);
        setCurrentBorderColor('');
        editor.chain().focus().run();
        setTimeout(() => clearTableColors(editor), 10);
    };

    if (!isInTable || columns.length === 0 || !portalTarget) return null;

    const canMerge = !isStructureLocked && editor.can().mergeCells();
    const canSplit = !isStructureLocked && editor.can().splitCell();
    const totalCols = columns.length;
    const totalRows = rows.length;

    return createPortal(
        <div ref={menuRef} className="table-floating-controls-portal">
            {/* ── Column drag bars ─ above each column ────────────────────── */}
            {columns.map((col) => (
                    <div
                        key={col.index}
                        className="flex justify-center"
                        style={{
                            position: 'absolute',
                            top: tablePos.top - 30,
                            left: col.left,
                            width: col.width,
                            zIndex: openColMenu === col.index ? 10002 : 9999,
                        }}
                    >
                        <button
                            onClick={() => handleColClick(col.index)}
                            onMouseDown={(e) => handleColDragStart(col.index, e)}
                            onMouseEnter={() => setHoveredCol(col.index)}
                            onMouseLeave={() => { if (dragColFrom === null) setHoveredCol(null); }}
                            className={`table-col-drag-bar ${
                                openColMenu === col.index ? 'table-col-drag-bar-active' : ''
                            } ${dragColFrom === col.index ? 'table-col-drag-bar-dragging' : ''}`}
                            title={t('notionEditor.table.dragReorder')}
                        >
                            <GripHorizontal className="w-3 h-3" />
                        </button>

                        {/* Column dropdown menu */}
                        {openColMenu === col.index && (
                            <div className="table-col-dropdown">
                                {!isStructureLocked && (
                                    <>
                                        <div className="table-dropdown-section-label">{t('notionEditor.table.insert')}</div>
                                        <button
                                            className="table-dropdown-item"
                                            onClick={() => handleColAction('insertLeft', col.index)}
                                            onMouseDown={(e) => e.preventDefault()}
                                        >
                                            <PanelLeftOpen className="w-4 h-4" />
                                            <span>{t('notionEditor.table.insertColLeft')}</span>
                                        </button>
                                        <button
                                            className="table-dropdown-item"
                                            onClick={() => handleColAction('insertRight', col.index)}
                                            onMouseDown={(e) => e.preventDefault()}
                                        >
                                            <PanelRightOpen className="w-4 h-4" />
                                            <span>{t('notionEditor.table.insertColRight')}</span>
                                        </button>
                                        <div className="table-dropdown-divider" />
                                    </>
                                )}
                                <div className="table-dropdown-section-label">{t('notionEditor.table.move')}</div>
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => handleColAction('moveLeft', col.index)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    disabled={col.index === 0}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>{t('notionEditor.table.moveColLeft')}</span>
                                </button>
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => handleColAction('moveRight', col.index)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    disabled={col.index >= totalCols - 1}
                                >
                                    <ArrowRight className="w-4 h-4" />
                                    <span>{t('notionEditor.table.moveColRight')}</span>
                                </button>
                                <div className="table-dropdown-divider" />
                                {!isStructureLocked && (
                                    <button
                                        className="table-dropdown-item"
                                        onClick={() => handleColAction('duplicate', col.index)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <Copy className="w-4 h-4" />
                                        <span>{t('notionEditor.table.duplicateCol')}</span>
                                    </button>
                                )}
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => handleColAction('sortAsc', col.index)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <ArrowDownAZ className="w-4 h-4" />
                                    <span>{t('notionEditor.table.sortAZ')}</span>
                                </button>
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => handleColAction('sortDesc', col.index)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <ArrowUpAZ className="w-4 h-4" />
                                    <span>{t('notionEditor.table.sortZA')}</span>
                                </button>
                                <div className="table-dropdown-divider" />
                                <div className="table-dropdown-section-label">{t('notionEditor.table.format')}</div>
                                {/* Color submenu */}
                                <div className="relative">
                                    <button
                                        className="table-dropdown-item"
                                        onClick={() => setColSubmenu(colSubmenu === 'color' ? null : 'color')}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <Paintbrush className="w-4 h-4" />
                                        <span>{t('notionEditor.table.color')}</span>
                                        <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
                                    </button>
                                    {colSubmenu === 'color' && (
                                        <div className="table-submenu">
                                            {TABLE_CELL_COLORS.map((c) => (
                                                <button
                                                    key={c.label}
                                                    className="table-dropdown-item"
                                                    onClick={() => handleColColor(col.index, c.value)}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                >
                                                    <span
                                                        className="table-color-swatch"
                                                        style={{ background: c.value || '#ffffff', border: c.value ? 'none' : '1px solid #d1d5db' }}
                                                    />
                                                    <span>{c.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {/* Alignment submenu */}
                                <div className="relative">
                                    <button
                                        className="table-dropdown-item"
                                        onClick={() => setColSubmenu(colSubmenu === 'align' ? null : 'align')}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <AlignLeft className="w-4 h-4" />
                                        <span>{t('notionEditor.table.alignment')}</span>
                                        <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
                                    </button>
                                    {colSubmenu === 'align' && (
                                        <div className="table-submenu">
                                            <button className="table-dropdown-item" onClick={() => handleColAlign(col.index, 'left')} onMouseDown={(e) => e.preventDefault()}>
                                                <AlignLeft className="w-4 h-4" /> <span>{t('notionEditor.toolbar.alignLeft')}</span>
                                            </button>
                                            <button className="table-dropdown-item" onClick={() => handleColAlign(col.index, 'center')} onMouseDown={(e) => e.preventDefault()}>
                                                <AlignCenter className="w-4 h-4" /> <span>{t('notionEditor.toolbar.alignCenter')}</span>
                                            </button>
                                            <button className="table-dropdown-item" onClick={() => handleColAlign(col.index, 'right')} onMouseDown={(e) => e.preventDefault()}>
                                                <AlignRight className="w-4 h-4" /> <span>{t('notionEditor.toolbar.alignRight')}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => handleColAction('clearContents', col.index)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <Eraser className="w-4 h-4" />
                                    <span>{t('notionEditor.table.clearContents')}</span>
                                </button>
                                <div className="table-dropdown-divider" />
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => handleColAction('toggleHeader', col.index)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <Bold className="w-4 h-4" />
                                    <span>{t('notionEditor.table.toggleHeader')}</span>
                                </button>
                                {canMerge && (
                                    <button
                                        className="table-dropdown-item"
                                        onClick={() => { setOpenColMenu(null); editor.chain().focus().mergeCells().run(); }}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <TableCellsMerge className="w-4 h-4" />
                                        <span>{t('notionEditor.table.mergeCells')}</span>
                                    </button>
                                )}
                                {canSplit && (
                                    <button
                                        className="table-dropdown-item"
                                        onClick={() => { setOpenColMenu(null); editor.chain().focus().splitCell().run(); }}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <TableCellsSplit className="w-4 h-4" />
                                        <span>{t('notionEditor.table.splitCell')}</span>
                                    </button>
                                )}
                                <div className="table-dropdown-divider" />
                                <button
                                    className="table-dropdown-item table-dropdown-item-danger"
                                    onClick={() => handleColAction('delete', col.index)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>{t('notionEditor.table.deleteCol')}</span>
                                </button>
                            </div>
                        )}
                    </div>
                ))}

            {/* ── Row drag bars ─ left of each row ────────────────────────── */}
            {rows.map((row) => (
                <div key={row.index} style={{ position: 'absolute', top: row.top, left: tablePos.left - 32, zIndex: openRowMenu === row.index ? 10002 : 9999 }}>
                    <button
                        onClick={() => handleRowClick(row.index)}
                        onMouseDown={(e) => {
                            if (isStructureLocked) {
                                e.preventDefault();
                                return;
                            }
                            handleRowDragStart(row.index, e);
                        }}
                        onMouseEnter={() => setHoveredRow(row.index)}
                        onMouseLeave={() => { if (dragRowFrom === null) setHoveredRow(null); }}
                        className={`table-row-drag-bar ${
                            openRowMenu === row.index ? 'table-row-drag-bar-active' : ''
                        } ${dragRowFrom === row.index ? 'table-row-drag-bar-dragging' : ''}`}
                        style={{ height: Math.max(row.height - 4, 18) }}
                        title={t('notionEditor.table.dragReorder')}
                    >
                        <GripVertical className="w-3 h-3" />
                    </button>

                    {/* Row dropdown menu */}
                    {openRowMenu === row.index && (
                        <div className="table-row-dropdown" style={{ position: 'absolute', top: 0, right: '100%', marginRight: 4 }}>
                            {!isStructureLocked && (
                                <>
                                    <div className="table-dropdown-section-label">{t('notionEditor.table.insert')}</div>
                                    <button
                                        className="table-dropdown-item"
                                        onClick={() => handleRowAction('insertAbove', row.index)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                        <span>{t('notionEditor.table.insertRowAbove')}</span>
                                    </button>
                                    <button
                                        className="table-dropdown-item"
                                        onClick={() => handleRowAction('insertBelow', row.index)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <ArrowDown className="w-4 h-4" />
                                        <span>{t('notionEditor.table.insertRowBelow')}</span>
                                    </button>
                                    <div className="table-dropdown-divider" />
                                </>
                            )}
                            {!isStructureLocked && (
                                <>
                                    <div className="table-dropdown-section-label">{t('notionEditor.table.move')}</div>
                                    <button
                                        className="table-dropdown-item"
                                        onClick={() => handleRowAction('moveUp', row.index)}
                                        onMouseDown={(e) => e.preventDefault()}
                                        disabled={row.index === 0}
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                        <span>{t('notionEditor.table.moveRowUp')}</span>
                                    </button>
                                    <button
                                        className="table-dropdown-item"
                                        onClick={() => handleRowAction('moveDown', row.index)}
                                        onMouseDown={(e) => e.preventDefault()}
                                        disabled={row.index >= totalRows - 1}
                                    >
                                        <ArrowDown className="w-4 h-4" />
                                        <span>{t('notionEditor.table.moveRowDown')}</span>
                                    </button>
                                    <div className="table-dropdown-divider" />
                                </>
                            )}
                            {!isStructureLocked && (
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => handleRowAction('duplicate', row.index)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <Copy className="w-4 h-4" />
                                    <span>{t('notionEditor.table.duplicateRow')}</span>
                                </button>
                            )}
                            <div className="table-dropdown-divider" />
                            <div className="table-dropdown-section-label">{t('notionEditor.table.format')}</div>
                            {/* Row color submenu */}
                            <div className="relative">
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => setRowSubmenu(rowSubmenu === 'color' ? null : 'color')}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <Paintbrush className="w-4 h-4" />
                                    <span>{t('notionEditor.table.color')}</span>
                                    <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
                                </button>
                                {rowSubmenu === 'color' && (
                                    <div className="table-submenu">
                                        {TABLE_CELL_COLORS.map((c) => (
                                            <button
                                                key={c.label}
                                                className="table-dropdown-item"
                                                onClick={() => handleRowColor(row.index, c.value)}
                                                onMouseDown={(e) => e.preventDefault()}
                                            >
                                                <span
                                                    className="table-color-swatch"
                                                    style={{ background: c.value || '#ffffff', border: c.value ? 'none' : '1px solid #d1d5db' }}
                                                />
                                                <span>{c.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Row alignment submenu */}
                            <div className="relative">
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => setRowSubmenu(rowSubmenu === 'align' ? null : 'align')}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <AlignLeft className="w-4 h-4" />
                                    <span>{t('notionEditor.table.alignment')}</span>
                                    <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
                                </button>
                                {rowSubmenu === 'align' && (
                                    <div className="table-submenu">
                                        <button className="table-dropdown-item" onClick={() => handleRowAlign(row.index, 'left')} onMouseDown={(e) => e.preventDefault()}>
                                            <AlignLeft className="w-4 h-4" /> <span>{t('notionEditor.toolbar.alignLeft')}</span>
                                        </button>
                                        <button className="table-dropdown-item" onClick={() => handleRowAlign(row.index, 'center')} onMouseDown={(e) => e.preventDefault()}>
                                            <AlignCenter className="w-4 h-4" /> <span>{t('notionEditor.toolbar.alignCenter')}</span>
                                        </button>
                                        <button className="table-dropdown-item" onClick={() => handleRowAlign(row.index, 'right')} onMouseDown={(e) => e.preventDefault()}>
                                            <AlignRight className="w-4 h-4" /> <span>{t('notionEditor.toolbar.alignRight')}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button
                                className="table-dropdown-item"
                                onClick={() => handleRowAction('clearContents', row.index)}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <Eraser className="w-4 h-4" />
                                <span>{t('notionEditor.table.clearContents')}</span>
                            </button>
                            <div className="table-dropdown-divider" />
                            <button
                                className="table-dropdown-item"
                                onClick={() => handleRowAction('toggleHeader', row.index)}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <Bold className="w-4 h-4" />
                                <span>{t('notionEditor.table.toggleHeaderRow')}</span>
                            </button>
                            <div className="table-dropdown-divider" />
                            <button
                                className="table-dropdown-item table-dropdown-item-danger"
                                onClick={() => handleRowAction('delete', row.index)}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>{t('notionEditor.table.deleteRow')}</span>
                            </button>
                        </div>
                    )}
                </div>
            ))}

            {/* ── Column highlight overlay ────────────────────────────────── */}
            {hoveredCol !== null && columns[hoveredCol] && (
                <div
                    className="table-col-highlight"
                    style={{
                        position: 'absolute',
                        top: tablePos.top,
                        left: columns[hoveredCol].left,
                        width: columns[hoveredCol].width,
                        height: tablePos.height,
                        zIndex: 9998,
                    }}
                />
            )}

            {/* ── Row highlight overlay ───────────────────────────────────── */}
            {hoveredRow !== null && rows[hoveredRow] && (
                <div
                    className="table-row-highlight"
                    style={{
                        position: 'absolute',
                        top: rows[hoveredRow].top,
                        left: tablePos.left,
                        width: tablePos.width,
                        height: rows[hoveredRow].height,
                        zIndex: 9998,
                    }}
                />
            )}

            {/* ── Column drag drop indicator line ──────────────────────── */}
            {dragColFrom !== null && dragColTarget !== null && dragColFrom !== dragColTarget && columns[dragColTarget] && (
                <div
                    className="table-drag-indicator-col"
                    style={{
                        position: 'absolute',
                        top: tablePos.top - 6,
                        left: dragColTarget <= dragColFrom
                            ? columns[dragColTarget].left - 2
                            : columns[dragColTarget].left + columns[dragColTarget].width - 2,
                        height: tablePos.height + 12,
                        zIndex: 10000,
                    }}
                />
            )}

            {/* ── Row drag drop indicator line ────────────────────────────── */}
            {dragRowFrom !== null && dragRowTarget !== null && dragRowFrom !== dragRowTarget && rows[dragRowTarget] && (
                <div
                    className="table-drag-indicator-row"
                    style={{
                        position: 'absolute',
                        top: dragRowTarget <= dragRowFrom
                            ? rows[dragRowTarget].top - 2
                            : rows[dragRowTarget].top + rows[dragRowTarget].height - 2,
                        left: tablePos.left - 6,
                        width: tablePos.width + 12,
                        zIndex: 10000,
                    }}
                />
            )}

            {!isStructureLocked && (
                <>
                    {/* ── "+" button ─ add column (right edge) ────────────────────── */}
                    <button
                        className="table-extend-btn"
                        style={{
                            position: 'absolute',
                            top: tablePos.top + tablePos.height / 2 - 14,
                            left: tablePos.left + tablePos.width + 6,
                            zIndex: 9999,
                        }}
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                        onMouseDown={(e) => e.preventDefault()}
                        title={t('notionEditor.table.addColumn')}
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>

                    {/* ── "+" button ─ add row (bottom edge) ──────────────────────── */}
                    <button
                        className="table-extend-btn"
                        style={{
                            position: 'absolute',
                            top: tablePos.bottom + 6,
                            left: tablePos.left + tablePos.width / 2 - 14,
                            zIndex: 9999,
                        }}
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                        onMouseDown={(e) => e.preventDefault()}
                        title={t('notionEditor.table.addRow')}
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </>
            )}

            {/* ── Table toolbar ─ border color + delete, below the add-row button ── */}
            <div
                style={{
                    position: 'absolute',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '6px',
                    top: tablePos.bottom + 36,
                    left: tablePos.left,
                    width: tablePos.width,
                    zIndex: borderMenuOpen ? 10002 : 9999,
                }}
            >
                {/* Border color picker */}
                <div className="relative">
                    <button
                        className="table-border-btn"
                        onClick={() => setBorderMenuOpen((o) => !o)}
                        onMouseDown={(e) => e.preventDefault()}
                        title={t('notionEditor.table.borderColor')}
                    >
                        <Square
                            className="w-3.5 h-3.5"
                            style={{ color: currentBorderColor || '#9ca3af' }}
                        />
                        <span>{t('notionEditor.table.borderColor')}</span>
                    </button>
                    {borderMenuOpen && (
                        <div className="table-border-popover">
                            {TABLE_BORDER_COLORS.map((c) => (
                                <button
                                    key={c.label}
                                    className="table-dropdown-item"
                                    onClick={() => handleTableBorderColor(c.value)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <span
                                        className={`table-color-swatch${c.value ? '' : ' table-color-swatch-none'}`}
                                        style={c.value
                                            ? { background: c.value, border: '1px solid rgba(0,0,0,0.1)' }
                                            : undefined}
                                    />
                                    <span>{c.label}</span>
                                    {currentBorderColor === c.value && (
                                        <Check className="w-3.5 h-3.5 ml-auto opacity-70" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    className="table-border-btn"
                    onClick={handleClearTableColors}
                    onMouseDown={(e) => e.preventDefault()}
                    title={t('notionEditor.table.clearColors')}
                >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>{t('notionEditor.table.clearColors')}</span>
                </button>

                <button
                    className="table-delete-btn"
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    onMouseDown={(e) => e.preventDefault()}
                    title={t('notionEditor.table.deleteTable')}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('notionEditor.table.deleteTable')}</span>
                </button>
            </div>
        </div>,
        portalTarget
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
    placeholder,
    className = "",
}: NotionLikeEditorProps) {
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder || t('notionEditor.placeholder');
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashQuery, setSlashQuery] = useState("");
    const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 });
    const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
    const slashStartPos = useRef<number | null>(null);

    // Handlebar {{ menu state
    const [hbMenuOpen, setHbMenuOpen] = useState(false);
    const [hbQuery, setHbQuery] = useState("");
    const [hbPosition, setHbPosition] = useState({ top: 0, left: 0 });
    const [hbSelectedIndex, setHbSelectedIndex] = useState(0);
    const hbStartPos = useRef<number | null>(null);

    const filteredHbVars = DEFAULT_HANDLEBAR_VARIABLES.filter(
        (v) =>
            v.label.toLowerCase().includes(hbQuery.toLowerCase()) ||
            v.key.toLowerCase().includes(hbQuery.toLowerCase())
    );
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const [aiGenerateModalOpen, setAiGenerateModalOpen] = useState(false);
    const [aiGeneratePrompt, setAiGeneratePrompt] = useState("");
    const [aiGenerating, setAiGenerating] = useState(false);
    const [imageBrowserOpen, setImageBrowserOpen] = useState(false);
    const [imageTarget, setImageTarget] = useState<{ pos: number | null; attrs: Record<string, any> } | null>(null);
    const [imageSearchQuery, setImageSearchQuery] = useState("");
    const [imageCustomUrl, setImageCustomUrl] = useState("");
    const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
    const [imageSearching, setImageSearching] = useState(false);
    const [imageSearchError, setImageSearchError] = useState("");
    const [newsletterAiAction, setNewsletterAiAction] = useState<NewsletterTransformAction | null>(null);
    const [newsletterAiDirection, setNewsletterAiDirection] = useState("");
    const [newsletterAiError, setNewsletterAiError] = useState("");

    const runImageSearch = useCallback(async (value: string) => {
        const term = value.trim();
        if (term.length < 2) return;

        setImageSearching(true);
        setImageSearchError("");
        try {
            const res = await apiRequest("GET", `/api/newsletters/ai/unsplash-search?q=${encodeURIComponent(term)}&per_page=12`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || t("notionEditor.imageBrowser.searchError"));
            setImageResults(data.results as ImageSearchResult[]);
        } catch (error: any) {
            setImageResults([]);
            setImageSearchError(error?.message || t("notionEditor.imageBrowser.searchError"));
        } finally {
            setImageSearching(false);
        }
    }, [t]);

    const openImageBrowser = useCallback((target: { pos: number | null; attrs: Record<string, any> } | null = null) => {
        const attrs = target?.attrs || {};
        // Seed the query from an existing image's alt/title when re-picking one, but start
        // blank for a fresh /image insert (no target) instead of defaulting to "product photo".
        const nextQuery = (attrs.alt || attrs.title || "").trim();

        setImageTarget(target);
        setImageSearchQuery(nextQuery);
        setImageCustomUrl(attrs.src || "");
        setImageResults([]);
        setImageSearchError("");
        setImageBrowserOpen(true);
        if (nextQuery) void runImageSearch(nextQuery);
    }, [runImageSearch]);

    const slashCommands = getSlashCommands(t);
    const filteredCommands = slashCommands.filter(
        (cmd: SlashCommand) =>
            cmd.title.toLowerCase().includes(slashQuery.toLowerCase()) ||
            cmd.description.toLowerCase().includes(slashQuery.toLowerCase())
    );
    const normalizedInitialContent = normalizeAiHtml(content);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                link: {
                    openOnClick: false,
                    HTMLAttributes: {
                        class: "notion-editor-link",
                        rel: "noopener noreferrer",
                        target: "_blank",
                    },
                },
            }),
            Placeholder.configure({
                placeholder: resolvedPlaceholder,
                showOnlyWhenEditable: true,
                showOnlyCurrent: true,
            }),
            ResizableImage,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            TextStyle,
            Color.configure({ types: ["textStyle"] }),
            Highlight.configure({ multicolor: true }),
            HandlebarVariable,
            ProductAwareTable.configure({
                resizable: true,
            }),
            TableRow,
            StyledTableCell,
            StyledTableHeader,
        ],
        content: normalizedInitialContent,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: `notion-editor-content ${className}`,
                spellcheck: "true",
            },
            handleKeyDown: (_view, event) => {
                // Handle handlebar {{ menu navigation
                if (hbMenuOpen) {
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setHbSelectedIndex((prev) =>
                            prev < filteredHbVars.length - 1 ? prev + 1 : 0
                        );
                        return true;
                    }
                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setHbSelectedIndex((prev) =>
                            prev > 0 ? prev - 1 : filteredHbVars.length - 1
                        );
                        return true;
                    }
                    if (event.key === "Enter" || event.key === "Tab") {
                        event.preventDefault();
                        if (filteredHbVars[hbSelectedIndex]) {
                            handleHbSelect(filteredHbVars[hbSelectedIndex].key);
                        }
                        return true;
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        setHbMenuOpen(false);
                        return true;
                    }
                }

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

                if (event.key === "Tab" && isSelectionInLockedProductTable(editor)) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        editor.commands.goToPreviousCell();
                    } else {
                        editor.commands.goToNextCell();
                    }
                    return true;
                }

                return false;
            },
            handleClickOn: (_view, _pos, node, nodePos, event, direct) => {
                if (direct && node.type.name === "image") {
                    event.preventDefault();
                    openImageBrowser({ pos: nodePos, attrs: node.attrs });
                    return true;
                }

                return false;
            },
        },
    });

    const handleNewsletterAiTransform = useCallback(async (action: NewsletterTransformAction, instruction?: string) => {
        if (!editor || newsletterAiAction) return;

        const html = normalizeAiHtml(editor.getHTML());
        const plainText = html
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (plainText.length < 20) {
            setNewsletterAiError(t("notionEditor.newsletterAi.notEnoughContent", "Add more newsletter content before using AI."));
            return;
        }

        const nextInstruction = instruction?.trim();
        if (action === "custom" && !nextInstruction) {
            setNewsletterAiError(t("notionEditor.newsletterAi.directionRequired", "Enter a direction first."));
            return;
        }

        setNewsletterAiAction(action);
        setNewsletterAiError("");
        try {
            const result = await transformNewsletter({
                html,
                action,
                instruction: nextInstruction,
            });

            if (result.success && result.html) {
                editor.commands.setContent(normalizeAiHtml(result.html));
                onChange(editor.getHTML());
                if (action === "custom") {
                    setNewsletterAiDirection("");
                }
            } else {
                setNewsletterAiError(result.error || t("notionEditor.newsletterAi.failed", "Could not rewrite the newsletter. Please try again."));
            }
        } catch (error: any) {
            setNewsletterAiError(error?.message || t("notionEditor.newsletterAi.failed", "Could not rewrite the newsletter. Please try again."));
        } finally {
            setNewsletterAiAction(null);
        }
    }, [editor, newsletterAiAction, onChange, t]);

    const closeImageBrowser = useCallback(() => {
        setImageBrowserOpen(false);
        setImageSearchError("");
    }, []);

    const applyImage = useCallback((src: string, alt?: string) => {
        if (!editor) return;

        const nextSrc = src.trim();
        if (!isSafeImageUrl(nextSrc)) {
            setImageSearchError(t("notionEditor.imageBrowser.invalidUrl"));
            return;
        }

        if (imageTarget?.pos !== null && imageTarget?.pos !== undefined) {
            const node = editor.state.doc.nodeAt(imageTarget.pos);
            if (node?.type.name === "image") {
                const nextAttrs = {
                    ...node.attrs,
                    src: nextSrc,
                    alt: alt || node.attrs.alt || "",
                };
                const tr = editor.state.tr.setNodeMarkup(imageTarget.pos, undefined, nextAttrs);
                editor.view.dispatch(tr);
                editor.commands.focus();
                onChange(editor.getHTML());
                closeImageBrowser();
                return;
            }
        }

        editor.chain().focus().setImage({ src: nextSrc, alt: alt || "" }).run();
        closeImageBrowser();
    }, [closeImageBrowser, editor, imageTarget, onChange, t]);

    const applyCustomImageUrl = useCallback(() => {
        applyImage(imageCustomUrl, imageTarget?.attrs?.alt || "");
    }, [applyImage, imageCustomUrl, imageTarget]);

    const removeTargetImage = useCallback(() => {
        if (!editor) return;
        const pos = imageTarget?.pos;
        if (pos === null || pos === undefined) return;
        const node = editor.state.doc.nodeAt(pos);
        if (node?.type.name !== "image") return;
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
        onChange(editor.getHTML());
        closeImageBrowser();
    }, [closeImageBrowser, editor, imageTarget, onChange]);

    const pickSearchImage = useCallback((result: ImageSearchResult) => {
        const attribution = result.attribution?.name ? `Photo by ${result.attribution.name}` : result.alt;
        applyImage(result.url, result.alt || attribution || "");
    }, [applyImage]);

    // Track slash command trigger AND handlebar {{ trigger
    useEffect(() => {
        if (!editor) return;

        const handleTransaction = () => {
            const { state } = editor;
            const { selection } = state;
            const { $from } = selection;

            // Get the text before the cursor on the current line
            const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

            // Check for {{ handlebar trigger first
            const hbMatch = textBefore.match(/\{\{([a-zA-Z0-9_]*)$/);
            if (hbMatch) {
                if (!hbMenuOpen) {
                    hbStartPos.current = $from.pos - hbMatch[0].length;
                }
                setHbQuery(hbMatch[1]);
                setHbSelectedIndex(0);
                setHbMenuOpen(true);

                // Calculate position
                const coords = editor.view.coordsAtPos($from.pos);
                const editorRect = editor.view.dom.closest('.notion-editor-area')?.getBoundingClientRect()
                    || editor.view.dom.getBoundingClientRect();
                setHbPosition({
                    top: coords.bottom - editorRect.top + 4,
                    left: coords.left - editorRect.left,
                });

                // Close slash menu if open
                if (slashMenuOpen) setSlashMenuOpen(false);
                return;
            } else {
                if (hbMenuOpen) {
                    setHbMenuOpen(false);
                }
            }

            // Check for slash command trigger
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
    }, [editor, slashMenuOpen, hbMenuOpen]);

    const handleHbSelect = useCallback(
        (variableKey: string) => {
            if (!editor || hbStartPos.current === null) return;

            // Delete the {{ trigger text
            const { state } = editor;
            const currentPos = state.selection.$from.pos;
            editor
                .chain()
                .focus()
                .deleteRange({ from: hbStartPos.current, to: currentPos })
                .insertContent({ type: 'handlebarVariable', attrs: { variable: variableKey } })
                .run();

            setHbMenuOpen(false);
            hbStartPos.current = null;
        },
        [editor]
    );

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

            // If this is the AI generate command, open the modal instead
            if (cmd.isAiGenerate) {
                setAiGenerateModalOpen(true);
                setAiGeneratePrompt("");
            } else if (cmd.isImageBrowser) {
                openImageBrowser(null);
            } else {
                cmd.command(editor);
            }

            setSlashMenuOpen(false);
            slashStartPos.current = null;
        },
        [editor, openImageBrowser]
    );

    const handleAiGenerate = useCallback(async () => {
        if (!editor || !aiGeneratePrompt.trim()) return;

        setAiGenerating(true);
        try {
            const result = await generateNewsletter({ prompt: aiGeneratePrompt.trim() });
            if (result.success && result.html) {
                editor.commands.setContent(normalizeAiHtml(result.html));
                onChange(editor.getHTML());
            } else {
                console.error("Failed to generate newsletter:", result.error);
                alert(result.error || t('notionEditor.ai.generateError'));
            }
        } catch (error: any) {
            console.error("Error generating newsletter:", error);
            alert(t('notionEditor.ai.generateError'));
        } finally {
            setAiGenerating(false);
            setAiGenerateModalOpen(false);
            setAiGeneratePrompt("");
        }
    }, [editor, aiGeneratePrompt, onChange]);

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
                            placeholder={t('notionEditor.link.placeholder')}
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
                            {t('notionEditor.link.apply')}
                        </button>
                    </div>
                </div>
            )}

            {/* AI Generate Newsletter Modal */}
            {aiGenerateModalOpen && (
                <div className="notion-link-modal-overlay" onClick={() => { if (!aiGenerating) { setAiGenerateModalOpen(false); setAiGeneratePrompt(""); } }}>
                    <div className="notion-ai-generate-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="notion-ai-generate-header">
                            <Sparkles className="w-5 h-5" style={{ color: '#a78bfa' }} />
                            <span>{t('notionEditor.ai.generateTitle')}</span>
                        </div>
                        <p className="notion-ai-generate-desc">
                            {t('notionEditor.ai.generateDesc')}
                        </p>
                        <textarea
                            value={aiGeneratePrompt}
                            onChange={(e) => setAiGeneratePrompt(e.target.value)}
                            placeholder={t('notionEditor.ai.generatePlaceholder')}
                            className="notion-ai-generate-input"
                            autoFocus
                            rows={4}
                            disabled={aiGenerating}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault();
                                    handleAiGenerate();
                                }
                                if (e.key === "Escape" && !aiGenerating) {
                                    setAiGenerateModalOpen(false);
                                    setAiGeneratePrompt("");
                                }
                            }}
                        />
                        <div className="notion-ai-generate-actions">
                            <button
                                onClick={() => { setAiGenerateModalOpen(false); setAiGeneratePrompt(""); }}
                                className="notion-ai-generate-cancel"
                                disabled={aiGenerating}
                            >
                                {t('notionEditor.ai.cancel')}
                            </button>
                            <button
                                onClick={handleAiGenerate}
                                className="notion-ai-generate-submit"
                                disabled={aiGenerating || !aiGeneratePrompt.trim()}
                            >
                                {aiGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('notionEditor.ai.generating')}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        {t('notionEditor.ai.generate')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ImageBrowserModal
                open={imageBrowserOpen}
                query={imageSearchQuery}
                customUrl={imageCustomUrl}
                results={imageResults}
                isSearching={imageSearching}
                error={imageSearchError}
                onQueryChange={setImageSearchQuery}
                onCustomUrlChange={setImageCustomUrl}
                onSearch={runImageSearch}
                onPick={pickSearchImage}
                onApplyUrl={applyCustomImageUrl}
                onClose={closeImageBrowser}
                canRemove={imageTarget?.pos !== null && imageTarget?.pos !== undefined}
                onRemove={removeTargetImage}
                t={(key, fallback) => fallback === undefined ? t(key) : t(key, fallback)}
            />

            {/* Editor */}
            <div className="notion-editor-area">
                <NewsletterAiMenuBar
                    processingAction={newsletterAiAction}
                    direction={newsletterAiDirection}
                    error={newsletterAiError}
                    onDirectionChange={(value) => {
                        setNewsletterAiDirection(value);
                        if (newsletterAiError) setNewsletterAiError("");
                    }}
                    onTransform={handleNewsletterAiTransform}
                    t={(key, fallback) => fallback === undefined ? t(key) : t(key, fallback)}
                />

                {/* Custom floating toolbar (replaces BubbleMenu) */}
                <FloatingToolbar
                    editor={editor}
                    onLinkClick={() => {
                        setLinkUrl(editor.getAttributes("link").href || "");
                        setLinkModalOpen(true);
                    }}
                />

                {/* Table floating controls (column/row grips with dropdown menus) */}
                <TableFloatingControls editor={editor} />

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

                {/* Handlebar {{ Variable Menu */}
                {hbMenuOpen && (
                    <HandlebarMenu
                        query={hbQuery}
                        onSelect={handleHbSelect}
                        selectedIndex={hbSelectedIndex}
                        position={hbPosition}
                    />
                )}
            </div>
        </div>
    );
}
