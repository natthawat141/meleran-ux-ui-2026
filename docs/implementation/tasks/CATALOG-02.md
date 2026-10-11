# CATALOG-02 — Public Instructor profile/courses

Status: **PENDING** · Priority: P1 · Module: courses

ต้องปิด D16; D02 constraints/profile semantics confirmed แล้ว

## Component evidence — 11 ต.ค. 2026

`GET /instructors/{id}` / `get_instructors_id` COMPONENT_VERIFIED: real Nest HTTP
และ isolated PostgreSQL 6 tests + feature-local bio projection 3 units ผ่าน.
ใช้ normalized Instructor grant จาก DB-02; public scalar fields เท่านั้น,
ไม่มีเงื่อนไขว่าต้องมีคอร์สที่ Scope ไม่ได้ระบุ. Non-Instructor/unknown 404,
nullable/reconnect/profile edit, malformed stored bio 500 ไม่เปิด private JSON,
ไม่มี session/grant/academic writes. Component ใช้ DB-01/DB-02 โดยไม่ต้องรอ
Catalog list; Auth/Management normalized writers ยังต้องทำต่อ.
รายชื่อคอร์สของผู้สอนยังรอ D16; whole task/Frontend gate ยังไม่ DONE.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.2 (line 235); §3.2 (line 415); §6.3 (line 1189)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/CATALOG-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /instructors/{id} | get_instructors_id | ไม่มี body | 200: #/components/schemas/PublicInstructorDto |
| GET | /instructors/{id}/courses | get_instructors_id_courses | ไม่มี body | 200: #/components/schemas/PublicInstructorCoursePage |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /instructors/{id}/courses → course.read_public; security []
- GET /instructors/{id} → course.read_public; security []

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] public Instructor projection ไม่เปิด private profile/credentials
- [CONFIRMED_SCOPE] รายชื่อคอร์สเฉพาะ Instructor นั้นและ Published
- [CONFIRMED_SCOPE] Instructor role ไม่เท่ากับ Admin หรือ Enrollment

## Data / transaction / dependencies

- Entities: User, Course
- [Domain model](../DOMAIN_MODEL.md) §READ — Read scoped projections
- PROPOSED_TECHNICAL execution: No write; apply principal/resource/Published scope before selecting fields; deterministic sort and page limits from canonical. No public GET grants/charges/completes.
- Dependencies: [CATALOG-01](CATALOG-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/courses/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/courses/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- non-Instructor/missing ID; unpublished courses hidden
- no other instructor courses; private fields redacted
- canonical profile and paged courses

Feature gate: **G-COURSE** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

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

## Renewed authorization continuation — 2026-10-11

Latest user permits agent decisions with a written record. See [technical decisions](../AUTONOMOUS_EXECUTION_DECISIONS.md) and [current component evidence](../AUTONOMOUS_CONTINUATION_COMPONENT.md). The current EXECUTION_STATUS/CONTINUATION_QUEUE override old planning waits above. No idle user-decision blocker for the implemented subset; full feature acceptance is still tracked separately.
