import type { DocumentListState } from '../hooks/useDocumentList';
import { formatDateTime } from '../utils/format';
import { ErrorBanner } from './ErrorBanner';
import { Loading } from './Loading';
import { StatusBadge } from './StatusBadge';

interface Props {
  list: DocumentListState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showSubmitter: boolean;
  emptyMessage: string;
}

export function DocumentList({ list, selectedId, onSelect, showSubmitter, emptyMessage }: Props) {
  const { items, loading, loadingMore, error, nextCursor, loadMore, refresh } = list;

  if (error && items.length === 0) return <ErrorBanner error={error} onRetry={refresh} />;
  if (loading && items.length === 0) return <Loading label="Loading documents" />;
  if (items.length === 0) return <p className="empty">{emptyMessage}</p>;

  return (
    <>
      {error && <ErrorBanner error={error} onRetry={refresh} />}
      <ul className={`doc-list${loading ? ' doc-list--refreshing' : ''}`} aria-busy={loading}>
        {items.map((doc) => (
          <li key={doc.id}>
            <button
              type="button"
              className="doc-row"
              aria-current={doc.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(doc.id)}
            >
              <span className="doc-row__main">
                <span className="doc-row__title">{doc.title}</span>
                <span className="doc-row__meta">
                  {showSubmitter && <span>{doc.submitter.name}</span>}
                  <time dateTime={doc.createdAt}>{formatDateTime(doc.createdAt)}</time>
                  {doc.file && <span>Has attachment</span>}
                </span>
                {doc.status === 'rejected' && doc.decision?.reason && (
                  <span className="doc-row__reason">{doc.decision.reason}</span>
                )}
              </span>
              <StatusBadge status={doc.status} />
            </button>
          </li>
        ))}
      </ul>
      {nextCursor && (
        <button type="button" className="btn btn--quiet btn--block" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Show more'}
        </button>
      )}
    </>
  );
}
