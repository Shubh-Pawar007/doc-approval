import { Router, type Request, type RequestHandler } from 'express';
import { Errors } from '../../domain/errors';
import type { StoredFile } from '../../domain/types';
import type { DocumentService } from '../../services/documentService';
import { currentUser, requireRole } from '../middleware/auth';
import type { Presenter } from '../presenters';
import { createDocumentSchema, decisionSchema, listDocumentsQuerySchema } from '../validation';

/** Express 5 types params as string | string[] after some middleware; normalise once. */
function docId(req: Request): string {
  return String(req.params.id);
}

interface DocumentsRouterDeps {
  service: DocumentService;
  presenter: Presenter;
  upload: RequestHandler;
}

/**
 * Thin controllers: parse + validate input, call the service, shape the response.
 * No business rules here.
 */
export function createDocumentsRouter({ service, presenter, upload }: DocumentsRouterDeps): Router {
  const router = Router();

  // Create — accepts multipart/form-data (title, content?, file?) or JSON (title, content).
  router.post('/', requireRole('submitter'), upload, async (req, res) => {
    const body = createDocumentSchema.parse(req.body ?? {});
    const file: StoredFile | null = req.file
      ? {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          data: req.file.buffer,
        }
      : null;

    const doc = await service.submit(currentUser(req), { ...body, file });
    res.status(201).location(`/api/documents/${doc.id}`).json(await presenter.detail(doc));
  });

  // List — scoped by role, filter by status, search by title, cursor pagination.
  router.get('/', async (req, res) => {
    const query = listDocumentsQuerySchema.parse(req.query);
    const result = await service.list(currentUser(req), query);
    res.json({
      items: await Promise.all(result.items.map((doc) => presenter.summary(doc))),
      nextCursor: result.nextCursor,
    });
  });

  router.get('/:id', async (req, res) => {
    const doc = await service.get(currentUser(req), docId(req));
    res.json(await presenter.detail(doc));
  });

  router.get('/:id/file', async (req, res) => {
    const doc = await service.get(currentUser(req), docId(req));
    if (!doc.file) throw Errors.notFound('File');
    res.attachment(doc.file.originalName);
    res.setHeader('Content-Type', doc.file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(doc.file.data);
  });

  router.get('/:id/history', async (req, res) => {
    const events = await service.history(currentUser(req), docId(req));
    res.json({ items: await Promise.all(events.map((e) => presenter.event(e))) });
  });

  // Decide — an action with an actor, not a free-form status write (see README).
  router.post('/:id/decision', requireRole('reviewer'), async (req, res) => {
    const body = decisionSchema.parse(req.body ?? {});
    const doc = await service.decide(currentUser(req), docId(req), body);
    res.json(await presenter.detail(doc));
  });

  return router;
}
