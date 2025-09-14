"use client"

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Bold, AlignLeft, AlignCenter, AlignRight, Droplet } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = "Start typing your message...", className = "" }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number; visible: boolean }>({ top: 0, left: 0, visible: false });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        dir: "ltr",
        style: "direction:ltr; text-align:left;",
        class: `min-h-[140px] leading-relaxed outline-none ${className}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      // Position toolbar when there is a selection
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      if (hasSelection) {
        const fromCoords = editor.view.coordsAtPos(from);
        const toCoords = editor.view.coordsAtPos(to);
        const left = (fromCoords.left + toCoords.left) / 2 - containerRect.left;
        const top = Math.min(fromCoords.top, toCoords.top) - containerRect.top - 8; // a bit above
        setToolbarPos({ top, left, visible: true });
      } else {
        setToolbarPos((p) => ({ ...p, visible: false }));
      }
    },
  });

  // Keep external value in sync if it changes from outside
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div ref={containerRef} className="relative">
      {toolbarPos.visible && (
        <div
          className="absolute z-10 bg-white border rounded-md shadow-sm p-1 flex items-center gap-1"
          style={{ top: toolbarPos.top, left: toolbarPos.left, transform: "translate(-50%, -100%)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
            <Bold className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign("left").run()} aria-label="Align left">
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign("center").run()} aria-label="Align center">
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign("right").run()} aria-label="Align right">
            <AlignRight className="w-4 h-4" />
          </Button>
          <div className="relative h-8 w-8">
            <input type="color" aria-label="Text color" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
            <div className="h-8 w-8 flex items-center justify-center">
              <Droplet className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}


