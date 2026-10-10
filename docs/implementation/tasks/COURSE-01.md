# COURSE-01 — Instructor/Admin create and list courses

Status: **NEEDS_DECISION** · Priority: P1 · Module: courses

ต้องปิด D10

Schema prerequisite update 11 ต.ค.: Course.createdBy now separates original creator from current instructorId, retaining truthful legacy NULL with FK/immutable audit. See [COURSE_CREATOR_AUDIT_SCHEMA](../COURSE_CREATOR_AUDIT_SCHEMA.md). Both future creation handlers must INSERT fresh actor ID with Course/createdAt atomically. Physical schema support is not evidence for HTTP creation, D10 approval, directories, full Auth or feature acceptance; whole task stays NEEDS_DECISION.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.2 (line 235); §2.3 (line 243); §3.4 (line 451); §5.2 (line 1008); §6.5 (line 1228)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/COURSE-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /instructor/courses | post_instructor_courses | #/components/schemas/CourseMetadataRequest | 201: #/components/schemas/AuthoringCourseDto |
| GET | /instructor/courses | get_instructor_courses | ไม่มี body | 200: #/components/schemas/ManagedCoursePage |
| POST | /admin/courses | post_admin_courses | #/components/schemas/AdminCourseCreateRequest | 201: #/components/schemas/AuthoringCourseDto |
| GET | /admin/courses | get_admin_courses | ไม่มี body | 200: #/components/schemas/ManagedCoursePage |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /instructor/courses → course.create: instructor; security [{"WebSession": []}]
- GET /instructor/courses → course.update: instructor scope; security [{"WebSession": []}]
- POST /admin/courses → course.create: admin; security [{"AdminSession": []}]
- GET /admin/courses → course.update: admin scope; security [{"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Instructor สร้างคอร์สตนเอง; Admin สร้างแทนโดยระบุ Instructor เดียว
- [CONFIRMED_SCOPE] แยก creator กับ instructor; เริ่ม Draft และเก็บ actor/time
- [CONFIRMED_SCOPE] รายการ Instructor เฉพาะ owner; Admin list ตาม permission

## Data / transaction / dependencies

- Entities: User, Course
- [Domain model](../DOMAIN_MODEL.md) §TX-COURSE — Course aggregate
- PROPOSED_TECHNICAL execution: Authorize actor and every nested ID, compare approved revision, replace/update aggregate as agreed D04, order changes and content revision+audit atomic. No overwrite of Transcript/AI settings; published edits immediate; approved edit invalidates prior approval.
- Dependencies: [AUTH-01](AUTH-01.md), [MGMT-02](MGMT-02.md), [DB-02](DB-02.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/courses/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/courses/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- creator/instructor distinct; forged owner/non-instructor target
- owner list vs Admin list; required DTO/price fields
- create/read-back after restart

Feature gate: **G-COURSE** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| C01 | Instructor สร้างคอร์สและบทหลายรายการ | บันทึกจริง เปิดกลับมาเห็นข้อมูลและลำดับเดิม |
| C02 | Admin สร้าง/แก้คอร์สแทน | Course มี Instructor คนเดียว แยกผู้สร้าง Admin ได้ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D10 — Replay/precondition policy: Key lifetime, same-key/different-payload conflict, create/grade partial success and timeout recovery need precise agreement. Resolution: Approve operation-specific semantics; keep naturally idempotent unique constraints; never blanket retry mutations/provider calls.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
