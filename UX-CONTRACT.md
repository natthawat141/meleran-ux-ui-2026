# melearn UX and behavior contract (prototype)

## Status and scope

`elearning-ux-v2` is a reviewable front-end prototype. Its local browser data, demo accounts, payment outcomes, file previews, and analytics are illustrative. None are production security, storage, financial, or reporting guarantees.

This implementation slice covers:

1. Instructor/admin assignment of an existing course quiz to enrolled learners of that same course.
2. Learner assignment inbox with start/resume/result states.
3. A safer single quiz-edit path, immutable attempt snapshots, and preservation of submitted work.
4. Role-scoped analytics derived only from existing course, enrollment, progress, attempt, and mock order data.
5. Provider-neutral payment copy while a provider is undecided.
6. A JSON fixture and a documented adapter boundary for future API work.

Not implemented as live integrations: backend APIs, real payment, AI/MCP authorization, event telemetry, external file storage, reminders/email, or production analytics. Those need their own contracts and security review.

## Roles and access

| Role | Assignments | Analytics | Course editing |
|---|---|---|---|
| Learner | View only active/cancelled assignments explicitly addressed to their account; start/resume their own attempt; see their own result | None in this slice | None |
| Instructor | Create/edit/delete assignments for courses they own; recipients must be enrolled in the selected course; view analytics for owned courses | Owned courses only | Existing course ownership rules |
| Admin | Manage assignments across courses; recipient selection still comes from that course's enrollments | All courses | Existing admin capability to edit all courses |

The front end filters by role for prototype UX. A future server must repeat every permission and resource-scope check; client-side filtering is not authorization.

## Assignment lifecycle

- Assignment fields: course, chapter/quiz, title, instructions, learner IDs, active/cancelled state, author and timestamps. Due dates and attempt limits are deliberately omitted until decided.
- A recipient must be enrolled in the selected course at assignment creation/update time.
- A learner sees an assignment only when their ID is in its recipient list. A URL parameter is not proof of access.
- A submitted attempt stores `assignmentId` and a quiz snapshot. Assignment history remains linked to the learner and course.
- Before any learner starts/submits, an assignment may be edited or deleted. After an attempt exists, recipient/content edits and hard deletion are blocked; the instructor may cancel future work while preserving the record.
- The prototype allows a learner to start another attempt after submission; the real retry policy is undecided and must be confirmed before production.
- Due dates, reminders, late handling, reassignment after enrollment removal, and grading SLA remain open decisions.

## Quiz authoring and submissions

- The chapter workspace and its `AssessmentEditor` are the canonical authoring path. Legacy `/teach/quizzes/:quizId` edit URLs should route there, not to a second lossy editor.
- Choice questions support two or more choices; essay questions may accept text, images, or both. Existing image component limits are three images per question, JPG/PNG/WebP, up to 5 MB each.
- Saving an attempt draft must not submit it. Submit is explicit; the learner sees an outcome and may reopen their own result.
- Every attempt retains the quiz content/answer/rubric snapshot used when the learner started. Later edits cannot silently change an in-progress or historical attempt.
- When an attempt exists, changing that quiz is blocked in this prototype. A true quiz version/release model is still required for production.
- Essay grading is pending until an instructor/admin with access records a score and feedback. Certificate eligibility continues to use the existing course-completion rule; do not represent a pending essay as passed.
- Image data URLs in localStorage are demo-only. Production requires server-side type/size validation, malware/content handling, access-controlled object storage, retention/deletion policy, and upload progress/retry semantics.

## Analytics definitions

Current analytics are derived, not an event warehouse:

- Enrolled learners: distinct learner accounts with an enrollment in the visible course scope.
- Course progress: completed visible curriculum items divided by total items for each enrollment. Quiz items count only when a submitted attempt is passed; other items use the existing completion flag.
- Quiz activity: saved attempts and submitted attempts in the selected course scope; pending written reviews count attempts with `essayStatus = pending`.
- Pass rate: passed submitted attempts divided by submitted attempts with a final pass/fail value. Pending essay attempts are excluded from the denominator.
- Revenue: sum of prototype orders marked `paid`, explicitly labeled simulated. This is not settlement, recognized revenue, or a finance report.
- Not available: video watch duration/percent, attendance, time-on-task, device/session history, learning-event funnel, cohort retention, or reliable daily active users. Do not estimate or invent them.

## Payment boundary

- Provider, supported methods, fee/tax/refund/settlement rules, payment state machine, webhook trust, and retry/idempotency behavior are undecided.
- Checkout is a clearly labeled mock only. Do not collect real card/bank details or call a real provider.
- Do not claim a real payment succeeded. Mock `paid` orders must stay visibly identified as prototype data.

## Future AI/MCP boundary

No AI tool may rely on UI visibility as permission. Future tools should use authenticated server-side actor identity and enforce tenant/resource scope on every call. Begin with read-only learner tools (course outline, authorized lesson text/material metadata, personal progress, study-plan draft) and instructor/admin tools scoped to courses they own or administer. No tool should reveal answer keys, another learner's submission/PII, or bypass grading/publication/payment state. Write tools require explicit schemas, audit records, confirmation/idempotency for consequential actions, and deny-by-default permission tests before exposure to Codex, Claude, or another MCP client.

## Open decisions before production

Payment provider and payment/refund lifecycle; assignment due dates and retry policy; quiz versioning and historical grading semantics; course enrollment and role/tenant model; analytics event taxonomy and retention; notifications; upload storage and privacy; certificate criteria across retries; AI/MCP scopes and audit policy; API error/conflict and idempotency contracts.
