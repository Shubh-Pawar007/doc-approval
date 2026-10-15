import { useState } from 'react';
import { normalizeError } from '../../api/client';
import type { DecisionInput } from '../../api/documents';
import type { DocumentDetail, DocumentSummary } from '../../api/types';
import { DocumentDetailPanel } from '../../components/DocumentDetailPanel';
import { DocumentList } from '../../components/DocumentList';
import { FilterBar, type StatusFilter } from '../../components/FilterBar';
import { useDocumentsApi } from '../../context/UserContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDocumentList } from '../../hooks/useDocumentList';
import { DecisionControls } from './DecisionControls';

function toSummary({ content: _content, ...summary }: DocumentDetail): DocumentSummary {
  return summary;
}

export function ReviewerView() {
  const api = useDocumentsApi();
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const list = useDocumentList(api, { status: status === 'all' ? undefined : status, q: q || undefined });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  /**
   * Optimistic: the row flips immediately, then we reconcile with the server.
   * On failure we roll back. On 409 (someone else decided first) the optimistic value
   * was wrong, so we also reload to show the real outcome.
   */
  async function decide(doc: DocumentDetail, input: DecisionInput, reload: () => void) {
    const previous = list.items.find((d) => d.id === doc.id);
    setNotice(null);
    list.updateItem(doc.id, (d) => ({ ...d, status: input.decision }));

    try {
      const updated = await api.decide(doc.id, input);
      list.updateItem(doc.id, () => toSummary(updated));
      setNotice({
        kind: 'success',
        text: `${updated.status === 'approved' ? 'Approved' : 'Rejected'} “${updated.title}”.`,
      });
      reload();
    } catch (err) {
      const apiError = normalizeError(err);
      if (previous) list.updateItem(doc.id, () => previous);
      if (apiError.status === 409) {
        setNotice({ kind: 'error', text: apiError.message });
        reload();
        list.refresh();
      }
      throw apiError; // DecisionControls shows it inline
    }
  }

  return (
    <div className={`workspace${selectedId ? ' workspace--with-detail' : ''}`}>
      <div className="workspace__main">
        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Review queue</h2>
            <button type="button" className="btn btn--quiet" onClick={list.refresh} disabled={list.loading}>
              {list.loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {notice && (
            <p className={`banner banner--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
              {notice.text}
            </p>
          )}
          <FilterBar status={status} onStatusChange={setStatus} search={search} onSearchChange={setSearch} />
          <DocumentList
            list={list}
            selectedId={selectedId}
            onSelect={setSelectedId}
            showSubmitter
            emptyMessage={
              status === 'pending' && !q ? 'The queue is clear. New submissions will show up here.' : 'No documents match these filters.'
            }
          />
        </section>
      </div>

      {selectedId && (
        <DocumentDetailPanel
          documentId={selectedId}
          onClose={() => setSelectedId(null)}
          renderActions={(doc, reload) =>
            doc.status === 'pending' ? (
              <DecisionControls key={doc.id} onDecide={(input) => decide(doc, input, reload)} />
            ) : null
          }
        />
      )}
    </div>
  );
}
