# E-Learning UX Prototype V2

React + TypeScript + Ant Design/Mantine prototype. Demo accounts and course data are stored in this browser only.

## AI / developer instructions

Before changing this prototype, read [AGENTS.md](AGENTS.md), [UI_SPEC.md](docs/UI_SPEC.md) and [CODE_SPEC.md](docs/CODE_SPEC.md). They describe the current Melearn design direction, component reuse and code conventions. [AI setup guide](docs/README.md) covers Codex, Gemini CLI and Cursor; project instructions are included in this repository so they also work after cloning it separately.

This is the active UX/UI prototype, not a Production backend. Latest user decisions take precedence over draft specifications.

Run from this directory with `npm install`, then `npm run dev -- --port 5174`.

## Environment

Copy `.env.example` to `.env.local` and set `VITE_MUX_ENV_KEY` to the Mux Data environment key for the client-side player integration. `.env.local` is ignored by Git. The current prototype does not yet initialize Mux analytics, so adding this value alone does not enable tracking.

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
```

Application source and Vite configuration use strict TypeScript. Native Node `.mjs` test harnesses are not browser application source. See [integration evidence](docs/WORKSPACE_INTEGRATION_20261004.md) for scope and verification limits.

## Email verification and course review prototype

Self-service email registration creates an unverified account and a local verification link. Login is allowed, while enrollment, redemption and learning require verification. Links expire after 24 hours and work once. `/verify-email` offers a new mock link after a prototype cooldown of 60 seconds. No email is sent and Resend is not connected. Existing demo accounts and Admin-created accounts without an unverified flag keep their access.

Google mode only simulates linking a matching email to the currently signed-in account. It does not perform OAuth, create users or merge accounts.

Courses follow `draft → pending_review → approved → published`. The owner Instructor or Admin submits a draft, Admin approves or returns it with a reason at `/admin/courses/reviews`, and the owner or Admin publishes an approved course. Editing an approved or pending course returns it to draft; published edits remain published.

Checks and browser walkthrough results: [Email verification and course review](docs/EMAIL_VERIFICATION_COURSE_REVIEW_20261006.md).

`/learn/ai` is a standalone learner chat page on the same site. It currently stores account-scoped chat history locally and renders demo responses, math and interactive response blocks; no real model or course-document retrieval is connected yet.
