import multer from 'multer';
import { Request } from 'express';
import path from 'path';

// 40MB total email limit (including base64 overhead)
// Base64 encoding increases size by ~33%, so raw file limit is ~30MB to stay under 40MB after encoding
const MAX_TOTAL_RAW_SIZE = 30 * 1024 * 1024; // 30MB total raw payload
const MAX_RAW_FILE_SIZE = MAX_TOTAL_RAW_SIZE; // A single file can use the full raw budget
const MAX_TOTAL_SIZE = 40 * 1024 * 1024; // 40MB total (after base64 this is the hard ceiling)
const MAX_FILES = 10;

type AttachmentUploadRequest = Request & {
  emailAttachmentRawBytes?: number;
};

// Allowed MIME types for email attachments
// Note: HTML, SVG and XML types are excluded due to XSS/XXE security risks
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
  // Images (raster only - no SVG due to XSS risk)
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  // Other
  'application/json',
];

const EXTENSION_MIME_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.txt': ['text/plain'],
  '.text': ['text/plain'],
  '.csv': ['text/csv'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
  '.json': ['application/json'],
};

const BINARY_SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
  'application/pdf': (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (buffer) => {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  },
  'image/webp': (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  'application/zip': (buffer) => hasZipSignature(buffer),
  'application/x-zip-compressed': (buffer) => hasZipSignature(buffer),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (buffer) => hasZipSignature(buffer),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (buffer) => hasZipSignature(buffer),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': (buffer) => hasZipSignature(buffer),
  'application/msword': (buffer) => hasOleSignature(buffer),
  'application/vnd.ms-excel': (buffer) => hasOleSignature(buffer),
  'application/vnd.ms-powerpoint': (buffer) => hasOleSignature(buffer),
};

const BLOCKED_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.svg',
  '.xml',
  '.xhtml',
  '.js',
  '.mjs',
  '.cjs',
]);

const storage: multer.StorageEngine = {
  _handleFile(req: AttachmentUploadRequest, file, cb) {
    const chunks: Buffer[] = [];
    let fileSize = 0;
    let finished = false;

    const fail = (error: Error) => {
      if (finished) return;
      finished = true;
      file.stream.resume();
      cb(error);
    };

    file.stream.on('data', (chunk: Buffer) => {
      if (finished) return;

      fileSize += chunk.length;
      req.emailAttachmentRawBytes = (req.emailAttachmentRawBytes || 0) + chunk.length;

      if (fileSize > MAX_RAW_FILE_SIZE) {
        fail(new Error('Individual file size too large. Maximum size per file is 30MB.'));
        return;
      }

      if (req.emailAttachmentRawBytes > MAX_TOTAL_RAW_SIZE) {
        fail(new Error('Total attachment size exceeds the 30MB raw upload limit. Please reduce attachment sizes.'));
        return;
      }

      chunks.push(chunk);
    });

    file.stream.on('error', fail);
    file.stream.on('end', () => {
      if (finished) return;
      finished = true;
      cb(null, {
        buffer: Buffer.concat(chunks, fileSize),
        size: fileSize,
      });
    });
  },
  _removeFile(req: AttachmentUploadRequest, file: Express.Multer.File, cb) {
    if (typeof file.size === 'number') {
      req.emailAttachmentRawBytes = Math.max(0, (req.emailAttachmentRawBytes || 0) - file.size);
    }
    delete (file as any).buffer;
    cb(null);
  },
};

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error(`File type "${file.mimetype}" is not allowed. Supported types: PDF, Word, Excel, PowerPoint, images, text (excluding HTML), CSV, ZIP.`));
    return;
  }
  cb(null, true);
};

function hasZipSignature(buffer: Buffer): boolean {
  const header = buffer.subarray(0, 4);
  return (
    header.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
    header.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
    header.equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
  );
}

function hasOleSignature(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
}

function looksLikeHtmlSvgOrXml(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('utf8').trimStart().toLowerCase();
  return (
    sample.startsWith('<!doctype html') ||
    sample.startsWith('<html') ||
    sample.startsWith('<svg') ||
    sample.startsWith('<?xml') ||
    sample.includes('<script')
  );
}

function extensionFor(file: Express.Multer.File): string {
  const safeBaseName = path.basename(file.originalname || '');
  return path.extname(safeBaseName).toLowerCase();
}

function sanitizeAttachmentFilename(filename: string): string {
  const baseName = path.basename(filename || 'attachment');
  const withoutControls = baseName.replace(/[\x00-\x1F\x7F]/g, '');
  const sanitized = withoutControls
    .replace(/[^\w .()-]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);
  return sanitized || 'attachment';
}

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

export function validateAttachmentContent(files: Express.Multer.File[]): { valid: boolean; error?: string } {
  for (const file of files || []) {
    const ext = extensionFor(file);
    const filename = sanitizeAttachmentFilename(file.originalname);

    if (!ext || BLOCKED_EXTENSIONS.has(ext)) {
      return { valid: false, error: `Attachment "${filename}" has a file extension that is not allowed.` };
    }

    const allowedMimeTypes = EXTENSION_MIME_TYPES[ext];
    if (!allowedMimeTypes || !allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: `Attachment "${filename}" does not match an allowed file type.` };
    }

    if (looksLikeHtmlSvgOrXml(file.buffer)) {
      return { valid: false, error: `Attachment "${filename}" appears to contain HTML, SVG, XML, or script content.` };
    }

    const signatureValidator = BINARY_SIGNATURES[file.mimetype];
    if (signatureValidator && !signatureValidator(file.buffer)) {
      return { valid: false, error: `Attachment "${filename}" content does not match its declared file type.` };
    }

    if (file.mimetype === 'application/json') {
      try {
        JSON.parse(file.buffer.toString('utf8'));
      } catch {
        return { valid: false, error: `Attachment "${filename}" is not valid JSON.` };
      }
    }
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
    filename: sanitizeAttachmentFilename(file.originalname),
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
