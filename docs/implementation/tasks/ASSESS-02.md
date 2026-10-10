# ASSESS-02 — Own attempt/results and best completed score

Status: **NEEDS_DECISION** · Priority: P1 · Module: assessments

ต้องปิด D06

Execution component 11 ต.ค.: `GET /learn/attempts/{id}` implemented bounded owned historical projection; 6 units + 15 actual HTTP/PG tests + 9 unchanged client checks. อ่าน [ATTEMPT_READ_COMPONENT](../ATTEMPT_READ_COMPONENT.md). Best-result endpoint/D06 ยังไม่ implement; stored Submitted vs canonical three-state conflict/normalized snapshot writer is explicit. Whole task ไม่ DONE; no original acceptance marked accepted.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.6 (line 315); §3.5 (line 475); §5.6 (line 1080); §6.6 (line 1278)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/ASSESS-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /learn/attempts/{id} | get_learn_attempts_id | ไม่มี body | 200: #/components/schemas/WireAttemptView |
| GET | /learn/items/{id}/results | get_learn_items_id_results | ไม่มี body | 200: #/components/schemas/QuizResults |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /learn/attempts/{id} → learning.read_self; security [{"WebSession": []}]
- GET /learn/items/{id}/results → learning.read_self; security [{"WebSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] อ่านเฉพาะ attempt/result ของตนและสิทธิ์ context
- [CONFIRMED_SCOPE] ใช้ผลสูงสุดของ attempt ที่ตรวจเสร็จ ไม่ใช้ pending result
- [CONFIRMED_SCOPE] ครั้งใหม่ต่ำกว่าไม่ลบผลผ่านเดิม; attemptเก่าไม่เปลี่ยนตาม Quizฉบับใหม่

## Data / transaction / dependencies

- Entities: QuizAttempt, Answer, Progress
- [Domain model](../DOMAIN_MODEL.md) §READ — Read scoped projections
- PROPOSED_TECHNICAL execution: No write; apply principal/resource/Published scope before selecting fields; deterministic sort and page limits from canonical. No public GET grants/charges/completes.
- Dependencies: [ASSESS-01](ASSESS-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/assessments/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/assessments/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- 80→60 remains pass; 60→90 becomes pass
- pending excluded; other learner denied
- changed max-score versions covered by approved comparison decision

Feature gate: **G-ASSESSMENT** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A06 | ผู้เรียน A อ่าน/แก้ Progress หรือ Attempt ของ B | ปฏิเสธ ไม่คืนข้อมูลส่วนตัวของ B |
| A09 | บัญชี Admin สร้างเชื่อม Google แล้ว Logout/Login ด้วย Google | กลับ User เดิม Role คอร์ส Progress คะแนน และใบรับรองเดิมยังอยู่ |
| Q06 | ครั้งแรกได้ 80% ครั้งถัดไปได้ 60% | ใช้ 80% และยังผ่าน |
| Q07 | ครั้งแรกได้ 60% ครั้งถัดไปได้ 90% | ใช้ 90% และเปลี่ยนเป็นผ่าน |
| AI21 | เลือกคอร์สด้วย `/` แล้วเปลี่ยนคอร์สหรือเลือกบริบทแบบฝึกหัด | ฉบับร่างคำถามไม่หาย ข้อความเก่ายังอ้างบริบทเดิม ไม่มีเฉลย Editor หลุดมา |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D06 — Assessment comparison across changed max-score versions: Scope confirms best completed score and immutable attempts; how to compare attempts after max score changes is not fully specified; start/submit replay ownership needs exact request semantics. Resolution: Decide comparison rule across versions explicitly; do not assume raw score or percentage. Preserve >70%, fully graded only, historical snapshots.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
