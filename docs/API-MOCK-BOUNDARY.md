# API and mock-data boundary

## Current implementation

- Existing broad demo state remains in `src/data.js` and is persisted by `src/store.jsx` to the browser key `stay-elearn-ux-v2`.
- New assignment seed data lives in `src/mocks/assignments.json` and is merged into reset/first-run prototype state.
- New page behavior calls domain actions on `useLms`; pages do not access browser storage directly.
- `src/api/analytics.js` is a deterministic read-model over the supplied demo state. It is not a server endpoint, event collector, or analytics SDK.
- JSON fixtures and localStorage are mutable per browser profile, easy to inspect/edit, and unsuitable for secrets, private learner work, secure uploads, concurrency, or multi-user truth.

## Replacement seam

When backend work begins, preserve the page/domain contract and replace the mock adapter behind `useLms` with an HTTP client. Keep the DTOs explicit and avoid making components depend on storage format.

Initial endpoint candidates (not approved API routes):

| Capability | Candidate operation | Required server checks |
|---|---|---|
| Assignments | list/create/update/cancel/delete | actor role; instructor owns course or admin; selected quiz belongs to course/chapter; each recipient is enrolled; preserve attempts |
| Learner task list | list assignments for current learner | derive actor from session; never accept arbitrary learner ID |
| Quiz attempt | create/resume/save draft/submit/get result | assignment recipient; course enrollment/entitlement; attempt state; idempotent submit; immutable quiz version |
| Grade essay | get attempt/grade attempt | instructor owns course or admin; only pending essay; score bounds; audit event |
| Analytics | get scoped summary/course rows/time series | actor's authorized course scope; server-derived definitions; no client-supplied scope escalation |
| Payment | create checkout/get status/webhook | provider decision first; server-owned price; signed webhook; idempotency; explicit pending/failed/paid/refund states |

Do not implement these routes from this table without an approved backend/API decision. Error envelopes, pagination, concurrency/version fields, authorization claims, tenant identity, retention and observability still need a separate contract.

## Data migration principle

Move one bounded domain at a time from JS fixture to JSON and then to API. Do not bulk-convert the current catalog blindly: course fixtures contain imported image assets and nested rich content. Keep seed IDs stable so local prototype records remain understandable; version/reset migrations intentionally and document destructive resets before changing the storage key.
