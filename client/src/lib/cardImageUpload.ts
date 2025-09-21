// Card image upload service using R2 Cloudflare storage with tenant-based organization

export interface CardImageUploadResult {
  success: boolean
  url?: string
  error?: string
}

export interface CardImageUploadOptions {
  file: File
  oldImageUrl?: string // URL of old image to replace/delete
  onProgress?: (progress: number) => void
}

/**
 * Upload card image to R2 storage with tenant-based organization
 */
export const uploadCardImage = async (options: CardImageUploadOptions): Promise<CardImageUploadResult> => {
  const { file, oldImageUrl } = options

  try {
    // Validate file
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' }
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return { success: false, error: 'File size too large. Please upload an image smaller than 5MB.' }
    }

    // Create form data for upload
    const formData = new FormData()
    formData.append('file', file)
    
    // Include old image URL for cleanup if provided
    if (oldImageUrl) {
      formData.append('oldImageUrl', oldImageUrl)
    }

    // Upload to backend endpoint for card images
    const response = await fetch('/api/card-images/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include', // Include cookies for authentication
    })

    if (!response.ok) {
      console.error('Card image upload failed:', response.status, response.statusText)
      const errorData = await response.json().catch(() => ({}))
      console.error('Error details:', errorData)
      return { 
        success: false, 
        error: errorData.message || `Upload failed: ${response.status} ${response.statusText}` 
      }
    }

    const result = await response.json()
    
    if (result.success) {
      return { 
        success: true, 
        url: result.url 
      }
    } else {
      return { 
        success: false, 
        error: result.message || 'Upload failed' 
      }
    }

  } catch (error) {
    console.error('Card image upload error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }
  }
}

/**
 * Delete a card image from R2 storage
 */
export const deleteCardImage = async (imageUrl: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return { success: false, error: 'Invalid image URL' }
    }

    const response = await fetch('/api/card-images/cleanup', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
      credentials: 'include', // Include cookies for authentication
    })

    if (!response.ok) {
      console.error('Card image deletion failed:', response.status, response.statusText)
      const errorData = await response.json().catch(() => ({}))
      console.error('Error details:', errorData)
      return { 
        success: false, 
        error: errorData.message || `Deletion failed: ${response.status} ${response.statusText}` 
      }
    }

    const result = await response.json()
    
    if (result.success) {
      return { success: true }
    } else {
      return { 
        success: false, 
        error: result.message || 'Deletion failed' 
      }
    }

  } catch (error) {
    console.error('Card image deletion error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Deletion failed' 
    }
  }
}

/**
 * Validate card image file
 */
export const validateCardImageFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' 
    }
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'File size too large. Please upload an image smaller than 5MB.' 
    }
  }

  return { valid: true }
}
