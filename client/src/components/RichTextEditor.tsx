"use client"

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Image } from "@tiptap/extension-image";
import { Button } from "@/components/ui/button";
import { Bold, AlignLeft, AlignCenter, AlignRight, Droplet, User, Sparkles } from "lucide-react";
import { generateBirthdayMessage } from "@/lib/aiApi";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
  };
  businessName?: string;
  onGenerateStart?: () => void;
  onGenerateEnd?: () => void;
}

export default function RichTextEditor({ value, onChange, placeholder = "Start typing your message...", className = "", customerInfo, businessName, onGenerateStart, onGenerateEnd }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Function to insert placeholder text
  // Placeholders are inserted in the format {{firstName}} or {{lastName}}
  const insertPlaceholder = (type: 'firstName' | 'lastName') => {
    if (editor) {
      const placeholderText = `{{${type}}}`;
      editor.chain().focus().insertContent(placeholderText).run();
    }
  };

  // Handle AI message generation
  const handleGenerateMessage = async () => {
    if (isGenerating || !editor) return;
    
    setIsGenerating(true);
    if (onGenerateStart) onGenerateStart();
    
    try {
      const result = await generateBirthdayMessage({
        customerName: customerInfo?.firstName,
        businessName: businessName,
      });
      
      if (result.success && result.message) {
        // Insert the generated message into the editor
        editor.commands.setContent(result.message);
        onChange(result.message);
      } else {
        console.error("Failed to generate message:", result.error);
        alert(result.error || "Failed to generate message. Please try again.");
      }
    } catch (error) {
      console.error("Error generating message:", error);
      alert("An error occurred while generating the message. Please try again.");
    } finally {
      setIsGenerating(false);
      if (onGenerateEnd) onGenerateEnd();
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color.configure({
        types: ['textStyle'],
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Image,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none ${className}`,
        style: 'min-height: 120px; padding: 8px;'
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return (
    <div ref={containerRef} className="relative min-h-[150px] border rounded-md bg-white">
      {/* Permanent top toolbar */}
      <div className="bg-gray-800 text-white rounded-t-md shadow-lg px-2 py-1 flex items-center gap-1 border-b">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${editor?.isActive('bold') ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-gray-600" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${editor?.isActive({ textAlign: 'left' }) ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          disabled={!editor}
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${editor?.isActive({ textAlign: 'center' }) ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          disabled={!editor}
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${editor?.isActive({ textAlign: 'right' }) ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          disabled={!editor}
        >
          <AlignRight className="w-4 h-4" />
        </Button>
        <div className="relative h-8 w-8">
          <input 
            type="color" 
            aria-label="Text color" 
            className="absolute inset-0 opacity-0 cursor-pointer" 
            onChange={(e) => {
              if (editor) {
                // Apply color using textStyle mark
                editor.chain().focus().setColor(e.target.value).run();
              }
            }}
            disabled={!editor}
          />
          <div className="h-8 w-8 flex items-center justify-center">
            <Droplet className="w-4 h-4" />
          </div>
        </div>

        {/* Placeholder buttons */}
        <div className="w-px h-6 bg-gray-600 mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-medium text-purple-300 hover:text-purple-100 hover:bg-gray-700"
          onClick={handleGenerateMessage}
          disabled={isGenerating || !editor}
          title="Generate birthday message with AI"
        >
          <Sparkles className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-pulse' : ''}`} />
          {isGenerating ? 'Generating...' : 'Generate'}
        </Button>
        <div className="w-px h-6 bg-gray-600 mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-medium text-blue-300 hover:text-blue-100 hover:bg-gray-700"
          onClick={() => insertPlaceholder('firstName')}
          disabled={!editor}
          title="Insert First Name placeholder"
        >
          <User className="w-3 h-3 mr-1" />
          First Name
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-medium text-blue-300 hover:text-blue-100 hover:bg-gray-700"
          onClick={() => insertPlaceholder('lastName')}
          disabled={!editor}
          title="Insert Last Name placeholder"
        >
          <User className="w-3 h-3 mr-1" />
          Last Name
        </Button>
      </div>
      
      {/* Editor content with permanent top padding */}
      <div className="p-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
