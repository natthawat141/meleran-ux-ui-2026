# MGMT-03 — Course/user roster and attempts

Status: **PENDING** · Priority: P2 · Module: management

ต้องปิด D16; D02 constraints/profile semantics confirmed แล้ว

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §3.3 (line 437); §3.4 (line 451); §3.5 (line 475); §6.9 (line 1327)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/MGMT-03.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /admin/users/{id}/enrollments | get_admin_users_id_enrollments | ไม่มี body | 200: #/components/schemas/RosterPage |
| GET | /admin/users/{id}/attempts | get_admin_users_id_attempts | ไม่มี body | 200: #/components/schemas/ManagedAttemptPage |
| GET | /courses/{id}/learners | get_courses_id_learners | ไม่มี body | 200: #/components/schemas/RosterPage |
| GET | /courses/{id}/attempts | get_courses_id_attempts | ไม่มี body | 200: #/components/schemas/ManagedAttemptPage |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /admin/users/{id}/enrollments → Admin scoped account course-management read; security [{"AdminSession": []}]
- GET /admin/users/{id}/attempts → Admin scoped read; no grading; security [{"AdminSession": []}]
- GET /courses/{id}/learners → course.learners_read: owner Instructor/Admin; security [{"WebSession": []}, {"AdminSession": []}]
- GET /courses/{id}/attempts → course.learners_read: owner Instructor/Admin; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Instructor จำกัด owned course ทั้ง list/detail; Enrollment ไม่ให้สิทธิ์จัดการคอร์สผู้อื่น
- [HTTP_DRAFT] Admin scope ตาม contract; principal/resource IDs ฝั่ง server
- [CONFIRMED_SCOPE] projection อ่านผลถาวร ไม่สร้าง Enrollment/Progress หรือ exposed answer keys โดยไม่จำเป็น

## Data / transaction / dependencies

- Entities: User, Course, Enrollment, Progress, QuizAttempt, Answer
- [Domain model](../DOMAIN_MODEL.md) §READ — Read scoped projections
- PROPOSED_TECHNICAL execution: No write; apply principal/resource/Published scope before selecting fields; deterministic sort and page limits from canonical. No public GET grants/charges/completes.
- Dependencies: [COURSE-02](COURSE-02.md), [ENROLL-01](ENROLL-01.md), [ASSESS-02](ASSESS-02.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/management/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/management/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- cross-owner direct URL/filter/pagination
- empty roster/attempts; consistent list/detail scope
- actual persisted results and privacy projections

Feature gate: **G-MANAGEMENT** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A05 | Instructor A แก้ Course/Chapter/Quiz ของ B | ปฏิเสธ แม้ A ลงเรียนคอร์ส B แล้ว |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D16 — List query, cursor and public/PII projection review: OpenAPI x-pending-decisions and Flow AB D7 still leave cursor expiry/search/sort/filter semantics and visibility/PII review open. Current schema fixes wire fields/limits, but a deterministic backend query/cursor design has not been reviewed. Resolution: Review per flow: keep canonical query/response fields, choose deterministic sort tuple and cursor binding to filters/principal, decide expiry and permitted search fields. Use public canonical projections only; do not broaden PII. Close the Catalog subset first so the public vertical slice need not wait for Auth/provider decisions.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy

## Management history execution override — 2026-10-11

Latest user permits documented technical choices. [Component evidence](../MANAGEMENT_HISTORY_COMPONENT.md) and [agent decisions](../AUTONOMOUS_EXECUTION_DECISIONS.md) supersede prior protocol/dependency waits for implemented reads. PAY-02 missing session is explicit empty string and event outcome is stored receipt state. All defined APIs in this package now have component proof; full browser/original acceptance pending.
