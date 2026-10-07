# E-Learning UX Prototype V2

React + TypeScript + Ant Design/Mantine prototype. Demo accounts and course data are stored in this browser only.

## AI / developer instructions

Before changing this prototype, read [AGENTS.md](AGENTS.md), [UI_SPEC.md](docs/UI_SPEC.md) and [CODE_SPEC.md](docs/CODE_SPEC.md). They describe the current Melearn design direction, component reuse and code conventions. [AI setup guide](docs/README.md) covers Codex, Gemini CLI and Cursor; project instructions are included in this repository so they also work after cloning it separately.

This is the active UX/UI prototype, not a Production backend. Latest user decisions take precedence over draft specifications.

Run from this directory with `npm install`, then `npm run dev -- --port 5174`.

## Environment

Copy `.env.example` to `.env.local` and set `VITE_MUX_ENV_KEY` to the Mux Data environment key for the client-side player integration. `.env.local` is ignored by Git. The current prototype does not yet initialize Mux analytics, so adding this value alone does not enable tracking.

## Feature readiness and preview builds

[Feature Release Matrix](docs/FEATURE_RELEASE_MATRIX.md) inventories all routes and separates UI, business approval, backend, and release readiness. `src/config/features.ts` controls route availability; every current feature is a prototype.

Development and Preview allow `prototype`, `integration`, and `released`; Staging allows `integration` and `released`; Production allows only `released`. `disabled` is blocked everywhere. Phase numbers are proposals and do not open routes.

`npm run dev` keeps the existing prototype walkthrough. For a built UX preview:

```powershell
npm.cmd run build -- --mode preview
npm.cmd run preview -- --port 4173
```

The default `npm run build` creates a Production bundle and hides every current feature route. `npm run build -- --mode staging` also hides current prototypes. `npm run preview` serves the last build and does not change its environment.

An explicit public `VITE_APP_ENV` build setting accepts `development`, `preview`, `staging`, or `production` and overrides the mode. Invalid values default to Production. Rebuild when changing the environment. No deployment settings were changed; any prototype pipeline using the default build must explicitly select Preview. Route gates do not enforce API permissions or remove code from the bundle.

Demo sign-in:

| Role | Email | Password |
| --- | --- | --- |
| Learner | `learner@learn.demo` | `Learn123!` |
| Instructor | `teacher@learn.demo` | `Teach123!` |
| Admin | `admin@learn.demo` | `Admin123!` |

Reset the browser demo data from Account → Reset demo data. The instructor role switch in the header is a walkthrough shortcut; use Admin → Instructors to review the invite and approval flows.

## Verification

Use Node.js 24 or later for the native TypeScript test entry. On Windows:

```powershell
npm.cmd run typecheck
npm.cmd run build
node --test tests/business-reports.test.mjs tests/profile-model.test.mjs tests/instructorAnalytics.test.ts tests/instructor-finance.test.mjs tests/ai-course-command.test.ts
node --test tests/feature-release.test.ts
```

Application source and Vite configuration use strict TypeScript. Native Node `.mjs` test harnesses are not browser application source. See [integration evidence](docs/WORKSPACE_INTEGRATION_20261004.md) for scope and verification limits.

`/learn/ai` is a standalone learner chat page on the same site. It currently stores account-scoped chat history locally and renders demo responses, math and interactive response blocks; no real model or course-document retrieval is connected yet.
