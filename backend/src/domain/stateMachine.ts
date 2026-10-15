import type { DocumentStatus } from './types';

export type DocumentAction = 'approve' | 'reject';

/**
 * The single source of truth for allowed status transitions.
 * Every code path that changes a status asks this table first.
 *
 *   pending ──approve──▶ approved   (terminal)
 *      └─────reject───▶ rejected   (terminal)
 *
 * Adding "resubmit" later is one new row: rejected → pending.
 */
const TRANSITIONS: Readonly<Record<DocumentStatus, Partial<Record<DocumentAction, DocumentStatus>>>> = {
  pending: { approve: 'approved', reject: 'rejected' },
  approved: {},
  rejected: {},
};

export function nextStatus(current: DocumentStatus, action: DocumentAction): DocumentStatus | null {
  return TRANSITIONS[current][action] ?? null;
}

export function canTransition(current: DocumentStatus, action: DocumentAction): boolean {
  return nextStatus(current, action) !== null;
}
