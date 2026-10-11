# REVIEW-02 — Approve/return/publish lifecycle

Status: **PENDING** · Priority: P1 · Module: courses

ต้องปิด D04; D02 constraints/profile semantics confirmed แล้ว

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.3 (line 243); §3.4 (line 451); §5.2 (line 1008); §6.5 (line 1228)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/REVIEW-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /admin/course-reviews/{id}/approve | post_admin_course-reviews_id_approve | #/components/schemas/CourseReviewRequest | 200: #/components/schemas/CourseReviewDto |
| POST | /admin/course-reviews/{id}/return | post_admin_course-reviews_id_return | #/components/schemas/CourseReturnRequest | 200: #/components/schemas/CourseReviewDto |
| POST | /courses/{id}/publish | post_courses_id_publish | #/components/schemas/EmptyRequest | 200: #/components/schemas/AuthoringCourseDto |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /admin/course-reviews/{id}/approve → course.review; security [{"AdminSession": []}]
- POST /admin/course-reviews/{id}/return → course.review; security [{"AdminSession": []}]
- POST /courses/{id}/publish → course.publish: owner Instructor or Admin; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Admin approve/return พร้อมเหตุผล; Instructor publish เฉพาะ owned approved current revision
- [CONFIRMED_SCOPE] Admin ตรวจและเผยแพร่แทนได้ โดยมีประวัติอนุมัติจริง
- [CONFIRMED_SCOPE] แก้เนื้อหาระหว่างตรวจไม่อนุมัติ stale revision; Draft direct publish ของ Instructor ถูกปฏิเสธ
- [CONFIRMED_SCOPE] Published edit ไม่เพิ่ม approval requirement ใหม่; AI-only updates ไม่เปลี่ยน lifecycle

## Data / transaction / dependencies

- Entities: Course, CourseReview
- [Domain model](../DOMAIN_MODEL.md) §TX-REVIEW — Review/publish
- PROPOSED_TECHNICAL execution: Lock Course and review revision, compare snapshot opened by Admin; approve/return result+actor/time+status atomic; publish verifies approval of current nonempty learning content. Stale data fails; Admin review+publish records approval rather than bypassing it.
- Dependencies: [REVIEW-01](REVIEW-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/courses/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/courses/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- edit-vs-approve/publish and return-vs-publish races
- actor/time/revision persisted; stale approval unusable
- nonempty valid content before first publish

Feature gate: **G-COURSE** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| C03 | Instructor เผยแพร่ Draft โดยตรง | ปฏิเสธ |
| C04 | ส่งตรวจ Admin ส่งกลับพร้อมเหตุผล แล้วส่งใหม่ | สถานะและเหตุผลถูกต้อง ประวัติเดิมยังอยู่ |
| C05 | Admin อนุมัติแล้ว Instructor เผยแพร่ | Published และแสดงใน Catalog |
| C06 | Admin ตรวจ อนุมัติ และเผยแพร่แทน | ทำได้ เก็บผู้อนุมัติ/ผู้เผยแพร่และเวลา |
| C07 | ข้อมูลเปลี่ยนระหว่าง Admin เปิดตรวจ | แจ้งให้ตรวจข้อมูลล่าสุด ไม่อนุมัติผิดฉบับเงียบ ๆ |
| C11 | แก้ข้อมูล/บท/Quiz ของ Approved ก่อน Publish | กลับ Draft ต้องตรวจฉบับใหม่ ใช้ Approval เก่าเผยแพร่ไม่ได้ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D04 — Authoring aggregate/revision lifecycle: Canonical PATCH aggregate replacement vs partial and review return/publish revision enforcement are still pending. Scope confirms pending_review; archived is in Draft enum but excluded from V1. Resolution: Approve revision/aggregate semantics; use current reviewed content version for approval/publish; no extra archived API.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy

## Authoring review execution override — 2026-10-11

Latest user permits documented agent choices. [Component evidence](../AUTHORING_REVIEW_COMPONENT.md) and [decisions](../AUTONOMOUS_EXECUTION_DECISIONS.md) override former D04/D05/D09/D10 waits for this implemented subset. All defined APIs in this package have component proof, shared PG25/unit7/actual Frontend8 checks. Whole browser/original feature acceptance pending; no provider/deploy claim.
