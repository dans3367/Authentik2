import { uploadToR2, R2_CONFIG, extractR2KeyFromUrl } from '../config/r2';
import crypto from 'crypto';

const DOWNLOAD_TIMEOUT_MS = 10_000; // 10s per image
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES = 50; // Safety cap per newsletter

// MIME type → file extension mapping
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/**
 * Check if a URL is already hosted on our R2 storage
 */
function isR2Url(url: string): boolean {
  if (!url) return false;
  return extractR2KeyFromUrl(url) !== null || url.startsWith(R2_CONFIG.publicUrl);
}

/**
 * Check if a URL is a data URI (already inline)
 */
function isDataUri(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Download an image from a URL with timeout and size limits
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Authentik-Newsletter/1.0' },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[ImageRehost] Failed to download ${url}: HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || '';
    if (!contentType.startsWith('image/')) {
      console.warn(`[ImageRehost] Skipping ${url}: not an image (${contentType})`);
      return null;
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_IMAGE_SIZE) {
      console.warn(`[ImageRehost] Skipping ${url}: too large (${(contentLength / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_IMAGE_SIZE) {
      console.warn(`[ImageRehost] Skipping ${url}: downloaded size exceeds limit (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }

    return { buffer, contentType };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[ImageRehost] Timeout downloading ${url}`);
    } else {
      console.warn(`[ImageRehost] Error downloading ${url}:`, err.message);
    }
    return null;
  }
}

/**
 * Upload an image buffer to R2 and return the public URL
 */
async function rehostImage(
  buffer: Buffer,
  contentType: string,
  tenantId: string,
  newsletterId: string
): Promise<string> {
  const ext = MIME_TO_EXT[contentType] || 'bin';
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);
  const key = `newsletter-assets/${tenantId}/${newsletterId}/${hash}.${ext}`;

  return uploadToR2(key, buffer, contentType);
}

/**
 * Extract all image source URLs from HTML content.
 * Handles: <img src="...">, background-image: url(...), background: url(...)
 */
function extractImageUrls(html: string): string[] {
  const urls = new Set<string>();

  // <img src="..."> and <img src='...'>
  const imgSrcRegex = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = imgSrcRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  // background-image: url(...) and background: url(...)
  const bgRegex = /background(?:-image)?\s*:\s*[^;]*url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  // <td background="..."> (email HTML pattern)
  const tdBgRegex = /<(?:td|th|table)[^>]+background\s*=\s*["']([^"']+)["']/gi;
  while ((match = tdBgRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  return Array.from(urls);
}

/**
 * Rehost all external images in newsletter HTML to Cloudflare R2.
 *
 * - Skips images already on R2
 * - Skips data URIs
 * - Downloads external images and uploads to R2
 * - Replaces URLs in the HTML with R2 URLs
 * - Graceful: if an image fails to download/upload, the original URL is kept
 *
 * @returns The HTML with rewritten image URLs and a summary of what was done
 */
export async function rehostNewsletterImages(
  html: string,
  tenantId: string,
  newsletterId: string
): Promise<{ html: string; rehosted: number; skipped: number; failed: number }> {
  if (!R2_CONFIG.isConfigured) {
    console.warn('[ImageRehost] R2 not configured, skipping image rehosting');
    return { html, rehosted: 0, skipped: 0, failed: 0 };
  }

  const imageUrls = extractImageUrls(html);
  let rehosted = 0;
  let skipped = 0;
  let failed = 0;

  // Filter to only external URLs that need rehosting
  const externalUrls = imageUrls.filter(url => {
    if (isDataUri(url) || isR2Url(url)) {
      skipped++;
      return false;
    }
    // Must be absolute HTTP(S) URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      skipped++;
      return false;
    }
    return true;
  });

  if (externalUrls.length === 0) {
    return { html, rehosted: 0, skipped, failed: 0 };
  }

  // Cap the number of images to process
  const toProcess = externalUrls.slice(0, MAX_IMAGES);
  if (externalUrls.length > MAX_IMAGES) {
    console.warn(`[ImageRehost] Newsletter has ${externalUrls.length} external images, capping at ${MAX_IMAGES}`);
    skipped += externalUrls.length - MAX_IMAGES;
  }

  console.log(`[ImageRehost] Processing ${toProcess.length} external image(s) for newsletter ${newsletterId}`);

  // Deduplicate: if the same URL appears multiple times, only download once
  const urlToR2: Map<string, string> = new Map();

  // Process images concurrently (batch of 5 at a time to avoid overwhelming)
  const CONCURRENCY = 5;
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const downloaded = await downloadImage(url);
        if (!downloaded) {
          failed++;
          return;
        }

        try {
          const r2Url = await rehostImage(downloaded.buffer, downloaded.contentType, tenantId, newsletterId);
          urlToR2.set(url, r2Url);
          rehosted++;
        } catch (uploadErr: any) {
          console.warn(`[ImageRehost] Failed to upload ${url} to R2:`, uploadErr.message);
          failed++;
        }
      })
    );
  }

  // Replace URLs in the HTML
  let updatedHtml = html;
  urlToR2.forEach((r2Url, originalUrl) => {
    // Replace all occurrences of this URL (it may appear in img src, background, etc.)
    updatedHtml = updatedHtml.split(originalUrl).join(r2Url);
  });

  console.log(`[ImageRehost] Done: ${rehosted} rehosted, ${skipped} skipped, ${failed} failed`);

  return { html: updatedHtml, rehosted, skipped, failed };
}
