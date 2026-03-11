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

    return (
        <NodeViewWrapper className="notion-resizable-image-wrapper">
            <div
                ref={containerRef}
                className={`notion-resizable-image ${selected ? "selected" : ""} ${resizing ? "resizing" : ""}`}
                style={{ width: width ? `${width}px` : "auto", maxWidth: "100%" }}
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
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            width: { default: null },
        };
    },

    parseHTML() {
        return [{ tag: "img[src]" }];
    },

    renderHTML({ HTMLAttributes }) {
        const { width, ...rest } = HTMLAttributes;
        const style = width ? `width: ${width}px; max-width: 100%;` : "max-width: 100%;";
        return ["img", mergeAttributes(rest, { style })];
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
