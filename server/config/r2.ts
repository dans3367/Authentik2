import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'authentik-avatars'
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://${R2_BUCKET_NAME}.r2.cloudflarestorage.com`

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ACCOUNT_ID) {
  console.warn('Cloudflare R2 credentials not configured. Avatar uploads will be disabled.')
}

// Create S3 client configured for Cloudflare R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || ''
  }
})

export const R2_CONFIG = {
  bucketName: R2_BUCKET_NAME,
  publicUrl: R2_PUBLIC_URL,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  isConfigured: !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ACCOUNT_ID)
}

export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  if (!R2_CONFIG.isConfigured) {
    throw new Error('Cloudflare R2 is not configured')
  }

  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000' // Cache for 1 year
  })

  await r2Client.send(command)
  return `${R2_CONFIG.publicUrl}/${key}`
}

export async function deleteFromR2(key: string) {
  if (!R2_CONFIG.isConfigured) {
    throw new Error('Cloudflare R2 is not configured')
  }

  const command = new DeleteObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key
  })

  await r2Client.send(command)
}

/**
 * Extract R2 key from a full R2 URL
 * @param url - The full R2 URL (e.g., https://bucket.r2.cloudflarestorage.com/card-images/tenant-id/filename.jpg)
 * @returns The R2 key (e.g., card-images/tenant-id/filename.jpg) or null if not a valid R2 URL
 */
export function extractR2KeyFromUrl(url: string): string | null {
  try {
    if (!url || typeof url !== 'string') {
      return null
    }

    // Check if it's an R2 URL
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    
    // Check if it's our R2 bucket hostname
    if (hostname.includes('r2.cloudflarestorage.com') || hostname.includes(R2_CONFIG.bucketName)) {
      // Extract the key from the pathname (remove leading slash)
      const key = urlObj.pathname.substring(1)
      return key || null
    }

    return null
  } catch (error) {
    console.warn('Failed to extract R2 key from URL:', url, error)
    return null
  }
}

/**
 * Delete an image from R2 using its full URL
 * @param imageUrl - The full R2 URL
 */
export async function deleteImageFromR2(imageUrl: string) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    console.warn('Invalid image URL provided for deletion:', imageUrl)
    return
  }

  const key = extractR2KeyFromUrl(imageUrl)
  if (!key) {
    console.warn('Could not extract R2 key from URL:', imageUrl)
    return
  }

  try {
    await deleteFromR2(key)
    console.log('📸 [R2 Cleanup] Successfully deleted image:', key)
  } catch (error) {
    console.error('📸 [R2 Cleanup] Failed to delete image:', key, error)
    // Don't throw error to avoid breaking the main flow
  }
}

export async function generatePresignedUrl(key: string, expiresIn = 3600) {
  if (!R2_CONFIG.isConfigured) {
    throw new Error('Cloudflare R2 is not configured')
  }

  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}