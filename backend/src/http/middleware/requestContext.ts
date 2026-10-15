import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (req, res, next) => {
  const id = req.header('x-request-id') || randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};

/** One structured log line per request. */
export function requestLogger(enabled: boolean): RequestHandler {
  return (req, res, next) => {
    if (!enabled) {
      next();
      return;
    }
    const started = Date.now();
    res.on('finish', () => {
      console.log(
        JSON.stringify({
          level: 'info',
          requestId: req.requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - started,
        }),
      );
    });
    next();
  };
}
