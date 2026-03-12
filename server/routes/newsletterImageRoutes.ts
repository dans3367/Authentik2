import { Router } from 'express'
import { nanoid } from 'nanoid'
import { authenticateToken, requireTenant } from '../middleware/auth-middleware'
import { avatarUpload } from '../middleware/upload'
import { uploadToR2 } from '../config/r2'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const newsletterImageRoutes = Router()

// Upload inline image for newsletter rich-text content
newsletterImageRoutes.post(
  '/upload',
  authenticateToken,
  requireTenant,
  avatarUpload,
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' })
      }

      const file = req.file
      const fileExtension = MIME_TO_EXT[file.mimetype] || 'jpg'
      const fileName = `${nanoid()}.${fileExtension}`
      const fullKey = `newsletter-images/${req.user.tenantId}/${fileName}`

      const imageUrl = await uploadToR2(fullKey, file.buffer, file.mimetype)

      res.json({ success: true, url: imageUrl })
    } catch (error) {
      console.error('[Newsletter Image Upload] Error:', error)
      res.status(500).json({ success: false, message: 'Failed to upload image' })
    }
  },
)
