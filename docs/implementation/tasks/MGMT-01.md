# MGMT-01 — Admin create/list/detail users

Status: **NEEDS_DECISION** · Priority: P2 · Module: management

ต้องปิด D02, D03, D16

Execution component 11 ต.ค.: GET /admin/users/{id} moved to Auth public bounded detail reader with fresh normalized Admin authority, sorted Account locks and canonical Admin inline profile semantics. See [ADMIN_USER_DETAIL_COMPONENT](../ADMIN_USER_DETAIL_COMPONENT.md) for18 HTTP/PG +10 real Admin-client checks, exact fields and pending status/disable interpretation. Component depends on FOUNDATION-01, DB-02 normalized roles and AUTH-BASE-01 fresh Admin proof; creation/query/provider/browser requirements and whole-task decisions remain open.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.1 (line 169); §2.2 (line 235); §3.4 (line 451); §6.2 (line 1171); §6.9 (line 1327)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/MGMT-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /admin/users | post_admin_users | #/components/schemas/AdminCreateUserRequest | 201: #/components/schemas/AdminCreateUserResponse |
| GET | /admin/users | get_admin_users | ไม่มี body | 200: #/components/schemas/AdminUserPage |
| GET | /admin/users/{id} | get_admin_users_id | ไม่มี body | 200: #/components/schemas/AdminUserDetailDto |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /admin/users → user.create; security [{"AdminSession": []}]
- GET /admin/users → Admin account management; security [{"AdminSession": []}]
- GET /admin/users/{id} → Admin account management; security [{"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Admin session+role เท่านั้น; สร้างเริ่ม Learner ไม่สร้าง Admin/Instructor จาก body
- [HTTP_DRAFT] Username ไม่ซ้ำ; email optional ตาม canonical ต้องไม่ silently reject ทั้ง scope
- [HTTP_DRAFT] เก็บ created_by/at; list/detail ไม่เปิด hash/secret; summary/detail แยก wire shapes

## Data / transaction / dependencies

- Entities: User, LocalCredential, UserRole
- [Domain model](../DOMAIN_MODEL.md) §TX-USER — Create/grant
- PROPOSED_TECHNICAL execution: Create User+local credential+initial role+actor audit in one transaction. Instructor grant via unique role relation; replay returns prior grant and does not duplicate successful audit.
- Dependencies: [AUTH-01](AUTH-01.md), [ACCOUNT-01](ACCOUNT-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/management/management.controller.ts + service/module/dto
- backend/src/features/auth/auth.service.ts + exported account/create/grant interfaces (Auth write owner; coordinate with Lead)
- feature-local tests; no Management direct Prisma identity write; no concurrent Auth service edits

## Tests และ acceptance

- duplicate username race; non-admin/forged audience
- optional email supported or explicitly blocked pending protocol
- list search username/display/email, pagination and response schema

Feature gate: **G-MANAGEMENT** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A07 | Admin สร้าง Username/Password โดยไม่มีอีเมล | Login และ Enroll/Redeem ได้ทันทีตามสิทธิ์คอร์ส |
| A08 | Learner/Instructor พยายามสร้างบัญชีแบบ Admin หรือสร้าง Username ซ้ำ | ปฏิเสธ ไม่ได้สิทธิ์สร้างบัญชีแทนและไม่มี Username ซ้ำ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D02 — Username/password/profile consistency: Canonical Admin-create/profile username patterns and password limits differ; prototype enforces 12 chars and profile null deletes values while Flow AB normalizes strings. CurrentUser responses omit required wire fields. Resolution: Review exact patterns/length/normalization and null/array semantics, then update canonical/mock/types together only when approved.
- D03 — Firebase + Resend verification/recovery ownership: Firebase Email/Google confirmed later; Scope still requires Resend one-use 24h links. Canonical register/verify/reset and four legacy Google deferred protocols have not migrated. Local account adding verified email lacks a frozen safe operation. Resolution: Approve provider action-link ownership, proof freshness/link/collision rules and proposed exchange/link changes. Preserve A01–A20; no silent removal of legacy paths.
- D16 — List query, cursor and public/PII projection review: OpenAPI x-pending-decisions and Flow AB D7 still leave cursor expiry/search/sort/filter semantics and visibility/PII review open. Current schema fixes wire fields/limits, but a deterministic backend query/cursor design has not been reviewed. Resolution: Review per flow: keep canonical query/response fields, choose deterministic sort tuple and cursor binding to filters/principal, decide expiry and permitted search fields. Use public canonical projections only; do not broaden PII. Close the Catalog subset first so the public vertical slice need not wait for Auth/provider decisions.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
