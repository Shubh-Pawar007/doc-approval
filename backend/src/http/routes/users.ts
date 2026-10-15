import { Router } from 'express';
import type { UserRepository } from '../../repositories/userRepository';

/** Public list of demo users that powers the frontend's user switcher. */
export function createUsersRouter(users: UserRepository): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json({ items: await users.list() });
  });
  return router;
}
