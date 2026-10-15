import { z } from 'zod';
import { DECISION_TYPES, DOCUMENT_STATUSES } from '../domain/types';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 50_000;
export const MAX_REASON_LENGTH = 1_000;

/** Treat "" (common from forms and query strings) as "not provided". */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const createDocumentSchema = z.object({
  title: z
    .string({ required_error: 'Title is required', invalid_type_error: 'Title must be text' })
    .trim()
    .min(1, 'Title is required')
    .max(MAX_TITLE_LENGTH, `Title must be at most ${MAX_TITLE_LENGTH} characters`),
  content: z.preprocess(
    blankToUndefined,
    z
      .string({ invalid_type_error: 'Content must be text' })
      .trim()
      .max(MAX_CONTENT_LENGTH, `Content must be at most ${MAX_CONTENT_LENGTH} characters`)
      .optional(),
  ),
});

export const listDocumentsQuerySchema = z.object({
  status: z.preprocess(
    blankToUndefined,
    z
      .enum(DOCUMENT_STATUSES, {
        errorMap: () => ({ message: `Status must be one of: ${DOCUMENT_STATUSES.join(', ')}` }),
      })
      .optional(),
  ),
  q: z.preprocess(blankToUndefined, z.string().trim().max(200, 'Search is too long').optional()),
  // Out-of-range limits are clamped rather than rejected: a friendlier contract for clients.
  limit: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ invalid_type_error: 'Limit must be a number' })
      .int('Limit must be a whole number')
      .min(1, 'Limit must be at least 1')
      .default(DEFAULT_PAGE_SIZE)
      .transform((n) => Math.min(n, MAX_PAGE_SIZE)),
  ),
  cursor: z.preprocess(blankToUndefined, z.string().max(500).optional()),
});

export const decisionSchema = z
  .object({
    decision: z.enum(DECISION_TYPES, {
      errorMap: () => ({ message: "Decision must be 'approved' or 'rejected'" }),
    }),
    reason: z.preprocess(
      blankToUndefined,
      z
        .string({ invalid_type_error: 'Reason must be text' })
        .trim()
        .max(MAX_REASON_LENGTH, `Reason must be at most ${MAX_REASON_LENGTH} characters`)
        .optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'rejected' && !value.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'A reason is required when rejecting a document',
      });
    }
  });

export type CreateDocumentBody = z.infer<typeof createDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
export type DecisionBody = z.infer<typeof decisionSchema>;
