import React, { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { getAvatarUrl, getUserInitials } from '@/lib/avatarUpload'
import { cn } from '@/lib/utils'

interface AvatarProps {
  user: {
    avatarUrl?: string | null
    email?: string
    firstName?: string
    lastName?: string
  }
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showFallback?: boolean
}

export const Avatar: React.FC<AvatarProps> = ({
  user,
  size = 'md',
  className = '',
  showFallback = true
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const [overrideUrl, setOverrideUrl] = useState<string | null>(null)
  const [cacheBuster, setCacheBuster] = useState<number>(0)

  useEffect(() => {
    const handler = (e: any) => {
      const detail = e.detail || {}
      const email = user.email
      if (!email) return
      if (detail.email && String(detail.email).toLowerCase() === String(email).toLowerCase()) {
        setOverrideUrl(typeof detail.url === 'string' ? detail.url : '')
        setCacheBuster(Date.now())
      }
    }
    window.addEventListener('avatarUpdated', handler as any)
    return () => window.removeEventListener('avatarUpdated', handler as any)
  }, [user.email])

  const baseAvatarUrl = overrideUrl !== null ? overrideUrl : getAvatarUrl(user)
  const initials = getUserInitials(user.email || '')
  const isDataUrl = baseAvatarUrl.startsWith('data:')

  // If it's a data URL (initials SVG), show the initials
  if (baseAvatarUrl.startsWith('data:image/svg+xml')) {
    return (
      <div className={cn(
        sizeClasses[size],
        "rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center",
        className
      )}>
        <span className="text-white font-bold text-sm">
          {initials}
        </span>
      </div>
    )
  }

  // If it's a real image URL, show the image
  if (baseAvatarUrl && !isDataUrl) {
    const effectiveUrl = `${baseAvatarUrl}${baseAvatarUrl.includes('?') ? '&' : '?'}v=${cacheBuster}`
    return (
      <div className={cn(sizeClasses[size], "rounded-full overflow-hidden", className)}>
        <img
          src={effectiveUrl}
          alt="User avatar"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials if image fails to load
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent && showFallback) {
              parent.innerHTML = `
                <div class="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600">
                  <span class="text-white font-bold text-sm">${initials}</span>
                </div>
              `
            }
          }}
        />
      </div>
    )
  }

  // Fallback to initials
  if (showFallback) {
    return (
      <div className={cn(
        sizeClasses[size],
        "rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center",
        className
      )}>
        <span className="text-white font-bold text-sm">
          {initials}
        </span>
      </div>
    )
  }

  // Fallback to User icon
  return (
    <div className={cn(
      sizeClasses[size],
      "rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center",
      className
    )}>
      <User className={cn(iconSizes[size], "text-white")} />
    </div>
  )
}