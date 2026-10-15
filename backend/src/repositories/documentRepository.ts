import type { DocumentCursor } from '../domain/cursor';
import type { DecisionType, Document, DocumentEvent, DocumentStatus, StoredFile } from '../domain/types';

export interface NewDocumentInput {
  title: string;
  content: string | null;
  file: StoredFile | null;
  submitterId: string;
  createdAt: string;
}

export interface ListDocumentsFilter {
  /** When set, only this submitter's documents are returned. */
  submitterId?: string;
  status?: DocumentStatus;
  /** Case-insensitive substring match on title. */
  q?: string;
  limit: number;
  /** Return items strictly after this cursor (newest-first order). */
  after?: DocumentCursor;
}

export interface DocumentPage {
  items: Document[];
  hasMore: boolean;
}

export interface ApplyDecisionInput {
  /** Compare-and-set guard: the write only happens if the status is still `from`. */
  from: DocumentStatus;
  to: DocumentStatus;
  reviewerId: string;
  decision: DecisionType;
  reason: string | null;
  decidedAt: string;
}

/**
 * Storage boundary. Routes and services never touch storage directly, so swapping
 * the in-memory store for Postgres means writing one new class that passes
 * the same contract tests (see tests/documentRepository.contract.test.ts).
 */
export interface DocumentRepository {
  /** Creates the document and its "submitted" event together. */
  create(input: NewDocumentInput): Promise<Document>;
  findById(id: string): Promise<Document | null>;
  list(filter: ListDocumentsFilter): Promise<DocumentPage>;
  /**
   * Atomically moves a document from `input.from` to `input.to` and appends the
   * matching audit event. Returns null when the precondition failed (the document
   * is missing or someone else already changed its status).
   *
   * Postgres equivalent:
   *   UPDATE documents SET status = $to, ... WHERE id = $id AND status = $from RETURNING *;
   *   -- 0 rows → return null; same transaction inserts into document_events.
   */
  applyDecision(id: string, input: ApplyDecisionInput): Promise<Document | null>;
  /** Events for one document, oldest first. */
  listEvents(documentId: string): Promise<DocumentEvent[]>;
}
