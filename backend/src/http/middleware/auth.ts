import type { Request, RequestHandler } from 'express';
import { Errors } from '../../domain/errors';
import type { Role, User } from '../../domain/types';
import type { UserRepository } from '../../repositories/userRepository';

/**
 * Mock authentication: the client sends `X-User-Id`. Every role check still happens
 * on the server, so replacing this with real sessions/JWT changes only this file.
 */
export function authenticate(users: UserRepository): RequestHandler {
  return async (req, _res, next) => {
    const userId = req.header('x-user-id')?.trim();
    if (!userId) throw Errors.unauthenticated('Missing X-User-Id header');
    const user = await users.findById(userId);
    if (!user) throw Errors.unauthenticated('Unknown user');
    req.user = user;
    next();
  };
}

export function currentUser(req: Request): User {
  if (!req.user) throw Errors.unauthenticated();
  return req.user;
}

/** Runs before body parsing/uploads so a forbidden request never buffers a file. */
export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (currentUser(req).role !== role) {
      throw Errors.forbidden(`This action requires the ${role} role`);
    }
    next();
  };
}
