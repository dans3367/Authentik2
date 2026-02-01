import sharp from 'sharp'

export interface ImageOptimizationOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

export interface OptimizedImage {
  buffer: Buffer
  mimetype: string
  width: number
  height: number
  originalSize: number
  optimizedSize: number
}

const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  quality: 80,
  format: 'webp'
}

const AVATAR_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 80,
  format: 'webp'
}

/**
 * Optimize an image buffer using sharp (libvips)
 * Resizes and compresses images for efficient storage
 */
export async function optimizeImage(
  buffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const originalSize = buffer.length

  let pipeline = sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation

  // Resize only if dimensions are specified
  if (opts.maxWidth || opts.maxHeight) {
    pipeline = pipeline.resize(opts.maxWidth, opts.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    })
  }

  // Convert to target format with quality settings
  switch (opts.format) {
    case 'webp':
      pipeline = pipeline.webp({ quality: opts.quality })
      break
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: opts.quality, mozjpeg: true })
      break
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9 })
      break
  }

  const { data: optimizedBuffer, info } = await pipeline.toBuffer({ resolveWithObject: true })

  return {
    buffer: optimizedBuffer,
    mimetype: `image/${opts.format}`,
    width: info.width,
    height: info.height,
    originalSize,
    optimizedSize: optimizedBuffer.length
  }
}

/**
 * Optimize avatar image with preset settings
 * Returns WebP format at 400x400 max dimensions
 */
export async function optimizeAvatar(buffer: Buffer): Promise<OptimizedImage> {
  return optimizeImage(buffer, AVATAR_OPTIONS)
}
