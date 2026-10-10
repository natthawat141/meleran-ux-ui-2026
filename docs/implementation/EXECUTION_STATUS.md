# สถานะ Melearn NestJS Wave 1–17

อัปเดต 11 ต.ค. 2026. เป้าหมายยังครบ 50 tasks / 86 defined + 5 deferred operations / 113 acceptance cases.

## ผลที่ตรวจแล้ว

- DONE: FOUNDATION-01, DB-01, DB-02, DB-05, DB-03, DB-04 (7/50 tasks พร้อม CI-01).
- Foundation/architecture tests 49/49; PostgreSQL + actual HTTP/persistence components 160/160; feature-local units 16/16; รวม 225 tests. Strict typecheck และ Nest build ผ่าน. Frontend client integration มี 6 Catalog + 7 Free Enroll + 11 Learning + 7 Admin Revoke + 6 generic Video unavailable transport checks (37 รวม) แยกจาก Jest count.
- Real Nest → melearn_test smoke ผ่าน: Catalog 200, /me 401, unknown route 404, invalid login 422; correlation ตรงกัน และจำนวนแถวทั้ง 27 models ไม่เปลี่ยนจาก startup/read.
- ยัง 0/113 cases ที่ผ่าน full feature acceptance; technical tests ไม่แทน UI/API/provider checks.
- CI-01 DONE: hosted Nest CI [38085878574](https://github.com/natthawat141/meleran-tutor/actions/runs/38085878574) ผ่านบน 78aee05 รวม 225 tests, build/smoke และ 37 client checks (6 Catalog + 7 Free Enroll + 11 Learning + 7 Admin Revoke + 6 generic Video unavailable transport). Frontend source ไม่เปลี่ยน; full Frontend CI [38076634194](https://github.com/natthawat141/meleran-tutor/actions/runs/38076634194) เป็นหลักฐานเดิมบน ea942cb (172 tests/Web/Admin containers). D13 ปิดแล้ว.
- COMPLETION-01 เป็น NEEDS_DECISION: dependencies จริงคือ DB-02/DB-03 ที่ผ่านแล้ว และ D06 สำหรับ best result ข้ามคะแนนเต็มต่างกัน.

## Checkout และ Git

Authoritative target: D:/code/elearn-prod/worktrees/melearn-fullstack/backend.
GitHub: natthawat141/meleran-tutor / backend/v1-foundation. NestJS อยู่ backend/, ASP.NET เก็บ legacy/aspnet/ และประวัติ Git; standalone ASP.NET/ENV/dirty work เดิมไม่เปลี่ยน. Main ไม่ถูกเขียนทับ.

Private ENV จาก Nest เดิมอยู่ backend/.env ที่ ignore; Firebase public Web config และ provider config ถูกเก็บต่อ. Public Firebase config ไม่ใช่ Admin credential. ไม่ upload ENV/database/keys/node_modules. DATABASE_URL ยังว่าง; tests/smoke เลือก TEST target explicitly.

## Database ที่ตรวจจริง

Instance เดิม melearn-infra-prod:asia-southeast3:melearn-tutor-db; PostgreSQL 16; database melearn_test เท่านั้น. Cloud SQL Auth Proxy loopback 127.0.0.1:5433. Runtime role melearn_test_app แยกจาก migration owner melearn_test_migrator. ไม่มี STG, instance ใหม่, deployment หรือ migration ข้อมูลจริง.

- DB-01: compatibility models/review, FK/unique/money/type checks.
- DB-02: normalized roles, same-course Progress, immutable completion/Certificate history, restrict academic deletion.
- DB-05: Blog/Transcript/AI history/request/day quota; same-owner messages/practice, unique replay ID, original-day immutability, pending+success<=20; hide/delete messages ไม่คืน quota.
- DB-03: Quiz/question definitions, immutable normalized attempt-question snapshots, answer FK/score bounds, strict >70 result check. No live-question FK from historical snapshot.
- DB-04: atomic code/grant linkage, Used/Revoked final state, immutable grant source; payment price/request/provider IDs; paid stateแยก fulfillment; unique verified-event bookkeeping.
- ทั้งชุดมี checksum, full-chain DDL rollback probe, FK/unique/concurrency/rollback/reconnect tests บน PostgreSQL.
- SQL triggers/constraints เป็น physical safety; authorization/provider/idempotency expiry/retry/business orchestration ยังต้องทำตาม feature task. ไม่มี HTTP endpoint ใหม่จาก schema work.

| Migration | SHA256 |
| --- | --- |
| 20261011002000_db01 | 11836edf261e7e0111e004082db03a8a06c31fafc75ddec1c996ae9e95d841ae |
| 20261011010000_db02 | 3232a6ceb8724c3c46dc6c73ca36db171e556cc6b8abbe2151cfb7ce874548a5 |
| 20261011020000_db05 | 5c8c27e078e013aea95a8d59b5d9675b37beeb1f28c71f9df6b29d26c55930e9 |
| 20261011030000_db03 | 726de5121ced61057fe4f43e9a2427743c043a10f6d30ae582b13b078aa85648 |
| 20261011040000_db04 | 684d41199be93bac7f368c8723cd89ec04cd9f46a360afe5b315152c8cb4d180 |

DB-04 follow-up history guard: 20261011041000_db04_history_guard, SHA256 e58bdf0cf2b13cb6dce3647597e3b205ffee4a75299fc8dcc4ed04f5c814f9e4. Granted fulfillment และ verified event identity เปลี่ยนย้อนหลังไม่ได้; ไม่ rewrite migration เดิม.

## สิ่งที่ยังรอ

D16 Catalog proposal อยู่ [CATALOG_QUERY_REVIEW](CATALOG_QUERY_REVIEW.md) และยังรอคำตอบ. Auth/security/Firebase recovery ownership D01–D03, revision/rich text D04–D05, best score D06, file/media/provider/idempotency/lifecycle D07–D12 ยังไม่ frozen. Permission/business factsที่ยืนยันแล้วไม่ถามซ้ำ.

Use [execution board](EXECUTION_STATUS.json) for exact dependencies/readiness; [decisions](DECISIONS.md) for unresolved policy. Early Frontend→Nest→PostgreSQL gate still follows CATALOG-01; not replaced by runtime smoke.

## ตรวจซ้ำ

From backend/: typecheck; check:boundaries; test:foundation; test:database with process-only ALLOW_TEST_DATABASE_RESET=yes; build; node scripts/smoke-test-api.cjs; node scripts/prisma-test.cjs status. Reviewed migrations require process-only ALLOW_TEST_DATABASE_MIGRATION=yes. Runtime never seeds/migrates.

Root CI installs existing pinned lockfiles, provisions disposable PostgreSQL, runs these checks and never connects Cloud SQL/providers. Static boundary exceptions for unchanged prototype Account writers are hash tracked for future Auth-owned cutover; no production/security approval implied.

## Coverage recheck

node scripts/check-blueprint.cjs ผ่าน: canonical 86 operations, 5 deferred, 113 case IDs พร้อม action/expected ตรง Scope เดิม, 50-task DAG และ checksums. 8 read operations ไม่มี dedicated numbered acceptance case ใน Scope; ต้องมี targeted feature tests ตามใบงานโดยไม่เพิ่ม case IDs ปลอม. ข้อเสนอที่ส่งให้ตัดสินอยู่ [NEXT_DECISIONS_TH](NEXT_DECISIONS_TH.md).

## CATALOG-01 component progress

GET /courses/{id} / get_courses_id ผ่าน real Nest HTTP+PostgreSQL 6 tests: explicit public select, canonical nullable/THB/date/outline, hidden/unknown 404, no private fields/body/keys, reconnect, corrupt outcomes fail closed, startup/read no session/grant/progress writes. Typed CourseDetail DTO separates storage from wire shape. Also fixed nested ApiException message propagation; Foundation regression passed. GET /courses search/sort/cursor still awaits D16; whole task and Frontend gate remain incomplete.

## Historical code checkpoint

5d9be36bbf8a8c29c19e90a9d6709dc2476f885c pushed successfully; hosted Nest CI passed. Foundation/architecture 49 + PostgreSQL/real HTTP 46 = 95 tests. Current Prisma-vs-Test-PostgreSQL diff contains no DDL. Full branch secret scan passed; all ENV values withheld. This evidence-only documentation update does not change implementation and skips a redundant hosted build; the verified code SHA is explicitly retained above.

## Follow-up components — 11 ต.ค. 2026

- CATALOG-02 profile detail: canonical 4 public fields, normalized Instructor grant, no invented published-course prerequisite, hidden/non-Instructor/missing 404, malformed profile fails closed, edits/reconnect/no writes. Actual HTTP/PG 6 + bio unit 3.
- ENROLL-01 internal EntitlementWriter: caller-owned transaction, safe parameterized ON CONFLICT, parallel sources converge, original source/time preserved, rollback/reconnect/FK checks. PG 8 รวม UTC timestamp ภายใต้ Bangkok transaction timezone. No eligibility/provider/HTTP operation declared complete.
- ASSESS-01 internal submitted-score helper: exact snapshot Decimal aggregate and strict >70, pending never pass, bounds and no global precision mutation. Unit 8. D06 best-attempt comparison and orchestrated grading/Progress remain pending.
- INTEGRATION-01 client component: unchanged fullstack Catalog client → actual Nest → owned PostgreSQL fixtures; 6 checks including saved edit, hidden/unknown 404, server/network errors and no mock fallback. Whole feature gate remains incomplete.
- Blog storage gaps are explicit in [CONTRACT_STORAGE_GAPS](CONTRACT_STORAGE_GAPS.md), mapped to D05/D16; no fake reading-time/content/category values were implemented.

No dependencies installed, schema/migrations changed, provider calls or STG/deployment in this follow-up. Hosted Nest CI 38076634181 and Frontend CI 38076634194 passed on ea942cb8eceed9fe19a2e2644f8baa1e265f9fdb: Backend 120 tests + 6 client checks; Frontend 172 tests and Web/Admin containers. Previous code SHAs are historical evidence. Run global no-write smoke and frontend fixture integration sequentially after DB suites finish.

## Early browser slice — course detail

Local preview Web (`VITE_APP_ENV=preview`, API_MODE=remote, credentials=omit) →
loopback Nest → melearn_test verified: anonymous published detail displays the
stored title/instructor/outline; changing the fixture title and price in
PostgreSQL then reloading displays the new title and ฿123. A malformed stored
outcome produces real 500 and the existing load-error UI, with no mock fallback.
Screenshots are ignored local artifacts at artifacts/nest-execution/
browser-course-detail.png and browser-course-error.png. Fixtures and temporary
API/preview services are cleaned up after verification; Cloud SQL proxy remains.

The two public Catalog pages now show their existing mock notice only when
apiConfig.mock is true; remote mode previously claimed the API was a mock.
Full Frontend Web/Admin/packages typecheck, Web/Admin preview build and 31
targeted transport/Catalog tests passed. No route, styling, release flag or
permission changes. The default production feature gate still hides prototypes.
This proves the detail component's real Frontend → Nest → PostgreSQL path;
list/search/cursor, authenticated learning and full G-COURSE acceptance remain
pending. The original 113 acceptance cases remain mapped and none is marked
complete from this component check.

## Stripe receiver checkpoint — 11 ต.ค. 2026

POST /api/v1/webhooks/stripe มี original-byte signature verification และ durable deduplicated receipt บน PaymentEvent เดิม: 5 unit + 10 actual HTTP/PostgreSQL tests. รวม backend regression 135 tests. รายละเอียด local protocol และข้อจำกัดอยู่ [STRIPE_WEBHOOK_RECEIVER](STRIPE_WEBHOOK_RECEIVER.md). Canonical webhook ยัง deferred; full PROVIDER-STRIPE-01 ยัง NEEDS_DECISION/PAY-01 dependency. Signing secret ยังว่าง; ไม่มี actual Stripe delivery หรือ worker/payment processor/grant. Unprocessed receipts ตอบ 503 ให้ retry; ไม่ ACK เงินหรืออ้างผ่าน business acceptance. ไม่มี dependency/schema/migration/cloud/deploy change. Hosted Nest CI [38078316359](https://github.com/natthawat141/meleran-tutor/actions/runs/38078316359) ผ่านบน code SHA `26cb18665d1ba04cdb8a41f39babd50189845326`: 49 foundation + 16 feature units + 70 PostgreSQL/HTTP = 135 tests, build, runtime smoke และ 6 unchanged frontend-client checks. Metadata-only checkpoint ไม่แก้ code และ skip CI ซ้ำ; SHA/CI ของ checkpoint ก่อนหน้าเป็น historical evidence.

## Admin AI / Auth session component — 11 ต.ค. 2026

AUTH-BASE-01 stored-session resolution/normalized-role authority มี 8 PostgreSQL tests; AI-01 ทั้ง 3 canonical settings/transcript operations มี actual HTTP/PostgreSQL tests 13 เคส. รวม backend regression 156 tests + 6 unchanged frontend-client checks. อ่าน [ADMIN_AI_COMPONENT](ADMIN_AI_COMPONENT.md) สำหรับ owner interfaces, authorization locks, Unicode body limit และ remaining gates. ไม่มี cookie/TTL/password/provider policy ที่ประกาศปิด; legacy handlers/role writers ยังต้อง cut over. ไม่มี schema/dependency/contract/cloud/STG/deploy change. Whole tasks ยังรอ prerequisites และ full business acceptance ยังคง 0/113. Hosted Nest CI [38080093084](https://github.com/natthawat141/meleran-tutor/actions/runs/38080093084) ผ่านบน code SHA `8c07b42ef34fcd8a754f1c089f1e83545098c9a0`: 49 foundation + 16 feature units + 91 PostgreSQL/HTTP = 156 tests, build/smoke และ 6 unchanged frontend-client checks. Metadata-only documentation checkpoint ไม่เปลี่ยน code และ skip CI ซ้ำ; receiver SHA/CI ก่อนหน้าเป็น historical evidence.

## Free Enroll checkpoint — 11 ต.ค. 2026

POST /courses/{id}/enroll เปลี่ยนจาก prototype check-then-create เป็น normalized Web authority + caller transaction + Course lock + existing safe EntitlementWriter. 13 actual HTTP/PostgreSQL tests ผ่าน รวม current verification, paid/hidden/owner/Admin denial, strict EmptyRequest, concurrent replay, preserved original history, SQL rollback และ concurrent price/new Admin role wait. Unchanged frontend Catalog mutation/decoder มี 7 real API/persistence checks เพิ่มจาก 6 public detail checks. Local และ hosted regression 169 tests + 13 client checks ผ่านบน code SHA `e28d8abff1bad684f6693ceb12d1e4c79658a18b`, [Nest CI 38081191962](https://github.com/natthawat141/meleran-tutor/actions/runs/38081191962). Metadata-only checkpoint ไม่เปลี่ยน code และ skip CI ซ้ำ. อ่าน [FREE_ENROLL_COMPONENT](FREE_ENROLL_COMPONENT.md). Whole ENROLL-01 และ authenticated browser G-LEARNING ยังไม่ครบ; 0/113 full acceptance. ไม่มี contract/schema/dependency/cloud/STG/deploy change.

## Enrolled learning reads checkpoint — 11 ต.ค. 2026

GET /learn/courses/{id} และ /learn/courses/{id}/items/{item_id} มี 13 actual HTTP/PostgreSQL tests + 11 unchanged frontend Learning API/decoder checks. Fresh normalized authority, own Enrollment, Published/same-Course checks; explicit type-specific fields hide Quiz keys/Transcript/private profile. Current row-derived progress/resume, historical completion/certificate preservation, no read writes, safe errors/reconnect and actual concurrent Course/Enrollment lock wait verified. Local และ hosted aggregate 182 tests + 24 client checks ผ่านบน code SHA `c134b168f952b1231712dbe3d8300e88fe0370be`, [Nest CI 38082286295](https://github.com/natthawat141/meleran-tutor/actions/runs/38082286295). Metadata-only documentation checkpoint ไม่เปลี่ยน code และ skip CI ซ้ำ. อ่าน [LEARNING_READ_COMPONENT](LEARNING_READ_COMPONENT.md) สำหรับ owner writer lock contract และ remaining Scope/HTTP management mapping, GET /me/progress และ full Auth/authoring/browser gates. Whole taskยัง BLOCKED/0 full acceptance; no contract/schema/dependency/cloud/STG/deploy change.

## Resume persistence / ordering checkpoint — 11 ต.ค. 2026

Internal Enrollments ResumeWriter/storedResume มี 8 PG tests; separate UTC saved time/private server order fixes latest-item selection after later completion updates or same-millisecond saves. Caller owns fresh access/Course shared/Enrollment exclusive locks. Actual built participant integrates with existing Nest/frontend read harness; 24 client checks retain their scope. Local aggregate 190 tests ผ่าน; 24 client checks ผ่านด้วย actual internal ResumeWriter/read integration. Hosted Nest CI [38083900295](https://github.com/natthawat141/meleran-tutor/actions/runs/38083900295) ผ่านบน code SHA `7c0c4113dba86da354fd5813332850a968d6b343`: 49 foundation + 16 feature units + 125 PG/HTTP = 190 tests, build/smoke/blueprint/boundaries และ 24 real-client checks. Stripe receiver regression 5 signature units + 10 actual HTTP/PG ยังคงผ่าน; ไม่มี actual provider delivery. อ่าน [RESUME_PERSISTENCE_COMPONENT](RESUME_PERSISTENCE_COMPONENT.md). Public PUT Resume ยังไม่ implement: canonical optional number/null vs mock video integer/required restrictions need explicit input reconciliation. Pending question is not approval. Manual Complete/COMPLETION-01/full Auth/browser gates remain blocked, full acceptance 0/113. No schema/contract/dependency/cloud/STG/deploy changes.

## Redeem / Revoke checkpoint — 11 ต.ค. 2026

Canonical POST /admin/redeem-codes/{id}/revoke มี fresh normalized Admin authority, Code lock, original audit/replay, Used409 และ safe rollback. Internal RedeemWriter consume+grant+audit ใน caller transaction ไม่กินโค้ดเพิ่มเมื่อมี Enrollment เดิม; แข่งกัน Code เดียว/ต่าง Code และ Redeem vs Revoke ทั้งสองทิศทางผ่าน actual lock-wait evidence. 21 shared PG tests + 7 unchanged frontend Admin API/decoder checks ผ่าน. Local aggregate 211 tests + 31 client checks, build/smoke/gates ผ่าน; Hosted Nest CI [38084954707](https://github.com/natthawat141/meleran-tutor/actions/runs/38084954707) ผ่านบน code SHA `371a0304148910fa87cd5fe6b15cc342f6b4b996`: 49 foundation + 16 feature units + 146 PG/HTTP = 211 tests, build/smoke/blueprint/boundaries และ 31 real-client checks. อ่าน [REDEEM_TRANSACTION_COMPONENT](REDEEM_TRANSACTION_COMPONENT.md). Public POST /me/redeem/issue/list/full Auth/Course/provider/browser G-REDEEM+G-AI ยังไม่ครบ; task scopes เดิมไม่ลด, 0/113 full acceptance. No schema/contract/dependency/cloud/STG/deploy change.

## Video unavailable / authoring authority checkpoint — 11 ต.ค. 2026

Canonical POST /courses/{id}/videos/uploads implemented fixed V1 503 after fresh normalized owner Instructor/Admin checks through bound Web/Admin namespaces. 14 actual HTTP/PostgreSQL tests + 6 unchanged generic HttpClient transport checks passed; no upload/files/provider/YouTube mutation. Shared filter exposes only fixed typed capability error, hiding arbitrary 5xx diagnostics. Local aggregate 225 tests + 37 client checks, build/smoke/gates passed; Hosted Nest CI [38085878574](https://github.com/natthawat141/meleran-tutor/actions/runs/38085878574) ผ่านบน code SHA `78aee05c5d85828041c83e48b0ca428913e35c34`: 49 foundation + 16 feature units + 160 PG/HTTP = 225 tests, build/smoke/blueprint/boundaries และ 37 client checks. อ่าน [VIDEO_UNAVAILABLE_COMPONENT](VIDEO_UNAVAILABLE_COMPONENT.md). Generic transport is not a video authoring handler/editor/browser proof; Auth/writer cutover/V02/G-COURSE remain pending and whole task BLOCKED, 0/113 full acceptance. No schema/contract/dependency/cloud/STG/deploy changes.
