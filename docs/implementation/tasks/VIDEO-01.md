# VIDEO-01 — Unavailable video upload contract

Status: **PENDING** · Priority: P1 · Module: courses

รอ dependencies: FOUNDATION-01, AUTH-01

## Read set และ traceability

Execution 11 ต.ค. 2026: the canonical unavailable operation now has fresh
normalized owner/Admin authority, fixed safe 503 and 14 HTTP/PG tests.
[VIDEO_UNAVAILABLE_COMPONENT](../VIDEO_UNAVAILABLE_COMPONENT.md) records
multi-audience binding, generic-client transport scope and no-write evidence.
Whole task still waits for full Auth/editor/browser gates; no video provider or
image capability is implemented by this unavailable endpoint.

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.3 (line 243); §6.5 (line 1228)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/VIDEO-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /courses/{id}/videos/uploads | post_courses_id_videos_uploads | ไม่มี body | Expected unavailable: 503 ErrorEnvelope; ดู exact media/schema ใน subset |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /courses/{id}/videos/uploads → course.update; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [HTTP_DRAFT] V1 upload video ยังไม่พร้อม: canonical 503 video_upload_not_available
- [CONFIRMED_SCOPE] ไม่สร้างไฟล์หรือ upload record; ไม่ทับ YouTube URL
- [HTTP_DRAFT] ไม่ปิดงาน image upload ซึ่งเป็นคนละ capability; errors/authorization ตาม canonical

## Data / transaction / dependencies

- Entities: Course, ContentItem
- [Domain model](../DOMAIN_MODEL.md) §NO_WRITE — HTTP foundation/unavailable capability
- PROPOSED_TECHNICAL execution: No business DB write/file upload; error response follows canonical; startup does not seed/migrate.
- Dependencies: [FOUNDATION-01](FOUNDATION-01.md), [AUTH-01](AUTH-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/courses/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/courses/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- direct API call produces exact 503/schema
- no rows/files written; existing YouTube untouched
- frontend message and image control unaffected

Feature gate: **G-COURSE** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| V02 | กด Upload Video หรือเรียก Upload API ตรง | ตอบ “ขออภัย ระบบนี้ยังไม่พร้อมใช้งาน” ไม่สร้างไฟล์/Upload record หรือทับ YouTube Link; ไม่กระทบภาพปก/ภาพคำตอบ |

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
