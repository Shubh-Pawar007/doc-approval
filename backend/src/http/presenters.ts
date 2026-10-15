import type { Document, DocumentEvent } from '../domain/types';
import type { UserRepository } from '../repositories/userRepository';

/**
 * Response shapes (DTOs). Kept separate from the domain model so storage details
 * (like the raw file buffer) never leak into JSON and the API can evolve on its own.
 */
export interface UserRefDto {
  id: string;
  name: string;
}

export interface DocumentSummaryDto {
  id: string;
  title: string;
  contentPreview: string | null;
  status: Document['status'];
  submitter: UserRefDto;
  file: { name: string; mimeType: string; size: number } | null;
  decision: {
    reviewer: UserRefDto;
    decision: 'approved' | 'rejected';
    reason: string | null;
    decidedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetailDto extends DocumentSummaryDto {
  content: string | null;
}

export interface DocumentEventDto {
  id: string;
  type: DocumentEvent['type'];
  actor: UserRefDto;
  reason: string | null;
  at: string;
}

const PREVIEW_LENGTH = 160;

function preview(content: string | null): string | null {
  if (!content) return null;
  return content.length > PREVIEW_LENGTH ? `${content.slice(0, PREVIEW_LENGTH).trimEnd()}…` : content;
}

export type Presenter = ReturnType<typeof createPresenter>;

export function createPresenter(users: UserRepository) {
  async function userRef(id: string): Promise<UserRefDto> {
    const user = await users.findById(id);
    return { id, name: user?.name ?? 'Unknown user' };
  }

  async function summary(doc: Document): Promise<DocumentSummaryDto> {
    return {
      id: doc.id,
      title: doc.title,
      contentPreview: preview(doc.content),
      status: doc.status,
      submitter: await userRef(doc.submitterId),
      file: doc.file ? { name: doc.file.originalName, mimeType: doc.file.mimeType, size: doc.file.size } : null,
      decision: doc.decision
        ? {
            reviewer: await userRef(doc.decision.reviewerId),
            decision: doc.decision.decision,
            reason: doc.decision.reason,
            decidedAt: doc.decision.decidedAt,
          }
        : null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async function detail(doc: Document): Promise<DocumentDetailDto> {
    return { ...(await summary(doc)), content: doc.content };
  }

  async function event(e: DocumentEvent): Promise<DocumentEventDto> {
    return { id: e.id, type: e.type, actor: await userRef(e.actorId), reason: e.reason, at: e.at };
  }

  return { summary, detail, event };
}
