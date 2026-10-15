import multer from 'multer';
import type { RequestHandler } from 'express';
import { Errors } from '../domain/errors';

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'image/png',
  'image/jpeg',
]);

/**
 * Accepts at most one file in the `file` field, kept in memory (mocked storage).
 * In production this would stream to object storage (S3 / GCS) instead.
 */
export function createUploadMiddleware(maxBytes: number): RequestHandler {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 10 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(
        Errors.validation(`Unsupported file type: ${file.mimetype || 'unknown'}`, [
          { field: 'file', message: 'Allowed types: PDF, DOCX, TXT, Markdown, PNG, JPEG' },
        ]),
      );
    },
  }).single('file');
}
