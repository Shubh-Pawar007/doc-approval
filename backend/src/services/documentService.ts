import { decodeCursor, encodeCursor } from '../domain/cursor';
import { Errors } from '../domain/errors';
import { nextStatus } from '../domain/stateMachine';
import type { DecisionType, Document, DocumentEvent, DocumentStatus, StoredFile, User } from '../domain/types';
import type { DocumentRepository } from '../repositories/documentRepository';

export interface SubmitDocumentInput {
  title: string;
  content?: string | null;
  file?: StoredFile | null;
}

export interface ListDocumentsInput {
  status?: DocumentStatus;
  q?: string;
  limit: number;
  cursor?: string;
}

export interface DocumentListResult {
  items: Document[];
  nextCursor: string | null;
}

export interface DecideInput {
  decision: DecisionType;
  reason?: string | null;
}

function canView(user: User, doc: Document): boolean {
  return user.role === 'reviewer' || doc.submitterId === user.id;
}

/**
 * Business rules live here: who may do what, and which state changes are allowed.
 * The HTTP layer validates shapes; this layer re-checks the rules that matter so
 * they hold no matter how the service is called.
 */
export class DocumentService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async submit(user: User, input: SubmitDocumentInput): Promise<Document> {
    if (user.role !== 'submitter') throw Errors.forbidden('Only submitters can submit documents');

    const title = input.title.trim();
    const content = input.content?.trim() || null;
    const file = input.file ?? null;

    if (!title) {
      throw Errors.validation('Title is required', [{ field: 'title', message: 'Title is required' }]);
    }
    if (!content && !file) {
      throw Errors.validation('Provide document content or attach a file', [
        { field: 'content', message: 'Add some content or attach a file' },
      ]);
    }

    return this.documents.create({
      title,
      content,
      file,
      submitterId: user.id,
      createdAt: this.now().toISOString(),
    });
  }

  /** Submitters only ever see their own documents; reviewers see everything. */
  async list(user: User, input: ListDocumentsInput): Promise<DocumentListResult> {
    const after = input.cursor ? decodeCursor(input.cursor) : undefined;
    const page = await this.documents.list({
      submitterId: user.role === 'submitter' ? user.id : undefined,
      status: input.status,
      q: input.q,
      limit: input.limit,
      after,
    });
    const last = page.items.at(-1);
    return {
      items: page.items,
      nextCursor: page.hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  /** Someone else's document returns 404, not 403, so ids do not leak. */
  async get(user: User, id: string): Promise<Document> {
    const doc = await this.documents.findById(id);
    if (!doc || !canView(user, doc)) throw Errors.notFound('Document');
    return doc;
  }

  async decide(user: User, id: string, input: DecideInput): Promise<Document> {
    if (user.role !== 'reviewer') throw Errors.forbidden('Only reviewers can approve or reject documents');

    const reason = input.reason?.trim() || null;
    if (input.decision === 'rejected' && !reason) {
      throw Errors.validation('A reason is required when rejecting a document', [
        { field: 'reason', message: 'A reason is required when rejecting a document' },
      ]);
    }

    const doc = await this.documents.findById(id);
    if (!doc) throw Errors.notFound('Document');
    if (doc.submitterId === user.id) throw Errors.forbidden('You cannot review your own document');

    const to = nextStatus(doc.status, input.decision === 'approved' ? 'approve' : 'reject');
    if (!to) throw Errors.conflict(`This document has already been ${doc.status}`);

    const updated = await this.documents.applyDecision(id, {
      from: doc.status,
      to,
      reviewerId: user.id,
      decision: input.decision,
      reason,
      decidedAt: this.now().toISOString(),
    });
    // Lost the race: another reviewer decided between our read and our write.
    if (!updated) throw Errors.conflict('Another reviewer decided this document first. Refresh to see the result.');
    return updated;
  }

  async history(user: User, id: string): Promise<DocumentEvent[]> {
    await this.get(user, id); // same visibility rules as the document itself
    return this.documents.listEvents(id);
  }
}
