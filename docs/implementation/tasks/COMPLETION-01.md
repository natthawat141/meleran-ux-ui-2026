# COMPLETION-01 — Shared completion transaction service (no new HTTP operation)

Status: **PENDING** · Priority: P1 · Module: enrollments

Dependencies passed: DB-02, DB-03; pending D06 for best-result selection.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.5 (line 302); §2.6 (line 315); §2.7 (line 327); §4.5 (line 956); §5.5 (line 1064); §5.7 (line 1095)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- ไม่มี defined HTTP operation ใน task นี้; internal foundation/coordination หรือ deferred protocol เท่านั้น
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

ไม่มี API ใหม่หรือ endpoint เพิ่มในชุดนี้

## บริบทและข้อกำหนด

- [PROPOSED_TECHNICAL] backend-onlyproofarticle/video/fullygradedquiz; noHTTPissueendpoint
- [PROPOSED_TECHNICAL] Enrollments coordinatorlockenrollment ตรวจcurrentitems/reportedbestcompleted result
- [PROPOSED_TECHNICAL] atomicProgress+completed_at+completion_snapshot+Certificate metadataผ่านservicesownerร่วมtx
- [PROPOSED_TECHNICAL] Certificates.issueForCompletionรับtrustedserverproof/txไม่importLearning/Assessment; ไม่มีmodulecycle

## Data / transaction / dependencies

- Entities: Enrollment, Progress, QuizAttempt, Certificate
- [Domain model](../DOMAIN_MODEL.md) §TX-COMPLETE — Progress/course completion
- PROPOSED_TECHNICAL execution: Enrollment owns Progress and completion coordinator. Lock Enrollment; record legitimate manual article/video or backend-derived fully graded Quiz proof; unique Progress. Compare completed current items exactly (no rounded100). First completion writes immutable snapshot/time and Certificate record via issuer in same transaction. Already completed retains old snapshot despite later content. PDF/network work outside transaction.
- Dependencies: [DB-02](DB-02.md), [DB-03](DB-03.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/enrollments/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/enrollments/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- concurrentlastitem and grading/complete; exactly-oncecertificate
- failure rollbackทั้งsnapshot/metadata; >70 and no rounding to100
- newitemsbeforecompletionrequired; aftercompletionpreserve

Feature gate: **G-LEARNING** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| Q04 | ทำครบคำตอบและได้คะแนนมากกว่า 70% | ผ่าน เมื่อคะแนนทุกข้อเสร็จแล้ว |
| Q05 | Choice ผ่าน แต่ข้อเขียน/ภาพยังรอตรวจ | ยังไม่สรุปผ่านจากผลครั้งนั้น ไม่ออกใบรับรองก่อนครบ |
| Q06 | ครั้งแรกได้ 80% ครั้งถัดไปได้ 60% | ใช้ 80% และยังผ่าน |
| Q07 | ครั้งแรกได้ 60% ครั้งถัดไปได้ 90% | ใช้ 90% และเปลี่ยนเป็นผ่าน |
| Q12 | คอร์สยังเหลือหนึ่งรายการแต่เปอร์เซ็นต์ปัดใกล้ 100 | ยังไม่แสดง 100% และยังไม่จบ |
| F01 | เนื้อหาและแบบฝึกหัดผ่านครบ | Progress 100% ออกใบรับรองอัตโนมัติ |
| F02 | Refresh/เรียกตรวจจบซ้ำ/ดาวน์โหลดหลายครั้ง | ใบรับรองเดิม ไม่ออกใบซ้ำ |
| F03 | Admin/เจ้าของเปิดดูเนื้อหาครบ | ไม่สร้างผลเรียนหรือใบรับรองอัตโนมัติ |
| F04 | เพิ่มบทเรียนหลังผู้เรียนได้ใบรับรองแล้ว | สถานะจบและใบเดิมยังอยู่ เรียนเพิ่มเป็นทางเลือก |
| F05 | เพิ่มบทเรียนก่อนผู้เรียนจบ | ผู้เรียนยังต้องครบรายการปัจจุบัน |
| F08 | จบ 100% แล้วเพิ่มบท/แก้แบบฝึกหัด | completed_at และ completion_snapshot เดิมยังอยู่ ใช้อธิบายผลจบเดิมได้ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

Execution review 2026-10-11: D06 applies to the best-attempt snapshot selection required by Q06/Q07; DB-03 is a concrete schema dependency. No completion implementation until this policy is resolved.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy

## Learning/authoring continuation — 2026-10-11

Latest user authorizes technical choices with a written record. See [current component evidence](../LEARNING_AUTHORING_COMPONENT.md) and [agent decisions](../AUTONOMOUS_EXECUTION_DECISIONS.md). EXECUTION_STATUS and CONTINUATION_QUEUE supersede old decision waits for the verified subset. Full feature/acceptance gates remain pending; continue missing operations.
