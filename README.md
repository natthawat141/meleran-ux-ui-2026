# E-Learning UX Prototype V2

React + Ant Design prototype. Demo accounts and course data are stored in this browser only.

Run from this directory with `npm install`, then `npm run dev -- --port 5174`.

Demo sign-in:

| Role | Email | Password |
| --- | --- | --- |
| Learner | `learner@learn.demo` | `Learn123!` |
| Instructor | `teacher@learn.demo` | `Teach123!` |
| Admin | `admin@learn.demo` | `Admin123!` |

Reset the browser demo data from Account → Reset demo data. The instructor role switch in the header is a walkthrough shortcut; use Admin → Instructors to review the invite and approval flows.


## Admin business and finance reporting prototype

Instructor analytics implementation follows [the instructor UX/UI specification](docs/INSTRUCTOR_ANALYTICS_UI_SPEC.md), including owner scoping, first submitted attempt selection, pending grades, paired Pre/Post comparison, and UI verification criteria.

- `/admin/business-analytics`: synthetic daily activity, learning/purchase-hour heatmaps, funnel and course breakdown.
- `/admin/finance`: synthetic confirmed payments, completed refunds, fees, signed ledger and CSV. No real payment or refund action.
- [UX/UI specification](docs/BUSINESS_ANALYTICS_UI_SPEC.md)
- [Metrics, raw events and draft API contract](docs/BUSINESS_ANALYTICS_DATA_SPEC.md)
- [Admin management gaps and quick work list](docs/ADMIN_MANAGEMENT_GAP_AUDIT_TH.md)

Verify with `npm run build`; domain tests: `node --test tests/business-reports.test.mjs` on Node 24. This feature uses isolated TS/TSX modules supported by Vite; it does not migrate the existing JavaScript application.
