# AUTH-01 — Local Username login/logout

Status: **NEEDS_DECISION** · Priority: P0 · Module: auth

ต้องปิด D01, D02, D03

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.1 (line 169); §3.5 (line 475); §5.1 (line 993); §6.2 (line 1171)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/AUTH-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /auth/login | post_auth_login | #/components/schemas/LoginRequest | 200: #/components/schemas/LoginResponse |
| POST | /auth/logout | post_auth_logout | ไม่มี body | 204: no body |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /auth/login → public; security []
- POST /auth/logout → current app session; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] ตรวจ credentials ฝั่ง server; audience/header เลือก Web/Admin ไม่เพิ่ม role
- [CONFIRMED_SCOPE] บัญชี Admin สร้างไม่มี email เข้าได้; self-email unverified Login ได้แต่ยังเรียนไม่ได้
- [CONFIRMED_SCOPE] Logout ยกเลิกเฉพาะ app session; ห้ามคืน password/hash/session secret ใน JSON
- [HTTP_DRAFT] Username/Email login ต้องครบ owner ที่ D03 ยืนยัน: local Username ใช้ kernel; Email credential/proof ผ่าน provider adapter ไม่เปลี่ยน canonical body หรือเก็บ Firebase password local

## Data / transaction / dependencies

- Entities: User, LocalCredential, AppSession
- [Domain model](../DOMAIN_MODEL.md) §TX-AUTH — Auth/reset
- PROPOSED_TECHNICAL execution: Verify proof/credential then atomically consume local reset proof/change password or create/revoke one app session. No provider password duplication; remote mail/provider I/O outside DB transaction; exact revocation policy D01/D03.
- Dependencies: [AUTH-BASE-01](AUTH-BASE-01.md), [PROVIDER-AUTH-01](PROVIDER-AUTH-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/auth/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/auth/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- invalid credentials, forged audience, non-admin Admin login
- expired/revoked session, logout isolation, durable session after restart
- schema CurrentUser/LoginResponse ครบ origin/learning_eligible/profile

Feature gate: **G-AUTH** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A07 | Admin สร้าง Username/Password โดยไม่มีอีเมล | Login และ Enroll/Redeem ได้ทันทีตามสิทธิ์คอร์ส |
| A11 | ผู้มีอีเมลยืนยันขอ Reset แล้วใช้ลิงก์ตั้งรหัสใหม่ | ส่งอีเมลจริง ตั้งรหัสใหม่ได้ รหัสเก่าใช้ Login ไม่ได้ |
| A15 | ตรวจวิธี Login รอบแรก | มี Username/อีเมลและ Google ยังไม่มี LINE |
| C12 | ตรวจคอร์ส pending_review | Admin เห็นในคิวตรวจ สถานะนี้ไม่ระงับ Login ของเจ้าของคอร์ส |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D01 — Session/security transport: Web/Admin isolation confirmed; cookie names/attributes/TTL/CSRF/CORS/origins/revocation/rate limits remain Draft. Strict/12h and omitted Secure in prototype are implementation observations, not approved policy. Resolution: Approve session/security policy and canonical mapping before AUTH-01/browser slice; allow public work.
- D02 — Username/password/profile consistency: Canonical Admin-create/profile username patterns and password limits differ; prototype enforces 12 chars and profile null deletes values while Flow AB normalizes strings. CurrentUser responses omit required wire fields. Resolution: Review exact patterns/length/normalization and null/array semantics, then update canonical/mock/types together only when approved.
- D03 — Firebase + Resend verification/recovery ownership: Firebase Email/Google confirmed later; Scope still requires Resend one-use 24h links. Canonical register/verify/reset and four legacy Google deferred protocols have not migrated. Local account adding verified email lacks a frozen safe operation. Resolution: Approve provider action-link ownership, proof freshness/link/collision rules and proposed exchange/link changes. Preserve A01–A20; no silent removal of legacy paths.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
