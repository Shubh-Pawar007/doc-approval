import { createApp } from '../src/app';
import { InMemoryDocumentRepository } from '../src/repositories/inMemoryDocumentRepository';
import { InMemoryUserRepository } from '../src/repositories/userRepository';
import type { User } from '../src/domain/types';

export const ALICE: User = { id: 'u-alice', name: 'Alice Fernandes', role: 'submitter' };
export const BOB: User = { id: 'u-bob', name: 'Bob Mehta', role: 'submitter' };
export const RITA: User = { id: 'u-rita', name: 'Rita Kulkarni', role: 'reviewer' };
export const RAJ: User = { id: 'u-raj', name: 'Raj Iyer', role: 'reviewer' };

/** A clock that ticks one second per call, so ordering in tests is deterministic. */
export function steppingClock(start = '2026-01-01T00:00:00.000Z') {
  let t = Date.parse(start);
  return () => {
    t += 1000;
    return new Date(t);
  };
}

export function buildTestApp(options: { maxUploadBytes?: number } = {}) {
  const deps = {
    users: new InMemoryUserRepository(),
    documents: new InMemoryDocumentRepository(),
    now: steppingClock(),
  };
  const app = createApp(deps, { logRequests: false, corsOrigins: ['http://localhost:5173'], ...options });
  return { app, deps };
}
