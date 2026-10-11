# Decisions / Conflicts — 10 ตุลาคม 2026

Planning baseline + execution decision register. Approval update 2026-10-11: canonical Draft.2 applies the confirmed subset below; unrelated decisions remain open. Blueprint D01–D16 เป็นรหัสของแผนนี้ แยกจาก Flow AB D1–D13; mapping อยู่ท้ายไฟล์.

## Confirmed sources

- Final1.6และ113casesเป็นbusiness source; OpenAPI86defined+5deferredเป็นHTTPDraft.
- ล่าสุดผู้ใช้ให้useexistingNestและORMต่อ แทนnewseparateprojectก่อนหน้า; ไม่scaffoldduplicate.
- NestJS/TypeScript/Prisma/PostgreSQL target; currentSQLiteเป็นimplementationgap ไม่ใช่สิทธิ์เลือกDBใหม่.
- Fresh test data; no prototype accounts/password/hash migration; no liveDBchanges.
- FirebaseEmail/GoogleกับlocalUsername; Web/Adminsharedaccountแต่แยกlogin/logoutsession; Resend/Stripe/R2/OpenRouterตามconfirmeddecisions.
- ทำคนเดียว; Git/CI placement ปิด D13 ตามคำสั่ง 11 ต.ค. 2026; ไม่ spawn agents.

## D01 — Session/security transport [PARTIALLY_CONFIRMED]

- Confirmed: Absolute session TTL 12h/no sliding, Web/Admin isolation, current-session Logout and all-app password-reset revocation confirmed 2026-10-11. Cookie/CSRF/CORS/origins/throttling remain technical/protocol review; do not reopen approved lifetime policy.
- Technical work: cookie attributes, CSRF/origin validation, session rotation and coordinated writer cutover need review/tests. No production origins or numeric throttle limits approved.
- AUTH-BASE-01 local kernel can start; AUTH-01/browser cutover must finish the transport/provider gates.
- Evidence: user accepted the preceding three-decision summary with “เอาตามนั้นเลย”; lifetime/logout/reset policy is no longer waiting for another approval.

## D02 — Username/password/profile consistency [CONFIRMED]

- Confirmed: Username ASCII 3–30, case-insensitive uniqueness/uppercase lookup, new passwords 8–128 characters and profile omitted/null/array semantics confirmed 2026-10-11; canonical Draft.2 reconciles Admin-create constraints. Implementation and provider email attachment are separate gates.
- Canonical revision: 1.0.0-draft.2, SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be. LoginRequest remains unchanged; no legacy account/hash migration.
- Profile implementation and actual Admin-create persistence/authorization tests remain outstanding; policy approval is not feature acceptance.
- Email attachment stays with D03; status/disable behavior must use Scope instead of inventing a policy.

## D03 — Firebase + Resend verification/recovery ownership [PARTIALLY_CONFIRMED]

- Confirmed: Firebase Email/Google credential ownership, Nest local Username/app sessions, explicit linking/no email auto-merge and necessary exchange/link contract design approved 2026-10-11. Wire/proof/recovery/error design, dependency justification and provider verification remain open; four Google deferred records are retained.
- Proposed technical work: specify token verification, exchange/link response/errors, collision handling and delivery/recovery compatibility with Final 1.6. The approved direction permits preparing the necessary contract delta.
- Remaining: exact provider proof/recovery protocol, 24h one-use link enforcement, production identity/From and sandbox evidence. No server SDK installed or new exchange/link path declared in Draft.2.
- AUTH-01/02/03 and provider feature cannot be accepted from a Username-only kernel.

## D04 — Authoring aggregate/revision lifecycle [UNRESOLVED]

- Evidence/conflict: Canonical PATCH aggregate replacement vs partial and review return/publish revision enforcement are still pending. Scope confirms pending_review; archived is in Draft enum but excluded from V1.
- Proposed resolution / next action: Approve revision/aggregate semantics; use current reviewed content version for approval/publish; no extra archived API.
- Blocking tasks: COURSE-02, REVIEW-02
- Owner: Lead Architect prepares; User approves policy/contract changes
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D05 — Rich document and safe content limits [UNRESOLVED]

- Evidence/conflict: JSON document version, depth/size/node limits, safe URL schemes and YouTube validation are not frozen; normal editor cannot overwrite AI-only fields.
- Proposed resolution / next action: Agree technical security limits without inventing lesson/business restrictions; keep current wire shape unless approved.
- Blocking tasks: COURSE-02, BLOG-02
- Owner: Lead Architect prepares; User approves policy/contract changes
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D06 — Assessment comparison across changed max-score versions [UNRESOLVED]

- Evidence/conflict: Scope confirms best completed score and immutable attempts; how to compare attempts after max score changes is not fully specified; start/submit replay ownership needs exact request semantics.
- Proposed resolution / next action: Decide comparison rule across versions explicitly; do not assume raw score or percentage. Preserve >70%, fully graded only, historical snapshots.
- Blocking tasks: ASSESS-01, ASSESS-02, GRADE-01
- Owner: Lead Architect prepares; User approves policy/contract changes
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D07 — Certificate file delivery [UNRESOLVED]

- Evidence/conflict: Business certificate auto-issue and private access confirmed; text mock is not a real file contract. MIME/filename/PDF generation/storage/retry protocol absent.
- Proposed resolution / next action: Approve file contract and justified library/adapter; completion/metadata design remains independent of file renderer.
- Blocking tasks: CERT-01
- Owner: Lead Architect prepares; User approves policy/contract changes
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D08 — Stripe protocol [UNRESOLVED]

- Evidence/conflict: Webhook remains deferred: verified raw body/signature/API version/event selection/late async payment behavior need provider contract.
- Proposed resolution / next action: Approve protocol + SDK justification + sandbox test plan; preserve financial state separate from grant and no refund policy invented.
- Blocking tasks: PAY-01, PROVIDER-STRIPE-01
- Owner: Lead Architect prepares; User approves policy/contract changes
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D09 — Image/R2 upload missing contract [UNRESOLVED]

- Evidence/conflict: Profile/cover/blog/essay image upload has no frozen operation in 86; video upload explicitly disabled. R2 choice already confirmed.
- Proposed resolution / next action: Approve image protocol/schema/permission/size/lifecycle; track gap without inventing endpoint. Block image-dependent acceptance only.
- Blocking tasks: ACCOUNT-01, COURSE-02, ASSESS-01, BLOG-02
- Owner: Lead Architect prepares; User approves policy/contract changes
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D10 — Replay/precondition policy [UNRESOLVED]

- Evidence/conflict: Key lifetime, same-key/different-payload conflict, create/grade partial success and timeout recovery need precise agreement.
- Proposed resolution / next action: Approve operation-specific semantics; keep naturally idempotent unique constraints; never blanket retry mutations/provider calls.
- Blocking tasks: COURSE-01, ASSESS-01, GRADE-01, PAY-01, PROVIDER-STRIPE-01
- Owner: Lead Architect prepares; User approves policy/contract changes
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D11 — Delete/retention and in-flight conflicts [UNRESOLVED]

- Evidence/conflict: AI history deletion must not refund quota; retained pending request/dedupe data and Blog delete/audit behavior are unspecified. DELETE Blog body stays canonical.
- Proposed resolution / next action: Approve deletion/retention, request vs delete race and required audit; no new retention period guessed.
- Blocking tasks: AI-05, BLOG-03
- Owner: Lead Architect prepares; User approves policy/contract changes
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D12 — AI provider/request lifecycle [UNRESOLVED]

- Evidence/conflict: JSON sync vs async/streaming, provider limits/timeouts/cancellation, reservation expiry and failed-request recovery need agreement; model ENV is confirmed.
- Proposed resolution / next action: Approve a protocol compatible with existing HTTP shape, durable cleanup and request replay; no extra streaming/status endpoint without contract approval.
- Blocking tasks: AI-03
- Owner: Lead Architect prepares; User approves policy/contract changes
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D13 — Git/CI ownership for existing Nest [CONFIRMED 2026-10-11]

- User explicitly authorized replacing the backend on GitHub repository `natthawat141/meleran-tutor`, branch `backend/v1-foundation`, and pushing it.
- Authoritative execution target: `worktrees/melearn-fullstack/backend`; sibling frontend/docs share one tracked root.
- Existing ASP.NET is retained in `legacy/aspnet` and Git history. Original standalone checkout and private ENV are preserved. No force push or main overwrite.
- Root Nest CI uses ephemeral PostgreSQL with separate runtime/migrator roles; no cloud/deployment credentials. Hosted CI result is recorded separately from local verification.

## D14 — Physical schema and transaction conventions [PROPOSED]

- Evidence/conflict: Use PostgreSQL timestamptz, JSONB snapshots/rich docs, numeric scores, opaque UUIDs; normalize role grants; shared transaction client; bounded serialization retry only without external I/O.
- Proposed resolution / next action: Schema Owner reviews Prisma model/SQL per DB task; physical choices do not alter wire IDs or confirmed business states.
- Blocking tasks: ไม่มี business policy blocker; technical review ตาม task
- Owner: Lead Architect / Schema Owner
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## D15 — Reuse existing backend/latest instruction [CONFIRMED]

- Evidence/conflict: Latest instruction overrides earlier new-project choice: use existing Nest structure and Prisma; PostgreSQL target already confirmed; no new backend scaffold or dependency installation.
- Proposed resolution / next action: Existing Nest is reused in D:\code\elearn-prod\worktrees\melearn-fullstack\backend per D13. Fresh test data only; no prototype account/hash migration.
- Blocking tasks: ไม่มี business policy blocker; technical review ตาม task
- Owner: Lead Architect / Schema Owner
- Approval evidence: Latest user request: reuse existing NestJS/ORM; earlier explicit PostgreSQL+Prisma and fresh test data instructions

## D16 — List query, cursor and public/PII projection review [UNRESOLVED]

- Evidence/conflict: OpenAPI x-pending-decisions and Flow AB D7 still leave cursor expiry/search/sort/filter semantics and visibility/PII review open. Current schema fixes wire fields/limits, but a deterministic backend query/cursor design has not been reviewed.
- Proposed resolution / next action: Review per flow: keep canonical query/response fields, choose deterministic sort tuple and cursor binding to filters/principal, decide expiry and permitted search fields. Use public canonical projections only; do not broaden PII. Close the Catalog subset first so the public vertical slice need not wait for Auth/provider decisions.
- Blocking tasks: MGMT-01, MGMT-03, MGMT-04, CATALOG-01, CATALOG-02, AI-02, BLOG-01
- Owner: Lead Architect with Backend/Frontend owner; User approves any business/HTTP change
- Approval evidence: Pending; proposed mechanism is subject to task review, unresolved policy/contract changes need approval

## Missing capability inventory (not approved new endpoints)

- R2image uploadprotocolไม่อยู่86defined; D09ระบุactor/resource/imagepolicyก่อนเพิ่มcanonical.
- Firebaseexchange/link pathsในAUTH_DECISIONเป็นproposal; 4deferredGoogleติดตามreview/replacementไม่implementทั้งหมดเป็น91readyendpoints.
- CertificateissueและAIreservationcleanupเป็นinternalworkflow ไม่เพิ่มCRUDendpoint.
- Admin/suspension fieldsในprototypeไม่เพิ่มaccountapproval/banmanagementนอกScope.
- Catalog ปิด D16 เฉพาะ flow นี้ก่อน vertical slice ได้; ไม่ต้องรอ Auth/provider ทั้งระบบ. Schema/response fields ที่ canonical กำหนดแล้วคงเดิมจน approved change.

## Canonical pending decision coverage

| Pending # | Canonical text | Blueprint decisions |
| --- | --- | --- |
| 1 | Cookie transport/names/domain/CSRF/TTL and environment origins (separate login/session confirmed) | D01 |
| 2 | Username pattern mismatch Admin create vs profile edit; unify or document compatibility | D02 |
| 3 | Revision enforcement on return-review; Blog mutations now require expected_revision | D04 |
| 4 | Idempotency key lifetime and payload mismatch/create/grade partial success behavior | D10 |
| 5 | Pagination cursor expiry/search/sort/filter limits | D16 |
| 6 | Rich document version, safe URL policy, size/depth/node limits and upload/storage | D05, D09 |
| 7 | Certificate download format vs text mock | D07 |
| 8 | Real OAuth handshake/callback and Stripe webhook/provider API version | D03, D08 |
| 9 | AI sync JSON vs async/streaming, retries/cancellation | D12 |
| 10 | Deletion/retention/audit and visibility/PII scopes | D11, D16 |
| 11 | Publish currently accepts an empty request and checks approved review/current revision server-side; agree whether client expected_revision is also required before freeze. | D04 |

## Flow AB decision register mapping

| Flow AB ID | Topic | Blueprint IDs | Current treatment |
| --- | --- | --- | --- |
| D1 | Session transport | D01 | UNRESOLVED |
| D2 | Shared identity/separate audience sessions | D01, D15 | business CONFIRMED; transport UNRESOLVED |
| D3 | Base path/version | D15 | HTTP_DRAFT: preserve canonical /api/v1 |
| D4 | Opaque IDs | D14 | HTTP_DRAFT + physical PROPOSED |
| D5 | Success shape | D15 | HTTP_DRAFT: pinned canonical subset |
| D6 | Error shape | D15 | HTTP_DRAFT: pinned canonical subset |
| D7 | Pagination | D16 | UNRESOLVED query/cursor review |
| D8 | Enum/time | D14 | HTTP_DRAFT; physical PROPOSED |
| D9 | Idempotency | D10 | UNRESOLVED |
| D10 | Account enumeration neutral responses | D03 | HTTP_DRAFT; provider delivery/recovery UNRESOLVED |
| D11 | Rate limits | D01, D03 | UNRESOLVED thresholds |
| D12 | Price | D08, D14 | HTTP_DRAFT THB minor integer; provider PROPOSED/UNRESOLVED |
| D13 | UX capabilities | D02, D16 | business permissions CONFIRMED; HTTP_DRAFT projection |

## Protocol review workflow

Leadเตรียมdecisionเฉพาะfeature → user/backend/frontendownerอนุมัติ → แก้canonical+generate/syncsnapshots/handbookตามdocsAGENTS → hashใหม่ → regenerateimpactedsubsets/matrix → re-evaluateREADY. ไม่เปลี่ยนScopeโดยปรับให้เข้ากับcode.

## Source fingerprint

ตารางนี้เก็บ byte fingerprints ของ canonical workspace ตอนสร้าง planning
baseline. Fullstack Git snapshot ใช้ LF จึงมี Scope byte SHA256
179c104ac0780d127e48a0dc2536d5cf659d7a9161da76217ae30a70264b60d8;
canonical root Scope ใช้ CRLF และยังตรง bb349f08... ในตาราง. ตรวจแล้วว่า
เนื้อหาเท่ากันเมื่อ normalize newline เป็น LF; ไม่มี business rule เปลี่ยน.
OpenAPI byte hash ตรงกันทั้งสอง checkout โดยไม่ normalize. Current execution
fingerprints อยู่ EXECUTION_STATUS.json; ไม่ rewrite historical matrix baseline.

| Source | SHA-256 |
| --- | --- |
| docs/MELEARN_V1_SCOPE.md | bb349f08f6bac5dc1f4ea15539450ecf11b53533c0cc5d83b30075c039564680 |
| docs/api-contract/openapi.json | c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3 |
| docs/api-contract/API_CONTRACT_R4A_DRAFT_TH.md | c15d874bc284ea8e85cf08068b4a1bf1d3882423c09c06cc779542deb31e321e |
| docs/api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md | 248fc99516cd2457a756aabc2b0b96812963499bde2538bbd1b6f216621bea90 |
| docs/BACKEND_DELIVERY_PLAN_TH.md | d9eb61643367665feec92abdd5e3579a4ae8bad2d00bda381620e4497a633880 |
| melearn-tutor-api/docs/AUTH_DECISION_TH.md | 1dcf980b5be02f496765830cb176f91d9d65b9ca3cc2e5dbdd3218d67d317eb8 |

## Execution review 2026-10-11

ASSESS-02 single-attempt review: Scope/DB Submitted state is absent from canonical WireAttemptView.status. No silent mapping; stored Submitted fails closed. Proposed future Submit transaction makes this an uncommitted intermediate before graded/pending_review; exposing committed Submitted requires approved canonical change. D10 and full ASSESS-01 remain open; single canonical-state self read is independently verified. Details: [ATTEMPT_READ_COMPONENT](ATTEMPT_READ_COMPONENT.md).

Blog projection/authoring subreview D05/D16: [CONTRACT_STORAGE_GAPS](CONTRACT_STORAGE_GAPS.md)
records missing plain content/category/reading_minutes and JSON null/omitted mapping.
No server reading-time formula or category default is inferred. CATALOG-02 detail
uses canonical public fields and normalized grants; its list policy remains D16.
Internal entitlement writer and one-attempt score math implement confirmed facts
only; they do not close Auth/source proofs, D06 or whole feature gates.

[Next decision packet](NEXT_DECISIONS_TH.md) holds concrete Proposed A/B/C choices; none is silently approved. COMPLETION-01 depends on DB-03 and D06 because its own acceptance requires best result selection. Physical batches are reviewed/applied only to melearn_test; D14 review is per batch and does not resolve business policy.

Execution conflict PAY-02 (11 ต.ค.): required string `WireAdminPayment.checkout_session_id` excludes valid pre-provider intent with null; event `outcome` has no approved interpretation of stored receipt processing state. Proposed required-nullable + explicit D08 outcome mapping awaits contract approval. Own Payment read is independent and implemented; never invent empty Checkout ID or infer fulfilled from processed. Evidence: [LOGOUT_PAYMENT_COMPONENTS](LOGOUT_PAYMENT_COMPONENTS.md).
