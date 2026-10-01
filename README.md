# E-Learning UX Prototype V2

React + Ant Design prototype. Demo accounts and course data are stored in this browser only.

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
