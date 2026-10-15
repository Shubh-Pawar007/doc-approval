import { describe, expect, it } from 'vitest';
import { canTransition, nextStatus, type DocumentAction } from '../src/domain/stateMachine';
import type { DocumentStatus } from '../src/domain/types';

describe('state machine', () => {
  // Table-driven over every (status, action) pair, so a new transition cannot slip in unnoticed.
  const cases: Array<[DocumentStatus, DocumentAction, DocumentStatus | null]> = [
    ['pending', 'approve', 'approved'],
    ['pending', 'reject', 'rejected'],
    ['approved', 'approve', null],
    ['approved', 'reject', null],
    ['rejected', 'approve', null],
    ['rejected', 'reject', null],
  ];

  it.each(cases)('%s + %s → %s', (from, action, expected) => {
    expect(nextStatus(from, action)).toBe(expected);
    expect(canTransition(from, action)).toBe(expected !== null);
  });
});
