# REVIEW-01 — Admin review queue/detail

Status: **PENDING** · Priority: P1 · Module: courses

รอ dependencies: COURSE-02

Storage preflight 11 ต.ค.: [CONTRACT_STORAGE_GAPS](../CONTRACT_STORAGE_GAPS.md#course-02--review-01--authoring-readwrite-prerequisites) แยก confirmed revision/history requirement จาก proposed review payload storage. D04 ของ prerequisite ต้องกำหนด old-review detail/current-course stale behavior ก่อน reader; Scope §4.6 ไม่บังคับ full course-version system. ห้าม silently คืน current course เป็น submitted snapshot.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.3 (line 243); §3.4 (line 451); §5.2 (line 1008)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/REVIEW-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /admin/course-reviews | get_admin_course-reviews | ไม่มี body | 200: #/components/schemas/ReviewPage |
| GET | /admin/course-reviews/{id} | get_admin_course-reviews_id | ไม่มี body | 200: #/components/schemas/ReviewDetail |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /admin/course-reviews → course.review; security [{"AdminSession": []}]
- GET /admin/course-reviews/{id} → course.review; security [{"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Admin เท่านั้นดู review queue/detail
- [CONFIRMED_SCOPE] แสดง revision/history/reason ของคอร์สที่ส่งตรวจ
- [CONFIRMED_SCOPE] pending_review ของคอร์สไม่ทำให้บัญชีเจ้าของ Login ไม่ได้

## Data / transaction / dependencies

- Entities: Course, CourseReview
- [Domain model](../DOMAIN_MODEL.md) §READ — Read scoped projections
- PROPOSED_TECHNICAL execution: No write; apply principal/resource/Published scope before selecting fields; deterministic sort and page limits from canonical. No public GET grants/charges/completes.
- Dependencies: [COURSE-02](COURSE-02.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/courses/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/courses/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- Instructor denied; pending queue and detail exact revision
- old history retained, missing review
- scope/status wire enum

Feature gate: **G-COURSE** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| C04 | ส่งตรวจ Admin ส่งกลับพร้อมเหตุผล แล้วส่งใหม่ | สถานะและเหตุผลถูกต้อง ประวัติเดิมยังอยู่ |
| C12 | ตรวจคอร์ส pending_review | Admin เห็นในคิวตรวจ สถานะนี้ไม่ระงับ Login ของเจ้าของคอร์ส |

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

## Authoring review execution override — 2026-10-11

Latest user permits documented agent choices. [Component evidence](../AUTHORING_REVIEW_COMPONENT.md) and [decisions](../AUTONOMOUS_EXECUTION_DECISIONS.md) override former D04/D05/D09/D10 waits for this implemented subset. All defined APIs in this package have component proof, shared PG25/unit7/actual Frontend8 checks. Whole browser/original feature acceptance pending; no provider/deploy claim.
