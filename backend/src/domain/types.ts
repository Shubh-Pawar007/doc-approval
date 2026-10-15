export type Role = 'submitter' | 'reviewer';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export const DOCUMENT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DECISION_TYPES = ['approved', 'rejected'] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export interface StoredFile {
  originalName: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

export interface Decision {
  reviewerId: string;
  decision: DecisionType;
  /** Required for rejections, optional comment for approvals. */
  reason: string | null;
  decidedAt: string;
}

export interface Document {
  id: string;
  title: string;
  /** Inline text content. A document has content, a file, or both. */
  content: string | null;
  file: StoredFile | null;
  submitterId: string;
  status: DocumentStatus;
  decision: Decision | null;
  createdAt: string;
  updatedAt: string;
}

export type DocumentEventType = 'submitted' | DecisionType;

/** Append-only audit entry. Written in the same step as the state change it records. */
export interface DocumentEvent {
  id: string;
  documentId: string;
  actorId: string;
  type: DocumentEventType;
  reason: string | null;
  at: string;
}
