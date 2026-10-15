import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentPage, DocumentSummary } from '../api/types';
import { useDocumentList } from './useDocumentList';

function doc(id: string, title = id): DocumentSummary {
  return {
    id,
    title,
    contentPreview: null,
    status: 'pending',
    submitter: { id: 'u-alice', name: 'Alice' },
    file: null,
    decision: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('useDocumentList', () => {
  it('ignores an out-of-order response for an older query', async () => {
    const slow = deferred<DocumentPage>();
    const list = vi
      .fn()
      .mockReturnValueOnce(slow.promise) // q = "old"
      .mockResolvedValueOnce({ items: [doc('new')], nextCursor: null }); // q = "new"
    const api = { list };

    const { result, rerender } = renderHook(({ q }) => useDocumentList(api, { q }), { initialProps: { q: 'old' } });
    rerender({ q: 'new' });
    await waitFor(() => expect(result.current.items.map((d) => d.id)).toEqual(['new']));

    await act(async () => slow.resolve({ items: [doc('stale')], nextCursor: null }));
    expect(result.current.items.map((d) => d.id)).toEqual(['new']);
  });

  it('appends the next page and stops when there is no cursor', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [doc('a'), doc('b')], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [doc('c')], nextCursor: null });
    const api = { list }; // stable reference, like the memoised api from context
    const { result } = renderHook(() => useDocumentList(api, {}));

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await act(() => result.current.loadMore());
    expect(result.current.items.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.nextCursor).toBeNull();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'c1' }));
  });

  it('supports local optimistic updates and rollback', async () => {
    const api = { list: vi.fn().mockResolvedValue({ items: [doc('a')], nextCursor: null }) };
    const { result } = renderHook(() => useDocumentList(api, {}));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    const original = result.current.items[0];
    act(() => result.current.updateItem('a', (d) => ({ ...d, status: 'approved' })));
    expect(result.current.items[0].status).toBe('approved');
    act(() => result.current.updateItem('a', () => original));
    expect(result.current.items[0].status).toBe('pending');
  });
});
