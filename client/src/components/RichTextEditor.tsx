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
import { Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, Droplet, User, Sparkles, Wand2, PartyPopper, ArrowRightFromLine, ArrowLeftToLine, Tag, Undo, Redo, Languages, List, ListOrdered, Heading1, Heading2, Link as LinkIcon, Minus, Mail, Phone, MapPin, Clock, CreditCard } from "lucide-react";
import { generateBirthdayMessage, improveText, emojifyText, expandText, shortenText, makeMoreCasualText, makeMoreFormalText, translateText } from "@/lib/aiApi";
import { useTranslation } from "react-i18next";
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
  businessName?: string;
  occasionType?: string;
  defaultTitle?: string;
  onEditorReady?: (editor: any) => void;
}

export default function RichTextEditor({ value, onChange, placeholder = "Start typing your message...", className = "", customerInfo, businessName, occasionType, defaultTitle, onEditorReady }: RichTextEditorProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const isProcessing = isGenerating || isImproving || isEmojifying || isExpanding || isShortening || isCasualizing || isFormalizing || isTranslating;
  
  // Track active states for toolbar buttons
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);
  const [isAlignLeft, setIsAlignLeft] = useState(false);
  const [isAlignCenter, setIsAlignCenter] = useState(false);
  const [isAlignRight, setIsAlignRight] = useState(false);
  const [isBulletList, setIsBulletList] = useState(false);
  const [isOrderedList, setIsOrderedList] = useState(false);
  const [isHeading1, setIsHeading1] = useState(false);
  const [isHeading2, setIsHeading2] = useState(false);

  // Function to insert placeholder text
  // Placeholders are inserted in liquid-style format e.g. {{first_name}}
  const insertPlaceholder = (variable: string) => {
    if (editor) {
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    }
  };

  // Handle AI message generation
  const handleGenerateMessage = async () => {
    if (isProcessing || !editor) return;
    
    setIsGenerating(true);
    
    try {
      const result = await generateBirthdayMessage({
        customerName: customerInfo?.firstName,
        businessName: businessName,
        occasionType: occasionType,
        defaultTitle: defaultTitle,
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

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

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
      setIsItalic(editor.isActive('italic'));
      setIsUnderline(editor.isActive('underline'));
      setIsStrike(editor.isActive('strike'));
      setIsAlignLeft(editor.isActive({ textAlign: 'left' }));
      setIsAlignCenter(editor.isActive({ textAlign: 'center' }));
      setIsAlignRight(editor.isActive({ textAlign: 'right' }));
      setIsBulletList(editor.isActive('bulletList'));
      setIsOrderedList(editor.isActive('orderedList'));
      setIsHeading1(editor.isActive('heading', { level: 1 }));
      setIsHeading2(editor.isActive('heading', { level: 2 }));
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
      <div className="bg-gray-800 text-white rounded-t-md shadow-lg px-2 py-1 flex flex-wrap items-center gap-1 border-b overflow-x-auto">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-gray-700"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor}
          title={t('ecards.editor.undo')}
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
          title={t('ecards.editor.redo')}
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
          title={t('ecards.editor.bold')}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isItalic ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor}
          title={t('ecards.editor.italic')}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isUnderline ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          disabled={!editor}
          title={t('ecards.editor.underline')}
        >
          <Underline className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isStrike ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          disabled={!editor}
          title={t('ecards.editor.strikethrough')}
        >
          <Strikethrough className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-gray-600" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isHeading1 ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          disabled={!editor}
          title={t('ecards.editor.heading1')}
        >
          <Heading1 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isHeading2 ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={!editor}
          title={t('ecards.editor.heading2')}
        >
          <Heading2 className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-gray-600" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isBulletList ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={!editor}
          title={t('ecards.editor.bulletList')}
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isOrderedList ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={!editor}
          title={t('ecards.editor.numberedList')}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-gray-700"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={!editor}
          title={t('ecards.editor.horizontalRule')}
        >
          <Minus className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-gray-600" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-white hover:bg-gray-700 ${isAlignLeft ? 'bg-gray-700' : ''}`}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          disabled={!editor}
          title={t('ecards.editor.alignLeft')}
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
          title={t('ecards.editor.alignCenter')}
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
          title={t('ecards.editor.alignRight')}
        >
          <AlignRight className="w-4 h-4" />
        </Button>
        <div className="relative h-8 w-8">
          <input 
            type="color" 
            aria-label={t('ecards.editor.textColor')}
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

        {/* Generate Message button */}
        <div className="w-px h-6 bg-gray-600 mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-medium text-purple-300 hover:text-purple-100 hover:bg-gray-700"
          onClick={handleGenerateMessage}
          disabled={isGenerating || !editor}
          title={t('ecards.editor.generateMessage', { occasion: occasionType || 'greeting' })}
        >
          <Sparkles className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-pulse' : ''}`} />
          {isGenerating ? t('ecards.editor.generating') : t('ecards.editor.generate')}
        </Button>

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
              title={t('ecards.editor.insertPlaceholders')}
            >
              <Tag className="w-3 h-3 mr-1" />
              {t('ecards.editor.tags')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
            <DropdownMenuItem
              onClick={() => insertPlaceholder('first_name')}
              className="text-white hover:bg-gray-700 cursor-pointer"
            >
              <User className="w-3 h-3 mr-2" />
              {t('ecards.editor.firstName')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => insertPlaceholder('last_name')}
              className="text-white hover:bg-gray-700 cursor-pointer"
            >
              <User className="w-3 h-3 mr-2" />
              {t('ecards.editor.lastName')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => insertPlaceholder('email')}
              className="text-white hover:bg-gray-700 cursor-pointer"
            >
              <Mail className="w-3 h-3 mr-2" />
              {t('ecards.editor.emailVar', 'Email')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => insertPlaceholder('phone')}
              className="text-white hover:bg-gray-700 cursor-pointer"
            >
              <Phone className="w-3 h-3 mr-2" />
              {t('ecards.editor.phone', 'Phone')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => insertPlaceholder('address')}
              className="text-white hover:bg-gray-700 cursor-pointer"
            >
              <MapPin className="w-3 h-3 mr-2" />
              {t('ecards.editor.address', 'Address')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => insertPlaceholder('office_hours')}
              className="text-white hover:bg-gray-700 cursor-pointer"
            >
              <Clock className="w-3 h-3 mr-2" />
              {t('ecards.editor.officeHours', 'Office Hours')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (editor) {
                  editor.chain().focus().insertContent(
                    `<p><strong>{{company_name}}</strong></p><p>\u2709 {{email}}</p><p>\u260E {{phone}}</p><p>\u{1F4CD} {{address}}</p>`
                  ).run();
                }
              }}
              className="text-white hover:bg-gray-700 cursor-pointer border-t border-gray-600 mt-1 pt-1"
            >
              <CreditCard className="w-3 h-3 mr-2" />
              {t('ecards.editor.contactCard', 'Contact Card')}
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
            {isImproving ? t('ecards.editor.improving') : t('ecards.editor.improveWithAI')}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleMoreCasualText}
            disabled={isProcessing}
          >
            <Sparkles className={`w-4 h-4 ${isCasualizing ? 'animate-pulse' : ''}`} />
            {isCasualizing ? t('ecards.editor.tuningTone') : t('ecards.editor.moreCasual')}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleMoreFormalText}
            disabled={isProcessing}
          >
            <Sparkles className={`w-4 h-4 ${isFormalizing ? 'animate-pulse' : ''}`} />
            {isFormalizing ? t('ecards.editor.polishing') : t('ecards.editor.moreFormal')}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleEmojifyText}
            disabled={isProcessing}
          >
            <PartyPopper className={`w-4 h-4 ${isEmojifying ? 'animate-pulse' : ''}`} />
            {isEmojifying ? t('ecards.editor.addingEmojis') : t('ecards.editor.emojify')}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleExpandText}
            disabled={isProcessing}
          >
            <ArrowRightFromLine className={`w-4 h-4 ${isExpanding ? 'animate-pulse' : ''}`} />
            {isExpanding ? t('ecards.editor.expanding') : t('ecards.editor.makeLonger')}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 text-gray-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleShortenText}
            disabled={isProcessing}
          >
            <ArrowLeftToLine className={`w-4 h-4 ${isShortening ? 'animate-pulse' : ''}`} />
            {isShortening ? t('ecards.editor.shortening') : t('ecards.editor.makeShorter')}
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
                {isTranslating ? t('ecards.editor.translating') : t('ecards.editor.translate')}
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
                {t('ecards.editor.english')}
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-700 disabled:opacity-50"
                onClick={() => handleTranslate('spanish')}
                disabled={isProcessing}
              >
                {t('ecards.editor.spanish')}
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-700 disabled:opacity-50"
                onClick={() => handleTranslate('mandarin')}
                disabled={isProcessing}
              >
                {t('ecards.editor.chinese')}
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-700 disabled:opacity-50"
                onClick={() => handleTranslate('hindi')}
                disabled={isProcessing}
              >
                {t('ecards.editor.hindi')}
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 text-gray-700 hover:text-purple-700 disabled:opacity-50"
                onClick={() => handleTranslate('bengali')}
                disabled={isProcessing}
              >
                {t('ecards.editor.bengali')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


