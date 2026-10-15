import { randomUUID } from 'node:crypto';
import type { DocumentCursor } from '../domain/cursor';
import type { Document, DocumentEvent } from '../domain/types';
import type {
  ApplyDecisionInput,
  DocumentPage,
  DocumentRepository,
  ListDocumentsFilter,
  NewDocumentInput,
} from './documentRepository';

/** Newest first; id breaks ties so the order is total and cursors are stable. */
function compareNewestFirst(a: Document, b: Document): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

function comesAfter(doc: Document, cursor: DocumentCursor): boolean {
  return doc.createdAt < cursor.createdAt || (doc.createdAt === cursor.createdAt && doc.id < cursor.id);
}

/** Callers get copies so they cannot mutate stored state by accident. */
function copy(doc: Document): Document {
  return { ...doc, decision: doc.decision ? { ...doc.decision } : null };
}

export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, Document>();
  private readonly events: DocumentEvent[] = [];
  private eventSeq = 0;

  constructor(private readonly newId: () => string = randomUUID) {}

  async create(input: NewDocumentInput): Promise<Document> {
    const doc: Document = {
      id: this.newId(),
      title: input.title,
      content: input.content,
      file: input.file,
      submitterId: input.submitterId,
      status: 'pending',
      decision: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
    this.documents.set(doc.id, doc);
    this.appendEvent({
      documentId: doc.id,
      actorId: input.submitterId,
      type: 'submitted',
      reason: null,
      at: input.createdAt,
    });
    return copy(doc);
  }

  async findById(id: string): Promise<Document | null> {
    const doc = this.documents.get(id);
    return doc ? copy(doc) : null;
  }

  async list({ submitterId, status, q, limit, after }: ListDocumentsFilter): Promise<DocumentPage> {
    const needle = q?.trim().toLowerCase();
    const matches = [...this.documents.values()]
      .filter((d) => !submitterId || d.submitterId === submitterId)
      .filter((d) => !status || d.status === status)
      .filter((d) => !needle || d.title.toLowerCase().includes(needle))
      .sort(compareNewestFirst)
      .filter((d) => !after || comesAfter(d, after));

    return {
      items: matches.slice(0, limit).map(copy),
      hasMore: matches.length > limit,
    };
  }

  async applyDecision(id: string, input: ApplyDecisionInput): Promise<Document | null> {
    // Check-then-set with no `await` in between. Node runs this synchronously on one
    // thread, so two concurrent requests cannot both pass the check. This guarantee
    // disappears with a real database or several instances — there the conditional
    // UPDATE (see the interface docs) gives the same compare-and-set semantics.
    const current = this.documents.get(id);
    if (!current || current.status !== input.from) return null;

    const updated: Document = {
      ...current,
      status: input.to,
      updatedAt: input.decidedAt,
      decision: {
        reviewerId: input.reviewerId,
        decision: input.decision,
        reason: input.reason,
        decidedAt: input.decidedAt,
      },
    };
    this.documents.set(id, updated);
    this.appendEvent({
      documentId: id,
      actorId: input.reviewerId,
      type: input.decision,
      reason: input.reason,
      at: input.decidedAt,
    });
    return copy(updated);
  }

  async listEvents(documentId: string): Promise<DocumentEvent[]> {
    // Events are appended in order, so insertion order is chronological order.
    return this.events.filter((e) => e.documentId === documentId).map((e) => ({ ...e }));
  }

  private appendEvent(event: Omit<DocumentEvent, 'id'>): void {
    this.eventSeq += 1;
    this.events.push({ id: `evt_${this.eventSeq}`, ...event });
  }
}
