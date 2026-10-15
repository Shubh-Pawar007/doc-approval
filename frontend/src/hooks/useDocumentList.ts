import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError, normalizeError, type ApiError } from '../api/client';
import type { DocumentsApi } from '../api/documents';
import type { DocumentStatus, DocumentSummary } from '../api/types';

export const PAGE_SIZE = 10;

export interface ListFilters {
  status?: DocumentStatus;
  q?: string;
}

export interface DocumentListState {
  items: DocumentSummary[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  loadMore: () => Promise<void>;
  refresh: () => void;
  /** Local patch, used for optimistic updates and their rollback. */
  updateItem: (id: string, update: (doc: DocumentSummary) => DocumentSummary) => void;
}

/**
 * Server-side filtered, cursor-paginated list.
 * Every new query bumps a sequence number and aborts the previous request, so a slow
 * response for an old filter can never overwrite the results of a newer one.
 */
export function useDocumentList(api: Pick<DocumentsApi, 'list'>, { status, q }: ListFilters): DocumentListState {
  const [items, setItems] = useState<DocumentSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const mySeq = ++seq.current;
    const controller = new AbortController();
    setLoading(true);
    setLoadingMore(false);
    setError(null);

    api
      .list({ status, q, limit: PAGE_SIZE }, controller.signal)
      .then((page) => {
        if (mySeq !== seq.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err) => {
        if (isAbortError(err) || mySeq !== seq.current) return;
        setError(normalizeError(err));
      })
      .finally(() => {
        if (mySeq === seq.current) setLoading(false);
      });

    return () => controller.abort();
  }, [api, status, q, reloadToken]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const mySeq = seq.current;
    setLoadingMore(true);
    try {
      const page = await api.list({ status, q, limit: PAGE_SIZE, cursor: nextCursor });
      if (mySeq !== seq.current) return;
      setItems((prev) => [...prev, ...page.items.filter((d) => !prev.some((p) => p.id === d.id))]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (mySeq === seq.current) setError(normalizeError(err));
    } finally {
      if (mySeq === seq.current) setLoadingMore(false);
    }
  }, [api, status, q, nextCursor, loadingMore]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  const updateItem = useCallback((id: string, update: (doc: DocumentSummary) => DocumentSummary) => {
    setItems((prev) => prev.map((doc) => (doc.id === id ? update(doc) : doc)));
  }, []);

  return { items, nextCursor, loading, loadingMore, error, loadMore, refresh, updateItem };
}
