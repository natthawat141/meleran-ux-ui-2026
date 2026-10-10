# LEARN-01 — Authorized learning/content/progress reads

Status: **BLOCKED** · Priority: P1 · Module: learning

รอ dependencies: ENROLL-01, COURSE-02

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.5 (line 302); §3.2 (line 415); §3.5 (line 475); §6.4 (line 1216)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/LEARN-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /learn/courses/{id} | get_learn_courses_id | ไม่มี body | 200: #/components/schemas/WireLearningCourse |
| GET | /learn/courses/{id}/items/{item_id} | get_learn_courses_id_items_item_id | ไม่มี body | 200: #/components/schemas/WireLearningItemContent |
| GET | /me/progress | get_me_progress | ไม่มี body | 200: #/components/schemas/ProgressPage |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /learn/courses/{id} → learning.read_self: effective enrollment; security [{"WebSession": []}]
- GET /learn/courses/{id}/items/{item_id} → course.read_content: effective enrollment; security [{"WebSession": []}]
- GET /me/progress → learning.read_self; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] ผู้เรียนอ่านตาม entitlement และ account eligibility; owner/Admin preview ไม่สร้างผลเรียน
- [CONFIRMED_SCOPE] ข้อมูล course/item ข้าม URL ต้องอยู่คอร์สเดียวกัน
- [CONFIRMED_SCOPE] ห้ามเปิด internal answer keys หรือ raw transcript
- [HTTP_DRAFT] ทั้ง 3 learner operations ใช้ effective enrollment ตาม canonical; owner/Admin preview ใช้ /courses/{id}/authoring-preview ใน COURSE-02 ไม่ให้สิทธิ์ผ่าน learner route เพียงเพราะเป็นเจ้าของ/Admin

## Data / transaction / dependencies

- Entities: Course, ContentItem, Enrollment, Progress
- [Domain model](../DOMAIN_MODEL.md) §READ — Read scoped projections
- PROPOSED_TECHNICAL execution: No write; apply principal/resource/Published scope before selecting fields; deterministic sort and page limits from canonical. No public GET grants/charges/completes.
- Dependencies: [ENROLL-01](ENROLL-01.md), [COURSE-02](COURSE-02.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/learning/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/learning/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- no entitlement/unverified; another course/learner IDs
- owner/Admin read has no Progress/Attempt/Certificate side effects
- durable progress and resume projections

Feature gate: **G-LEARNING** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A01 | สมัครด้วยอีเมลแล้ว Enroll ก่อนยืนยัน | ปฏิเสธ หลังยืนยันจึงลงเรียนได้ |
| A06 | ผู้เรียน A อ่าน/แก้ Progress หรือ Attempt ของ B | ปฏิเสธ ไม่คืนข้อมูลส่วนตัวของ B |
| A09 | บัญชี Admin สร้างเชื่อม Google แล้ว Logout/Login ด้วย Google | กลับ User เดิม Role คอร์ส Progress คะแนน และใบรับรองเดิมยังอยู่ |
| C08 | Instructor แก้เนื้อหา Published | ผู้เรียนเห็นข้อมูลที่แก้ได้ทันที ไม่รออนุมัติใหม่ |
| V01 | ใส่ YouTube Link ใน Video แล้วบันทึกและเปิดหน้าเรียน | ลิงก์และแหล่ง youtube อยู่ครบ เล่นได้ตามการตั้งค่าของ YouTube และตรวจสิทธิ์เข้าเรียน |
| V03 | ลิงก์ผิด วิดีโอถูกลบ หรือไม่อนุญาตให้ฝัง | แจ้งข้อผิดพลาด ไม่อ้างว่าเล่นได้และไม่เพิ่ม Progress เอง |
| Q02 | ออกจากระบบ/เปลี่ยนอุปกรณ์แล้วเปิดคอร์ส | ความคืบหน้าและข้อมูลกลับมาเรียนต่อยังอยู่ |
| Q12 | คอร์สยังเหลือหนึ่งรายการแต่เปอร์เซ็นต์ปัดใกล้ 100 | ยังไม่แสดง 100% และยังไม่จบ |
| F03 | Admin/เจ้าของเปิดดูเนื้อหาครบ | ไม่สร้างผลเรียนหรือใบรับรองอัตโนมัติ |
| AI05 | ผู้เรียนเปิดหน้าเรียน Catalog Preview และ API เนื้อหา | ไม่เห็น Raw Transcript ทั้งหมดหรือช่องแก้ Transcript |

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
