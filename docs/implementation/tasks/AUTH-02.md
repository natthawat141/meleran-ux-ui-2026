# AUTH-02 — Email signup/verify/resend

Status: **PENDING** · Priority: P1 · Module: auth

ต้องปิด D03; D02 constraints/profile semantics confirmed แล้ว

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.1 (line 169); §5.8 (line 1101); §6.2 (line 1171)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/AUTH-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /auth/register | post_auth_register | #/components/schemas/RegisterRequest | 201: #/components/schemas/RegisterResponse |
| POST | /auth/verify-email | post_auth_verify-email | #/components/schemas/VerifyEmailRequest | 200: #/components/schemas/VerifyEmailResponse |
| POST | /auth/resend-verification-email | post_auth_resend-verification-email | #/components/schemas/ResendVerificationRequest | 202: #/components/schemas/AcceptedResponse |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /auth/register → public; security []
- POST /auth/verify-email → public; security []
- POST /auth/resend-verification-email → public; security []

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] สมัครเองเริ่ม Learner; unverified เข้าได้แต่ธุรกรรมเรียนถูกปฏิเสธ
- [UNRESOLVED_REQUIREMENT] Verification Link ใช้ครั้งเดียวอายุ 24h ผ่าน Resend ตาม Scope; ต้องปิด ownership กับ Firebase ก่อน
- [CONFIRMED_SCOPE] ส่งเมลสำเร็จไม่ใช่ยืนยันสำเร็จ; เก็บผลล้มเหลวและจำกัดความถี่โดย policy ที่อนุมัติ

## Data / transaction / dependencies

- Entities: User, AuthIdentity, EmailVerification, EmailDelivery
- [Domain model](../DOMAIN_MODEL.md) §TX-LINK — Identity/verification consume
- PROPOSED_TECHNICAL execution: Lock original User/link proof; unique provider/project/subject; conditional unused/unexpired consumption and verified flag/link update together. Collision cannot move ownership. Provider verification before transaction.
- Dependencies: [AUTH-01](AUTH-01.md), [PROVIDER-AUTH-01](PROVIDER-AUTH-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/auth/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/auth/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- link invalid/expired/replayed/concurrent; User เดิมไม่ซ้ำ
- sender failure ไม่เปลี่ยน verified; quota/resend rate tests ตาม decision
- actual Firebase/Resend sandbox evidence แยก test doubles

Feature gate: **G-AUTH** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A01 | สมัครด้วยอีเมลแล้ว Enroll ก่อนยืนยัน | ปฏิเสธ หลังยืนยันจึงลงเรียนได้ |
| A14 | ส่งอีเมลขัดข้อง | มีผลล้มเหลวให้ตรวจ ไม่รายงานว่ายืนยันอีเมลหรือ Reset แล้ว |
| A15 | ตรวจวิธี Login รอบแรก | มี Username/อีเมลและ Google ยังไม่มี LINE |
| A17 | สมัครอีเมลและกดลิงก์ภายใน 24 ชั่วโมง | ได้ Verification Link ทาง Resend ไม่ใช้ OTP; User เดิม email_verified=true |
| A18 | ลิงก์ Verification หมดอายุหรือไม่ถูกต้อง | ไม่ยืนยัน ให้ขอลิงก์ใหม่เมื่อหมดอายุ |
| A19 | เปิดลิงก์ Verification ที่ใช้แล้วซ้ำ/พร้อมกัน | ไม่ยืนยันซ้ำ ไม่สร้าง User และไม่เพิ่มผลธุรกิจซ้ำ |
| A20 | ขอ Resend Verification Email ถี่เกินขีดจำกัด | จำกัดการส่ง แจ้งสถานะที่เหมาะสม |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D03 — Firebase + Resend verification/recovery ownership: Firebase Email/Google credential ownership, Nest local Username/app sessions, explicit linking/no email auto-merge and necessary exchange/link contract design approved 2026-10-11. Wire/proof/recovery/error design, dependency justification and provider verification remain open; four Google deferred records are retained.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
