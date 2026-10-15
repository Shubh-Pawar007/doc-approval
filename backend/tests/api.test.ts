import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ALICE, BOB, RAJ, RITA, buildTestApp } from './helpers';

type App = ReturnType<typeof buildTestApp>['app'];

function as(app: App, userId: string) {
  return {
    get: (url: string) => request(app).get(url).set('X-User-Id', userId),
    post: (url: string) => request(app).post(url).set('X-User-Id', userId),
  };
}

async function submit(app: App, title = 'Policy', content = 'Some content') {
  const res = await as(app, ALICE.id).post('/api/documents').send({ title, content });
  expect(res.status).toBe(201);
  return res.body as { id: string; status: string };
}

describe('API', () => {
  let app: App;

  beforeEach(() => {
    ({ app } = buildTestApp({ maxUploadBytes: 1024 }));
  });

  describe('basics', () => {
    it('GET /api/health is public', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /api/users lists demo users for the switcher', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(200);
      expect(res.body.items.map((u: { id: string }) => u.id)).toEqual([ALICE.id, BOB.id, RITA.id, RAJ.id]);
    });

    it('returns 401 without a user header and for an unknown user', async () => {
      expect((await request(app).get('/api/documents')).status).toBe(401);
      const res = await request(app).get('/api/documents').set('X-User-Id', 'ghost');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('uses one error shape with a request id', async () => {
      const res = await as(app, ALICE.id).get('/api/documents/missing');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Document not found' });
      expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
    });

    it('returns 404 for unknown routes', async () => {
      expect((await request(app).get('/nope')).status).toBe(404);
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await as(app, ALICE.id)
        .post('/api/documents')
        .set('Content-Type', 'application/json')
        .send('{"title": ');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_JSON');
    });
  });

  describe('POST /api/documents', () => {
    it('creates a document from JSON', async () => {
      const res = await as(app, ALICE.id).post('/api/documents').send({ title: 'Policy', content: 'Body' });
      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/api/documents/${res.body.id}`);
      expect(res.body).toMatchObject({
        title: 'Policy',
        content: 'Body',
        status: 'pending',
        submitter: { id: ALICE.id, name: ALICE.name },
        decision: null,
        file: null,
      });
    });

    it('creates a document from a multipart upload and serves the file back', async () => {
      const res = await as(app, ALICE.id)
        .post('/api/documents')
        .field('title', 'Spec')
        .attach('file', Buffer.from('hello'), { filename: 'spec.txt', contentType: 'text/plain' });
      expect(res.status).toBe(201);
      expect(res.body.file).toEqual({ name: 'spec.txt', mimeType: 'text/plain', size: 5 });

      const file = await as(app, RITA.id).get(`/api/documents/${res.body.id}/file`);
      expect(file.status).toBe(200);
      expect(file.headers['content-type']).toContain('text/plain');
      expect(file.headers['content-disposition']).toContain('spec.txt');
      expect(file.text).toBe('hello');
    });

    it.each([
      [{}, 'title'],
      [{ title: '   ', content: 'x' }, 'title'],
      [{ title: 'x'.repeat(201), content: 'x' }, 'title'],
      [{ title: 123, content: 'x' }, 'title'],
    ])('returns 400 for invalid payload %j', async (payload, field) => {
      const res = await as(app, ALICE.id).post('/api/documents').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    });

    it('returns 400 when there is neither content nor a file', async () => {
      const res = await as(app, ALICE.id).post('/api/documents').send({ title: 'Empty' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('content');
    });

    it('returns 400 for an unsupported file type', async () => {
      const res = await as(app, ALICE.id)
        .post('/api/documents')
        .field('title', 'Script')
        .attach('file', Buffer.from('#!/bin/sh'), { filename: 'run.sh', contentType: 'application/x-sh' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('file');
    });

    it('returns 413 for a file over the size limit', async () => {
      const res = await as(app, ALICE.id)
        .post('/api/documents')
        .field('title', 'Big')
        .attach('file', Buffer.alloc(2048, 'a'), { filename: 'big.txt', contentType: 'text/plain' });
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('returns 403 for reviewers', async () => {
      const res = await as(app, RITA.id).post('/api/documents').send({ title: 'x', content: 'y' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/documents', () => {
    it('scopes submitters to their own documents', async () => {
      await submit(app, 'Alice doc');
      await as(app, BOB.id).post('/api/documents').send({ title: 'Bob doc', content: 'x' });

      const alice = await as(app, ALICE.id).get('/api/documents');
      expect(alice.body.items.map((d: { title: string }) => d.title)).toEqual(['Alice doc']);
      const rita = await as(app, RITA.id).get('/api/documents');
      expect(rita.body.items).toHaveLength(2);
    });

    it('does not let a submitter fetch someone else’s document', async () => {
      const doc = await submit(app);
      expect((await as(app, BOB.id).get(`/api/documents/${doc.id}`)).status).toBe(404);
    });

    it('filters by status and searches by title', async () => {
      const a = await submit(app, 'Budget plan');
      await submit(app, 'Hiring plan');
      await submit(app, 'Travel policy');
      await as(app, RITA.id).post(`/api/documents/${a.id}/decision`).send({ decision: 'approved' });

      const approved = await as(app, RITA.id).get('/api/documents?status=approved');
      expect(approved.body.items.map((d: { title: string }) => d.title)).toEqual(['Budget plan']);

      const search = await as(app, RITA.id).get('/api/documents?q=plan&status=pending');
      expect(search.body.items.map((d: { title: string }) => d.title)).toEqual(['Hiring plan']);
    });

    it('pages with a cursor; the last page has no next cursor', async () => {
      for (let i = 1; i <= 5; i += 1) await submit(app, `Doc ${i}`);

      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const url: string = `/api/documents?limit=2${cursor ? `&cursor=${cursor}` : ''}`;
        const res = await as(app, RITA.id).get(url);
        expect(res.status).toBe(200);
        seen.push(...res.body.items.map((d: { title: string }) => d.title));
        cursor = res.body.nextCursor;
        pages += 1;
      } while (cursor);

      expect(pages).toBe(3);
      expect(seen).toEqual(['Doc 5', 'Doc 4', 'Doc 3', 'Doc 2', 'Doc 1']);
    });

    it('clamps a limit above the cap', async () => {
      for (let i = 1; i <= 3; i += 1) await submit(app, `Doc ${i}`);
      const res = await as(app, RITA.id).get('/api/documents?limit=10000');
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(3);
    });

    it.each([
      ['status=archived', 'status'],
      ['limit=0', 'limit'],
      ['limit=abc', 'limit'],
      ['cursor=not-a-cursor', 'cursor'],
    ])('returns 400 for ?%s', async (qs, field) => {
      const res = await as(app, RITA.id).get(`/api/documents?${qs}`);
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe(field);
    });

    it('returns a short preview in lists and full content in detail', async () => {
      const long = 'x'.repeat(500);
      const doc = await submit(app, 'Long', long);
      const list = await as(app, RITA.id).get('/api/documents');
      expect(list.body.items[0].contentPreview.length).toBeLessThan(200);
      expect(list.body.items[0]).not.toHaveProperty('content');
      const detail = await as(app, RITA.id).get(`/api/documents/${doc.id}`);
      expect(detail.body.content).toBe(long);
    });
  });

  describe('POST /api/documents/:id/decision', () => {
    it('approves and the submitter sees the new status', async () => {
      const doc = await submit(app);
      const res = await as(app, RITA.id).post(`/api/documents/${doc.id}/decision`).send({ decision: 'approved' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');

      const mine = await as(app, ALICE.id).get(`/api/documents/${doc.id}`);
      expect(mine.body.status).toBe('approved');
      expect(mine.body.decision.reviewer).toEqual({ id: RITA.id, name: RITA.name });
    });

    it('rejects with a reason that the submitter can see', async () => {
      const doc = await submit(app);
      await as(app, RITA.id)
        .post(`/api/documents/${doc.id}/decision`)
        .send({ decision: 'rejected', reason: 'Add a budget section' });

      const list = await as(app, ALICE.id).get('/api/documents');
      expect(list.body.items[0]).toMatchObject({
        status: 'rejected',
        decision: { decision: 'rejected', reason: 'Add a budget section' },
      });
    });

    it.each([
      [{ decision: 'rejected' }, 'reason'],
      [{ decision: 'rejected', reason: '   ' }, 'reason'],
      [{ decision: 'maybe' }, 'decision'],
      [{}, 'decision'],
    ])('returns 400 for %j', async (payload, field) => {
      const doc = await submit(app);
      const res = await as(app, RITA.id).post(`/api/documents/${doc.id}/decision`).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    });

    it('returns 403 for submitters', async () => {
      const doc = await submit(app);
      const res = await as(app, ALICE.id).post(`/api/documents/${doc.id}/decision`).send({ decision: 'approved' });
      expect(res.status).toBe(403);
    });

    it('returns 404 for an unknown document', async () => {
      const res = await as(app, RITA.id).post('/api/documents/missing/decision').send({ decision: 'approved' });
      expect(res.status).toBe(404);
    });

    it('returns 409 on a second decision', async () => {
      const doc = await submit(app);
      await as(app, RITA.id).post(`/api/documents/${doc.id}/decision`).send({ decision: 'approved' });
      const res = await as(app, RAJ.id)
        .post(`/api/documents/${doc.id}/decision`)
        .send({ decision: 'rejected', reason: 'Too late' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('parallel decisions: exactly one 200 and one 409', async () => {
      const doc = await submit(app);
      const [a, b] = await Promise.all([
        as(app, RITA.id).post(`/api/documents/${doc.id}/decision`).send({ decision: 'approved' }),
        as(app, RAJ.id).post(`/api/documents/${doc.id}/decision`).send({ decision: 'rejected', reason: 'No' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
    });
  });

  describe('GET /api/documents/:id/history', () => {
    it('returns events in order with actor names', async () => {
      const doc = await submit(app);
      await as(app, RITA.id).post(`/api/documents/${doc.id}/decision`).send({ decision: 'rejected', reason: 'Fix it' });

      const res = await as(app, ALICE.id).get(`/api/documents/${doc.id}/history`);
      expect(res.status).toBe(200);
      expect(res.body.items.map((e: { type: string; actor: { name: string } }) => [e.type, e.actor.name])).toEqual([
        ['submitted', ALICE.name],
        ['rejected', RITA.name],
      ]);
    });
  });
});
