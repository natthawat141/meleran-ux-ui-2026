# E-Learning UX Prototype V2

**Approved business scope:** [Melearn Final 1.6](docs/MELEARN_V1_SCOPE.md), based on the owner-reviewed Final 1.5 and the confirmed Stripe/AI-practice additions on 6 October 2026. This is the source of truth for the first month. [Release matrix](docs/FEATURE_RELEASE_MATRIX.md) tracks implementation readiness separately. Stripe course payments are now in scope. Cart/order history, finance and inbox screens remain legacy prototypes outside V1.

React + TypeScript + Ant Design/Mantine prototype. Demo accounts and course data are stored in this browser only.

## AI / developer instructions

Before changing this prototype, read [AGENTS.md](AGENTS.md), [UI_SPEC.md](docs/UI_SPEC.md) and [CODE_SPEC.md](docs/CODE_SPEC.md). They describe the current Melearn design direction, component reuse and code conventions. [AI setup guide](docs/README.md) covers Codex, Gemini CLI and Cursor; project instructions are included in this repository so they also work after cloning it separately.

This is the active UX/UI prototype, not a Production backend. Latest user decisions take precedence over draft specifications.

Run from this directory with `npm install`, then `npm run dev -- --port 5174`.

## Environment

V1 uses YouTube links. Mux/Bunny has not been selected. `.env.example` retains the optional `VITE_MUX_ENV_KEY` from the prototype for potential Mux Data analytics; do not treat it as a required V1 integration. `.env.local` is ignored by Git. The current prototype does not yet initialize Mux analytics, so adding this value alone does not enable tracking.

## New first-month requirements

AI accepts “สร้างแบบฝึกหัด” or `/quiz` and returns an interactive multiple-choice set in chat, with saved answers and feedback. These practice scores do not affect course progress or certificates. Stripe course checkout grants lifetime enrollment after server-verified payment; redemption codes remain another entry path. The current UI responses and checkout are still browser-local mocks: neither real quiz generation nor Stripe/payment APIs are connected by this documentation update.

## Feature readiness and preview builds

[Feature Release Matrix](docs/FEATURE_RELEASE_MATRIX.md) inventories all routes and separates UI, business approval, backend, and release readiness. `src/config/features.ts` controls route availability; every current feature is a prototype.

Development and Preview allow `prototype`, `integration`, and `released`; Staging allows `integration` and `released`; Production allows only `released`. `disabled` is blocked everywhere. First-month scope follows the approved Final 1.6. Items marked Later have no committed delivery date. Phase metadata does not open routes.

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

Reset the browser demo data from Account → Reset demo data. The instructor role switch in the header is a walkthrough shortcut; Admin alone grants Instructor access under the approved scope; legacy application screens are outside V1.

## Verification

Use Node.js 24 or later for the native TypeScript test entry. On Windows:

```powershell
npm.cmd run typecheck
npm.cmd run build
node --test tests/feature-release.test.ts
node --test tests/business-reports.test.mjs tests/profile-model.test.mjs tests/instructorAnalytics.test.ts tests/instructor-finance.test.mjs tests/ai-course-command.test.ts
```

Application source and Vite configuration use strict TypeScript. Native Node `.mjs` test harnesses are not browser application source. See [integration evidence](docs/WORKSPACE_INTEGRATION_20261004.md) for scope and verification limits.

## Email verification and course review prototype

Self-service email registration creates an unverified account and a local verification link. Login is allowed, while enrollment, redemption and learning require verification. Links expire after 24 hours and work once. `/verify-email` offers a new mock link after a prototype cooldown of 60 seconds. No email is sent and Resend is not connected. Existing demo accounts and Admin-created accounts without an unverified flag keep their access.

Google mode only simulates linking a matching email to the currently signed-in account. It does not perform OAuth, create users or merge accounts.

Courses follow `draft → pending_review → approved → published`. The owner Instructor or Admin submits a draft, Admin approves or returns it with a reason at `/admin/courses/reviews`, and the owner or Admin publishes an approved course. Editing an approved or pending course returns it to draft; published edits remain published.

Checks and browser walkthrough results: [Email verification and course review](docs/EMAIL_VERIFICATION_COURSE_REVIEW_20261006.md).

`/learn/ai` is a standalone chat page for learners, instructors and admins. Learners must be enrolled in an AI-enabled course; instructors can use their own enabled courses or courses they are enrolled in, and admins can inspect enabled courses. It stores account-scoped chat history locally and renders demo responses, math and interactive response blocks; no real model or course-document retrieval is connected yet.
