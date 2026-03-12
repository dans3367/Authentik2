import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Resizable Image Node View ────────────────────────────────────────────────

function ResizableImageView({ node, updateAttributes, selected }: any) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [resizing, setResizing] = useState(false);
    const [resizeDir, setResizeDir] = useState<"left" | "right" | null>(null);
    const startX = useRef(0);
    const startWidth = useRef(0);

    const width = node.attrs.width;
    const src = node.attrs.src;
    const alt = node.attrs.alt || "";
    const title = node.attrs.title || "";

    const onMouseDown = useCallback(
        (e: React.MouseEvent, dir: "left" | "right") => {
            e.preventDefault();
            e.stopPropagation();
            setResizing(true);
            setResizeDir(dir);
            startX.current = e.clientX;
            const imgEl = containerRef.current?.querySelector("img");
            startWidth.current = imgEl?.offsetWidth || 300;
        },
        []
    );

    useEffect(() => {
        if (!resizing) return;

        const onMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - startX.current;
            // If dragging left handle, invert direction
            const delta = resizeDir === "left" ? -diff : diff;
            const newWidth = Math.max(100, Math.min(startWidth.current + delta * 2, 1200));
            updateAttributes({ width: newWidth });
        };

        const onMouseUp = () => {
            setResizing(false);
            setResizeDir(null);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        return () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
    }, [resizing, resizeDir, updateAttributes]);

    const textAlign = node.attrs.textAlign || "center";

    return (
        <NodeViewWrapper className="notion-resizable-image-wrapper" style={{ textAlign }}>
            <div
                ref={containerRef}
                className={`notion-resizable-image ${selected ? "selected" : ""} ${resizing ? "resizing" : ""}`}
                style={{ width: width ? `${width}px` : "auto", maxWidth: "100%", display: "inline-block" }}
            >
                {/* Left resize handle */}
                <div
                    className="notion-resize-handle notion-resize-handle-left"
                    onMouseDown={(e) => onMouseDown(e, "left")}
                >
                    <div className="notion-resize-handle-bar" />
                </div>

                <img
                    src={src}
                    alt={alt}
                    title={title}
                    draggable={false}
                    style={{ width: "100%", display: "block" }}
                />

                {/* Right resize handle */}
                <div
                    className="notion-resize-handle notion-resize-handle-right"
                    onMouseDown={(e) => onMouseDown(e, "right")}
                >
                    <div className="notion-resize-handle-bar" />
                </div>
            </div>
        </NodeViewWrapper>
    );
}

// ── Custom Image Extension ───────────────────────────────────────────────────

export const ResizableImage = Node.create({
    name: "image",

    group: "block",

    atom: true,

    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (element: HTMLElement) => {
                    const img = element.tagName === "IMG" ? element : element.querySelector("img");
                    return img?.getAttribute("src") || null;
                },
            },
            alt: {
                default: null,
                parseHTML: (element: HTMLElement) => {
                    const img = element.tagName === "IMG" ? element : element.querySelector("img");
                    return img?.getAttribute("alt") || null;
                },
            },
            title: {
                default: null,
                parseHTML: (element: HTMLElement) => {
                    const img = element.tagName === "IMG" ? element : element.querySelector("img");
                    return img?.getAttribute("title") || null;
                },
            },
            width: {
                default: null,
                parseHTML: (element: HTMLElement) => {
                    // If the element is a wrapper div, look at the child img
                    const img = element.tagName === "IMG" ? element : element.querySelector("img");
                    if (!img) return null;
                    const attrWidth = img.getAttribute("width");
                    if (attrWidth) return parseInt(attrWidth, 10) || null;
                    const styleWidth = (img as HTMLElement).style.width;
                    if (styleWidth && styleWidth.endsWith("px")) {
                        return parseInt(styleWidth, 10) || null;
                    }
                    return null;
                },
                renderHTML: (attributes: any) => {
                    if (!attributes.width) return {};
                    return { width: attributes.width };
                },
            },
            textAlign: {
                default: "center",
                parseHTML: (element: HTMLElement) => {
                    // Check the wrapper div's text-align style
                    const wrapper = element.tagName === "DIV" ? element : element.closest(".notion-resizable-image-wrapper");
                    if (wrapper) {
                        const style = (wrapper as HTMLElement).style.textAlign;
                        if (style && ["left", "center", "right"].includes(style)) return style;
                    }
                    // Check inline style on the element itself
                    const elStyle = element.style.textAlign;
                    if (elStyle && ["left", "center", "right"].includes(elStyle)) return elStyle;
                    return "center";
                },
                renderHTML: (attributes: any) => {
                    // Don't render as an HTML attribute — we handle it in renderHTML below
                    return {};
                },
            },
        };
    },

    parseHTML() {
        return [
            // Match wrapper div containing img (our saved output format)
            { tag: "div.notion-resizable-image-wrapper" },
            // Fallback: plain img tag
            { tag: "img[src]" },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { width, textAlign: alignAttr, style: incomingStyle, ...rest } = HTMLAttributes;
        const attrs: Record<string, any> = { ...rest };

        // Determine alignment: prefer the explicit textAlign attribute, then try parsing style
        let textAlign = alignAttr || "center";
        if (!alignAttr && incomingStyle && typeof incomingStyle === "string" && incomingStyle.includes("text-align")) {
            const match = incomingStyle.match(/text-align:\s*(left|center|right)/);
            if (match) textAlign = match[1];
        }

        if (width) {
            attrs.width = width;
            attrs.style = `width: ${width}px; max-width: 100%; height: auto; display: inline-block; border-radius: 4px;`;
        } else {
            attrs.style = "max-width: 100%; height: auto; display: inline-block; border-radius: 4px;";
        }
        return [
            "div",
            { class: "notion-resizable-image-wrapper", style: `text-align: ${textAlign}; margin: 8px 0;` },
            ["img", mergeAttributes(attrs)]
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageView);
    },

    addCommands() {
        return {
            setImage:
                (options: { src: string; alt?: string; title?: string; width?: number }) =>
                ({ commands }: any) => {
                    return commands.insertContent({
                        type: this.name,
                        attrs: options,
                    });
                },
        } as any;
    },
});
