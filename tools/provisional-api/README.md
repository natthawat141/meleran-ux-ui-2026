# Provisional API mock (development and tests only)

This directory is a fetch-compatible, in-memory stand-in for a Backend that does not exist yet. It exists so
Frontend work (Query hooks, page migration, tests) can proceed against a *draft* contract and later switch to a
real server by changing the HTTP client's `baseUrl` and `fetcher`.

It is **not** a Backend, **not** a contract, **not** seed data for production, and proves nothing about a real
server. Anything under `tools/provisional-api/` may change or be deleted when a Backend owner publishes OpenAPI.

## Rules

- Never imported from `apps/` or `packages/`. `tests/provisional-api-boundary.test.mjs` fails if it is.
- `createProvisionalApi` throws unless `environment` is `development` or `test`.
- Clients never fall back to this mock when a real call fails (`createCatalogApi` only knows the HttpClient it is given).
- Public responses are built by explicit allow-list projections (`domain.ts`), never by returning records.
- Anything the draft does not specify is either rejected (unknown fields/query names answer 422) or listed as a
  *mock-only assumption* at the top of the flow file and in `docs/PROVISIONAL_API_MOCK_TH.md`.

## Layout

| File | Role |
| --- | --- |
| `server.ts` | `createProvisionalApi`, router, per-"browser" cookie jar, error envelope |
| `http.ts` | `Route`, `RequestContext`, `ApiError`, validation/pagination/permission helpers, `MockConfig` |
| `db.ts` | in-memory record types, clock, id factory |
| `domain.ts` | shared rules and projections (enrollment, progress, completion, certificate, course DTOs) |
| `seed.ts` | seeded accounts, courses (with `SECRET` markers on private data), blog posts, redeem codes |
| `flow-a-auth.ts` … `flow-h-blog.ts` | one file per flow in `docs/API_CONTRACT_R4A_DRAFT_TH.md` |

## Conventions

- A route is `{ method, path, handler }`; `path` has no leading slash and uses `:param` segments, for example
  `courses/:id/enroll`. The router strips the client's `basePath`.
- Handlers read `context` (`db`, `clock`, `config`, `principal`, `query`, `params`, `body`, ...) and return
  `ok(body)`, `created(body)`, `accepted(body)`, `noContent()` or throw `ApiError(status, code, message, options)`.
  Error body is `{ error: { code, message, request_id, details? } }` (draft D6); success bodies are resources,
  not wrapped in `data` (draft D5); lists are `{ items, next_cursor }` with `limit`/`cursor` (draft D7).
- Use `readObject` + `rejectUnknownFields` for request bodies so a Client cannot send `roles`, `price`,
  `passed`, `user_id`, and similar server-owned values.
- Resources owned by a user answer `404 not_found` (not 403) to other users when existence itself is private.
- IDs are opaque strings from `nextId(db, prefix)`; time comes only from `context.clock`.
- Sessions are an `HttpOnly` cookie held in the fetcher's own jar (draft D1 proposal). Web and Admin use
  different `createFetcher()` instances, so their sessions are independent (draft D2 assumption).
- TypeScript is run directly by Node type stripping: use `.ts` import extensions and erasable syntax only
  (no `enum`, no constructor parameter properties).

## Tests

`tests/support/provisional-api.mjs` provides `createWorld()` and `createBrowser()`. Seeded accounts and the
shared password are in `seed.ts` / `accounts`. Each test should end by asserting
`world.api.unexpectedErrors` is empty (a non-empty list means a bug in the mock itself).
