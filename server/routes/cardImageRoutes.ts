import { Router } from 'express'
import { nanoid } from 'nanoid'
import { authenticateToken, requireTenant, requirePermission } from '../middleware/auth-middleware'
import { avatarUpload } from '../middleware/upload'
import { uploadToR2, deleteImageFromR2, extractR2KeyFromUrl } from '../config/r2'

// Map MIME types to safe file extensions
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Validate that an R2 image URL belongs to the given tenant.
 * Returns true only if the key starts with the expected tenant prefix.
 */
function isOwnedByTenant(imageUrl: string, tenantId: string): boolean {
  const key = extractR2KeyFromUrl(imageUrl)
  if (!key) return false
  return key.startsWith(`card-images/${tenantId}/`)
}

export const cardImageRoutes = Router()

// Upload card image to R2 with tenant-based organization
cardImageRoutes.post('/upload', authenticateToken, requireTenant, requirePermission('cards.manage_images'), avatarUpload, async (req: any, res) => {
  try {
    console.log('📸 [Card Image Upload] Request received for tenant:', req.user.tenantId)
    
    if (!req.file) {
      console.log('📸 [Card Image Upload] No file in request')
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      })
    }

    const file = req.file
    console.log('📸 [Card Image Upload] File details:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    })

    // Check for old image URL to replace (optional)
    const oldImageUrl = req.body.oldImageUrl
    if (oldImageUrl && typeof oldImageUrl === 'string') {
      console.log('📸 [Card Image Upload] Old image URL provided for replacement:', oldImageUrl)
    }

    // Generate unique filename with tenant prefix for organization
    const fileExtension = MIME_TO_EXT[file.mimetype] || 'jpg'
    const fileName = `${nanoid()}.${fileExtension}`
    const tenantPrefix = `card-images/${req.user.tenantId}`
    const fullKey = `${tenantPrefix}/${fileName}`

    console.log('📸 [Card Image Upload] Uploading to R2 with key:', fullKey)

    // Upload to R2
    const imageUrl = await uploadToR2(fullKey, file.buffer, file.mimetype)
    
    console.log('📸 [Card Image Upload] Upload successful:', imageUrl)

    // Clean up old image if provided (async, don't wait for completion)
    if (oldImageUrl && typeof oldImageUrl === 'string' && oldImageUrl !== imageUrl) {
      if (!isOwnedByTenant(oldImageUrl, req.user.tenantId)) {
        console.warn('📸 [Card Image Upload] Blocked cleanup of image not owned by tenant:', oldImageUrl)
      } else {
        console.log('📸 [Card Image Upload] Cleaning up old image:', oldImageUrl)
        deleteImageFromR2(oldImageUrl).catch(error => {
          console.error('📸 [Card Image Upload] Failed to cleanup old image:', oldImageUrl, error)
        })
      }
    }

    res.json({
      success: true,
      url: imageUrl,
      message: 'Card image uploaded successfully'
    })

  } catch (error) {
    console.error('📸 [Card Image Upload] Error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload card image'
    })
  }
})

// Delete card image from R2
cardImageRoutes.delete('/cleanup', authenticateToken, requireTenant, requirePermission('cards.manage_images'), async (req: any, res) => {
  try {
    const { imageUrl } = req.body

    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      })
    }

    // Verify the image belongs to this tenant before deleting
    if (!isOwnedByTenant(imageUrl, req.user.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this image'
      })
    }

    console.log('📸 [Card Image Cleanup] Cleaning up image for tenant:', req.user.tenantId, 'URL:', imageUrl)

    // Delete from R2
    await deleteImageFromR2(imageUrl)
    
    console.log('📸 [Card Image Cleanup] Cleanup successful:', imageUrl)

    res.json({
      success: true,
      message: 'Image deleted successfully'
    })

  } catch (error) {
    console.error('📸 [Card Image Cleanup] Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete image'
    })
  }
})
