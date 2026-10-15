import type { ApiErrorBody, FieldError } from './types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  fieldError(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.message;
  }
}

export function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

/** Turns anything thrown into an ApiError so components handle one error type. */
export function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const message = err instanceof Error ? err.message : 'Unexpected error';
  return new ApiError(0, 'UNKNOWN', message);
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error) {
      const { code, message, details, requestId } = body.error;
      return new ApiError(res.status, code, message, details ?? [], requestId);
    }
  } catch {
    // Not JSON — fall through.
  }
  return new ApiError(res.status, 'HTTP_ERROR', `Request failed with status ${res.status}`);
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export interface HttpClient {
  json<T>(path: string, options?: RequestOptions): Promise<T>;
  blob(path: string, signal?: AbortSignal): Promise<Blob>;
}

/**
 * A client bound to one (mock) identity. The user id travels in the X-User-Id
 * header; swapping in a real auth token later changes only this function.
 */
export function createHttpClient(userId: string | null): HttpClient {
  async function send(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (userId) headers['X-User-Id'] = userId;

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body; // browser sets the multipart boundary
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload, signal });
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check that the API is running.');
    }
    if (!res.ok) throw await errorFromResponse(res);
    return res;
  }

  return {
    async json<T>(path: string, options?: RequestOptions) {
      const res = await send(path, options);
      return (await res.json()) as T;
    },
    async blob(path: string, signal?: AbortSignal) {
      const res = await send(path, { signal });
      return res.blob();
    },
  };
}
