"use client"

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, ImagePlus, ImageOff, Bold, AlignLeft, AlignCenter, AlignRight, Droplet } from "lucide-react";

type DesignerData = {
  title: string;
  message: string;
  imageUrl?: string | null;
  signature?: string;
  themeId?: string;
  customImage?: boolean;
};

interface CardDesignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialThemeId?: string;
  initialData?: Partial<DesignerData>;
  onSave?: (data: DesignerData) => void;
}

export function CardDesignerDialog({ open, onOpenChange, initialThemeId, initialData, onSave }: CardDesignerDialogProps) {
  const [title, setTitle] = useState(initialData?.title ?? "Header");
  const [message, setMessage] = useState(initialData?.message ?? "Content area\nContent area");
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.imageUrl ?? 
    (initialThemeId === "sparkle-cake" ? "/images/birthday-sparkle.jpg" : null));
  const [signature, setSignature] = useState(initialData?.signature ?? "From Daniel S");
  const [customImage, setCustomImage] = useState<boolean>(initialData?.customImage ?? false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEditingContent, setIsEditingContent] = useState(false);

  // Initialize state on open
  useEffect(() => {
    if (!open) return;
    setTitle(initialData?.title ?? "Header");
    setMessage(initialData?.message ?? "Content area\nContent area");
    setSignature(initialData?.signature ?? "From Daniel S");
    const themeDefault = initialThemeId === "sparkle-cake" ? "/images/birthday-sparkle.jpg" : null;
    const isCustom = initialData?.customImage ?? customImage ?? false;
    setCustomImage(isCustom);
    setImageUrl(isCustom ? (initialData?.imageUrl ?? null) : themeDefault);
  }, [open, initialThemeId, initialData]);

  // If theme changes while open and no custom image chosen, update header image to theme default
  useEffect(() => {
    if (!open) return;
    if (customImage) return;
    const themeDefault = initialThemeId === "sparkle-cake" ? "/images/birthday-sparkle.jpg" : null;
    setImageUrl(themeDefault);
  }, [initialThemeId, customImage, open]);

  // Persist draft locally so switching themes won't lose text
  useEffect(() => {
    if (!open) return;
    const draft: DesignerData = {
      title,
      message,
      imageUrl: imageUrl ?? undefined,
      signature,
      themeId: initialThemeId,
      customImage,
    };
    try {
      localStorage.setItem("birthdayCardDesignerDraft", JSON.stringify(draft));
    } catch {}
  }, [open, title, message, imageUrl, signature, initialThemeId, customImage]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePickImage = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setCustomImage(true);
    }
  };

  const handleRemoveImage = () => { setImageUrl(null); setCustomImage(false); };

  const handleSave = () => {
    onSave?.({ title, message, imageUrl, signature, themeId: initialThemeId, customImage } as DesignerData);
    onOpenChange(false);
  };

  // Simple text formatting for textarea
  const wrapSelectedText = (prefix: string, suffix?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    
    if (selectedText) {
      const beforeText = message.substring(0, start);
      const afterText = message.substring(end);
      const wrappedText = `${prefix}${selectedText}${suffix || prefix}`;
      
      setMessage(beforeText + wrappedText + afterText);
      
      // Restore focus and cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    }
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const beforeText = message.substring(0, start);
    const afterText = message.substring(start);
    
    setMessage(beforeText + text + afterText);
    
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px]" dir="ltr" style={{ direction: 'ltr' }}>
        <DialogHeader>
          <DialogTitle>Design your birthday card</DialogTitle>
          <DialogDescription>Customize the image, header and message.</DialogDescription>
        </DialogHeader>

        {/* Designer Canvas - standard email width (600px) with forced LTR */}
        <div className="mx-auto w-[600px] rounded-2xl overflow-hidden border bg-white" dir="ltr" style={{ direction: 'ltr' }}>
          {/* Image header */}
          <div className="relative bg-gray-100">
            {imageUrl ? (
              <img src={imageUrl} alt="Card header" className="w-full h-[300px] object-cover" />
            ) : (
              <div className="w-full h-[300px] flex items-center justify-center text-gray-400">
                <div className="flex items-center gap-2 text-sm"><ImagePlus className="w-4 h-4" /> Add an image</div>
              </div>
            )}

            <div className="absolute left-3 bottom-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" className="rounded-full">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={handlePickImage}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit message
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRemoveImage}>
                    <ImageOff className="w-4 h-4 mr-2" />
                    Remove Image
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => { setTitle(""); setMessage(""); setImageUrl(null); setCustomImage(false); }}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-3xl md:text-4xl font-extrabold border-0 shadow-none px-0 focus-visible:ring-0 text-center"
            />

            {/* Rich text editor with bubble (tooltip) menu */}
            <RichTextEditor
              value={typeof message === 'string' ? message : ''}
              onChange={(html) => setMessage(html)}
              placeholder="Start typing your message..."
              className="text-base text-gray-800"
            />

            <div className="flex items-center justify-end text-gray-500 text-sm">
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="w-[220px] text-right border-0 shadow-none px-0 focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        {/* Footer actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { DesignerData };


