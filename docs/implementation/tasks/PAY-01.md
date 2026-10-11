# PAY-01 — Checkout and own payment status

Status: **PENDING** · Priority: P1 · Module: payments

ต้องปิด D08, D10; D02 constraints/profile semantics confirmed แล้ว

Implemented subset: owned historical `GET /me/payments/{id}` คืน canonical WirePaymentView แบบ read-only, linked Enrollment/source เดิม; 16 HTTP/PG tests + 8 unchanged client checks. อ่าน [component checkpoint](../LOGOUT_PAYMENT_COMPONENTS.md). Checkout/event processing/provider gate ยังค้าง; 113 business acceptance ไม่ได้ผ่านจาก stored fixtures.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.4 (line 264); §3.3 (line 437); §5.11 (line 1136); §6.5.1 (line 1253)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/PAY-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /me/payments/checkout | post_me_payments_checkout | #/components/schemas/CheckoutRequest | 200: #/components/schemas/CheckoutResponse; 201: #/components/schemas/CheckoutResponse |
| GET | /me/payments/{id} | get_me_payments_id | ไม่มี body | 200: #/components/schemas/WirePaymentView |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /me/payments/checkout → payment.checkout_self; security [{"WebSession": []}, {"AdminSession": []}]
- GET /me/payments/{id} → payment.read_self; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] serverกำหนด price/currency snapshot; Published paid onlyและยังไม่มีสิทธิ์
- [CONFIRMED_SCOPE] Admin/own course/unverified self ถูกปฏิเสธก่อนสร้าง Checkout
- [CONFIRMED_SCOPE] request_id/reusable open session ป้องกัน accidental duplicate charge
- [CONFIRMED_SCOPE] success/cancel URL หรือ GET status ไม่ grant สิทธิ์ ไม่ overwrite paid จาก browser

## Data / transaction / dependencies

- Entities: User, Course, Payment, Enrollment
- [Domain model](../DOMAIN_MODEL.md) §TX-CHECKOUT — External Checkout
- PROPOSED_TECHNICAL execution: Persist server price/currency/request intent first; perform Stripe I/O outside DB transaction using approved provider idempotency. Persist session ID/result; timeout requires lookup/reconciliation rather than another charge. GET/success/cancel URL only reads authoritative state.
- Dependencies: [ENROLL-01](ENROLL-01.md), [DB-04](DB-04.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/payments/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/payments/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- tampered amount/course/payment IDs; duplicate click/two tabs
- provider timeout after session creation; replay payload mismatch
- pending/processing/failed/expired durable states and schemas

Feature gate: **G-PAYMENT** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A01 | สมัครด้วยอีเมลแล้ว Enroll ก่อนยืนยัน | ปฏิเสธ หลังยืนยันจึงลงเรียนได้ |
| P01 | บัญชีพร้อมซื้อคอร์ส Published ผ่าน Stripe สำเร็จ | Backend ตรวจ Webhook แล้วสร้าง Enrollment source stripe โดยไม่รอ Admin/ไม่ใช้โค้ด เข้าเรียนได้ตลอด |
| P02 | Admin หรือ Instructor ซื้อคอร์สตนเอง; สมัครอีเมลยังไม่ยืนยัน | ปฏิเสธก่อนสร้าง Session; บัญชีที่ Admin สร้างเรียนได้ทันทีตามข้อยกเว้น |
| P03 | แก้ราคา course_id payment_id หรือสถานะใน Request/URL | ใช้ราคาจาก server เข้าถึงเฉพาะ Payment ของตน ไม่ได้สิทธิ์ผิดคอร์สหรือจากสถานะปลอม |
| P04 | จ่ายไม่สำเร็จ กดกลับ Session หมดอายุ หรือยังรอผล | แสดงผลตาม Stripe/server ยังไม่ให้สิทธิ์ใหม่; browser ยกเลิกอย่างเดียวไม่ทับผลจ่ายสำเร็จ |
| P05 | จ่ายแล้วปิด browser ก่อนกลับจาก Stripe | Webhook ให้สิทธิ์ได้ เปิดบัญชีเดิมแล้วเรียนต่อได้ |
| P06 | ส่ง Webhook ปลอม ส่งซ้ำ หรือสองแท็บอ่านสถานะพร้อมกัน | ปฏิเสธลายเซ็นผิด; Webhook จริงให้สิทธิ์หนึ่งครั้ง ไม่มี Payment หรือ Enrollment ซ้ำ; GET ไม่ให้สิทธิ์ |
| P07 | จ่ายสำเร็จแต่บันทึกสิทธิ์ล้มเหลว | เก็บ Succeeded และ fulfillment failed ลองให้สิทธิ์ต่อได้โดยไม่เก็บเงินใหม่ |
| P08 | Redeem สำเร็จระหว่างรอผลจ่าย หรือมี Payment จ่ายซ้ำจริง | ใช้ Enrollment เดิม เก็บผลเงินทุกรายการ ไม่ใช้โค้ดเพิ่ม ไม่สร้าง Refund policy อัตโนมัติ |
| P09 | เปลี่ยนราคาคอร์สหลังเริ่มจ่าย / กดซื้อซ้ำขณะ Session ยังเปิด | ตรวจจากราคา Snapshot เดิม; การลอง request เดิมไม่สร้างการเก็บเงินใหม่ทุกครั้ง |
| P10 | เปิด Success Page หรือเติม status=success ใน URL ก่อน Webhook มาถึง | อ่านสถานะ Pending/Processing จาก Backend ไม่สร้างสิทธิ์และไม่มีปุ่มเริ่มเรียน; หลัง Webhook สำเร็จจึงแสดงสิทธิ์ |
| P11 | Frontend ส่งราคาหรือ User ID ที่แก้เองในคำขอ Checkout | Backend ใช้ตัวตนจาก session และราคาปัจจุบันของ Course เท่านั้น ปฏิเสธหรือไม่ใช้ค่าที่ไม่ได้อยู่ใน contract |
| P12 | Redeem สำเร็จก่อน Webhook ของ Payment เดิม | เชื่อม Payment กับ Enrollment เดิม ไม่สร้างสิทธิ์ซ้ำและไม่เขียนทับ source redeem |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D08 — Stripe protocol: Webhook remains deferred: verified raw body/signature/API version/event selection/late async payment behavior need provider contract. Resolution: Approve protocol + SDK justification + sandbox test plan; preserve financial state separate from grant and no refund policy invented.
- D10 — Replay/precondition policy: Key lifetime, same-key/different-payload conflict, create/grade partial success and timeout recovery need precise agreement. Resolution: Approve operation-specific semantics; keep naturally idempotent unique constraints; never blanket retry mutations/provider calls.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
