# AI implementation and handoff rules

Read `DESIGN.md`, `UX-CONTRACT.md`, and `docs/API-MOCK-BOUNDARY.md` before changing product behavior. Treat `src/data.js` and `src/mocks/*.json` as prototype fixtures, not production records.

## Build and change rules

- Keep code under the existing React/Vite structure; reuse installed components and tokens. Avoid introducing a new state/data library for one feature.
- UI calls the `useLms` domain actions; pages should not write `localStorage` directly. Keep demo persistence behind the store/adapter boundary.
- Never claim a mock response, browser storage write, payment, upload, or analytics metric is production-confirmed.
- Enforce actor/role/resource scope in domain actions as well as hiding unauthorized UI. Preserve other users' submitted work and history.
- Do not implement undecided business behavior (payment methods, fees/refunds, attempt limits, due dates, AI write permissions); keep it visibly unresolved and update the open-decision section.
- Validate data before save; preserve drafts on errors; show a recoverable message. Destructive actions require scoped confirmation and safe history handling.
- Use visible labels, keyboard-operable controls, focus states, reduced-motion support, and explicit empty/loading/error states. Do not use emoji as icons.
- No dependency additions without a clear requirement and an update to this document.

## Required handoff for each feature

Report files and behavior changed; role/resource scope; data shape and migration/default behavior; source-of-truth or mock limitations; unresolved decisions; build command/results; manual flows inspected; and any tests not run. Do not call a feature production-ready just because the Vite build succeeds.

## Build and test policy

- Build: `npm run build` is the current available production-bundle check.
- Tests: this repository currently has no `test`, lint, or typecheck script. Do not describe tests as passing. Before a feature is merged, the project owner should choose a test runner and add unit/component coverage for permission boundaries, assignment eligibility, quiz snapshots/grading, and analytics calculations, then browser-test keyboard/mobile and recovery states.
- For small UX-only changes, use a bounded manual smoke of only touched routes and role paths. For business logic changes, add automated tests before production adoption.
- Never use another developer's active port/process as your preview server or stop it. Use an explicitly isolated port/worktree for preview.
