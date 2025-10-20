// Note: authManager removed - Better Auth handles authentication

export interface AvatarUploadResult {
  success: boolean
  url?: string
  error?: string
}

export interface AvatarUploadOptions {
  file: File
  onProgress?: (progress: number) => void
}

/**
 * Upload avatar to server
 */
export const uploadAvatar = async (options: AvatarUploadOptions): Promise<AvatarUploadResult> => {
  const { file } = options

  try {
    // Validate file
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' }
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return { success: false, error: 'File size too large. Please upload an image smaller than 5MB.' }
    }

    // Create form data for upload
    const formData = new FormData()
    formData.append('file', file)

    // Better Auth handles authentication via cookies
    // No need to manually get tokens

    // Upload to backend endpoint
    const response = await fetch('/api/user/avatar', {
      method: 'POST',
      body: formData,
      credentials: 'include', // Include cookies for authentication
    })

    if (!response.ok) {
      console.error('Avatar upload failed:', response.status, response.statusText)
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
    console.error('Avatar upload error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }
  }
}

/**
 * Delete avatar from server
 */
export const deleteAvatar = async (): Promise<AvatarUploadResult> => {
  try {
    // Better Auth handles authentication via cookies
    const response = await fetch('/api/user/avatar', {
      method: 'DELETE',
      credentials: 'include', // Include cookies for authentication
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { 
        success: false, 
        error: errorData.message || `Deletion failed: ${response.status} ${response.statusText}` 
      }
    }

    const result = await response.json()
    
    if (result.success) {
      return { 
        success: true
      }
    } else {
      return { 
        success: false, 
        error: result.error || 'Deletion failed' 
      }
    }

  } catch (error) {
    console.error('Avatar deletion error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Deletion failed' 
    }
  }
}

/**
 * Generate avatar URL from user data
 */
export const getAvatarUrl = (user: { avatarUrl?: string | null; email?: string }): string => {
  // If user has a custom avatar, use it
  if (user.avatarUrl) {
    return user.avatarUrl
  }

  // Generate initials for fallback avatar
  const initials = getUserInitials(user.email || '')
  return `data:image/svg+xml;base64,${btoa(generateInitialsSVG(initials))}`
}

/**
 * Get user initials from email or name
 */
export const getUserInitials = (text: string): string => {
  if (!text) return '?'
  
  // Extract initials from email (before @) or name
  const cleanText = text.split('@')[0] // Remove domain from email
  const words = cleanText.split(/[\s._-]+/).filter(word => word.length > 0)
  
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
}

/**
 * Generate SVG for initials avatar
 */
const generateInitialsSVG = (initials: string): string => {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ]
  
  const colorIndex = initials.charCodeAt(0) % colors.length
  const backgroundColor = colors[colorIndex]
  
  return `
    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="${backgroundColor}" rx="50"/>
      <text x="50" y="50" font-family="Arial, sans-serif" font-size="36" font-weight="bold" 
            fill="white" text-anchor="middle" dy=".3em">${initials}</text>
    </svg>
  `
}

/**
 * Validate avatar file
 */
export const validateAvatarFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' 
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