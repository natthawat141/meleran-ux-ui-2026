# LEARN-02 — Complete article/video and resume

Status: **BLOCKED** · Priority: P1 · Module: learning

รอ dependencies: LEARN-01, COMPLETION-01

## Read set และ traceability

Execution update 11 ต.ค. 2026: owner ResumeWriter/storedResume participant has
8 PostgreSQL tests and built-writer→Nest→unchanged frontend read integration.
[RESUME_PERSISTENCE_COMPONENT](../RESUME_PERSISTENCE_COMPONENT.md) records UTC
resume time/private order, immutable academic history, locks and pending
ResumeRequest vs mock reconciliation. No public PUT/complete operation is closed;
whole task remains BLOCKED and no original acceptance case is marked accepted.

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.5 (line 302); §2.7 (line 327); §4.5 (line 956); §5.5 (line 1064); §6.4 (line 1216)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/LEARN-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /learn/items/{id}/complete | post_learn_items_id_complete | #/components/schemas/EmptyRequest | 200: #/components/schemas/CompleteResponse |
| PUT | /learn/items/{id}/resume | put_learn_items_id_resume | #/components/schemas/ResumeRequest | 200: #/components/schemas/ResumeResponse |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /learn/items/{id}/complete → progress.update_self; security [{"WebSession": []}]
- PUT /learn/items/{id}/resume → progress.update_self; security [{"WebSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] วิดีโอ/บทอ่านจบเมื่อกดเรียนจบ ไม่ใช้ watch time
- [CONFIRMED_SCOPE] หนึ่ง Enrollment/Item มี Progress เดียว; resume เก็บฝั่ง server
- [CONFIRMED_SCOPE] Quiz ต้องผ่าน assessment completion path ไม่รับ complete shortcut
- [CONFIRMED_SCOPE] 100% ต้องครบทุก itemจริง; ผู้จบเดิมคง completed_at/snapshot

## Data / transaction / dependencies

- Entities: Enrollment, Progress, ContentItem, Certificate
- [Domain model](../DOMAIN_MODEL.md) §TX-COMPLETE — Progress/course completion
- PROPOSED_TECHNICAL execution: Enrollment owns Progress and completion coordinator. Lock Enrollment; record legitimate manual article/video or backend-derived fully graded Quiz proof; unique Progress. Compare completed current items exactly (no rounded100). First completion writes immutable snapshot/time and Certificate record via issuer in same transaction. Already completed retains old snapshot despite later content. PDF/network work outside transaction.
- Dependencies: [LEARN-01](LEARN-01.md), [COMPLETION-01](COMPLETION-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/learning/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/learning/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- repeat and concurrent complete, forged Quiz completion
- near100 rounding; no preview progress
- resume after logout/device and certificate issue trigger

Feature gate: **G-LEARNING** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A06 | ผู้เรียน A อ่าน/แก้ Progress หรือ Attempt ของ B | ปฏิเสธ ไม่คืนข้อมูลส่วนตัวของ B |
| V03 | ลิงก์ผิด วิดีโอถูกลบ หรือไม่อนุญาตให้ฝัง | แจ้งข้อผิดพลาด ไม่อ้างว่าเล่นได้และไม่เพิ่ม Progress เอง |
| Q01 | กดเรียนจบวิดีโอ/บทอ่าน แล้วกดซ้ำ | Completed หนึ่งรายการ ไม่เพิ่มยอดซ้ำ |
| Q02 | ออกจากระบบ/เปลี่ยนอุปกรณ์แล้วเปิดคอร์ส | ความคืบหน้าและข้อมูลกลับมาเรียนต่อยังอยู่ |
| Q04 | ทำครบคำตอบและได้คะแนนมากกว่า 70% | ผ่าน เมื่อคะแนนทุกข้อเสร็จแล้ว |
| Q12 | คอร์สยังเหลือหนึ่งรายการแต่เปอร์เซ็นต์ปัดใกล้ 100 | ยังไม่แสดง 100% และยังไม่จบ |
| F03 | Admin/เจ้าของเปิดดูเนื้อหาครบ | ไม่สร้างผลเรียนหรือใบรับรองอัตโนมัติ |
| F05 | เพิ่มบทเรียนก่อนผู้เรียนจบ | ผู้เรียนยังต้องครบรายการปัจจุบัน |

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
