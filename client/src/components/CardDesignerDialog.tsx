"use client"

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const editorRef = useRef<HTMLDivElement | null>(null);

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

  // Simple execCommand wrapper for formatting
  const exec = (command: string, value?: string) => {
    // Focus editor to apply formatting to current selection
    editorRef.current?.focus();
    try {
      document.execCommand(command, false, value);
      // After formatting, sync HTML back to state
      if (editorRef.current) setMessage(editorRef.current.innerHTML);
    } catch {}
  };

  const onEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    setMessage((e.currentTarget as HTMLDivElement).innerHTML);
  };

  const coerceHtml = (value: string) => {
    if (!value) return "";
    // If value looks like HTML, return as is; otherwise convert newlines to <br>
    if (/[<][a-z][^>]*>/i.test(value)) return value;
    return value.replace(/\n/g, "<br>");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Design your birthday card</DialogTitle>
          <DialogDescription>Customize the image, header and message.</DialogDescription>
        </DialogHeader>

        {/* Designer Canvas - standard email width (600px) */}
        <div className="mx-auto w-[600px] rounded-2xl overflow-hidden border bg-white">
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

            {/* Content toolbar */}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => exec('bold')} title="Bold">
                <Bold className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => exec('justifyLeft')} title="Align left">
                <AlignLeft className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => exec('justifyCenter')} title="Align center">
                <AlignCenter className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => exec('justifyRight')} title="Align right">
                <AlignRight className="w-4 h-4" />
              </Button>
              <div className="relative">
                <input
                  type="color"
                  aria-label="Text color"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => exec('foreColor', e.target.value)}
                />
                <Button type="button" variant="outline" size="sm" asChild>
                  <span><Droplet className="w-4 h-4" /></span>
                </Button>
              </div>
            </div>

            {/* Editable content area */}
            <div
              ref={editorRef}
              className="min-h-[140px] border border-input bg-background px-3 py-3 text-base text-gray-700 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              contentEditable
              suppressContentEditableWarning
              onInput={onEditorInput}
              dangerouslySetInnerHTML={{ __html: coerceHtml(message) }}
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


