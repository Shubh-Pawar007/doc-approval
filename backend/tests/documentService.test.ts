import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../src/domain/errors';
import { InMemoryDocumentRepository } from '../src/repositories/inMemoryDocumentRepository';
import { DocumentService } from '../src/services/documentService';
import { ALICE, BOB, RAJ, RITA, steppingClock } from './helpers';

async function expectAppError(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  return err as AppError;
}

describe('DocumentService', () => {
  let repo: InMemoryDocumentRepository;
  let service: DocumentService;

  beforeEach(() => {
    repo = new InMemoryDocumentRepository();
    service = new DocumentService(repo, steppingClock());
  });

  describe('submit', () => {
    it('creates a pending document owned by the submitter, with trimmed fields', async () => {
      const doc = await service.submit(ALICE, { title: '  Policy  ', content: '  Body  ' });
      expect(doc).toMatchObject({ title: 'Policy', content: 'Body', status: 'pending', submitterId: ALICE.id });
    });

    it('rejects reviewers', async () => {
      await expectAppError(service.submit(RITA, { title: 'x', content: 'y' }), 403);
    });

    it('requires content or a file', async () => {
      const err = await expectAppError(service.submit(ALICE, { title: 'x', content: '   ' }), 400);
      expect(err.details?.[0].field).toBe('content');
    });

    it('accepts a file without text content', async () => {
      const file = { originalName: 'a.txt', mimeType: 'text/plain', size: 3, data: Buffer.from('abc') };
      const doc = await service.submit(ALICE, { title: 'x', file });
      expect(doc.content).toBeNull();
      expect(doc.file?.originalName).toBe('a.txt');
    });
  });

  describe('visibility', () => {
    it('submitters only list their own documents; reviewers list all', async () => {
      await service.submit(ALICE, { title: 'Alice doc', content: 'a' });
      await service.submit(BOB, { title: 'Bob doc', content: 'b' });

      expect((await service.list(ALICE, { limit: 10 })).items.map((d) => d.title)).toEqual(['Alice doc']);
      expect((await service.list(RITA, { limit: 10 })).items).toHaveLength(2);
    });

    it("hides another submitter's document behind a 404", async () => {
      const doc = await service.submit(ALICE, { title: 'Private', content: 'a' });
      await expectAppError(service.get(BOB, doc.id), 404);
      await expectAppError(service.history(BOB, doc.id), 404);
    });
  });

  describe('decide', () => {
    it('approves a pending document and records the reviewer', async () => {
      const doc = await service.submit(ALICE, { title: 'x', content: 'y' });
      const updated = await service.decide(RITA, doc.id, { decision: 'approved' });
      expect(updated.status).toBe('approved');
      expect(updated.decision).toMatchObject({ reviewerId: RITA.id, decision: 'approved', reason: null });
    });

    it('keeps an optional comment on approval', async () => {
      const doc = await service.submit(ALICE, { title: 'x', content: 'y' });
      const updated = await service.decide(RITA, doc.id, { decision: 'approved', reason: 'Nice work' });
      expect(updated.decision?.reason).toBe('Nice work');
    });

    it('requires a non-blank reason to reject', async () => {
      const doc = await service.submit(ALICE, { title: 'x', content: 'y' });
      await expectAppError(service.decide(RITA, doc.id, { decision: 'rejected', reason: '   ' }), 400);
      expect((await repo.findById(doc.id))?.status).toBe('pending');
    });

    it('forbids submitters from deciding', async () => {
      const doc = await service.submit(ALICE, { title: 'x', content: 'y' });
      await expectAppError(service.decide(BOB, doc.id, { decision: 'approved' }), 403);
    });

    it('forbids reviewing your own document', async () => {
      const own = await repo.create({
        title: 'Self', content: 'x', file: null, submitterId: RITA.id, createdAt: new Date().toISOString(),
      });
      await expectAppError(service.decide(RITA, own.id, { decision: 'approved' }), 403);
    });

    it('returns 404 for an unknown document', async () => {
      await expectAppError(service.decide(RITA, 'nope', { decision: 'approved' }), 404);
    });

    it('returns 409 when the document is already decided, and the status never changes', async () => {
      const doc = await service.submit(ALICE, { title: 'x', content: 'y' });
      await service.decide(RITA, doc.id, { decision: 'approved' });
      await expectAppError(service.decide(RAJ, doc.id, { decision: 'rejected', reason: 'late' }), 409);
      expect((await repo.findById(doc.id))?.status).toBe('approved');
    });

    it('two simultaneous decisions: exactly one succeeds, the other gets 409', async () => {
      const doc = await service.submit(ALICE, { title: 'x', content: 'y' });
      const results = await Promise.allSettled([
        service.decide(RITA, doc.id, { decision: 'approved' }),
        service.decide(RAJ, doc.id, { decision: 'rejected', reason: 'no' }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0].reason as AppError).status).toBe(409);
      expect((await repo.listEvents(doc.id)).map((e) => e.type)).toHaveLength(2); // submitted + one decision
    });
  });

  describe('history', () => {
    it('adds exactly one event per successful action and none for failed ones', async () => {
      const doc = await service.submit(ALICE, { title: 'x', content: 'y' });
      await expectAppError(service.decide(RITA, doc.id, { decision: 'rejected' }), 400);
      await service.decide(RITA, doc.id, { decision: 'rejected', reason: 'Needs numbers' });
      await expectAppError(service.decide(RAJ, doc.id, { decision: 'approved' }), 409);

      const events = await service.history(ALICE, doc.id);
      expect(events.map((e) => [e.type, e.actorId, e.reason])).toEqual([
        ['submitted', ALICE.id, null],
        ['rejected', RITA.id, 'Needs numbers'],
      ]);
    });
  });
});
