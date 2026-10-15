import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { isAbortError, normalizeError, type ApiError } from '../api/client';
import type { DocumentDetail, DocumentEvent } from '../api/types';
import { useDocumentsApi } from '../context/UserContext';
import { formatBytes, formatDateTime } from '../utils/format';
import { ErrorBanner } from './ErrorBanner';
import { HistoryTimeline } from './HistoryTimeline';
import { Loading } from './Loading';
import { StatusBadge } from './StatusBadge';

interface Props {
  documentId: string;
  onClose: () => void;
  /** Role-specific actions (the reviewer's approve / reject). */
  renderActions?: (doc: DocumentDetail, reload: () => void) => ReactNode;
}

export function DocumentDetailPanel({ documentId, onClose, renderActions }: Props) {
  const api = useDocumentsApi();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [events, setEvents] = useState<DocumentEvent[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([api.get(documentId, controller.signal), api.history(documentId, controller.signal)])
      .then(([detail, history]) => {
        if (controller.signal.aborted) return;
        setDoc(detail);
        setEvents(history);
      })
      .catch((err) => {
        if (!isAbortError(err)) setError(normalizeError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, documentId, reloadToken]);

  async function download() {
    if (!doc?.file) return;
    setDownloadError(null);
    try {
      await api.downloadFile(doc.id, doc.file.name);
    } catch (err) {
      setDownloadError(normalizeError(err).message);
    }
  }

  const current = doc?.id === documentId ? doc : null;

  return (
    <aside className="detail" aria-label="Document details">
      <div className="detail__bar">
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Close
        </button>
      </div>

      {error && <ErrorBanner error={error} onRetry={reload} />}
      {!current && loading && <Loading label="Opening document" />}

      {current && (
        <article className={loading ? 'is-refreshing' : undefined}>
          <header className="detail__head">
            <h2 className="detail__title">{current.title}</h2>
            <StatusBadge status={current.status} stamp />
          </header>
          <p className="detail__meta">
            Submitted by {current.submitter.name} on {formatDateTime(current.createdAt)}
          </p>

          {current.decision && (
            <section className={`verdict verdict--${current.decision.decision}`}>
              <p>
                {current.decision.decision === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                {current.decision.reviewer.name} on {formatDateTime(current.decision.decidedAt)}
              </p>
              {current.decision.reason && <blockquote>{current.decision.reason}</blockquote>}
            </section>
          )}

          {current.content && <div className="detail__content">{current.content}</div>}

          {current.file && (
            <div className="attachment">
              <span>
                {current.file.name} <span className="muted">({formatBytes(current.file.size)})</span>
              </span>
              <button type="button" className="btn btn--quiet" onClick={download}>
                Download
              </button>
              {downloadError && <p className="field-error" role="alert">{downloadError}</p>}
            </div>
          )}

          {renderActions?.(current, reload)}

          <h3 className="detail__subhead">History</h3>
          <HistoryTimeline events={events} />
        </article>
      )}
    </aside>
  );
}
