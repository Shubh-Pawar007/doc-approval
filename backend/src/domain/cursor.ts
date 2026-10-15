import { Errors } from './errors';

export interface DocumentCursor {
  createdAt: string;
  id: string;
}

/**
 * Opaque keyset cursor: (createdAt, id) of the last item on the page.
 * Unlike offsets, it stays stable when new documents arrive while someone is paging.
 */
export function encodeCursor(cursor: DocumentCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt, cursor.id]), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): DocumentCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      !Number.isNaN(Date.parse(parsed[0]))
    ) {
      return { createdAt: parsed[0], id: parsed[1] };
    }
  } catch {
    // fall through to the validation error below
  }
  throw Errors.validation('Invalid cursor', [{ field: 'cursor', message: 'Cursor is malformed or expired' }]);
}
