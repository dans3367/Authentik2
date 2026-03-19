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
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
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
    User,
    Mail,
    Phone,
    MapPin,
    Clock,
    CreditCard,
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
} from "lucide-react";
import { improveText, emojifyText, expandText, shortenText, makeMoreCasualText, makeMoreFormalText, translateText, generateNewsletter } from "@/lib/aiApi";
import "./NotionLikeEditor.css";

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

// ── Slash Command Menu ─────────────────────────────────────────────────────────

interface SlashCommand {
    title: string;
    description: string;
    icon: React.ReactNode;
    command: (editor: any) => void;
    isAiGenerate?: boolean;
    category?: string;
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
        title: t('notionEditor.slash.image'),
        description: t('notionEditor.slash.imageDesc'),
        icon: <ImageIcon className="w-4 h-4" />,
        command: (editor) => {
            const url = window.prompt(t('notionEditor.slash.imagePrompt'));
            if (url) {
                editor.chain().focus().setImage({ src: url }).run();
            }
        },
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

    const replaceSelection = (range: { from: number; to: number }, replacement: string) => {
        editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, replacement).run();
    };

    const handleAiAction = async (action: string, targetLanguage?: string) => {
        const { from, to, selectedText } = getSelectionInfo();
        if (!selectedText.trim()) return;

        setAiProcessing(action);
        setAiMenuOpen(false);
        setTranslateSubOpen(false);

        try {
            let result: any;
            let replacement: string | undefined;

            switch (action) {
                case 'improve':
                    result = await improveText({ text: selectedText });
                    replacement = result.improvedText;
                    break;
                case 'casual':
                    result = await makeMoreCasualText({ text: selectedText });
                    replacement = result.casualText;
                    break;
                case 'formal':
                    result = await makeMoreFormalText({ text: selectedText });
                    replacement = result.formalText;
                    break;
                case 'emojify':
                    result = await emojifyText({ text: selectedText });
                    replacement = result.emojifiedText;
                    break;
                case 'expand':
                    result = await expandText({ text: selectedText });
                    replacement = result.expandedText;
                    break;
                case 'shorten':
                    result = await shortenText({ text: selectedText });
                    replacement = result.shortenedText;
                    break;
                case 'translate':
                    if (!targetLanguage) return;
                    result = await translateText({ text: selectedText, targetLanguage });
                    replacement = result.translatedText;
                    break;
            }

            if (result?.success && replacement) {
                replaceSelection({ from, to }, replacement);
            } else {
                console.error(`AI ${action} failed:`, result?.error);
            }
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
                const style = color ? `background-color: ${color}` : '';
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
                const style = color ? `background-color: ${color}` : '';
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
    const menuRef = useRef<HTMLDivElement>(null);

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

            // Determine which column the mouse is over based on x position
            const mouseX = ev.clientX; // viewport coordinate, matches col.left (also viewport)
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

            const mouseY = ev.clientY; // viewport coordinate, matches row.top (also viewport)
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

        const update = () => {
            let dom: HTMLElement | undefined;
            try { dom = editor.view?.dom; } catch { return; }
            if (!dom) return;
            const active = editor.isActive('table');
            if (!active) {
                setIsInTable(false);
                setOpenColMenu(null);
                setOpenRowMenu(null);
                return;
            }

            const { state } = editor;
            const { $from } = state.selection;
            let domNode: HTMLElement | null = null;
            try {
                domNode = editor.view.domAtPos($from.start($from.depth)).node as HTMLElement;
            } catch {
                setIsInTable(false);
                return;
            }
            const table = (domNode?.closest?.('table') || dom.querySelector('table')) as HTMLTableElement | null;
            if (!table) {
                setIsInTable(false);
                return;
            }

            // Use viewport-relative coords (position: fixed) to avoid overflow clipping
            const tableRect = table.getBoundingClientRect();
            setTablePos({
                top: tableRect.top,
                left: tableRect.left,
                width: tableRect.width,
                height: tableRect.height,
                bottom: tableRect.bottom,
            });

            // Column positions from the first row
            const firstRow = table.querySelector('tr');
            if (firstRow) {
                const cells = Array.from(firstRow.children) as HTMLElement[];
                setColumns(cells.map((cell, i) => {
                    const cellRect = cell.getBoundingClientRect();
                    return { left: cellRect.left, width: cellRect.width, index: i };
                }));
            }

            // Row positions from all rows
            const allRows = Array.from(table.querySelectorAll('tr')) as HTMLElement[];
            setRows(allRows.map((row, i) => {
                const rowRect = row.getBoundingClientRect();
                return { top: rowRect.top, height: rowRect.height, index: i };
            }));

            setIsInTable(true);
        };

        // Also re-measure on scroll so fixed-position handles track the table
        const scrollEl = viewDom.closest('.notion-editor-area') as HTMLElement | null;
        const onScroll = () => { if (editor.isActive('table')) update(); };

        editor.on('selectionUpdate', update);
        editor.on('transaction', update);
        scrollEl?.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            editor.off('selectionUpdate', update);
            editor.off('transaction', update);
            scrollEl?.removeEventListener('scroll', onScroll);
            window.removeEventListener('scroll', onScroll);
        };
    }, [editor]);

    // Close menus on outside click
    useEffect(() => {
        if (openColMenu === null && openRowMenu === null) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenColMenu(null);
                setOpenRowMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openColMenu, openRowMenu]);

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

    if (!isInTable || columns.length === 0) return null;

    const canMerge = editor.can().mergeCells();
    const canSplit = editor.can().splitCell();
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
                            position: 'fixed',
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
                                <button
                                    className="table-dropdown-item"
                                    onClick={() => handleColAction('duplicate', col.index)}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <Copy className="w-4 h-4" />
                                    <span>{t('notionEditor.table.duplicateCol')}</span>
                                </button>
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
                <div key={row.index} style={{ position: 'fixed', top: row.top, left: tablePos.left - 32, zIndex: openRowMenu === row.index ? 10002 : 9999 }}>
                    <button
                        onClick={() => handleRowClick(row.index)}
                        onMouseDown={(e) => handleRowDragStart(row.index, e)}
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
                            <button
                                className="table-dropdown-item"
                                onClick={() => handleRowAction('duplicate', row.index)}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <Copy className="w-4 h-4" />
                                <span>{t('notionEditor.table.duplicateRow')}</span>
                            </button>
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
                        position: 'fixed',
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
                        position: 'fixed',
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
                        position: 'fixed',
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
                        position: 'fixed',
                        top: dragRowTarget <= dragRowFrom
                            ? rows[dragRowTarget].top - 2
                            : rows[dragRowTarget].top + rows[dragRowTarget].height - 2,
                        left: tablePos.left - 6,
                        width: tablePos.width + 12,
                        zIndex: 10000,
                    }}
                />
            )}

            {/* ── "+" button ─ add column (right edge) ────────────────────── */}
            <button
                className="table-extend-btn"
                style={{
                    position: 'fixed',
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
                    position: 'fixed',
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

            {/* ── Delete table button ─ below the add-row button ──────────── */}
            <div
                style={{
                    position: 'fixed',
                    display: 'flex',
                    justifyContent: 'center',
                    top: tablePos.bottom + 36,
                    left: tablePos.left,
                    width: tablePos.width,
                    zIndex: 9999,
                }}
            >
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
        document.body
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

    const slashCommands = getSlashCommands(t);
    const filteredCommands = slashCommands.filter(
        (cmd: SlashCommand) =>
            cmd.title.toLowerCase().includes(slashQuery.toLowerCase()) ||
            cmd.description.toLowerCase().includes(slashQuery.toLowerCase())
    );

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
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableCell,
            TableHeader,
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

                return false;
            },
        },
    });

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
            } else {
                cmd.command(editor);
            }

            setSlashMenuOpen(false);
            slashStartPos.current = null;
        },
        [editor]
    );

    const handleAiGenerate = useCallback(async () => {
        if (!editor || !aiGeneratePrompt.trim()) return;

        setAiGenerating(true);
        try {
            const result = await generateNewsletter({ prompt: aiGeneratePrompt.trim() });
            if (result.success && result.html) {
                editor.commands.setContent(result.html);
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
