import type { User } from '../domain/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
    }
  }
}

export {};
