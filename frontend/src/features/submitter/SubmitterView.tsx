import { useState } from 'react';
import type { CreateDocumentInput } from '../../api/documents';
import { DocumentDetailPanel } from '../../components/DocumentDetailPanel';
import { DocumentList } from '../../components/DocumentList';
import { FilterBar, type StatusFilter } from '../../components/FilterBar';
import { useDocumentsApi } from '../../context/UserContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDocumentList } from '../../hooks/useDocumentList';
import { SubmitDocumentForm } from './SubmitDocumentForm';

export function SubmitterView() {
  const api = useDocumentsApi();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const list = useDocumentList(api, { status: status === 'all' ? undefined : status, q: q || undefined });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(input: CreateDocumentInput) {
    setNotice(null);
    const doc = await api.create(input);
    setNotice(`Submitted “${doc.title}”. It is now waiting for a reviewer.`);
    list.refresh();
    setSelectedId(doc.id);
  }

  return (
    <div className={`workspace${selectedId ? ' workspace--with-detail' : ''}`}>
      <div className="workspace__main">
        <section className="panel">
          <h2 className="panel__title">New submission</h2>
          <SubmitDocumentForm onSubmit={handleSubmit} />
          {notice && <p className="banner banner--success" role="status">{notice}</p>}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">My submissions</h2>
            <button type="button" className="btn btn--quiet" onClick={list.refresh} disabled={list.loading}>
              {list.loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <FilterBar status={status} onStatusChange={setStatus} search={search} onSearchChange={setSearch} />
          <DocumentList
            list={list}
            selectedId={selectedId}
            onSelect={setSelectedId}
            showSubmitter={false}
            emptyMessage={
              status === 'all' && !q
                ? 'Nothing submitted yet. Use the form above to send your first document for review.'
                : 'No submissions match these filters.'
            }
          />
        </section>
      </div>

      {selectedId && <DocumentDetailPanel documentId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
