import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
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
    
    // Check if it's our R2 bucket hostname or configured public URL
    const publicUrlHostname = new URL(R2_CONFIG.publicUrl).hostname
    if (hostname.includes('r2.cloudflarestorage.com') || hostname.includes(R2_CONFIG.bucketName) || hostname === publicUrlHostname) {
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

/**
 * Delete every object in the R2 bucket matching a given prefix.
 * Paginates via ListObjectsV2Command and batches DeleteObjectsCommand in chunks of 1000.
 * Best-effort: logs failures and returns counts instead of throwing, so callers
 * (like account deletion) can continue even if R2 is partially unreachable.
 *
 * @param prefix - The R2 key prefix to delete (e.g., "card-images/tenant-123/")
 * @returns { deleted, errors } counts
 */
export async function deleteR2Prefix(prefix: string): Promise<{ deleted: number; errors: number }> {
  if (!R2_CONFIG.isConfigured) {
    console.warn('[R2 Cleanup] Skipping deleteR2Prefix — R2 is not configured')
    return { deleted: 0, errors: 0 }
  }

  if (!prefix || typeof prefix !== 'string') {
    console.warn('[R2 Cleanup] Invalid prefix provided to deleteR2Prefix:', prefix)
    return { deleted: 0, errors: 0 }
  }

  let deleted = 0
  let errors = 0
  let continuationToken: string | undefined = undefined

  try {
    do {
      const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: R2_CONFIG.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })

      const listResponse = await r2Client.send(listCommand)
      const objects = listResponse.Contents || []

      if (objects.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: R2_CONFIG.bucketName,
          Delete: {
            Objects: objects
              .filter((obj) => !!obj.Key)
              .map((obj) => ({ Key: obj.Key as string })),
            Quiet: true,
          },
        })

        try {
          const deleteResponse = await r2Client.send(deleteCommand)
          deleted += objects.length - (deleteResponse.Errors?.length || 0)
          errors += deleteResponse.Errors?.length || 0
          if (deleteResponse.Errors?.length) {
            console.warn(
              `[R2 Cleanup] ${deleteResponse.Errors.length} errors while deleting prefix ${prefix}:`,
              deleteResponse.Errors.slice(0, 5)
            )
          }
        } catch (err) {
          console.error(`[R2 Cleanup] Batch delete failed for prefix ${prefix}:`, err)
          errors += objects.length
        }
      }

      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined
    } while (continuationToken)

    console.log(`[R2 Cleanup] Prefix "${prefix}" — deleted: ${deleted}, errors: ${errors}`)
    return { deleted, errors }
  } catch (err) {
    console.error(`[R2 Cleanup] Failed to list objects for prefix ${prefix}:`, err)
    return { deleted, errors: errors + 1 }
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