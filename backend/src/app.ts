import cors from 'cors';
import express, { Router } from 'express';
import { config } from './config';
import { authenticate, currentUser } from './http/middleware/auth';
import { errorHandler, notFoundHandler } from './http/middleware/errorHandler';
import { requestId, requestLogger } from './http/middleware/requestContext';
import { createPresenter } from './http/presenters';
import { createDocumentsRouter } from './http/routes/documents';
import { createUsersRouter } from './http/routes/users';
import { createUploadMiddleware } from './http/upload';
import type { DocumentRepository } from './repositories/documentRepository';
import type { UserRepository } from './repositories/userRepository';
import { DocumentService } from './services/documentService';

export interface AppDependencies {
  users: UserRepository;
  documents: DocumentRepository;
  now?: () => Date;
}

export interface AppOptions {
  corsOrigins: string[];
  maxUploadBytes: number;
  logRequests: boolean;
}

/** Builds the Express app from its dependencies. Tests call this with fresh stores. */
export function createApp(deps: AppDependencies, overrides: Partial<AppOptions> = {}) {
  const options: AppOptions = {
    corsOrigins: config.corsOrigins,
    maxUploadBytes: config.maxUploadBytes,
    logRequests: config.logRequests,
    ...overrides,
  };

  const service = new DocumentService(deps.documents, deps.now);
  const presenter = createPresenter(deps.users);

  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(requestLogger(options.logRequests));
  app.use(cors({ origin: options.corsOrigins, exposedHeaders: ['x-request-id', 'content-disposition'] }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/users', createUsersRouter(deps.users));

  const authed = Router();
  authed.use(authenticate(deps.users));
  authed.get('/me', (req, res) => {
    res.json(currentUser(req));
  });
  authed.use(
    '/documents',
    createDocumentsRouter({ service, presenter, upload: createUploadMiddleware(options.maxUploadBytes) }),
  );
  app.use('/api', authed);

  app.use(notFoundHandler);
  app.use(errorHandler({ maxUploadBytes: options.maxUploadBytes, log: options.logRequests }));
  return app;
}
