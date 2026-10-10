# Enrolled learning reads — execution component

11 ต.ค. 2026. LEARN-01 learner subset; whole task/feature gate remains BLOCKED.

## Traceability / confirmed behavior

- Final 1.6 §2.1, §2.5–2.7, §3.2/3.3, §6.4. Account readiness and effective Enrollment control learner content; Instructor learns another instructor's course. Opening content never completes, grants, grades or issues a certificate. Progress/resume belong to one Enrollment; historical completion/certificate survive later content additions.
- Canonical Draft `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` unchanged. [LEARN-01 subset](contracts/LEARN-01.openapi.json) contains exact required/null/type/schema/security and errors.

| Method/path (prefix `/api/v1`) | operationId | Output |
| --- | --- | --- |
| GET /learn/courses/{id} | get_learn_courses_id | WireLearningCourse |
| GET /learn/courses/{id}/items/{item_id} | get_learn_courses_id_items_item_id | WireLearningItemContent |

No request body/mutation added. Related original acceptance IDs stay mapped in [LEARN-01](tasks/LEARN-01.md); no numbered case is closed from component tests.

## Authorization / read ownership

`LearningModule` is feature-local. Controller opts into normalized Web authority and Learner/Instructor roles. Service rechecks stored Session/Account/UserRole via Auth-owned `requireLearning` in the caller transaction, including verification readiness and Admin exclusion. It then checks Published/publish time and **own Enrollment**. No expiry is invented for lifetime grants. Paid-course reads are allowed with an existing grant regardless of its original free/Stripe/redeem source; price changes do not replace the original grant.

Bounded read joins are explicitly authorized here: Course/Instructor public summary and ordered Chapter/Item identity; own Enrollment/Progress and Certificate id; authorized Item body/video; Quiz question **maxScore only** for metadata. No cross-feature writes, full Account/profile, private attempt, answer keys/options/editor instructions or VideoTranscript query/projection. Owner management privileges alone cannot manufacture learner Enrollment.

Both paths return 401 for missing/expired/revoked/disabled proof, 403 for unready/unauthorized/no Enrollment, 404 for missing/non-Published Course or an Item outside the authorized Course. Error envelopes contain safe messages/correlation, never stored private diagnostics.

## Transactions / consistent current reads

ReadCommitted → fresh authority locks → Course shared lock → own Enrollment shared lock → bounded projections → commit. Reuse the fresh-authority kernel rather than a RepeatableRead snapshot taken before a concurrent role grant commits. No provider/network call or writes.

**Writer integration contract:** Course authoring must take its exclusive Course lock; completion/resume/progress commands must acquire their Enrollment exclusive lock after Course, before Progress changes. These locks keep the multi-query read coherent. A SQL client that bypasses owner command locks is not the supported concurrent writer path. The actual PostgreSQL test proves both coordinated Course and Progress writes wait until the read ends, and a later read sees both updates.

Outline orders Chapters/Items by position/id. Current `completed_items` counts completed Progress rows among the current outline, not the prototype `Enrollment.completedItems` cache. `total_items` counts current Items (one Quiz set is one Item). Historical `completed_at` and Certificate id remain original; additional optional Items do not rewrite them or generate Progress during GET.

Resume projection reads stored `position_seconds` (finite non-negative or null) and Progress.updatedAt, exposes no extra JSON fields, and chooses the most recently updated own row with resume data in the current outline (itemId breaks ties). This is the storage projection used by this component, not a new autosave cadence/precision policy. The future writer must preserve a coherent resume timestamp; see pending reconciliation below.

Type-specific content: Video returns video_url; Article returns body:null + stored JSON body_doc so the unchanged frontend decoder retains the document; Quiz returns only question_count and max_score from stored definitions. Decimal aggregation uses a local precision constructor; wire number is display metadata, never grading input. Missing Quiz definition or invalid stored resume fails closed as safe 500. Raw Article JSON is returned as canonical data; D05 authoring validation/render safety and YouTube delivery behavior are not declared accepted here.

## Tests / integration evidence

- `test/database/learning-read.pg-spec.ts`: **13 actual HTTP/PostgreSQL tests**, including real Free Enroll → course, source/lifetime/Instructor, complete canonical payloads, type-specific privacy, own vs foreign progress, proof lifecycle, ID tampering, no-write/reconnect, stale cache ignored, preserved historical completion/certificate, safe corrupt-state failures and coordinated concurrent writes via `pg_blocking_pids`.
- `scripts/verify-frontend-detail.cjs`: keeps 6 Catalog + 7 Free Enroll checks and adds **11 Learning checks**. Actual unchanged frontend `learningApi` endpoint builders/decoders → actual HttpClient/fetch → built Nest → owned Test PostgreSQL. For Node execution only, the Vite singleton's configuration is injected with the test base URL/session; frontend code/decoders and transport are not mocked or copied. Tests read Article/YouTube/Quiz, private-field exclusions, owner/anonymous/foreign-item denial, persisted own resume/reconnect and server/network errors. Real login/provider/browser gates remain separate.
- Follow backend checks: typecheck, boundaries/blueprint, foundation/component units, database suite, build; after database tests finish, run no-write smoke and client integration sequentially. Aggregate expected checkpoint **49 + 16 + 117 = 182 tests**, plus **24 client checks**. Current verified SHA/CI is recorded in EXECUTION_STATUS.json after the checkpoint.

## Unresolved / remaining work

- Whole LEARN-01 still needs GET /me/progress query/projection, full Auth/normalized writers and Course-authoring prerequisites, real authenticated browser G-LEARNING. No complete/submit/grade/resume-write/Certificate delivery implementation is claimed.
- **Scope/HTTP mapping conflict:** Scope §6.4 describes learner/owner/Admin contexts on learning reads; canonical WireLearningCourse accepts only `access.mode='enrolled'`, and these paths advertise WebSession/effective Enrollment. The existing task proposes the canonical `/courses/{id}/authoring-preview` for management view. This component implements only the confirmed enrolled learner subset; owner/Admin preview and final reconciliation remain part of COURSE-02/D04. Do not add enum variants, silently grant ownership-based Enrollment, or claim F03 accepted.
- D04 curriculum/revision/reconciliation and D05 rich-document/URL writer validation remain open. D06 best-attempt selection is not decided by this reader; accepted Progress records are read, no score is recalculated. Resume writer timestamp vs completion updates must be reviewed when LEARN-02 is implemented. D01–D03 Auth transport/provider policies remain open.
- No new dependencies, schema/migration, contract changes, startup seed, provider call, STG or deployment.
