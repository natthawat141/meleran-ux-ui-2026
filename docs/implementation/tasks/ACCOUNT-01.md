# ACCOUNT-01 — Read/update own profile

Status: **NEEDS_DECISION** · Priority: P0 · Module: accounts

Execution 11 ต.ค. 2026: GET /me implemented as a separate confirmed read component;
Auth public SelfProfileReader owns bounded identity/credential projection; Accounts
opens the caller transaction. Fresh normalized roles, exact nullable CurrentUser,
public profile whitelist, safe corrupted-storage failure and no read writes are
tested on real HTTP/PostgreSQL. See [SELF_PROFILE_COMPONENT](../SELF_PROFILE_COMPONENT.md)
and EXECUTION_STATUS for current evidence. PATCH/D02/D09 and full Auth/provider/browser
gates remain; this note does not close ACCOUNT-01/A03/A09 or approve PATCH semantics.

ต้องปิด D09; D02 constraints/profile semantics confirmed แล้ว

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.1 (line 169); §3.5 (line 475); §6.2 (line 1171)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/ACCOUNT-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /me | get_me | ไม่มี body | 200: #/components/schemas/CurrentUser |
| PATCH | /me | patch_me | #/components/schemas/UpdateProfileRequest | 200: #/components/schemas/CurrentUser |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /me → user.profile_self; security [{"WebSession": []}, {"AdminSession": []}]
- PATCH /me → user.profile_self; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] อ่าน/แก้เฉพาะบัญชีตนเอง; roles/email_verified/identity เปลี่ยนผ่าน profile ไม่ได้
- [HTTP_DRAFT] รักษา root snake_case และ nested profile camelCase ตาม schema
- [HTTP_DRAFT] null/empty/string/array semantics ต้องตาม canonical/Flow AB; ปฏิเสธ unknown fields

## Data / transaction / dependencies

- Entities: User, AuthIdentity
- [Domain model](../DOMAIN_MODEL.md) §TX-PROFILE — Profile patch
- PROPOSED_TECHNICAL execution: Validate allowed fields and approved canonical null semantics; uniqueness enforced by DB; update allowed fields atomically through Auth-owned method. Use preconditions only where the approved contract defines them; do not add a profile revision field/header independently. Accounts facade uses exported Auth interface.
- Dependencies: [AUTH-01](AUTH-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/accounts/accounts.controller.ts + service/module/dto
- backend/src/features/auth/auth.service.ts: own-profile exported writer (Auth owner coordinated)
- feature-local profile/permission/contract/PostgreSQL tests; no concurrent Auth service edits

## Tests และ acceptance

- role escalation/unknown nested fields rejected
- missing required CurrentUser fields; patch null/empty arrays
- concurrent edit ไม่ lost-update; usernames unique via DB

Feature gate: **G-AUTH** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A03 | Learner ส่ง Role=Admin/Instructor ในข้อมูล Profile | ไม่เพิ่มสิทธิ์ |
| A09 | บัญชี Admin สร้างเชื่อม Google แล้ว Logout/Login ด้วย Google | กลับ User เดิม Role คอร์ส Progress คะแนน และใบรับรองเดิมยังอยู่ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D02 — Username/password/profile consistency: Username ASCII 3–30, case-insensitive uniqueness/uppercase lookup, new passwords 8–128 characters and profile omitted/null/array semantics confirmed 2026-10-11; canonical Draft.2 reconciles Admin-create constraints. Implementation and provider email attachment are separate gates.
- D09 — Image/R2 upload missing contract: Profile/cover/blog/essay image upload has no frozen operation in 86; video upload explicitly disabled. R2 choice already confirmed. Resolution: Approve image protocol/schema/permission/size/lifecycle; track gap without inventing endpoint. Block image-dependent acceptance only.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
