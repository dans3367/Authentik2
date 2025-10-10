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
import { Bold, AlignLeft, AlignCenter, AlignRight, Droplet, User, Sparkles, Wand2, PartyPopper, ArrowRightFromLine, ArrowLeftToLine, Tag, Undo, Redo, Languages } from "lucide-react";
import { improveText, emojifyText, expandText, shortenText, makeMoreCasualText, makeMoreFormalText, translateText } from "@/lib/aiApi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
  };
}

export default function RichTextEditor({ value, onChange, placeholder = "Start typing your message...", className = "", customerInfo }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [isEmojifying, setIsEmojifying] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isShortening, setIsShortening] = useState(false);
  const [isCasualizing, setIsCasualizing] = useState(false);
  const [isFormalizing, setIsFormalizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selectedText: string;
    from: number;
    to: number;
    position: 'absolute' | 'fixed';
  } | null>(null);

  const isProcessing = isImproving || isEmojifying || isExpanding || isShortening || isCasualizing || isFormalizing || isTranslating;
  
  // Track active states for toolbar buttons
  const [isBold, setIsBold] = useState(false);
  const [isAlignLeft, setIsAlignLeft] = useState(false);
  const [isAlignCenter, setIsAlignCenter] = useState(false);
  const [isAlignRight, setIsAlignRight] = useState(false);

  // Function to insert placeholder text
  // Placeholders are inserted in the format {{firstName}} or {{lastName}}
  const insertPlaceholder = (type: 'firstName' | 'lastName') => {
    if (editor) {
      const placeholderText = `{{${type}}}`;
      editor.chain().focus().insertContent(placeholderText).run();
    }
  };

  // Handle AI text improvement
  const replaceSelection = (range: { from: number; to: number }, replacement: string) => {
    if (!editor) return;
    editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, replacement).run();
  };

  const handleImproveText = async () => {
    if (isProcessing || !editor || !contextMenu) return;

    const selection = contextMenu;
    setIsImproving(true);
    setContextMenu(null);

    try {
      const result = await improveText({ text: selection.selectedText });

      if (result.success && result.improvedText) {
        replaceSelection({ from: selection.from, to: selection.to }, result.improvedText);
      } else {
        console.error("Failed to improve text:", result.error);
        alert(result.error || "Failed to improve text. Please try again.");
      }
    } catch (error) {
      console.error("Error improving text:", error);
      alert("An error occurred while improving the text. Please try again.");
    } finally {
      setIsImproving(false);
    }
  };

  const handleEmojifyText = async () => {
    if (isProcessing || !editor || !contextMenu) return;

    const selection = contextMenu;
    setIsEmojifying(true);
    setContextMenu(null);

    try {
      const result = await emojifyText({ text: selection.selectedText });

      if (result.success && result.emojifiedText) {
        replaceSelection({ from: selection.from, to: selection.to }, result.emojifiedText);
      } else {
        console.error("Failed to emojify text:", result.error);
        alert(result.error || "Failed to emojify text. Please try again.");
      }
    } catch (error) {
      console.error("Error emojifying text:", error);
      alert("An error occurred while emojifying the text. Please try again.");
    } finally {
      setIsEmojifying(false);
    }
  };

  const handleExpandText = async () => {
    if (isProcessing || !editor || !contextMenu) return;

    const selection = contextMenu;
    setIsExpanding(true);
    setContextMenu(null);

    try {
      const result = await expandText({ text: selection.selectedText });

      if (result.success && result.expandedText) {
        replaceSelection({ from: selection.from, to: selection.to }, result.expandedText);
      } else {
        console.error("Failed to expand text:", result.error);
        alert(result.error || "Failed to make text longer. Please try again.");
      }
    } catch (error) {
      console.error("Error expanding text:", error);
      alert("An error occurred while making the text longer. Please try again.");
    } finally {
      setIsExpanding(false);
    }
  };

  const handleShortenText = async () => {
    if (isProcessing || !editor || !contextMenu) return;

    const selection = contextMenu;
    setIsShortening(true);
    setContextMenu(null);

    try {
      const result = await shortenText({ text: selection.selectedText });

      if (result.success && result.shortenedText) {
        replaceSelection({ from: selection.from, to: selection.to }, result.shortenedText);
      } else {
        console.error("Failed to shorten text:", result.error);
        alert(result.error || "Failed to make text shorter. Please try again.");
      }
    } catch (error) {
      console.error("Error shortening text:", error);
      alert("An error occurred while making the text shorter. Please try again.");
    } finally {
      setIsShortening(false);
    }
  };

  const handleMoreCasualText = async () => {
    if (isProcessing || !editor || !contextMenu) return;

    const selection = contextMenu;
    setIsCasualizing(true);
    setContextMenu(null);

    try {
      const result = await makeMoreCasualText({ text: selection.selectedText });

      if (result.success && result.casualText) {
        replaceSelection({ from: selection.from, to: selection.to }, result.casualText);
      } else {
        console.error("Failed to make text more casual:", result.error);
        alert(result.error || "Failed to make text more casual. Please try again.");
      }
    } catch (error) {
      console.error("Error making text more casual:", error);
      alert("An error occurred while making the text more casual. Please try again.");
    } finally {
      setIsCasualizing(false);
    }
  };

  const handleMoreFormalText = async () => {
    if (isProcessing || !editor || !contextMenu) return;

    const selection = contextMenu;
    setIsFormalizing(true);
    setContextMenu(null);

    try {
      const result = await makeMoreFormalText({ text: selection.selectedText });

      if (result.success && result.formalText) {
        replaceSelection({ from: selection.from, to: selection.to }, result.formalText);
      } else {
        console.error("Failed to make text more formal:", result.error);
        alert(result.error || "Failed to make text more formal. Please try again.");
      }
    } catch (error) {
      console.error("Error making text more formal:", error);
      alert("An error occurred while making the text more formal. Please try again.");
    } finally {
      setIsFormalizing(false);
    }
  };

  const handleTranslate = async (targetLanguage: string) => {
    if (isProcessing || !editor || !contextMenu) return;

    const selection = contextMenu;
    setIsTranslating(true);
    setContextMenu(null);

    try {
      const result = await translateText({ text: selection.selectedText, targetLanguage });

      if (result.success && result.translatedText) {
        replaceSelection({ from: selection.from, to: selection.to }, result.translatedText);
      } else {
        console.error("Failed to translate text:", result.error);
        alert(result.error || "Failed to translate text. Please try again.");
      }
    } catch (error) {
      console.error("Error translating text:", error);
      alert("An error occurred while translating the text. Please try again.");
    } finally {
      setIsTranslating(false);
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

  // Handle context menu on editor
  useEffect(() => {
    if (!editor) return;

    const editorElement = editor.view.dom;

    const handleContextMenu = (event: MouseEvent) => {
      const { state, view } = editor;
      const { from, to } = state.selection;
      const selectedText = state.doc.textBetween(from, to, ' ');
      
      // Only show context menu if text is selected
      if (selectedText && selectedText.trim().length > 0) {
        event.preventDefault();
        event.stopPropagation();
        
        // Get the coordinates of the end of the selection
        const coords = view.coordsAtPos(to);
        const containerRect = containerRef.current?.getBoundingClientRect();

        if (containerRect) {
          const offsetX = coords.left - containerRect.left;
          const offsetY = coords.bottom - containerRect.top;

          // Approximate menu dimensions for bounds clamping
          const menuWidth = 220;
          const menuHeight = 260;

          const clampedX = Math.max(8, Math.min(offsetX, containerRect.width - menuWidth));
          const clampedY = Math.max(8, Math.min(offsetY, containerRect.height - menuHeight));

          setContextMenu({
            x: clampedX,
            y: clampedY,
            selectedText: selectedText.trim(),
            from,
            to,
            position: 'absolute',
          });
        } else {
          setContextMenu({
            x: coords.right,
            y: coords.bottom,
            selectedText: selectedText.trim(),
            from,
            to,
            position: 'fixed',
          });
        }
      }
    };

    editorElement.addEventListener('contextmenu', handleContextMenu);

    return () => {
      editorElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [editor]);

  // Update toolbar button states when selection or content changes
  useEffect(() => {
    if (!editor) return;

    const updateToolbarStates = () => {
      setIsBold(editor.isActive('bold'));
      setIsAlignLeft(editor.isActive({ textAlign: 'left' }));
      setIsAlignCenter(editor.isActive({ textAlign: 'center' }));
      setIsAlignRight(editor.isActive({ textAlign: 'right' }));
    };

    // Update states initially
    updateToolbarStates();

    // Listen to editor events
    editor.on('selectionUpdate', updateToolbarStates);
    editor.on('transaction', updateToolbarStates);
    editor.on('update', updateToolbarStates);

    return () => {
      editor.off('selectionUpdate', updateToolbarStates);
      editor.off('transaction', updateToolbarStates);
      editor.off('update', updateToolbarStates);
    };
  }, [editor]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('contextmenu', handleClickOutside);
      };
    }
  }, [contextMenu]);

  return (
    <div ref={containerRef} className="relative min-h-[150px] border rounded-md bg-white">
      {/* Permanent top toolbar */}
      <div className="bg-gray-800 text-white rounded-t-md shadow-lg px-2 py-1 flex items-center gap-1 border-b">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-gray-700"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor}
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-gray-700"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor}
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-gray-600" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isBold ? 'bg-gray-700' : ''}`}
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
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isAlignLeft ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          disabled={!editor}
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isAlignCenter ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          disabled={!editor}
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isAlignRight ? 'bg-gray-700' : ''}`}
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

        {/* Tags dropdown */}
        <div className="w-px h-6 bg-gray-600 mx-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-medium text-blue-300 hover:text-blue-100 hover:bg-gray-700"
              disabled={!editor}
              title="Insert placeholders"
            >
              <Tag className="w-3 h-3 mr-1" />
              Tags
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
            <DropdownMenuItem
              onClick={() => insertPlaceholder('firstName')}
              className="text-white hover:bg-gray-700 cursor-pointer"
            >
              <User className="w-3 h-3 mr-2" />
              First Name
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => insertPlaceholder('lastName')}
              className="text-white hover:bg-gray-700 cursor-pointer"
            >
              <User className="w-3 h-3 mr-2" />
              Last Name
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Editor content with permanent top padding */}
      <div className="p-2">
        <EditorContent editor={editor} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={`${contextMenu.position === 'fixed' ? 'fixed' : 'absolute'} bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[100] min-w-[160px]`}
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleImproveText}
            disabled={isProcessing}
          >
            <Wand2 className={`w-4 h-4 ${isImproving ? 'animate-pulse' : ''}`} />
            {isImproving ? 'Improving...' : 'Improve with AI'}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleMoreCasualText}
            disabled={isProcessing}
          >
            <Sparkles className={`w-4 h-4 ${isCasualizing ? 'animate-pulse' : ''}`} />
            {isCasualizing ? 'Tuning tone...' : 'More casual'}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleMoreFormalText}
            disabled={isProcessing}
          >
            <Sparkles className={`w-4 h-4 ${isFormalizing ? 'animate-pulse' : ''}`} />
            {isFormalizing ? 'Polishing...' : 'More formal'}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleEmojifyText}
            disabled={isProcessing}
          >
            <PartyPopper className={`w-4 h-4 ${isEmojifying ? 'animate-pulse' : ''}`} />
            {isEmojifying ? 'Adding emojis...' : 'Emojify'}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleExpandText}
            disabled={isProcessing}
          >
            <ArrowRightFromLine className={`w-4 h-4 ${isExpanding ? 'animate-pulse' : ''}`} />
            {isExpanding ? 'Expanding...' : 'Make longer'}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleShortenText}
            disabled={isProcessing}
          >
            <ArrowLeftToLine className={`w-4 h-4 ${isShortening ? 'animate-pulse' : ''}`} />
            {isShortening ? 'Shortening...' : 'Make shorter'}
          </button>
          
          {/* Translate submenu */}
          <div className="relative group">
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center justify-between text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isProcessing}
              onMouseEnter={(e) => {
                const submenu = e.currentTarget.nextElementSibling as HTMLElement;
                if (submenu) submenu.style.display = 'block';
              }}
            >
              <div className="flex items-center gap-2">
                <Languages className={`w-4 h-4 ${isTranslating ? 'animate-pulse' : ''}`} />
                {isTranslating ? 'Translating...' : 'Translate'}
              </div>
              <span className="ml-auto text-xs">›</span>
            </button>
            <div 
              className="hidden absolute left-full bottom-0 ml-1 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[101] min-w-[180px]"
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            >
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-700 disabled:opacity-50"
                onClick={() => handleTranslate('english')}
                disabled={isProcessing}
              >
                English
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-700 disabled:opacity-50"
                onClick={() => handleTranslate('spanish')}
                disabled={isProcessing}
              >
                Spanish
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-700 disabled:opacity-50"
                onClick={() => handleTranslate('mandarin')}
                disabled={isProcessing}
              >
                Chinese
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-700 disabled:opacity-50"
                onClick={() => handleTranslate('hindi')}
                disabled={isProcessing}
              >
                Hindi
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-700 disabled:opacity-50"
                onClick={() => handleTranslate('bengali')}
                disabled={isProcessing}
              >
                Bengali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


