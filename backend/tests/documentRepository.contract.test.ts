import { describe, expect, it } from 'vitest';
import type { DocumentRepository } from '../src/repositories/documentRepository';
import { InMemoryDocumentRepository } from '../src/repositories/inMemoryDocumentRepository';

/**
 * Contract tests every DocumentRepository implementation must pass.
 * A future PostgresDocumentRepository registers itself here and runs the same suite.
 */
function runRepositoryContract(name: string, createRepo: () => DocumentRepository) {
  describe(`${name} repository contract`, () => {
    const at = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s)).toISOString();
    const base = { content: 'body', file: null, submitterId: 'u-alice' };

    it('creates a pending document with a submitted event', async () => {
      const repo = createRepo();
      const doc = await repo.create({ ...base, title: 'A', createdAt: at(1) });
      expect(doc.status).toBe('pending');
      expect(await repo.findById(doc.id)).toEqual(doc);
      const events = await repo.listEvents(doc.id);
      expect(events.map((e) => e.type)).toEqual(['submitted']);
    });

    it('returns null for an unknown id', async () => {
      expect(await createRepo().findById('missing')).toBeNull();
    });

    it('lists newest first and pages with a keyset cursor', async () => {
      const repo = createRepo();
      for (let i = 1; i <= 5; i += 1) await repo.create({ ...base, title: `Doc ${i}`, createdAt: at(i) });

      const first = await repo.list({ limit: 2 });
      expect(first.items.map((d) => d.title)).toEqual(['Doc 5', 'Doc 4']);
      expect(first.hasMore).toBe(true);

      const last = first.items[1];
      const second = await repo.list({ limit: 2, after: { createdAt: last.createdAt, id: last.id } });
      expect(second.items.map((d) => d.title)).toEqual(['Doc 3', 'Doc 2']);

      const tail = second.items[1];
      const third = await repo.list({ limit: 2, after: { createdAt: tail.createdAt, id: tail.id } });
      expect(third.items.map((d) => d.title)).toEqual(['Doc 1']);
      expect(third.hasMore).toBe(false);
    });

    it('filters by submitter, status and title search', async () => {
      const repo = createRepo();
      await repo.create({ ...base, title: 'Budget plan', createdAt: at(1) });
      await repo.create({ ...base, title: 'Hiring plan', submitterId: 'u-bob', createdAt: at(2) });
      const approved = await repo.create({ ...base, title: 'Travel policy', createdAt: at(3) });
      await repo.applyDecision(approved.id, {
        from: 'pending', to: 'approved', reviewerId: 'u-rita', decision: 'approved', reason: null, decidedAt: at(4),
      });

      expect((await repo.list({ limit: 10, submitterId: 'u-bob' })).items.map((d) => d.title)).toEqual(['Hiring plan']);
      expect((await repo.list({ limit: 10, status: 'approved' })).items.map((d) => d.title)).toEqual(['Travel policy']);
      expect((await repo.list({ limit: 10, q: 'PLAN' })).items.map((d) => d.title)).toEqual(['Hiring plan', 'Budget plan']);
    });

    it('applyDecision is compare-and-set: the second write loses', async () => {
      const repo = createRepo();
      const doc = await repo.create({ ...base, title: 'A', createdAt: at(1) });
      const decision = { from: 'pending' as const, reviewerId: 'u-rita', reason: 'no', decidedAt: at(2) };

      const won = await repo.applyDecision(doc.id, { ...decision, to: 'rejected', decision: 'rejected' });
      const lost = await repo.applyDecision(doc.id, { ...decision, to: 'approved', decision: 'approved', reason: null });

      expect(won?.status).toBe('rejected');
      expect(lost).toBeNull();
      expect((await repo.findById(doc.id))?.status).toBe('rejected');
      expect((await repo.listEvents(doc.id)).map((e) => e.type)).toEqual(['submitted', 'rejected']);
    });

    it('returns copies so callers cannot mutate stored state', async () => {
      const repo = createRepo();
      const doc = await repo.create({ ...base, title: 'Original', createdAt: at(1) });
      doc.title = 'Mutated';
      expect((await repo.findById(doc.id))?.title).toBe('Original');
    });
  });
}

runRepositoryContract('in-memory', () => new InMemoryDocumentRepository());
