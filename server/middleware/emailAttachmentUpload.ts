import multer from 'multer';
import { Request } from 'express';

// 40MB total email limit (including base64 overhead)
// Base64 encoding increases size by ~33%, so raw file limit is ~30MB to stay under 40MB after encoding
const MAX_RAW_FILE_SIZE = 30 * 1024 * 1024; // 30MB per file
const MAX_TOTAL_SIZE = 40 * 1024 * 1024; // 40MB total (after base64 this is the hard ceiling)
const MAX_FILES = 10;

// Allowed MIME types for email attachments
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  'text/html',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  // Other
  'application/json',
  'application/xml',
];

const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error(`File type "${file.mimetype}" is not allowed. Supported types: PDF, Word, Excel, PowerPoint, images, text, CSV, ZIP.`));
    return;
  }
  cb(null, true);
};

// Multer instance for email attachments
export const emailAttachmentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_RAW_FILE_SIZE,
    files: MAX_FILES,
  },
}).array('attachments', MAX_FILES);

/**
 * Validate total attachment size including base64 overhead.
 * Base64 encoding increases size by ~33%.
 * Returns { valid: true } or { valid: false, error: string }
 */
export function validateAttachmentSize(files: Express.Multer.File[]): { valid: boolean; error?: string } {
  if (!files || files.length === 0) return { valid: true };

  const totalRawSize = files.reduce((sum, f) => sum + f.size, 0);
  // Base64 overhead: ceil(n/3)*4
  const estimatedBase64Size = Math.ceil(totalRawSize / 3) * 4;

  if (estimatedBase64Size > MAX_TOTAL_SIZE) {
    const totalMB = (estimatedBase64Size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Total attachment size after encoding (~${totalMB}MB) exceeds the 40MB email limit. Please reduce attachment sizes.`,
    };
  }

  return { valid: true };
}

/**
 * Convert multer files to base64 attachment objects for Resend/Trigger.dev
 */
export function filesToBase64Attachments(files: Express.Multer.File[]): Array<{
  filename: string;
  content: string;
  contentType: string;
}> {
  if (!files || files.length === 0) return [];

  return files.map((file) => ({
    filename: file.originalname,
    content: file.buffer.toString('base64'),
    contentType: file.mimetype,
  }));
}

export const handleEmailAttachmentError = (error: any): string => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return 'Individual file size too large. Maximum size per file is 30MB.';
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return `Too many files. Maximum is ${MAX_FILES} attachments.`;
    }
    return error.message;
  }
  return error?.message || 'Attachment upload failed';
};
