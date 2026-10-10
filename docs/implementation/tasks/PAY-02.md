# PAY-02 — Admin payment view

Status: **BLOCKED** · Priority: P1 · Module: payments

รอ dependencies: PAY-01

Contract conflict found 11 ต.ค. 2026: `WireAdminPayment.checkout_session_id` required string ขัดกับ valid DB Checkout intent ที่ยังมี null; events `outcome` ยังไม่มี mapping ที่ยืนยันจาก receipt processing state. Proposed required-nullable + explicit event outcome protocol ต้อง approved canonical delta ก่อน implement; ห้าม invent empty ID/fulfilled outcome. อ่าน [component checkpoint](../LOGOUT_PAYMENT_COMPONENTS.md).

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §3.3 (line 437); §3.4 (line 451); §5.11 (line 1136)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/PAY-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /admin/payments/{id} | get_admin_payments_id | ไม่มี body | 200: #/components/schemas/WireAdminPayment |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /admin/payments/{id} → payment.read_admin: individual abnormal-payment lookup only; security [{"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [HTTP_DRAFT] Admin session+role อ่าน payment ตาม contract
- [CONFIRMED_SCOPE] เงินกับ fulfillment state แยก; แสดง failed fulfillment แม้เงิน succeeded
- [CONFIRMED_SCOPE] การอ่านไม่ replay charge หรือ grant

## Data / transaction / dependencies

- Entities: Payment, PaymentEvent, Enrollment
- [Domain model](../DOMAIN_MODEL.md) §READ — Read scoped projections
- PROPOSED_TECHNICAL execution: No write; apply principal/resource/Published scope before selecting fields; deterministic sort and page limits from canonical. No public GET grants/charges/completes.
- Dependencies: [PAY-01](PAY-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/payments/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/payments/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- non-admin and forged audience denied
- no-card/no-secret DTO; paid+failed fulfillment visible
- unknown payment and restart projection

Feature gate: **G-PAYMENT** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| P03 | แก้ราคา course_id payment_id หรือสถานะใน Request/URL | ใช้ราคาจาก server เข้าถึงเฉพาะ Payment ของตน ไม่ได้สิทธิ์ผิดคอร์สหรือจากสถานะปลอม |

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
