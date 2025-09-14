import { Router } from 'express'
import { nanoid } from 'nanoid'
import { authenticateToken, requireTenant } from '../middleware/auth-middleware'
import { avatarUpload } from '../middleware/upload'
import { uploadToR2 } from '../config/r2'

export const cardImageRoutes = Router()

// Upload card image to R2 with tenant-based organization
cardImageRoutes.post('/upload', authenticateToken, requireTenant, avatarUpload, async (req: any, res) => {
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

    // Generate unique filename with tenant prefix for organization
    const fileExtension = file.originalname.split('.').pop() || 'jpg'
    const fileName = `${nanoid()}.${fileExtension}`
    const tenantPrefix = `card-images/${req.user.tenantId}`
    const fullKey = `${tenantPrefix}/${fileName}`

    console.log('📸 [Card Image Upload] Uploading to R2 with key:', fullKey)

    // Upload to R2
    const imageUrl = await uploadToR2(fullKey, file.buffer, file.mimetype)
    
    console.log('📸 [Card Image Upload] Upload successful:', imageUrl)

    res.json({
      success: true,
      url: imageUrl,
      message: 'Card image uploaded successfully'
    })

  } catch (error) {
    console.error('📸 [Card Image Upload] Error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload card image',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})
