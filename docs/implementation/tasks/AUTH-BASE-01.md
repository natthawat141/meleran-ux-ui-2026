# AUTH-BASE-01 — Shared principal/session and local credential kernel

Status: **NEEDS_DECISION** · Priority: P0 · Module: auth

ต้องปิด D01, D02

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §1.2 (line 65); §2.1 (line 169); §3.1 (line 409); §4.5 (line 956); §5.8 (line 1101)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- อ่าน [AUTH-01 context](../contracts/AUTH-01.openapi.json) สำหรับ principal/CurrentUser fields และ D01/D02 ที่ปิดแล้ว; kernel ไม่มี HTTP operation ใหม่
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

ไม่มี API ใหม่หรือ endpoint เพิ่มในชุดนี้

## บริบทและข้อกำหนด

- [PROPOSED_TECHNICAL] Internal Auth interfaces เท่านั้น: resolve principal, issue/revoke app session, verify local Username credential และ trusted provider principal handoff; ไม่มี HTTP endpoint ใหม่
- [CONFIRMED_SCOPE] Web/Admin ใช้ User เดียวแต่ session แยก; audience ไม่ให้ role และ Logout ไม่ปิด session อีก app
- [UNRESOLVED_REQUIREMENT] Credential hash/cookie/TTL/revocation/CSRF ตาม D01/D02 ที่ปิดแล้ว; ไม่ยก demo PBKDF2/Strict12h เป็น policy
- [UNRESOLVED_REQUIREMENT] Email/Google credential owner เป็น provider ตาม D03; kernel ไม่สร้าง fake Firebase email หรือเก็บ provider password ซ้ำ

## Data / transaction / dependencies

- Entities: User, LocalCredential, AppSession, UserRole
- [Domain model](../DOMAIN_MODEL.md) §TX-AUTH — Auth/reset
- PROPOSED_TECHNICAL execution: Verify proof/credential then atomically consume local reset proof/change password or create/revoke one app session. No provider password duplication; remote mail/provider I/O outside DB transaction; exact revocation policy D01/D03.
- Dependencies: [FOUNDATION-01](FOUNDATION-01.md), [DB-01](DB-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/auth/auth.module.ts + auth.service.ts/exported session/local credential helpers (reuse existing feature)
- backend/src/shared/auth/session.guard.ts + current-user.decorator.ts: consume Auth principal interface
- feature-local session/credential/authorization/PostgreSQL tests; no new Auth HTTP endpoint or independent identity store

## Tests และ acceptance

- unit session issue/resolve/revoke and wrong audience; expired/revoked proof
- local Username verification and approved hash metadata; secrets not returned/logged
- PostgreSQL durable sessions; role/principal freshness; session isolation across Web/Admin

Feature gate: **G-AUTH** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

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

- D01 — Session/security transport: Web/Admin isolation confirmed; cookie names/attributes/TTL/CSRF/CORS/origins/revocation/rate limits remain Draft. Strict/12h and omitted Secure in prototype are implementation observations, not approved policy. Resolution: Approve session/security policy and canonical mapping before AUTH-01/browser slice; allow public work.
- D02 — Username/password/profile consistency: Canonical Admin-create/profile username patterns and password limits differ; prototype enforces 12 chars and profile null deletes values while Flow AB normalizes strings. CurrentUser responses omit required wire fields. Resolution: Review exact patterns/length/normalization and null/array semantics, then update canonical/mock/types together only when approved.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
