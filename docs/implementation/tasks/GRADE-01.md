# GRADE-01 — Owner Instructor grading

Status: **PENDING** · Priority: P1 · Module: assessments

ต้องปิด D06, D10; D02 constraints/profile semantics confirmed แล้ว

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.6 (line 315); §3.4 (line 451); §3.5 (line 475); §6.6 (line 1278)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/GRADE-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /instructor/grading-queue | get_instructor_grading-queue | ไม่มี body | 200: #/components/schemas/GradingQueuePage |
| PUT | /instructor/attempts/{id}/questions/{question_id}/grade | put_instructor_attempts_id_questions_question_id_grade | #/components/schemas/QuestionGradeRequest | 200: #/components/schemas/WireAttemptView |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /instructor/grading-queue → quiz.grade: owner Instructor; Admin forbidden; security [{"WebSession": []}]
- PUT /instructor/attempts/{id}/questions/{question_id}/grade → quiz.grade: owner Instructor; Admin forbidden; security [{"WebSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Instructor เจ้าของคอร์สตรวจข้อเขียน/ภาพ; Admin ไม่ได้สิทธิ์ตรวจแทนเอง
- [CONFIRMED_SCOPE] คะแนนไม่เกิน max ของ snapshot; serverคำนวณรวมและรอครบ
- [PROPOSED_TECHNICAL] ตรวจซ้ำ/concurrent grading ต้องไม่ duplicate completion/certificate

## Data / transaction / dependencies

- Entities: Course, QuizAttempt, Answer, Progress, Certificate
- [Domain model](../DOMAIN_MODEL.md) §TX-GRADE — Last manual grade
- PROPOSED_TECHNICAL execution: Owner Instructor only; acquire Course/Enrollment/Attempt/Answer locks in shared order, recheck ownership and validate snapshot max and revision/idempotency D10. Recompute result when all grades complete, select best completed result under D06 and update Progress/completion/cert through owner services sharing transaction.
- Dependencies: [ASSESS-01](ASSESS-01.md), [COMPLETION-01](COMPLETION-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/assessments/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/assessments/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- foreign-course Instructor/Admin denied
- over-max/negative/invalid scores; concurrent last answer graded
- best completed attempt and completion/cert updated atomically

Feature gate: **G-ASSESSMENT** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A05 | Instructor A แก้ Course/Chapter/Quiz ของ B | ปฏิเสธ แม้ A ลงเรียนคอร์ส B แล้ว |
| E03 | Instructor Redeem คอร์สคนอื่น | ได้สิทธิ์เรียน แต่ไม่ได้ Editor/คิวตรวจงาน |
| Q04 | ทำครบคำตอบและได้คะแนนมากกว่า 70% | ผ่าน เมื่อคะแนนทุกข้อเสร็จแล้ว |
| Q05 | Choice ผ่าน แต่ข้อเขียน/ภาพยังรอตรวจ | ยังไม่สรุปผ่านจากผลครั้งนั้น ไม่ออกใบรับรองก่อนครบ |
| Q06 | ครั้งแรกได้ 80% ครั้งถัดไปได้ 60% | ใช้ 80% และยังผ่าน |
| Q07 | ครั้งแรกได้ 60% ครั้งถัดไปได้ 90% | ใช้ 90% และเปลี่ยนเป็นผ่าน |
| Q11 | Instructor ตรวจคำตอบคอร์สคนอื่น/ให้คะแนนเกินเต็ม | ปฏิเสธ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D06 — Assessment comparison across changed max-score versions: Scope confirms best completed score and immutable attempts; how to compare attempts after max score changes is not fully specified; start/submit replay ownership needs exact request semantics. Resolution: Decide comparison rule across versions explicitly; do not assume raw score or percentage. Preserve >70%, fully graded only, historical snapshots.
- D10 — Replay/precondition policy: Key lifetime, same-key/different-payload conflict, create/grade partial success and timeout recovery need precise agreement. Resolution: Approve operation-specific semantics; keep naturally idempotent unique constraints; never blanket retry mutations/provider calls.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy

## Assessment lifecycle execution override — 2026-10-11

Latest user authorizes agent-selected documented protocols. [Evidence](../ASSESSMENT_LIFECYCLE_COMPONENT.md) and [decision record](../AUTONOMOUS_EXECUTION_DECISIONS.md) override earlier D06/D09/D10 waits for these implemented APIs. All package APIs have component evidence; shared25 PG/12 units/7 actual Frontend checks. Browser/original113 acceptance remain pending. No new HTTP shape/schema/dependency.
