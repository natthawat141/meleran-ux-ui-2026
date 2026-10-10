# ASSESS-01 — Attempt snapshot/answer/submit

Status: **NEEDS_DECISION** · Priority: P1 · Module: assessments

ต้องปิด D06, D09, D10

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.6 (line 315); §4.5 (line 956); §5.6 (line 1080); §6.6 (line 1278)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/ASSESS-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /learn/items/{id}/attempts | post_learn_items_id_attempts | #/components/schemas/EmptyRequest | 200: #/components/schemas/WireAttemptView; 201: #/components/schemas/WireAttemptView |
| PUT | /learn/attempts/{id}/answers | put_learn_attempts_id_answers | #/components/schemas/SaveAnswersRequest | 200: #/components/schemas/WireAttemptView |
| POST | /learn/attempts/{id}/submit | post_learn_attempts_id_submit | #/components/schemas/EmptyRequest | 200: #/components/schemas/WireAttemptView |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /learn/items/{id}/attempts → quiz.attempt_self; security [{"WebSession": []}]
- PUT /learn/attempts/{id}/answers → quiz.attempt_self; security [{"WebSession": []}]
- POST /learn/attempts/{id}/submit → quiz.attempt_self; security [{"WebSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] เริ่ม attempt เก็บ immutable questions/options/keys/max score
- [CONFIRMED_SCOPE] ส่งคำตอบครบ; server คิดคะแนน; >70% ผ่าน 70% ไม่ผ่าน
- [CONFIRMED_SCOPE] ข้อเขียน/ภาพรอ Instructor ครบก่อนสรุป; ส่งแล้วแก้คำตอบเดิมไม่ได้
- [UNRESOLVED_REQUIREMENT] retry ใช้ attemptเดิม; ลองใหม่เป็น attemptใหม่; ภาพต้องมี approved media protocol

## Data / transaction / dependencies

- Entities: Quiz, Question, Enrollment, QuizAttempt, Answer, Progress
- [Domain model](../DOMAIN_MODEL.md) §TX-ASSESS — Attempt start/answer/submit
- PROPOSED_TECHNICAL execution: Start stores immutable full question/max/key snapshot; answer upsert only on owned open attempt and valid snapshot ID. Acquire Course/Enrollment/Attempt locks in the shared order before submit; freeze answers and server scoring. Pending written answers prevent final pass. Completed result calls Enrollment completion with verified best-result proof in the same transaction; replay rules D10.
- Dependencies: [LEARN-01](LEARN-01.md), [DB-03](DB-03.md), [COMPLETION-01](COMPLETION-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/assessments/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/assessments/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- snapshot after editor change; fake score/passed rejected
- double submit/answer-vs-submit race; missing answers
- pending written/image; invalid question IDs; rollback

Feature gate: **G-ASSESSMENT** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A06 | ผู้เรียน A อ่าน/แก้ Progress หรือ Attempt ของ B | ปฏิเสธ ไม่คืนข้อมูลส่วนตัวของ B |
| Q03 | ทำครบคำตอบแต่ได้คะแนน 70% | ไม่ผ่าน ยังไม่นับ Quiz เป็น Completed |
| Q04 | ทำครบคำตอบและได้คะแนนมากกว่า 70% | ผ่าน เมื่อคะแนนทุกข้อเสร็จแล้ว |
| Q05 | Choice ผ่าน แต่ข้อเขียน/ภาพยังรอตรวจ | ยังไม่สรุปผ่านจากผลครั้งนั้น ไม่ออกใบรับรองก่อนครบ |
| Q06 | ครั้งแรกได้ 80% ครั้งถัดไปได้ 60% | ใช้ 80% และยังผ่าน |
| Q07 | ครั้งแรกได้ 60% ครั้งถัดไปได้ 90% | ใช้ 90% และเปลี่ยนเป็นผ่าน |
| Q08 | เริ่ม Attempt แล้วผู้สอนแก้โจทย์/คะแนนเต็ม | ครั้งเดิมใช้ชุดที่เก็บไว้ ครั้งใหม่ใช้ชุดปัจจุบัน |
| Q09 | ส่ง Score=100/Passed=true จากหน้าเว็บ | server คิดจากคำตอบจริง ไม่เชื่อค่าที่ส่ง |
| Q10 | ส่งคำตอบซ้ำหรือบันทึกทับหลังส่งแล้ว | ไม่สร้าง Attempt ใหม่ และแก้คำตอบที่ส่งแล้วไม่ได้ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D06 — Assessment comparison across changed max-score versions: Scope confirms best completed score and immutable attempts; how to compare attempts after max score changes is not fully specified; start/submit replay ownership needs exact request semantics. Resolution: Decide comparison rule across versions explicitly; do not assume raw score or percentage. Preserve >70%, fully graded only, historical snapshots.
- D09 — Image/R2 upload missing contract: Profile/cover/blog/essay image upload has no frozen operation in 86; video upload explicitly disabled. R2 choice already confirmed. Resolution: Approve image protocol/schema/permission/size/lifecycle; track gap without inventing endpoint. Block image-dependent acceptance only.
- D10 — Replay/precondition policy: Key lifetime, same-key/different-payload conflict, create/grade partial success and timeout recovery need precise agreement. Resolution: Approve operation-specific semantics; keep naturally idempotent unique constraints; never blanket retry mutations/provider calls.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
