# MGMT-02 — Instructor grant and directory

Status: **BLOCKED** · Priority: P2 · Module: management

รอ dependencies: AUTH-01, MGMT-01

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.2 (line 235); §3.4 (line 451); §5.1 (line 993); §6.9 (line 1327)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/MGMT-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /admin/users/{id}/instructor | post_admin_users_id_instructor | #/components/schemas/EmptyRequest | 200: #/components/schemas/AssignInstructorResponse |
| GET | /admin/instructors | get_admin_instructors | ไม่มี body | 200: #/components/schemas/InstructorPage |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /admin/users/{id}/instructor → user.assign_instructor; security [{"AdminSession": []}]
- GET /admin/instructors → Admin course owner selection; security [{"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Admin เพิ่ม Instructor ให้บัญชีเดิม; รักษา Learner และข้อมูลเดิม
- [CONFIRMED_SCOPE] ทำซ้ำไม่เพิ่มสิทธิ์/ประวัติสำเร็จซ้ำ; บันทึก actor/time
- [HTTP_DRAFT] Admin target และรูปแบบ body ตาม canonical ไม่ถือ mock เป็นกฎใหม่

## Data / transaction / dependencies

- Entities: User, UserRole, InstructorGrantAudit
- [Domain model](../DOMAIN_MODEL.md) §TX-USER — Create/grant
- PROPOSED_TECHNICAL execution: Create User+local credential+initial role+actor audit in one transaction. Instructor grant via unique role relation; replay returns prior grant and does not duplicate successful audit.
- Dependencies: [AUTH-01](AUTH-01.md), [MGMT-01](MGMT-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/management/management.controller.ts + service/module/dto
- backend/src/features/auth/auth.service.ts + exported account/create/grant interfaces (Auth write owner; coordinate with Lead)
- feature-local tests; no Management direct Prisma identity write; no concurrent Auth service edits

## Tests และ acceptance

- Learner/Instructor denied; unknown account; Admin target conflict
- parallel duplicate grants, role/audit uniqueness
- instructor list/read shape and filtering

Feature gate: **G-MANAGEMENT** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A04 | Instructor พยายามเพิ่ม Instructor | ปฏิเสธ Admin ทำได้และมีประวัติ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

ไม่มี business/protocol decision เฉพาะ task; ตรวจ dependency/environment ก่อนเริ่ม

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
