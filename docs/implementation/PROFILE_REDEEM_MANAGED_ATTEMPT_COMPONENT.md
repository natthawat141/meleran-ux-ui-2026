# HTTP component checkpoint — Profile / Redeem / Managed Attempt

11 ต.ค. 2026 · Canonical Draft.2 SHA256
`b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be`.
ไม่มี schema/migration/dependency delta. Scope และ 113 acceptance IDs คงเดิม.

| Operation / task | Implementation | PostgreSQL evidence |
| --- | --- | --- |
| `PATCH /me` / ACCOUNT-01 | Accounts facade → Auth public SelfProfileWriter; fresh bound self authority, explicit field whitelist, case-insensitive Username uniqueness, omitted/null/array semantics ตาม D02 | 10 added HTTP/PG tests + 6 pipe units; existing GET tests 14 unchanged |
| `GET /instructor/attempts/{id}` / MGMT-04 | Owner Instructor เท่านั้น; Admin รวม multi-role ห้ามใช้; historical normalized snapshots, learner display name, choice subtotals/manual grades, ไม่เปิด correct keys | 10 added HTTP/PG tests; existing learner Attempt tests 15 unchanged |
| `POST /admin/redeem-codes` / REDEEM-01 | Fresh Admin/audience, Published paid course, atomic 1–50 batch; cryptographic random unique code, original issuer/time, no learner before use | 5 added HTTP/PG tests including full-batch DB rollback |
| `POST /me/redeem` / REDEEM-02 | Fresh learning eligibility → Course shared lock → Code exclusive lock → central entitlement; new grant201 / existing grant200; existing enrollment leaves new code Unused | 9 added HTTP/PG tests; existing shared revoke/transaction tests21 unchanged |

## Technical conventions / evidence boundary

- Profile Writer locks Session → Account UPDATE before fresh self recheck; concurrent
  Username claims have one200/one409. Empty PATCH has no write; private profile
  metadata preserved but never returned. Avatar accepts canonical URL metadata;
  actual image upload remains D09 PENDING and does not block this operation.
- Managed Attempt reads Course → Enrollment → Attempt and stored question/answer
  projection. `submitted` is preserved as canonical ManagedAttempt state; does not
  imply final grading or select best score across max-score versions. D06 remains
  PENDING for result selection/writes, not this historical read.
- Issue omitted optional `count` uses one; this is an explicit technical convention
  compatible with the Draft optional field and client single-code use case. Code
  generation uses 128 random bits/Node crypto and DB unique defense. A collision or
  batch failure rolls back the whole batch; no automatic mutation retry/replay.
- Redeem `code` remains an opaque canonical string with exact lookup. No expiry,
  trimming or case-folding policy added from mock behavior. Optional user-friendly
  normalization would need a contract decision; current real client transmits code
  unchanged. Unknown/Used/Revoked/non-public/free codes return unavailable404.
- Denied eligibility checked before code lookup; own-course denial doesn't consume
  code. Foreign Instructor can get enrollment but no ownership/editor/grading right.
- No payment/share/order record invented for redemption; original lifetime grant
  and source are preserved. Reset/revoked-after-guard and real rollback tested.

Frontend gate uses existing `authSessionApi.updateProfile`, Web resource+management
decoder, `redeemAdminApi.create` and `paymentApi.redeem`, real fetch → Nest → isolated
PostgreSQL. Client checks are recorded separately from Jest. Seeded valid sessions
are component evidence, not a completed Firebase/browser authentication acceptance.

## Remaining work

ACCOUNT-01 and REDEEM-02 now have every canonical operation implemented at component
level. REDEEM-01 still lacks the masked paginated list (D16); MGMT-04 still lacks
the two roster directories (D16/PII). Image upload/Auth/browser and G-REDEEM/G-AI
feature acceptance remain PENDING. Do not label full waves/cases DONE from this
checkpoint. Continue dependency-independent components; pending decisions do not
freeze their entire parent task or the Wave 1–17 queue.
