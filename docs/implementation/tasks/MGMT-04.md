# MGMT-04 — Learner directory and managed attempt views

Status: **PENDING** · Priority: P2 · Module: management

ต้องปิด D16; D02 constraints/profile semantics confirmed แล้ว

Component update 11 ต.ค.: GET /managed-quizzes/{id} and GET /instructor/attempts/{id} implemented and verified separately. Locator evidence is [MANAGED_QUIZ_LOCATOR_COMPONENT](../MANAGED_QUIZ_LOCATOR_COMPONENT.md); historical Attempt evidence is [current checkpoint](../PROFILE_REDEEM_MANAGED_ATTEMPT_COMPONENT.md). Both depend on FOUNDATION-01, DB-02 normalized identity, DB-03 Quiz/snapshot linkage and AUTH-BASE-01 fresh authority. They do not depend on unresolved roster query/PII or best-score selection. The two roster operations and feature gate remain PENDING.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §3.4 (line 451); §3.5 (line 475); §6.6 (line 1278)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/MGMT-04.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /instructor/learners | get_instructor_learners | ไม่มี body | 200: #/components/schemas/RosterPage |
| GET | /admin/learners | get_admin_learners | ไม่มี body | 200: #/components/schemas/RosterPage |
| GET | /managed-quizzes/{id} | get_managed-quizzes_id | ไม่มี body | 200: #/components/schemas/ManagedQuizLocator |
| GET | /instructor/attempts/{id} | get_instructor_attempts_id | ไม่มี body | 200: #/components/schemas/ManagedAttemptDto |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /instructor/learners → owner Instructor courses only; security [{"WebSession": []}]
- GET /admin/learners → Admin course management; security [{"AdminSession": []}]
- GET /managed-quizzes/{id} → course.update: owner Instructor/Admin; security [{"WebSession": []}, {"AdminSession": []}]
- GET /instructor/attempts/{id} → quiz.grade: owner Instructor; Admin forbidden; security [{"WebSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Instructor views จำกัด course owner; Admin endpoint ต้อง Admin audience+role
- [CONFIRMED_SCOPE] locator/attempt ต้องอยู่ในคอร์สและผู้เรียนที่มีสิทธิ์จัดการ
- [CONFIRMED_SCOPE] อ่านผลไม่ทำให้ตรวจข้อเขียนแทน Instructor โดยอัตโนมัติ

## Data / transaction / dependencies

- Entities: User, Course, Enrollment, Quiz, QuizAttempt, Answer
- [Domain model](../DOMAIN_MODEL.md) §READ — Read scoped projections
- PROPOSED_TECHNICAL execution: No write; apply principal/resource scope before selecting fields; deterministic sort and page limits from canonical. Locator is private authoring and accepts owned course states per Scope; Published visibility applies only where the relevant operation requires it. No public GET grants/charges/completes.
- Dependencies: [MGMT-03](MGMT-03.md), [GRADE-01](GRADE-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/management/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/management/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- IDs ของ another owner; fake managed Quiz ID
- canonical responses/nullable grades; pending grading visible
- list/detail authorization parity

Feature gate: **G-MANAGEMENT** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

ไม่มีรหัส acceptance ของ feature โดยตรง; เป็น prerequisite ไม่เพิ่ม case ใหม่แทน 113 cases

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

Continuation update 11 ต.ค.: 2/4 canonical operations component-verified; see [current checkpoint](../PROFILE_REDEEM_MANAGED_ATTEMPT_COMPONENT.md). Outstanding feature gates/decisions are PENDING and do not block independent use cases.

## Management history execution override — 2026-10-11

Latest user permits documented technical choices. [Component evidence](../MANAGEMENT_HISTORY_COMPONENT.md) and [agent decisions](../AUTONOMOUS_EXECUTION_DECISIONS.md) supersede prior protocol/dependency waits for implemented reads. PAY-02 missing session is explicit empty string and event outcome is stored receipt state. All defined APIs in this package now have component proof; full browser/original acceptance pending.
