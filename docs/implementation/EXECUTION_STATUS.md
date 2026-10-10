# สถานะ Melearn NestJS Wave 1–17

อัปเดต 11 ต.ค. 2026. เป้าหมายยังครบ 50 tasks / 86 defined + 5 deferred operations / 113 acceptance cases.

## ผลที่ตรวจแล้ว

- DONE: FOUNDATION-01, DB-01, DB-02, DB-05, DB-03, DB-04 (7/50 tasks พร้อม CI-01).
- Foundation/architecture tests 49/49; PostgreSQL + actual HTTP component tests 46/46; strict typecheck และ Nest build ผ่าน.
- Real Nest → melearn_test smoke ผ่าน: Catalog 200, /me 401, unknown route 404, invalid login 422; correlation ตรงกัน และจำนวนแถวทั้ง 27 models ไม่เปลี่ยนจาก startup/read.
- ยัง 0/113 cases ที่ผ่าน full feature acceptance; technical tests ไม่แทน UI/API/provider checks.
- CI-01 DONE: hosted CI [38074542071](https://github.com/natthawat141/meleran-tutor/actions/runs/38074542071) ผ่านบน 5d9be36 รวม Catalog detail component. D13 ปิดแล้ว.
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

## Verified code checkpoint

5d9be36bbf8a8c29c19e90a9d6709dc2476f885c pushed successfully; hosted Nest CI passed. Foundation/architecture 49 + PostgreSQL/real HTTP 46 = 95 tests. Current Prisma-vs-Test-PostgreSQL diff contains no DDL. Full branch secret scan passed; all ENV values withheld. This evidence-only documentation update does not change implementation and skips a redundant hosted build; the verified code SHA is explicitly retained above.
