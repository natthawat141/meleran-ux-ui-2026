# MGMT-03/04 + PAY-02 — historical management reads

Contract: Draft.2 / SHA256 `b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be`. Business: Final1.6 §3.3–3.4, management/task source excerpts. Latest user authorizes documented technical choices and continuing independently.

## Implemented subset

| Method | Canonical path | Package |
| --- | --- | --- |
| GET | `/courses/{id}/learners` | MGMT-03 |
| GET | `/courses/{id}/attempts` | MGMT-03 |
| GET | `/admin/users/{id}/enrollments` | MGMT-03 |
| GET | `/admin/users/{id}/attempts` | MGMT-03 |
| GET | `/instructor/learners` | MGMT-04 |
| GET | `/admin/learners` | MGMT-04 |
| GET | `/admin/payments/{id}` | PAY-02 |

Fresh normalized owner Instructor/Admin authority precedes resource selection; global/account management is Admin-only. Instructor learner directory uses Web Instructor only. Unknown/foreign Course returns404; Enrollment never grants management authority. Existing empty Course/account returns canonical empty page. Archived academic/payment history remains readable within management authority.

## Technical choices

- One roster row is one Enrollment, preserving required `course_id`; a learner enrolled in two courses has two rows. No guessed primary course or personal-contact data.
- Read current curriculum/Progress under RepeatableRead; only matching CompletedProgress contributes. `percent` rounds the display ratio to an integer; it does not alter assessment pass/completion. Certificate name/time are original snapshots; inconsistent completion proof fails500 without repair.
- Roster order granted_at DESC/id ASC; Attempt order started_at DESC/id ASC. Existing signed keyset binds namespace/resource/principal/limit; default20,1–50. Unknown/repeated query fields reject422.
- `Assessments.ManagedAttemptReader` is a public trusted transaction participant, called only after authority and scoped IDs. Course→Enrollment→Attempt shared locks; public historical snapshot projection excludes answer keys/provider/profile fields. Management can view submitted/pending feedback and grades without changing records. Existing single owner Attempt endpoint uses the same reader.
- Admin payment lookup uses Payment→Enrollment shared locks and RepeatableRead; no Stripe I/O, retry, charge, grant or financial inference. Canonical DTO includes stored amount/request/session/event metadata only, never raw provider proof/error diagnostics.
- Prior PAY-02 wait is resolved under renewed user authority: Draft required-string `checkout_session_id` uses empty string when no session exists, explicitly meaning unallocated. No fabricated Stripe ID; provider/full checkout remains pending. A future nullable contract revision can replace this marker with coordinated client change.
- Event `outcome` exposes stored receipt processing state (`received`/`processed`/`failed`), not inferred fulfillment. Enrollment/fulfillment remains a separate authoritative field. This overrides the previous undecided mapping without inventing a refund/payment policy.

## Verification and remaining gates

`management-history.pg-spec.ts`:16 real HTTP/PostgreSQL cases, including canonical DTOs, authority, immutable snapshots, keyset isolation, corruption/no repair, concurrent read and reconnect. Existing managed single-Attempt25 regression cases passed after reader extraction. Existing own-payment16 passed after shared projection extraction. PAY-02 targeted cases and actual Frontend transport evidence are recorded in EXECUTION_STATUS only after passing.

No schema/migration/dependency changes. Build/typecheck/boundaries and actual Web/Admin API clients are required before commit. Hosted exact-SHA regression is a separate checkpoint. Authenticated browser and original113 acceptance remain pending; this document does not accept entire waves.
