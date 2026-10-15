# Document Approval Workflow

A minimal, end-to-end document approval system. A **submitter** sends a document (text, a file, or both) for review and tracks its status. A **reviewer** works through a queue of submissions and approves or rejects each one, giving a reason when rejecting.

|                       |                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------- |
| **Frontend**          | React 18 + TypeScript, Vite, Vitest + Testing Library                                   |
| **Backend**           | Node.js 22 + Express 5 + TypeScript, Zod validation, Multer uploads, Vitest + Supertest |
| **Storage**           | In-memory, behind a repository interface (swap-ready for Postgres)                      |
| **Live demo**         | _add your URL here_                                                                     |
| **Video walkthrough** | _add your Loom link here_                                                               |

---

## Quick start

Requires Node.js 20+ (22 recommended, see `.nvmrc`).

```bash
npm run install:all     # installs backend and frontend

# terminal 1 — API on http://localhost:4000
npm run dev:backend

# terminal 2 — web app on http://localhost:5173
npm run dev:frontend
```

Open http://localhost:5173 and use **Acting as** in the top-right to switch between demo users:

| User                       | Role      |
| -------------------------- | --------- |
| Alice Fernandes, Bob Mehta | submitter |
| Rita Kulkarni, Raj Iyer    | reviewer  |

The API seeds four demo documents (pending, approved and rejected) on startup. Set `SEED_DEMO_DATA=false` to start empty. Data resets when the API restarts.

### Run all tests

```bash
npm test
```

Runs the backend suite (unit, repository contract, HTTP integration) and the frontend suite (components and hooks). `npm run typecheck` type-checks both apps.

### Environment

| Variable            | App      | Default                 | Purpose                                                            |
| ------------------- | -------- | ----------------------- | ------------------------------------------------------------------ |
| `PORT`              | backend  | `4000`                  | API port                                                           |
| `CORS_ORIGIN`       | backend  | `http://localhost:5173` | Comma-separated allowed origins                                    |
| `SEED_DEMO_DATA`    | backend  | `true`                  | Seed demo documents                                                |
| `VITE_API_BASE_URL` | frontend | empty                   | API origin in production. Empty in dev because Vite proxies `/api` |

---

## Project structure

```
.
├── backend/
│   ├── src/
│   │   ├── domain/               # Pure business types and rules, no Express, no storage
│   │   │   ├── types.ts          #   Document, User, DocumentEvent, statuses
│   │   │   ├── stateMachine.ts   #   The one table of allowed status transitions
│   │   │   ├── errors.ts         #   AppError + factories (400/401/403/404/409/413)
│   │   │   └── cursor.ts         #   Opaque keyset pagination cursor
│   │   ├── repositories/         # Storage boundary
│   │   │   ├── documentRepository.ts          # interface (the contract)
│   │   │   ├── inMemoryDocumentRepository.ts  # implementation used today
│   │   │   └── userRepository.ts              # mocked demo users
│   │   ├── services/
│   │   │   └── documentService.ts  # Authorization + workflow rules
│   │   ├── http/                   # Everything HTTP-specific
│   │   │   ├── middleware/         #   auth (mock), request id + logging, error handler
│   │   │   ├── routes/             #   thin controllers
│   │   │   ├── validation.ts       #   Zod request schemas
│   │   │   ├── presenters.ts       #   Domain → response DTOs
│   │   │   └── upload.ts           #   Multer config (type + size limits)
│   │   ├── app.ts                # createApp(deps) — composition root, used by tests
│   │   ├── bootstrap.ts          # Wires in-memory deps + demo seed
│   │   ├── config.ts             # Env-driven config
│   │   └── server.ts             # Starts HTTP server, graceful shutdown
│   └── tests/
│       ├── stateMachine.test.ts                 # table-driven over every (status, action)
│       ├── documentRepository.contract.test.ts  # any storage must pass this
│       ├── documentService.test.ts              # rules, permissions, concurrency
│       └── api.test.ts                          # HTTP integration via Supertest
└── frontend/
    └── src/
        ├── api/                  # Typed HTTP client, ApiError, endpoint functions
        ├── context/UserContext.tsx  # Mock identity + API client bound to that user
        ├── hooks/
        │   ├── useDocumentList.ts   # server filtering, cursor paging, stale-response guard
        │   └── useDebouncedValue.ts
        ├── components/           # Shared UI: list, detail panel, badge, timeline, filters
        ├── features/
        │   ├── submitter/        # SubmitterView, SubmitDocumentForm (+ tests)
        │   └── reviewer/         # ReviewerView, DecisionControls (+ tests)
        ├── App.tsx               # Shell: picks the view by the current user's role
        └── styles.css
```

Dependencies point inward: `http → services → domain`, and `services → repositories (interface)`. The domain knows nothing about Express or storage.

---

## API design

Base path `/api`. JSON in and out, except uploads (`multipart/form-data`) and file downloads.

**Identity (mocked).** Every `/api/documents` request sends `X-User-Id: <id>`. The server looks the user up and checks the role on every route. Missing or unknown id → `401`. Wrong role → `403`. Replacing this with real auth means changing one middleware.

| Method | Path                          | Who               | Purpose                             |
| ------ | ----------------------------- | ----------------- | ----------------------------------- |
| `GET`  | `/api/health`                 | public            | Liveness check                      |
| `GET`  | `/api/users`                  | public            | Demo users for the switcher         |
| `GET`  | `/api/me`                     | any               | The current user                    |
| `POST` | `/api/documents`              | submitter         | Create a submission                 |
| `GET`  | `/api/documents`              | any               | List; submitters see only their own |
| `GET`  | `/api/documents/:id`          | owner or reviewer | One document with full content      |
| `GET`  | `/api/documents/:id/file`     | owner or reviewer | Download the attachment             |
| `GET`  | `/api/documents/:id/history`  | owner or reviewer | Audit trail                         |
| `POST` | `/api/documents/:id/decision` | reviewer          | Approve or reject                   |

### Create a submission

`POST /api/documents` as `multipart/form-data` (or JSON without a file):

| Field     | Rules                                                   |
| --------- | ------------------------------------------------------- |
| `title`   | required, trimmed, 1–200 chars                          |
| `content` | optional, up to 50,000 chars                            |
| `file`    | optional; PDF, DOCX, TXT, Markdown, PNG, JPEG; max 5 MB |

At least one of `content` or `file` is required. Returns `201` with a `Location` header and the document:

```json
{
  "id": "6f1c…",
  "title": "Travel policy",
  "content": "Economy class only for flights under 4 hours.",
  "contentPreview": "Economy class only for flights under 4 hours.",
  "status": "pending",
  "submitter": { "id": "u-alice", "name": "Alice Fernandes" },
  "file": {
    "name": "policy.pdf",
    "mimeType": "application/pdf",
    "size": 48213
  },
  "decision": null,
  "createdAt": "2026-10-15T09:30:00.000Z",
  "updatedAt": "2026-10-15T09:30:00.000Z"
}
```

### List submissions

`GET /api/documents?status=pending&q=policy&limit=20&cursor=…`

| Param    | Rules                                         |
| -------- | --------------------------------------------- |
| `status` | `pending`, `approved` or `rejected`           |
| `q`      | case-insensitive title search                 |
| `limit`  | default 20; values above 50 are clamped to 50 |
| `cursor` | the `nextCursor` from the previous page       |

```json
{
  "items": [
    /* summaries: same shape as above, without `content` */
  ],
  "nextCursor": "WyIyMDI2…"
}
```

Newest first. `nextCursor` is `null` on the last page. Lists return a 160-character `contentPreview` instead of full content, so a long list stays small.

### Decide

`POST /api/documents/:id/decision`

```json
{ "decision": "rejected", "reason": "Please add a cost breakdown." }
```

- `reason` is **required** for `rejected` (server-side, not just the form). For `approved` it is optional and stored as a comment.
- `200` with the updated document. `409` if the document is no longer pending (already decided, or another reviewer won the race). `403` if the caller is not a reviewer or is the submitter.

### History

`GET /api/documents/:id/history`

```json
{
  "items": [
    {
      "id": "evt_1",
      "type": "submitted",
      "actor": { "id": "u-alice", "name": "Alice Fernandes" },
      "reason": null,
      "at": "…"
    },
    {
      "id": "evt_2",
      "type": "rejected",
      "actor": { "id": "u-rita", "name": "Rita Kulkarni" },
      "reason": "Please add a cost breakdown.",
      "at": "…"
    }
  ]
}
```

### Errors

One shape for every error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "reason",
        "message": "A reason is required when rejecting a document"
      }
    ],
    "requestId": "b0c4…"
  }
}
```

| Status | Code                               | When                                                        |
| ------ | ---------------------------------- | ----------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`, `INVALID_JSON` | Bad payload, query, cursor, file type, malformed JSON       |
| 401    | `UNAUTHENTICATED`                  | Missing or unknown `X-User-Id`                              |
| 403    | `FORBIDDEN`                        | Wrong role, or reviewing your own document                  |
| 404    | `NOT_FOUND`                        | Unknown id, or another submitter's document                 |
| 409    | `CONFLICT`                         | Decision on a document that is not pending                  |
| 413    | `PAYLOAD_TOO_LARGE`                | File over 5 MB or JSON over 100 KB                          |
| 500    | `INTERNAL_ERROR`                   | Unexpected; logged with the request id, no stack trace sent |

### Why these choices

- **`POST /:id/decision` rather than `PATCH /:id { status }`.** A decision is an action with an actor, a reason, and rules. A generic status field would invite `status: "pending"` or edits after a decision. A dedicated endpoint has one narrow payload and one place to enforce the rules.
- **Server-side filtering with a keyset cursor.** Filtering in the browser breaks once there are hundreds of documents. A `(createdAt, id)` cursor stays correct when new documents arrive mid-paging; offsets would skip or repeat rows.
- **404 for another submitter's document,** so ids cannot be probed.
- **Clamp an oversized `limit`** instead of rejecting it: friendlier for clients, still protects the server.

---

## Major decisions

### Data model

```
User           { id, name, role: submitter | reviewer }
Document       { id, title, content?, file?, submitterId, status, decision?, createdAt, updatedAt }
Decision       { reviewerId, decision: approved | rejected, reason?, decidedAt }   (embedded)
DocumentEvent  { id, documentId, actorId, type: submitted | approved | rejected, reason?, at }   (append-only)
```

`status` is stored on the document for fast filtering. Every change also appends a `DocumentEvent`, written in the same step as the status change, so the two cannot disagree.

### State transitions

```
pending ──approve──▶ approved   (final)
   └──────reject───▶ rejected   (final, reason required)
```

All transitions live in one table in `domain/stateMachine.ts`. The service asks it before every change, and a table-driven test covers every (status, action) pair. Adding "edit and resubmit" later is one new row (`rejected → pending`, submitter only).

### Concurrency

Two reviewers clicking at once must not both win. The repository's `applyDecision` is compare-and-set: it writes only if the status is still `pending`, otherwise returns `null` and the API answers `409`.

In memory this is safe because Node runs the check and the write synchronously with no `await` between them. That stops being true with a database or several instances; there the same contract is a conditional update:

```sql
UPDATE documents SET status = $1, ... WHERE id = $2 AND status = 'pending' RETURNING *;
-- zero rows → 409; the history insert goes in the same transaction
```

Both a service test and an HTTP test fire two decisions in parallel and assert exactly one succeeds.

### Frontend

- **Role decides the view.** Switching user remounts the view (`key={user.id}`), so no state leaks between identities.
- **API client bound to the user** through context. Components never build headers.
- **Optimistic approve and reject.** The row updates immediately; on failure it rolls back. On `409` the optimistic value was wrong, so the view also reloads to show the real outcome.
- **Stale responses are ignored.** Each list query aborts the previous request and carries a sequence number, so a slow response for an old filter cannot overwrite newer results. Search is debounced (300 ms).
- **Double-submit guard** on decisions uses a ref, because React state updates land a render late.
- **Client validation mirrors the server** for fast feedback; server field errors are still shown next to the right field.

### Trade-offs within the time budget

- **In-memory storage.** Data is lost on restart. The repository interface plus contract tests make the Postgres swap a contained change.
- **Files kept in memory.** In production they would stream to object storage (S3 or GCS) with only metadata in the database.
- **Mock auth via header.** Anyone can claim any id. Fine for a demo; the first thing to replace.
- **No polling or push.** The submitter uses Refresh to see new decisions.
- **Filters are not in the URL**, so refresh resets them.
- **Single reviewer per document**, one decision, no resubmission.

---

## Tests

Backend (`backend/tests`):

- **State machine:** every (status, action) pair, table-driven.
- **Repository contract:** creation, keyset paging, filters, compare-and-set, defensive copies. A future Postgres repository runs the same suite.
- **Service:** permissions, visibility, reject-without-reason, 409 on a second decision, two parallel decisions with exactly one winner, one history event per successful action and none for failed ones.
- **HTTP integration (Supertest):** 401/403/404/409/413, validation for each field, multipart upload and download, status filter, search, paging to the last page, limit clamping, invalid cursor, error shape with request id.

Frontend (`frontend/src/**/*.test.ts(x)`):

- **DecisionControls:** approve, reject disabled until a non-blank reason, 409 message shown, double click sends one request.
- **SubmitDocumentForm:** client validation, trimmed submit and reset, file instead of content, oversized file, server field errors.
- **useDocumentList:** out-of-order responses ignored, load more until no cursor, optimistic update and rollback.

---

## What I would add for production

In priority order:

1. **Real authentication and authorization.** Sessions or JWT from an identity provider, roles from the token, the same server-side checks on every route.
2. **Postgres.** `users`, `documents`, `document_events` tables with foreign keys and a `CHECK` on status; indexes on `(status, created_at, id)` for the reviewer queue and `(submitter_id, created_at, id)` for "my documents"; migrations with a tool (e.g. node-pg-migrate or Prisma); the conditional `UPDATE` above for decisions.
3. **Object storage for files** (S3 or GCS) with signed URLs, virus scanning, and content-type sniffing rather than trusting the client's MIME type.
4. **Notifications** for submitters via an outbox table and a worker with retries, so a down mail service never fails the request.
5. **Operations.** Rate limiting, Helmet security headers, structured logs shipped to a log store, metrics, a readiness check that pings the database, and CI that runs typecheck and tests on every push (a starter workflow is in `.github/workflows/ci.yml`).
6. **Frontend.** Filters in the URL, polling or server-sent events for live status, React Query (or similar) for caching, and Playwright end-to-end tests for both roles.
