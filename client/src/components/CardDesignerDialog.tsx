"use client"

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, ImagePlus, ImageOff, Search, ZoomIn, ZoomOut, Move, RotateCcw, Smile, RefreshCw, ChevronLeft, ChevronRight, X, AlertTriangle } from "lucide-react";
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
  onPreviewChange?: (data: DesignerData) => void;
  onMakeActive?: (themeId: string, data: DesignerData) => void;
  isCurrentlyActive?: boolean;
  senderName?: string;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
  };
  businessName?: string;
}

export function CardDesignerDialog({ open, onOpenChange, initialThemeId, initialData, onSave, onPreviewChange, onMakeActive, isCurrentlyActive, senderName, customerInfo, businessName }: CardDesignerDialogProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [message, setMessage] = useState(initialData?.message ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.imageUrl ??
    (initialThemeId === "sparkle-cake" ? "/images/birthday-sparkle.jpg" : null));
  const [signature, setSignature] = useState(initialData?.signature ?? "");
  const [emojiCount, setEmojiCount] = useState<number>(0);
  const [customImage, setCustomImage] = useState<boolean>(initialData?.customImage ?? false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unsplashImages, setUnsplashImages] = useState<Array<{ id: string; urls: { small: string; regular: string }; alt_description: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Change tracking and confirmation dialog state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [initialValues, setInitialValues] = useState<{
    title: string;
    message: string;
    imageUrl: string | null;
    signature: string;
    customImage: boolean;
    imagePosition: { x: number; y: number };
    imageScale: number;
  } | null>(null);

  // Pagination state for Unsplash
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
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

    // Default theme header images (seasonal: Christmas)
    const defaultThemeImages = {
      'default': 'https://images.unsplash.com/photo-1478479474071-8a3014c1c15a?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'confetti': 'https://images.unsplash.com/photo-1512317052271-03dcd8aefb21?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'balloons': 'https://images.unsplash.com/photo-1454372182658-c712e4c5a1db?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    };

    // Determine if this should use custom image based on initialData
    const hasCustomImageData = initialData?.customImage === true && initialData?.imageUrl;
    const isCustomTheme = initialThemeId === 'custom';

    console.log('🎨 [Card Designer] Initializing with:', {
      initialThemeId,
      hasCustomImageData,
      isCustomTheme,
      initialImageUrl: initialData?.imageUrl,
      initialCustomImage: initialData?.customImage
    });

    // Set image state based on theme and data - PRESERVE CUSTOM IMAGES
    if (hasCustomImageData) {
      // Has explicit custom image data - always preserve this
      console.log('📸 Setting custom image:', initialData.imageUrl);
      setImageUrl(initialData.imageUrl);
      setCustomImage(true);
    } else if (isCustomTheme && initialData?.imageUrl) {
      // Custom theme with saved image URL (even if customImage flag is missing)
      console.log('📸 Setting custom theme image from saved data:', initialData.imageUrl);
      setImageUrl(initialData.imageUrl);
      setCustomImage(true);
    } else if (!isCustomTheme && initialThemeId && initialThemeId in defaultThemeImages) {
      // Default theme with its header image
      console.log('🎭 Setting default theme image for:', initialThemeId);
      setImageUrl(defaultThemeImages[initialThemeId as keyof typeof defaultThemeImages]);
      setCustomImage(false);
    } else {
      // Custom theme without custom image or unknown theme
      console.log('🎨 Custom theme without image - clearing state');
      setImageUrl(null);
      setCustomImage(isCustomTheme);
    }

    const finalImagePosition = initialData?.imagePosition ?? { x: 0, y: 0 };
    const finalImageScale = initialData?.imageScale ?? 1;

    setImagePosition(finalImagePosition);
    setImageScale(finalImageScale);

    // Reset image error state on initialization
    setImageError(false);

    // Store initial values for change tracking
    const finalImageUrl = hasCustomImageData ? initialData.imageUrl :
      (isCustomTheme && initialData?.imageUrl) ? initialData.imageUrl :
        (!isCustomTheme && initialThemeId && initialThemeId in defaultThemeImages) ?
          defaultThemeImages[initialThemeId as keyof typeof defaultThemeImages] : null;

    const finalCustomImage = hasCustomImageData || (isCustomTheme && initialData?.imageUrl) ||
      (!isCustomTheme && initialThemeId && initialThemeId in defaultThemeImages) ? false : isCustomTheme;

    setInitialValues({
      title: initialData?.title ?? "",
      message: initialData?.message ?? "",
      imageUrl: finalImageUrl,
      signature: initialData?.signature ?? "",
      customImage: finalCustomImage,
      imagePosition: finalImagePosition,
      imageScale: finalImageScale,
    });

    // Reset change tracking
    setHasUnsavedChanges(false);

  }, [open, initialThemeId, initialData]);

  // Emoji count: compute based on plain text extracted from the rich text HTML
  useEffect(() => {
    if (!open) return;
    const extractText = (html: string): string => {
      const div = document.createElement('div');
      div.innerHTML = html || '';
      return div.textContent || div.innerText || '';
    };
    const countEmojis = (text: string): number => {
      try {
        // Prefer modern Unicode property escape when available
        const re = /\p{Extended_Pictographic}/gu;
        return (text.match(re) || []).length;
      } catch {
        // Fallback broad ranges covering most emoji blocks
        const re = /[\u203C-\u3299\u00A9\u00AE\u2122\u231A-\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD-\u25FE\u2600-\u27BF\u2B50\u2B55\u2934-\u2935\u2194-\u2199\u1F004\u1F0CF\u1F170-\u1F171\u1F17E-\u1F17F\u1F18E\u1F191-\u1F19A\u1F1E6-\u1F1FF\u1F201-\u1F202\u1F21A\u1F22F\u1F232-\u1F23A\u1F250-\u1F251\u1F300-\u1F6FF\u1F900-\u1F9FF\u1FA70-\u1FAFF]/g;
        return (text.match(re) || []).length;
      }
    };
    const plain = extractText(message);
    setEmojiCount(countEmojis(plain));
  }, [open, message]);

  // Load persistent Unsplash search state only once when modal opens
  useEffect(() => {
    if (!open) return;

    try {
      const savedSearchState = localStorage.getItem("unsplashSearchState");
      if (savedSearchState) {
        const state = JSON.parse(savedSearchState);
        setSearchQuery(state.query || "");
        setUnsplashImages(state.images || []);
        setCurrentPage(state.currentPage || 1);
        setTotalPages(state.totalPages || 0);
        setTotalResults(state.totalResults || 0);
        setHasSearched(state.hasSearched || false);
      }
    } catch (error) {
      console.warn('Error loading search state:', error);
    }
  }, [open]); // Only depend on open, not other props

  // If theme changes while open and no custom image chosen, update to theme's default image
  useEffect(() => {
    if (!open) return;

    // Don't override custom images - this is the key fix
    if (customImage && imageUrl) {
      console.log('🔒 [Card Designer] Preserving custom image, skipping theme change effect');
      return;
    }

    // Default theme header images
    const defaultThemeImages = {
      'default': 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'confetti': 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'balloons': 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    };

    console.log('🔄 [Card Designer] Theme change effect triggered:', {
      initialThemeId,
      customImage,
      currentImageUrl: imageUrl
    });

    if (initialThemeId === 'custom') {
      // For custom theme, only clear if no custom image is set
      if (!customImage && !imageUrl) {
        console.log('🎨 Custom theme with no image - clearing');
        setImageUrl(null);
        setImageError(false);
      }
    } else if (initialThemeId && initialThemeId in defaultThemeImages && !customImage) {
      // For default themes, only set if not using a custom image
      console.log('🎭 Setting default theme image for:', initialThemeId);
      setImageUrl(defaultThemeImages[initialThemeId as keyof typeof defaultThemeImages]);
      setImageError(false);
    }
  }, [initialThemeId, open]);

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
    } catch { }
  }, [open, title, message, imageUrl, signature, initialThemeId, customImage, imagePosition, imageScale]);

  // Call preview change callback for real-time updates
  useEffect(() => {
    if (!open || !onPreviewChange) return;

    const previewData: DesignerData = {
      title,
      message,
      imageUrl: imageUrl ?? undefined,
      signature,
      themeId: initialThemeId,
      customImage,
      imagePosition,
      imageScale,
    };

    // Debounce the preview updates to avoid too many calls
    const timeoutId = setTimeout(() => {
      try {
        onPreviewChange(previewData);
      } catch (error) {
        console.warn('Error calling onPreviewChange:', error);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [open, title, message, imageUrl, signature, initialThemeId, customImage, imagePosition, imageScale]); // Removed onPreviewChange from dependencies

  // Debug effect to track image state changes
  useEffect(() => {
    if (open) {
      console.log('🔍 [Card Designer] Image state changed:', {
        imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : null,
        customImage,
        imageError,
        initialThemeId,
        uploading
      });
    }
  }, [open, imageUrl, customImage, imageError, initialThemeId, uploading]);

  // Change detection effect
  useEffect(() => {
    if (!open || !initialValues) return;

    const hasChanges =
      title !== initialValues.title ||
      message !== initialValues.message ||
      imageUrl !== initialValues.imageUrl ||
      signature !== initialValues.signature ||
      customImage !== initialValues.customImage ||
      imagePosition.x !== initialValues.imagePosition.x ||
      imagePosition.y !== initialValues.imagePosition.y ||
      imageScale !== initialValues.imageScale;

    setHasUnsavedChanges(hasChanges);
  }, [open, initialValues, title, message, imageUrl, signature, customImage, imagePosition, imageScale]);

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
        oldImageUrl: imageUrl || undefined, // Pass current image URL for cleanup
        onProgress: (progress) => {
          console.log('📸 [Card Designer] Upload progress:', progress);
        }
      });

      if (result.success && result.url) {
        console.log('📸 [Card Designer] Upload successful:', result.url);
        setImageUrl(result.url);
        setCustomImage(true); // Mark as custom when user uploads new image
        setImageError(false);
        setShowImageControls(false);

        // Note: When user uploads a new image, the save function will automatically
        // switch to custom theme since customImage is now true
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
    console.log('🗑️ [Card Designer] Removing image:', imageUrl);

    // Clean up object URL if it exists (only for blob URLs, not R2 URLs)
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl(null);
    setCustomImage(false);
    setImageError(false); // Clear any error state
    // Reset position and scale when image is removed - TEMPORARILY DISABLED
    // setImagePosition({ x: 0, y: 0 });
    // setImageScale(1);
    setShowImageControls(false);

    console.log('✅ [Card Designer] Image removal complete');
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

  // Search Unsplash images with pagination support
  const searchUnsplash = async (query: string, page: number = 1, append: boolean = false) => {
    if (!query.trim()) return;

    if (page === 1) {
      setLoading(true);
      setHasSearched(false);
    } else {
      setLoadingMore(true);
    }

    const accessKey = import.meta.env.VITE_ACCESS_KEY;

    console.log('🔍 Starting Unsplash search for:', query, 'Page:', page);
    console.log('🔑 Access key available:', !!accessKey);
    console.log('🔑 Access key (first 10 chars):', accessKey ? accessKey.substring(0, 10) + '...' : 'Not set');

    try {
      // Check if environment variables are configured
      if (!accessKey) {
        console.warn('❌ VITE_ACCESS_KEY not configured, using fallback images');
        throw new Error('Unsplash API key not configured');
      }

      // Simplify search query first to test basic functionality
      const searchQuery = query.trim();

      console.log('📝 Search query:', searchQuery);

      // Using basic Unsplash API parameters with pagination
      const apiUrl = `https://api.unsplash.com/search/photos`;
      const searchParams = new URLSearchParams({
        query: searchQuery,
        per_page: '15', // Increased per page for better UX
        page: page.toString(),
        client_id: accessKey
      });

      const fullUrl = `${apiUrl}?${searchParams}`;
      console.log('🌐 Full API URL:', fullUrl.replace(accessKey, 'ACCESS_KEY_HIDDEN'));

      const response = await fetch(fullUrl);

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('✅ API Response received:', {
          total: data.total,
          total_pages: data.total_pages,
          results_count: data.results?.length || 0,
          current_page: page
        });

        const results = data.results || [];

        // Deduplicate results by image ID to prevent duplicate keys
        const uniqueResults = results.filter((image: any, index: number, arr: any[]) =>
          arr.findIndex(img => img.id === image.id) === index
        );

        if (uniqueResults.length > 0) {
          console.log('🖼️ First result sample:', {
            id: uniqueResults[0].id,
            description: uniqueResults[0].description,
            alt_description: uniqueResults[0].alt_description,
            urls: Object.keys(uniqueResults[0].urls || {})
          });
        }

        console.log(`📊 Deduplication: ${results.length} -> ${uniqueResults.length} images`);

        // Update images state
        if (append && page > 1) {
          setUnsplashImages(prev => {
            // Deduplicate between existing and new results
            const combined = [...prev, ...uniqueResults];
            return combined.filter((image, index, arr) =>
              arr.findIndex(img => img.id === image.id) === index
            );
          });
        } else {
          setUnsplashImages(uniqueResults);
        }

        // Update pagination state
        setCurrentPage(page);
        setTotalPages(data.total_pages || 0);
        setTotalResults(data.total || 0);
        setHasSearched(true);

        // Save search state to localStorage
        const searchState = {
          query: searchQuery,
          images: append && page > 1 ? [...(JSON.parse(localStorage.getItem("unsplashSearchState") || '{}').images || []), ...uniqueResults] : uniqueResults,
          currentPage: page,
          totalPages: data.total_pages || 0,
          totalResults: data.total || 0,
          hasSearched: true
        };

        try {
          localStorage.setItem("unsplashSearchState", JSON.stringify(searchState));
        } catch (error) {
          console.warn('Error saving search state:', error);
        }

      } else {
        const errorText = await response.text();
        console.error('❌ Unsplash API error:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        throw new Error(`Unsplash API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('💥 Search error details:', error);
      console.warn('🔄 Falling back to demo images');

      // Fallback to mock data when API is not available or configured
      const mockResults = [
        { id: '1', urls: { small: 'https://picsum.photos/300/200?random=1', regular: 'https://picsum.photos/600/400?random=1' }, alt_description: 'Sample birthday image 1' },
        { id: '2', urls: { small: 'https://picsum.photos/300/200?random=2', regular: 'https://picsum.photos/600/400?random=2' }, alt_description: 'Sample birthday image 2' },
        { id: '3', urls: { small: 'https://picsum.photos/300/200?random=3', regular: 'https://picsum.photos/600/400?random=3' }, alt_description: 'Sample birthday image 3' },
        { id: '4', urls: { small: 'https://picsum.photos/300/200?random=4', regular: 'https://picsum.photos/600/400?random=4' }, alt_description: 'Sample birthday image 4' },
        { id: '5', urls: { small: 'https://picsum.photos/300/200?random=5', regular: 'https://picsum.photos/600/400?random=5' }, alt_description: 'Sample birthday image 5' },
        { id: '6', urls: { small: 'https://picsum.photos/300/200?random=6', regular: 'https://picsum.photos/600/400?random=6' }, alt_description: 'Sample birthday image 6' },
        { id: '7', urls: { small: 'https://picsum.photos/300/200?random=7', regular: 'https://picsum.photos/600/400?random=7' }, alt_description: 'Sample birthday image 7' },
        { id: '8', urls: { small: 'https://picsum.photos/300/200?random=8', regular: 'https://picsum.photos/600/400?random=8' }, alt_description: 'Sample birthday image 8' },
        { id: '9', urls: { small: 'https://picsum.photos/300/200?random=9', regular: 'https://picsum.photos/600/400?random=9' }, alt_description: 'Sample birthday image 9' },
        { id: '10', urls: { small: 'https://picsum.photos/300/200?random=10', regular: 'https://picsum.photos/600/400?random=10' }, alt_description: 'Sample birthday image 10' },
        { id: '11', urls: { small: 'https://picsum.photos/300/200?random=11', regular: 'https://picsum.photos/600/400?random=11' }, alt_description: 'Sample birthday image 11' },
        { id: '12', urls: { small: 'https://picsum.photos/300/200?random=12', regular: 'https://picsum.photos/600/400?random=12' }, alt_description: 'Sample birthday image 12' },
        { id: '13', urls: { small: 'https://picsum.photos/300/200?random=13', regular: 'https://picsum.photos/600/400?random=13' }, alt_description: 'Sample birthday image 13' },
        { id: '14', urls: { small: 'https://picsum.photos/300/200?random=14', regular: 'https://picsum.photos/600/400?random=14' }, alt_description: 'Sample birthday image 14' },
        { id: '15', urls: { small: 'https://picsum.photos/300/200?random=15', regular: 'https://picsum.photos/600/400?random=15' }, alt_description: 'Sample birthday image 15' }
      ];

      if (append && page > 1) {
        setUnsplashImages(prev => [...prev, ...mockResults]);
      } else {
        setUnsplashImages(mockResults);
      }

      setCurrentPage(page);
      setTotalPages(5); // Mock pagination
      setTotalResults(75); // Mock total results
      setHasSearched(true);
    }

    setLoading(false);
    setLoadingMore(false);
  };

  const selectUnsplashImage = (imageUrl: string) => {
    console.log('🖼️ [Card Designer] Selecting Unsplash image:', imageUrl);

    // Clean up previous blob URL if it exists (not for Unsplash URLs)
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl(imageUrl);
    setCustomImage(true);
    setImageError(false); // Reset any previous error state
    setUnsplashOpen(false);
    // Don't clear search state - keep it persistent
    // Reset position and scale when new image is selected - TEMPORARILY DISABLED
    // setImagePosition({ x: 0, y: 0 });
    // setImageScale(1);
    setShowImageControls(false);

    console.log('✅ [Card Designer] Image selection complete, customImage set to true');
  };

  // Pagination helper functions
  const loadMoreResults = () => {
    if (currentPage < totalPages && !loadingMore && searchQuery.trim()) {
      searchUnsplash(searchQuery, currentPage + 1, true);
    }
  };

  const startNewSearch = (query: string) => {
    if (query.trim()) {
      setCurrentPage(1);
      searchUnsplash(query, 1, false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setUnsplashImages([]);
    setCurrentPage(1);
    setTotalPages(0);
    setTotalResults(0);
    setHasSearched(false);
    try {
      localStorage.removeItem("unsplashSearchState");
    } catch (error) {
      console.warn('Error clearing search state:', error);
    }
  };

  // Image manipulation functions - TEMPORARILY DISABLED
  const handleZoomIn = () => {
    // setImageScale(prev => Math.min(prev + 0.1, 2)); // Reduced max zoom to prevent excessive blurriness
  };

  const handleZoomOut = () => {
    // setImageScale(prev => Math.max(prev - 0.1, 0.8)); // Reduced min zoom to maintain quality
  };

  const handleResetPosition = () => {
    // setImagePosition({ x: 0, y: 0 });
    // setImageScale(1);
  };

  // TEMPORARILY DISABLED - Image manipulation handlers
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // setShowImageControls(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TEMPORARILY DISABLED - Drag functionality
    // setShowImageControls(true);
    // setIsDragging(true);
    // setDragStart({
    //   x: e.clientX,
    //   y: e.clientY,
    //   startX: imagePosition.x,
    //   startY: imagePosition.y,
    // });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // TEMPORARILY DISABLED - Drag functionality
    // if (!isDragging || !dragStart) return;
    // 
    // const deltaX = e.clientX - dragStart.x;
    // const deltaY = e.clientY - dragStart.y;
    // 
    // setImagePosition({
    //   x: dragStart.startX + deltaX,
    //   y: dragStart.startY + deltaY,
    // });
  };

  const handleMouseUp = () => {
    // TEMPORARILY DISABLED - Drag functionality
    // setIsDragging(false);
    // setDragStart(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    // TEMPORARILY DISABLED - Zoom functionality
    // const delta = e.deltaY > 0 ? -0.05 : 0.05; // Smaller increments for smoother control
    // setImageScale(prev => Math.max(0.8, Math.min(2, prev + delta))); // Limited range for better quality
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
    const isCustomTheme = initialThemeId === 'custom';
    const resetMessage = isCustomTheme
      ? "Are you sure you want to reset the card? This will clear all content including the image, title, message, and signature."
      : "Are you sure you want to reset the text? This will clear the title, message, and signature.";

    const confirmed = confirm(resetMessage);

    if (confirmed) {
      // Always clear text content
      setTitle("");
      setMessage("");
      setSignature("");

      // Only reset image for custom theme
      if (isCustomTheme) {
        console.log('🔄 [Card Designer] Resetting custom theme');

        // Remove image and reset image controls
        if (imageUrl && imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(imageUrl);
        }
        setImageUrl(null);
        setCustomImage(false);
        // Reset image position and scale - TEMPORARILY DISABLED
        // setImagePosition({ x: 0, y: 0 });
        // setImageScale(1);
        setShowImageControls(false);

        // Clear any error states
        setImageError(false);

        console.log('✅ [Card Designer] Custom theme reset complete');
      }

      // Always close emoji picker
      setShowEmojiPicker(false);

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
    setHasUnsavedChanges(false); // Reset change tracking after save
    onOpenChange(false);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirmDiscard = () => {
    setShowConfirmDialog(false);
    setHasUnsavedChanges(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-[760px] max-h-[95vh] overflow-y-auto p-3 sm:p-6"
          dir="ltr"
          style={{ direction: 'ltr' }}
        >
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg sm:text-xl">Design your birthday card</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">Customize the image, header and message.</DialogDescription>
          </DialogHeader>

          {/* Designer Canvas - responsive width with forced LTR */}
          <div className="mx-auto w-full max-w-[600px] rounded-2xl overflow-hidden border bg-white" dir="ltr" style={{ direction: 'ltr' }}>
            {/* Image header */}
            <div
              ref={imageContainerRef}
              className={`relative bg-gray-100 overflow-hidden transition-all duration-200 ${showImageControls && imageUrl && !imageError
                ? 'ring-2 ring-blue-400 ring-opacity-50'
                : ''
                }`}
              // TEMPORARILY DISABLED - Image manipulation event handlers
              // onClick={imageUrl && !imageError ? handleImageClick : undefined}
              // onMouseDown={imageUrl && !imageError ? handleMouseDown : undefined}
              // onMouseMove={isDragging ? handleMouseMove : undefined}
              // onMouseUp={handleMouseUp}
              // onMouseLeave={handleMouseUp}
              // onWheel={imageUrl && !imageError ? handleWheel : undefined}
              style={{
                // cursor: isDragging ? 'grabbing' : (imageUrl && !imageError ? 'grab' : 'default'),
                cursor: 'default',
                height: 'clamp(200px, 40vw, 300px)',
                willChange: isDragging ? 'transform' : 'auto'
              }}
            >
              {uploading ? (
                <div className="w-full h-full flex items-center justify-center text-blue-500 bg-blue-50">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <div className="text-xs sm:text-sm">Uploading image...</div>
                  </div>
                </div>
              ) : imageUrl && !imageError ? (
                <img
                  key={`card-image-${imageUrl}-${customImage}`} // Force re-render on image change
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
                    console.log('📸 [Card Designer] Image loaded successfully:', imageUrl);
                    setImageError(false);
                  }}
                  onError={(e) => {
                    console.error('❌ [Card Designer] Image failed to load:', imageUrl);
                    console.error('Error event:', e);
                    setImageError(true);
                  }}
                  onDragStart={(e) => e.preventDefault()}
                />
              ) : imageUrl && imageError ? (
                <div className="w-full h-full flex items-center justify-center text-red-400 bg-red-50">
                  <div className="text-center px-4">
                    <ImageOff className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                    <div className="text-xs sm:text-sm">Failed to load image</div>
                    <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => setImageError(false)}>
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <ImagePlus className="w-3 h-3 sm:w-4 sm:h-4" />
                    Add an image
                  </div>
                </div>
              )}

              {/* Image Overlay Controls - only show when focused */}
              {/* TEMPORARILY DISABLED - Image zoom and position controls
            {imageUrl && !imageError && !uploading && showImageControls && (
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1 sm:gap-2 animate-in fade-in-0 duration-200">
                <div className="bg-black/70 backdrop-blur-sm rounded-lg p-1.5 sm:p-2 flex flex-col gap-0.5 sm:gap-1 shadow-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 sm:h-8 sm:w-8 text-white hover:bg-white/20 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleZoomIn();
                    }}
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 sm:h-8 sm:w-8 text-white hover:bg-white/20 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleZoomOut();
                    }}
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 sm:h-8 sm:w-8 text-white hover:bg-white/20 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetPosition();
                    }}
                    title="Reset Position & Zoom"
                  >
                    <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
                <div className="bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 sm:px-3 sm:py-1 shadow-lg">
                  <div className="flex items-center gap-1 sm:gap-2 text-white text-xs">
                    <Move className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span className="hidden sm:inline">Drag to move • Scroll to zoom</span>
                    <span className="sm:hidden">Drag • Scroll</span>
                  </div>
                </div>
              </div>
            )}
            */}

              {/* Click to focus hint - only show when not focused and image is present */}
              {/* TEMPORARILY DISABLED - Click to show controls hint
            {imageUrl && !imageError && !uploading && !showImageControls && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 sm:px-4 text-white text-xs sm:text-sm">
                  <span className="hidden sm:inline">Click to show controls</span>
                  <span className="sm:hidden">Tap for controls</span>
                </div>
              </div>
            )}
            */}

              <div className="absolute left-3 bottom-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="rounded-full">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {/* Image controls only for custom theme */}
                    {initialThemeId === 'custom' && (
                      <>
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
                      </>
                    )}
                    <DropdownMenuItem className="text-red-600" onClick={handleReset}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset {initialThemeId === 'custom' ? 'Card' : 'Text'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
              <div className="relative">
                <Input
                  ref={titleInputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="🎉 Happy Birthday! 🎂"
                  className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold border-0 shadow-none px-0 pr-8 sm:pr-12 focus-visible:ring-0 text-center placeholder:text-gray-400 placeholder:font-normal h-auto min-h-[3rem] sm:min-h-[4rem] md:min-h-[5rem] lg:min-h-[6rem] py-2 sm:py-3 md:py-4 leading-tight"
                />
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                  <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 sm:h-8 sm:w-8 p-0 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowEmojiPicker(true)}
                      >
                        <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-72 sm:w-80 p-3 sm:p-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-2 sm:space-y-3">
                        <div className="text-xs sm:text-sm font-medium text-gray-700">Birthday Emojis</div>
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 sm:gap-2">
                          {birthdayEmojis.map((emoji, index) => (
                            <button
                              key={index}
                              onClick={() => insertEmoji(emoji)}
                              className="w-7 h-7 sm:w-8 sm:h-8 text-base sm:text-lg hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
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
                className="text-sm sm:text-base text-gray-800"
                customerInfo={customerInfo}
                businessName={businessName}
              />

              {/* Emoji counter and deliverability warning */}
              <div className="mt-2">
                <div className="text-xs text-gray-500">Emojis detected in message: {emojiCount}</div>
                {emojiCount > 1 && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded p-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-700" />
                    <span>
                      <strong>Warning:</strong> More than one emoji could affect email delivery to inbox and place your mail under Promotions or Spam.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end text-gray-500 text-xs sm:text-sm">
                <Input
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={senderName ? `From ${senderName}` : "From [Your Name]"}
                  className="w-full max-w-[180px] sm:max-w-[220px] text-right border-0 shadow-none px-0 focus-visible:ring-0 placeholder:text-gray-400"
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
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              {onMakeActive && (
                <Button
                  variant={isCurrentlyActive ? "secondary" : "default"}
                  onClick={() => {
                    // Determine the correct theme ID based on current state
                    let currentThemeId = initialThemeId || 'default';

                    // Set to custom theme if user has uploaded a custom image OR if we're explicitly in custom theme mode
                    if (customImage || initialThemeId === 'custom') {
                      currentThemeId = 'custom';
                    }
                    // Otherwise, preserve the default theme (default, confetti, balloons)

                    const currentData = {
                      title,
                      message,
                      imageUrl,
                      signature,
                      themeId: currentThemeId,
                      customImage,
                      imagePosition,
                      imageScale,
                    };
                    onMakeActive(currentThemeId, currentData);
                  }}
                  className="text-sm"
                  disabled={isCurrentlyActive}
                >
                  {isCurrentlyActive ? 'Currently Active' : 'Make Active'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="text-sm">
                Close
              </Button>
              <Button onClick={handleSave} className="text-sm">
                Save
              </Button>
            </div>
          </div>

          {/* Unsplash Image Picker Modal */}
          <Dialog open={unsplashOpen} onOpenChange={setUnsplashOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Browse Images from Unsplash</DialogTitle>
                <DialogDescription className="text-sm sm:text-base">Search for high-quality stock photos for your card header.</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative">
                    <Input
                      placeholder="Search for images..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && startNewSearch(searchQuery)}
                      className="flex-1 text-sm sm:text-base pr-8"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400 hover:text-gray-600 ${searchQuery ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                      onClick={clearSearch}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => startNewSearch(searchQuery)}
                    disabled={loading || !searchQuery.trim()}
                    className="w-full sm:w-auto text-sm"
                  >
                    <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Search
                  </Button>
                </div>

                {/* Search Results Summary */}
                {hasSearched && !loading && totalResults > 0 && (
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      Showing {unsplashImages.length} of {totalResults.toLocaleString()} results for "{searchQuery}"
                    </span>
                    {currentPage < totalPages && (
                      <span className="text-xs text-gray-500">
                        Page {currentPage} of {totalPages}
                      </span>
                    )}
                  </div>
                )}

                {loading && (
                  <div className="flex items-center justify-center py-6 sm:py-8">
                    <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-gray-900"></div>
                  </div>
                )}

                {unsplashImages.length > 0 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 max-h-64 sm:max-h-96 overflow-y-auto">
                      {unsplashImages.map((image, index) => (
                        <div key={`unsplash-${image.id}-${index}`} className="cursor-pointer group" onClick={() => selectUnsplashImage(image.urls.regular)}>
                          <img
                            src={image.urls.small}
                            alt={image.alt_description || 'Unsplash image'}
                            className="w-full h-24 sm:h-32 object-cover rounded-md group-hover:opacity-80 transition-opacity"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Load More Button */}
                    {currentPage < totalPages && (
                      <div className="flex flex-col items-center gap-2">
                        {loadingMore ? (
                          <div className="flex items-center gap-2 text-gray-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span className="text-sm">Loading more images...</span>
                          </div>
                        ) : (
                          <Button
                            onClick={loadMoreResults}
                            variant="outline"
                            className="text-sm"
                            disabled={loadingMore}
                          >
                            <ChevronRight className="w-4 h-4 mr-1" />
                            Load More ({(totalPages - currentPage) > 0 ? `${Math.min(15, totalResults - unsplashImages.length)} more` : 'No more'})
                          </Button>
                        )}

                        {/* Progress indicator */}
                        <div className="text-xs text-gray-500">
                          Loaded {unsplashImages.length} of {totalResults.toLocaleString()} images
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!loading && unsplashImages.length === 0 && hasSearched && searchQuery && (
                  <div className="text-center py-6 sm:py-8 text-gray-500">
                    <div className="space-y-2">
                      <p className="text-sm sm:text-base">No images found for "{searchQuery}". Try a different search term.</p>
                      {!import.meta.env.VITE_ACCESS_KEY && (
                        <div className="text-xs sm:text-sm text-orange-600 bg-orange-50 p-3 rounded-md mx-auto max-w-md">
                          <p className="font-medium">Unsplash API not configured</p>
                          <p>Add VITE_ACCESS_KEY to your .env file to enable image search.</p>
                          <p>Showing demo images instead.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!loading && !hasSearched && (
                  <div className="text-center py-8 sm:py-12 text-gray-500">
                    <div className="space-y-3">
                      <Search className="w-12 h-12 mx-auto text-gray-300" />
                      <div>
                        <p className="text-sm sm:text-base font-medium">Search for beautiful images</p>
                        <p className="text-xs sm:text-sm">Enter a search term above to find high-quality photos from Unsplash</p>
                      </div>
                      <div className="text-xs text-gray-400">
                        Try searches like: "birthday party", "celebration", "cake", "balloons"
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Unsaved Changes */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your birthday card. Are you sure you want to close without saving? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export type { DesignerData };


