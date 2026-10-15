import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError, Errors, type ErrorCode, type ErrorDetail } from '../../domain/errors';

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.round(bytes / 1024)} KB`;
}

export const notFoundHandler: RequestHandler = () => {
  throw Errors.notFound('Route');
};

/**
 * Every error leaves the API in one shape:
 *   { "error": { "code", "message", "details"?, "requestId" } }
 * Unexpected errors are logged with the request id and never expose stack traces.
 */
export function errorHandler(options: { maxUploadBytes: number; log: boolean }): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const send = (status: number, code: ErrorCode, message: string, details?: ErrorDetail[]) => {
      res.status(status).json({
        error: { code, message, ...(details?.length ? { details } : {}), requestId: req.requestId },
      });
    };

    if (err instanceof AppError) {
      send(err.status, err.code, err.message, err.details);
      return;
    }
    if (err instanceof ZodError) {
      send(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        err.issues.map((issue) => ({ field: issue.path.join('.') || 'body', message: issue.message })),
      );
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        send(413, 'PAYLOAD_TOO_LARGE', `File exceeds the ${formatBytes(options.maxUploadBytes)} limit`, [
          { field: 'file', message: `Maximum size is ${formatBytes(options.maxUploadBytes)}` },
        ]);
        return;
      }
      send(400, 'VALIDATION_ERROR', err.message, [{ field: err.field ?? 'file', message: err.message }]);
      return;
    }

    const bodyParserError = err as { type?: string };
    if (bodyParserError?.type === 'entity.parse.failed') {
      send(400, 'INVALID_JSON', 'Request body is not valid JSON');
      return;
    }
    if (bodyParserError?.type === 'entity.too.large') {
      send(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
      return;
    }

    if (options.log) {
      const e = err as Error;
      console.error(JSON.stringify({ level: 'error', requestId: req.requestId, message: e?.message, stack: e?.stack }));
    }
    send(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
  };
}
