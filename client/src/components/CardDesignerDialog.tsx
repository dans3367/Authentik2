"use client"

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, ImagePlus, ImageOff, Search, ZoomIn, ZoomOut, Move, RotateCcw, Smile, RefreshCw } from "lucide-react";
import { uploadCardImage, validateCardImageFile } from "@/lib/cardImageUpload";

type DesignerData = {
  title: string;
  message: string;
  imageUrl?: string | null;
  signature?: string;
  themeId?: string;
  customImage?: boolean;
  imagePosition?: { x: number; y: number };
  imageScale?: number;
};

interface CardDesignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialThemeId?: string;
  initialData?: Partial<DesignerData>;
  onSave?: (data: DesignerData) => void;
}

export function CardDesignerDialog({ open, onOpenChange, initialThemeId, initialData, onSave }: CardDesignerDialogProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [message, setMessage] = useState(initialData?.message ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.imageUrl ?? 
    (initialThemeId === "sparkle-cake" ? "/images/birthday-sparkle.jpg" : null));
  const [signature, setSignature] = useState(initialData?.signature ?? "");
  const [customImage, setCustomImage] = useState<boolean>(initialData?.customImage ?? false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unsplashImages, setUnsplashImages] = useState<Array<{ id: string; urls: { small: string; regular: string }; alt_description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Image position and zoom controls
  const [imagePosition, setImagePosition] = useState<{ x: number; y: number }>(
    initialData?.imagePosition ?? { x: 0, y: 0 }
  );
  const [imageScale, setImageScale] = useState(initialData?.imageScale ?? 1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [showImageControls, setShowImageControls] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Initialize state on open
  useEffect(() => {
    if (!open) return;
    setTitle(initialData?.title ?? "");
    setMessage(initialData?.message ?? "");
    setSignature(initialData?.signature ?? "");
    const themeDefault = initialThemeId === "sparkle-cake" ? "/images/birthday-sparkle.jpg" : null;
    const isCustom = initialData?.customImage ?? customImage ?? false;
    setCustomImage(isCustom);
    setImageUrl(isCustom ? (initialData?.imageUrl ?? null) : themeDefault);
    setImagePosition(initialData?.imagePosition ?? { x: 0, y: 0 });
    setImageScale(initialData?.imageScale ?? 1);
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
      imagePosition,
      imageScale,
    };
    try {
      localStorage.setItem("birthdayCardDesignerDraft", JSON.stringify(draft));
    } catch {}
  }, [open, title, message, imageUrl, signature, initialThemeId, customImage, imagePosition, imageScale]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePickImage = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('📸 [Card Designer] File selected:', file.name, file.type, file.size);

    // Validate file using the validation function
    const validation = validateCardImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // Check image dimensions for quality recommendations
    const checkImageQuality = () => {
      return new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => {
          console.log('📸 [Card Designer] Image dimensions:', img.width, 'x', img.height);
          
          // Recommend higher resolution for better quality
          const minRecommendedWidth = 1200; // For good quality at 600px width
          if (img.width < minRecommendedWidth) {
            const shouldContinue = confirm(
              `This image is ${img.width}px wide. For best quality, we recommend images at least ${minRecommendedWidth}px wide. Continue anyway?`
            );
            resolve(shouldContinue);
          } else {
            resolve(true);
          }
        };
        img.onerror = () => resolve(true); // Continue if can't read dimensions
        img.src = URL.createObjectURL(file);
      });
    };

    const shouldProceed = await checkImageQuality();
    if (!shouldProceed) return;
    
    setUploading(true);
    setImageError(false);
    
    try {
      // Clean up previous blob URL if it exists
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
      
      console.log('📸 [Card Designer] Starting upload to R2...');
      
      // Upload to R2 via our API
      const result = await uploadCardImage({
        file,
        onProgress: (progress) => {
          console.log('📸 [Card Designer] Upload progress:', progress);
        }
      });
      
      if (result.success && result.url) {
        console.log('📸 [Card Designer] Upload successful:', result.url);
        setImageUrl(result.url);
        setCustomImage(true);
        setImageError(false);
        setShowImageControls(false);
      } else {
        console.error('📸 [Card Designer] Upload failed:', result.error);
        alert(result.error || 'Upload failed. Please try again.');
        setImageError(true);
      }
      
      // Clear the file input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('📸 [Card Designer] Upload error:', error);
      alert('Error uploading image. Please try again.');
      setImageError(true);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => { 
    // Clean up object URL if it exists (only for blob URLs, not R2 URLs)
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setCustomImage(false);
    // Reset position and scale when image is removed
    setImagePosition({ x: 0, y: 0 });
    setImageScale(1);
    setShowImageControls(false);
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // Handle clicks outside image to hide controls
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (imageContainerRef.current && !imageContainerRef.current.contains(event.target as Node)) {
        setShowImageControls(false);
      }
    };

    if (showImageControls) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showImageControls]);

  // Handle escape key to close emoji picker
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showEmojiPicker) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showEmojiPicker]);

  // Search Unsplash images
  const searchUnsplash = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    
    const accessKey = import.meta.env.VITE_ACCESS_KEY;
    const secretKey = import.meta.env.VITE_SECRET_KEY;
    
    try {
      // Check if environment variables are configured
      if (!accessKey) {
        console.warn('VITE_ACCESS_KEY not configured, using fallback images');
        throw new Error('Unsplash API key not configured');
      }
      
      // Using Unsplash API with environment variables
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&client_id=${accessKey}`);
      
      if (response.ok) {
        const data = await response.json();
        setUnsplashImages(data.results || []);
      } else {
        console.error('Unsplash API error:', response.status, response.statusText);
        throw new Error(`Unsplash API error: ${response.status}`);
      }
    } catch (error) {
      console.warn('Falling back to demo images:', error);
      // Fallback to mock data when API is not available or configured
      setUnsplashImages([
        { id: '1', urls: { small: 'https://picsum.photos/300/200?random=1', regular: 'https://picsum.photos/600/400?random=1' }, alt_description: 'Sample birthday image 1' },
        { id: '2', urls: { small: 'https://picsum.photos/300/200?random=2', regular: 'https://picsum.photos/600/400?random=2' }, alt_description: 'Sample birthday image 2' },
        { id: '3', urls: { small: 'https://picsum.photos/300/200?random=3', regular: 'https://picsum.photos/600/400?random=3' }, alt_description: 'Sample birthday image 3' },
        { id: '4', urls: { small: 'https://picsum.photos/300/200?random=4', regular: 'https://picsum.photos/600/400?random=4' }, alt_description: 'Sample birthday image 4' },
        { id: '5', urls: { small: 'https://picsum.photos/300/200?random=5', regular: 'https://picsum.photos/600/400?random=5' }, alt_description: 'Sample birthday image 5' },
        { id: '6', urls: { small: 'https://picsum.photos/300/200?random=6', regular: 'https://picsum.photos/600/400?random=6' }, alt_description: 'Sample birthday image 6' },
      ]);
    }
    setLoading(false);
  };

  const selectUnsplashImage = (imageUrl: string) => {
    setImageUrl(imageUrl);
    setCustomImage(true);
    setUnsplashOpen(false);
    setSearchQuery("");
    setUnsplashImages([]);
    // Reset position and scale when new image is selected
    setImagePosition({ x: 0, y: 0 });
    setImageScale(1);
    setShowImageControls(false);
  };

  // Image manipulation functions
  const handleZoomIn = () => {
    setImageScale(prev => Math.min(prev + 0.1, 2)); // Reduced max zoom to prevent excessive blurriness
  };

  const handleZoomOut = () => {
    setImageScale(prev => Math.max(prev - 0.1, 0.8)); // Reduced min zoom to maintain quality
  };

  const handleResetPosition = () => {
    setImagePosition({ x: 0, y: 0 });
    setImageScale(1);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowImageControls(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowImageControls(true);
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startX: imagePosition.x,
      startY: imagePosition.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setImagePosition({
      x: dragStart.startX + deltaX,
      y: dragStart.startY + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05; // Smaller increments for smoother control
    setImageScale(prev => Math.max(0.8, Math.min(2, prev + delta))); // Limited range for better quality
  };

  // Emoji functionality
  const birthdayEmojis = [
    '🎉', '🎂', '🎈', '🎁', '🎊', '🥳', '🍰', '🎀',
    '✨', '🌟', '💝', '🎵', '🎶', '💫', '🌈', '🦄',
    '🍾', '🥂', '🍭', '🍬', '🎪', '🎭', '🎨', '💐',
    '🌺', '🌸', '🌻', '🌷', '🔥', '💖', '💕', '💗'
  ];

  const insertEmoji = (emoji: string) => {
    if (titleInputRef.current) {
      const input = titleInputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newTitle = title.slice(0, start) + emoji + title.slice(end);
      setTitle(newTitle);
      setShowEmojiPicker(false);
      
      // Focus back to input and set cursor position after emoji
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
  };

  // Reset functionality
  const handleReset = () => {
    const confirmed = confirm(
      "Are you sure you want to reset the card? This will clear all content including the image, title, message, and signature."
    );
    
    if (confirmed) {
      // Clear all content
      setTitle("");
      setMessage("");
      setSignature("");
      
      // Remove image and reset image controls
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
      setImageUrl(initialThemeId === "sparkle-cake" ? "/images/birthday-sparkle.jpg" : null);
      setCustomImage(false);
      setImagePosition({ x: 0, y: 0 });
      setImageScale(1);
      setShowImageControls(false);
      setShowEmojiPicker(false);
      
      // Clear any error states
      setImageError(false);
      
      // Focus on title input for immediate editing
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  };

  const handleSave = () => {
    onSave?.({ 
      title, 
      message, 
      imageUrl, 
      signature, 
      themeId: initialThemeId, 
      customImage,
      imagePosition,
      imageScale
    } as DesignerData);
    onOpenChange(false);
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
          <div 
            ref={imageContainerRef}
            className={`relative bg-gray-100 overflow-hidden transition-all duration-200 ${
              showImageControls && imageUrl && !imageError 
                ? 'ring-2 ring-blue-400 ring-opacity-50' 
                : ''
            }`}
            onClick={imageUrl && !imageError ? handleImageClick : undefined}
            onMouseDown={imageUrl && !imageError ? handleMouseDown : undefined}
            onMouseMove={isDragging ? handleMouseMove : undefined}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={imageUrl && !imageError ? handleWheel : undefined}
            style={{ 
              cursor: isDragging ? 'grabbing' : (imageUrl && !imageError ? 'grab' : 'default'),
              height: '300px',
              willChange: isDragging ? 'transform' : 'auto'
            }}
          >
            {uploading ? (
              <div className="w-full h-[300px] flex items-center justify-center text-blue-500 bg-blue-50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <div className="text-sm">Uploading image...</div>
                </div>
              </div>
            ) : imageUrl && !imageError ? (
              <img 
                src={imageUrl} 
                alt="Card header" 
                className="w-full h-full object-cover select-none"
                style={{
                  transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  imageRendering: 'crisp-edges',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  WebkitTransform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                  MozTransform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                  msTransform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                  filter: 'none',
                  WebkitFilter: 'none'
                }}
                onLoad={() => {
                  console.log('Image loaded successfully:', imageUrl);
                  setImageError(false);
                }}
                onError={(e) => {
                  console.error('Image failed to load:', imageUrl);
                  console.error('Error event:', e);
                  setImageError(true);
                }}
                onDragStart={(e) => e.preventDefault()}
              />
            ) : imageUrl && imageError ? (
              <div className="w-full h-[300px] flex items-center justify-center text-red-400 bg-red-50">
                <div className="text-center">
                  <ImageOff className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-sm">Failed to load image</div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setImageError(false)}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full h-[300px] flex items-center justify-center text-gray-400">
                <div className="flex items-center gap-2 text-sm"><ImagePlus className="w-4 h-4" /> Add an image</div>
              </div>
            )}

            {/* Image Overlay Controls - only show when focused */}
            {imageUrl && !imageError && !uploading && showImageControls && (
              <div className="absolute top-3 right-3 flex flex-col gap-2 animate-in fade-in-0 duration-200">
                <div className="bg-black/70 backdrop-blur-sm rounded-lg p-2 flex flex-col gap-1 shadow-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleZoomIn();
                    }}
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleZoomOut();
                    }}
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetPosition();
                    }}
                    title="Reset Position & Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
                <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1 shadow-lg">
                  <div className="flex items-center gap-2 text-white text-xs">
                    <Move className="w-3 h-3" />
                    <span>Drag to move • Scroll to zoom</span>
                  </div>
                </div>
              </div>
            )}

            {/* Click to focus hint - only show when not focused and image is present */}
            {imageUrl && !imageError && !uploading && !showImageControls && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
                  Click to show controls
                </div>
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
                  <DropdownMenuItem onClick={handlePickImage} disabled={uploading}>
                    <Edit className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setUnsplashOpen(true)}>
                    <Search className="w-4 h-4 mr-2" />
                    Browse Unsplash
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
            <div className="relative">
              <Input
                ref={titleInputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="🎉 Happy Birthday! 🎂"
                className="text-3xl md:text-4xl font-extrabold border-0 shadow-none px-0 pr-12 focus-visible:ring-0 text-center placeholder:text-gray-400 placeholder:font-normal"
              />
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowEmojiPicker(true)}
                    >
                      <Smile className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-80 p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-gray-700">Birthday Emojis</div>
                      <div className="grid grid-cols-8 gap-2">
                        {birthdayEmojis.map((emoji, index) => (
                          <button
                            key={index}
                            onClick={() => insertEmoji(emoji)}
                            className="w-8 h-8 text-lg hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
                            title={`Insert ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Rich text editor with bubble (tooltip) menu */}
            <RichTextEditor
              value={typeof message === 'string' ? message : ''}
              onChange={(html) => setMessage(html)}
              placeholder="Type your birthday message here..."
              className="text-base text-gray-800"
            />

            <div className="flex items-center justify-end text-gray-500 text-sm">
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="From [Your Name]"
                className="w-[220px] text-right border-0 shadow-none px-0 focus-visible:ring-0 placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" 
          onChange={handleFileChange} 
          className="hidden" 
        />

        {/* Footer actions */}
        <div className="flex justify-between items-center">
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset Card
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>

        {/* Unsplash Image Picker Modal */}
        <Dialog open={unsplashOpen} onOpenChange={setUnsplashOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Browse Images from Unsplash</DialogTitle>
              <DialogDescription>Search for high-quality stock photos for your card header.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search for images..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUnsplash(searchQuery)}
                  className="flex-1"
                />
                <Button onClick={() => searchUnsplash(searchQuery)} disabled={loading || !searchQuery.trim()}>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              )}

              {unsplashImages.length > 0 && (
                <div className="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {unsplashImages.map((image) => (
                    <div key={image.id} className="cursor-pointer group" onClick={() => selectUnsplashImage(image.urls.regular)}>
                      <img 
                        src={image.urls.small} 
                        alt={image.alt_description || 'Unsplash image'} 
                        className="w-full h-32 object-cover rounded-md group-hover:opacity-80 transition-opacity"
                      />
                    </div>
                  ))}
                </div>
              )}

              {!loading && unsplashImages.length === 0 && searchQuery && (
                <div className="text-center py-8 text-gray-500">
                  No images found. Try a different search term.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

export type { DesignerData };


