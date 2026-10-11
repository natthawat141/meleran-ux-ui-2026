# REDEEM-01 — Issue/list/revoke codes

Status: **PENDING** · Priority: P1 · Module: redeem

รอ dependencies: COURSE-01, DB-04, AUTH-01

## Read set และ traceability

Execution 11 ต.ค. 2026: canonical Admin revoke operation has actual HTTP/PG
and unchanged frontend decoder integration; original actor/time replay and
competing Redeem lock behavior verified. See
[REDEEM_TRANSACTION_COMPONENT](../REDEEM_TRANSACTION_COMPONENT.md).
Issue is now implemented with 5 additional HTTP/PG tests; masked list and full
Auth/Course/G-REDEEM/G-AI feature gates remain PENDING.

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.4 (line 264); §3.3 (line 437); §4.5 (line 956); §5.4 (line 1050); §6.3 (line 1189)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/REDEEM-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /admin/redeem-codes | post_admin_redeem-codes | #/components/schemas/IssueCodesRequest | 201: #/components/schemas/IssuedCodesResponse |
| GET | /admin/redeem-codes | get_admin_redeem-codes | ไม่มี body | 200: #/components/schemas/RedeemCodePage |
| POST | /admin/redeem-codes/{id}/revoke | post_admin_redeem-codes_id_revoke | #/components/schemas/EmptyRequest | 200: #/components/schemas/RevokeCodeResponse |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /admin/redeem-codes → redeem_code.create; security [{"AdminSession": []}]
- GET /admin/redeem-codes → redeem_code.read; security [{"AdminSession": []}]
- POST /admin/redeem-codes/{id}/revoke → redeem_code.revoke: unused only; security [{"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Admin ออกโค้ดผูกคอร์สเดียว ไม่มี learner ก่อนใช้; codeไม่หมดอายุ
- [CONFIRMED_SCOPE] revoke เฉพาะ Unused พร้อม actor/time; Usedห้าม revoke
- [CONFIRMED_SCOPE] revoke-vs-redeem ต้องสำเร็จทางเดียว; ไม่ถอน enrollment/certเดิม

## Data / transaction / dependencies

- Entities: Course, RedeemCode, Enrollment
- [Domain model](../DOMAIN_MODEL.md) §TX-REDEEM — Redeem vs revoke
- PROPOSED_TECHNICAL execution: Lock Code and entitlement key in consistent order; recheck Unused and eligibility. Existing Enrollment returns without consuming. Code used_by/time/enrollment+central grant commit together. Revoke competes on same Unused row; failure rollback. No expiry added.
- Dependencies: [COURSE-01](COURSE-01.md), [DB-04](DB-04.md), [AUTH-01](AUTH-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/redeem/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/redeem/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- unique code generation collision; non-admin denied
- unused→revoked; used rejection; race with redeem
- list used owner/time and unused without learner

Feature gate: **G-REDEEM** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| E05 | Admin ออกโค้ดและผู้เรียนใช้สำเร็จ | ผูกคอร์สถูกต้อง ระบุ User และเวลาใช้ |
| E11 | Admin ยกเลิก Unused | เป็น Revoked มีผู้ทำ/เวลา แลกไม่ได้ |
| E12 | Admin ยกเลิก Used | ปฏิเสธ สิทธิ์เรียนและใบรับรองเดิมยังอยู่ |
| E13 | ยกเลิก Unused พร้อมกับ Redeem | สำเร็จได้หนึ่งทาง ไม่เกิดทั้ง Revoked และให้สิทธิ์จากรหัสเดียวกัน |

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

Continuation update 11 ต.ค.: 2/3 canonical operations component-verified; see [current checkpoint](../PROFILE_REDEEM_MANAGED_ATTEMPT_COMPONENT.md). Outstanding feature gates/decisions are PENDING and do not block independent use cases.
