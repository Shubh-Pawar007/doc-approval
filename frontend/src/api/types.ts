/** Mirrors the backend DTOs (backend/src/http/presenters.ts). */
export type Role = 'submitter' | 'reviewer';
export type DocumentStatus = 'pending' | 'approved' | 'rejected';
export type Decision = 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface FileMeta {
  name: string;
  mimeType: string;
  size: number;
}

export interface DecisionInfo {
  reviewer: UserRef;
  decision: Decision;
  reason: string | null;
  decidedAt: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  contentPreview: string | null;
  status: DocumentStatus;
  submitter: UserRef;
  file: FileMeta | null;
  decision: DecisionInfo | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: string | null;
}

export interface DocumentPage {
  items: DocumentSummary[];
  nextCursor: string | null;
}

export interface DocumentEvent {
  id: string;
  type: 'submitted' | Decision;
  actor: UserRef;
  reason: string | null;
  at: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: FieldError[];
    requestId?: string;
  };
}
