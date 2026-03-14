import { Router } from 'express'
import { nanoid } from 'nanoid'
import sharp from 'sharp'
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

// 2x the largest UI size (X-Large = 160px) for crisp rendering on retina displays
const LOGO_TARGET_HEIGHT = 320

// Upload and resize a logo image for email headers
newsletterImageRoutes.post(
  '/upload-logo',
  authenticateToken,
  requireTenant,
  avatarUpload,
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' })
      }

      const file = req.file

      // Resize to Large height (128px), preserving aspect ratio, output as PNG for transparency support
      const resizedBuffer = await sharp(file.buffer)
        .resize({ height: LOGO_TARGET_HEIGHT, withoutEnlargement: true })
        .png({ quality: 90 })
        .toBuffer()

      const fileName = `${nanoid()}.png`
      const fullKey = `newsletter-logos/${req.user.tenantId}/${fileName}`

      const imageUrl = await uploadToR2(fullKey, resizedBuffer, 'image/png')

      res.json({ success: true, url: imageUrl })
    } catch (error) {
      console.error('[Newsletter Logo Upload] Error:', error)
      res.status(500).json({ success: false, message: 'Failed to upload logo' })
    }
  },
)
