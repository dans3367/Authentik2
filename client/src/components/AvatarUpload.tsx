import React, { useState, useRef, useCallback } from 'react'
import { Camera, X, Loader2, ImageIcon, Edit3, Check } from 'lucide-react'
import { uploadAvatar, deleteAvatar, getAvatarUrl, validateAvatarFile, getUserInitials } from '@/lib/avatarUpload'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useDispatch } from 'react-redux'
import { updateUser } from '@/store/authSlice'
import { useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/hooks/useLanguage'

interface AvatarUploadProps {
  currentAvatarUrl?: string | null
  userEmail?: string
  onAvatarUpdate?: (avatarUrl: string) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatarUrl,
  userEmail,
  onAvatarUpdate,
  size = 'md',
  className = ''
}) => {
  const dispatch = useDispatch()
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)



  // Size classes
  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-28 h-28',
    lg: 'w-36 h-36'
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  const processFile = (file: File) => {
    // Validate file
    const validation = validateAvatarFile(file)
    if (!validation.valid) {
      setError(validation.error || 'Invalid file')
      return
    }

    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      const result = await uploadAvatar({
        file,
        onProgress: (progress) => {
          console.log('Upload progress:', progress)
        }
      })

      if (result.success && result.url) {
        setPreviewUrl(null)
        onAvatarUpdate?.(result.url)
        // Update Redux store
        dispatch(updateUser({ avatarUrl: result.url }))
        // Invalidate user query to refetch latest data
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] })
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        setError(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      setError('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      const result = await deleteAvatar()
      
      if (result.success) {
        setPreviewUrl(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        onAvatarUpdate?.('')
        // Update Redux store
        dispatch(updateUser({ avatarUrl: null }))
        // Invalidate user query to refetch latest data
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] })
      } else {
        setError(result.error || 'Failed to remove avatar')
      }
    } catch (error) {
      console.error('Remove avatar error:', error)
      setError('Failed to remove avatar. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }, [])

  const getCurrentAvatarUrl = () => {
    if (previewUrl) return previewUrl
    if (currentAvatarUrl) return currentAvatarUrl
    return getAvatarUrl({ email: userEmail })
  }

  const initials = getUserInitials(userEmail || '')
  const hasCurrentAvatar = currentAvatarUrl && !getCurrentAvatarUrl().startsWith('data:image/svg+xml')

  return (
    <div className={cn("flex flex-col items-center space-y-6", className)}>
      {/* Avatar Display with Drag & Drop */}
      <div className="relative">
        <div 
          className={cn(
            sizeClasses[size],
            "rounded-full relative group cursor-pointer transition-all duration-300 transform hover:scale-105",
            isDragOver && "ring-4 ring-blue-400 ring-opacity-50 scale-105"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {/* Avatar Image/Initials */}
          <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 border-4 border-white dark:border-gray-900 shadow-xl">
            {getCurrentAvatarUrl().startsWith('data:image/svg+xml') ? (
              // Show initials avatar
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700">
                <span className="text-white font-bold text-xl">
                  {initials}
                </span>
              </div>
            ) : (
              // Show image avatar
              <img
                src={getCurrentAvatarUrl()}
                alt="User avatar"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.nextElementSibling?.classList.remove('hidden')
                }}
              />
            )}
            
            {/* Fallback initials (hidden by default) */}
            <div className="hidden w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700">
              <span className="text-white font-bold text-xl">
                {initials}
              </span>
            </div>
          </div>

          {/* Upload overlay */}
          <div className={cn(
            "absolute inset-0 bg-black bg-opacity-60 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center",
            isDragOver && "opacity-100"
          )}>
            <Camera className={cn("text-white mb-1", iconSizes[size])} />
            <span className="text-white text-xs font-medium">
              {isDragOver ? t('profile.avatar.dropHere') : t('profile.avatar.change')}
            </span>
          </div>

          {/* Status indicator */}
          {(isUploading || isDeleting) && (
            <div className="absolute inset-0 bg-black bg-opacity-75 rounded-full flex items-center justify-center">
              <Loader2 className={cn("text-white animate-spin", iconSizes[size])} />
            </div>
          )}
        </div>

        {/* Preview indicator */}
        {previewUrl && !isUploading && (
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-lg">
            <Edit3 className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Action Buttons */}
      <div className="flex flex-col space-y-3 w-full max-w-sm">
        {/* Primary Actions */}
        {previewUrl && !isUploading ? (
          <div className="flex space-x-3">
            <Button
              onClick={handleUpload}
              className="flex-1"
              variant="default"
            >
              <Check className="w-4 h-4 mr-2" />
              {t('profile.avatar.saveAvatar')}
            </Button>
            <Button
              onClick={() => {
                setPreviewUrl(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              variant="outline"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex space-x-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1"
              variant="outline"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4 mr-2" />
              )}
              {isUploading ? t('profile.avatar.uploading') : hasCurrentAvatar ? t('profile.avatar.changePhoto') : t('profile.avatar.uploadPhoto')}
            </Button>
            
            {hasCurrentAvatar && !previewUrl && (
              <Button
                onClick={handleRemoveAvatar}
                disabled={isDeleting}
                variant="outline"
                className="text-red-600 hover:text-red-700"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        )}

        {/* Drag & Drop Hint */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {t('profile.avatar.clickOrDrag')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {t('profile.avatar.fileTypes')}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="w-full max-w-sm">
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md shadow-sm text-sm">
            {error}
          </div>
        </div>
      )}

      {/* File Info */}
      {fileInputRef.current?.files?.[0] && previewUrl && (
        <div className="w-full max-w-sm">
          <div className="bg-blue-50 border border-blue-300 text-blue-700 px-4 py-3 rounded-md shadow-sm text-sm">
            <p className="font-medium">{fileInputRef.current.files[0].name}</p>
            <p className="text-xs opacity-75 mt-1">
              {(fileInputRef.current.files[0].size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      )}
    </div>
  )
}