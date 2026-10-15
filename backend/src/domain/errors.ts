export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  field: string;
  message: string;
}

/** An expected, client-facing error. The HTTP layer maps it straight to a response. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (message: string, details?: ErrorDetail[]) =>
    new AppError(400, 'VALIDATION_ERROR', message, details),
  unauthenticated: (message = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', message),
  forbidden: (message = 'You do not have permission to do this') => new AppError(403, 'FORBIDDEN', message),
  notFound: (resource = 'Resource') => new AppError(404, 'NOT_FOUND', `${resource} not found`),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  payloadTooLarge: (message: string) => new AppError(413, 'PAYLOAD_TOO_LARGE', message),
};
