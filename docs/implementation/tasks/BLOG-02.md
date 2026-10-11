# BLOG-02 — Admin blog draft/editor/preview

Status: **PENDING** · Priority: P2 · Module: blog

ต้องปิด D05, D09; D02 constraints/profile semantics confirmed แล้ว

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.8 (line 338); §3.4 (line 451); §5.9 (line 1116); §6.10 (line 1347)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/BLOG-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /admin/blog | get_admin_blog | ไม่มี body | 200: #/components/schemas/AdminBlogPage |
| POST | /admin/blog | post_admin_blog | #/components/schemas/BlogCreateRequest | 201: #/components/schemas/AdminBlogDto |
| PATCH | /admin/blog/{id} | patch_admin_blog_id | #/components/schemas/BlogPatchRequest | 200: #/components/schemas/AdminBlogDto |
| GET | /admin/blog/{id}/preview | get_admin_blog_id_preview | ไม่มี body | 200: #/components/schemas/AdminBlogDto |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- PATCH /admin/blog/{id} → blog.update; security [{"AdminSession": []}]
- GET /admin/blog → blog.update; security [{"AdminSession": []}]
- POST /admin/blog → blog.create; security [{"AdminSession": []}]
- GET /admin/blog/{id}/preview → blog.update; security [{"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] Adminเขียน/preview; Instructor/Learnerไม่ได้
- [HTTP_DRAFT] revision guardตามcanonical; savePublishedมีผลทันที
- [CONFIRMED_SCOPE] saveกับpublishเป็นคนละคำสั่ง; ไม่เสียsaved ID/revisionหากpublishfail

## Data / transaction / dependencies

- Entities: User, BlogPost
- [Domain model](../DOMAIN_MODEL.md) §TX-BLOG — Revision protected blog
- PROPOSED_TECHNICAL execution: Admin and current expected_revision; validate safe document under D05, save content/editor/time/revision atomic. Publish saved state; unpublish hides public. DELETE retains canonical JSON precondition until approved change; physical retention D11. Blog never updates learning entities.
- Dependencies: [AUTH-01](AUTH-01.md), [BLOG-01](BLOG-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/blog/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/blog/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- non-admin denied; stale expected_revision409/missing422
- richdoc/null fields/maxlimitsตามdecision; preserve slug convention
- persisted editor/preview and dirty UI not silently rebased

Feature gate: **G-BLOG** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| B01 | Admin สร้าง Draft และดูตัวอย่าง | ข้อมูล/ภาพ/รูปแบบยังอยู่ สาธารณะยังอ่าน Draft ไม่ได้ |
| B02 | Admin Publish บทความ | Guest และทุกบทบาทอ่าน Published ได้ |
| B03 | Learner/Instructor เรียกคำสั่งเขียน แก้ หรือ Publish Blog | ปฏิเสธ แม้เป็น Instructor ที่แก้บทอ่านในคอร์สได้ |
| B04 | Admin แก้ Published แล้วบันทึก | บทความแสดงข้อมูลใหม่ ไม่กระทบ Progress หรือใบรับรอง |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D05 — Rich document and safe content limits: JSON document version, depth/size/node limits, safe URL schemes and YouTube validation are not frozen; normal editor cannot overwrite AI-only fields. Resolution: Agree technical security limits without inventing lesson/business restrictions; keep current wire shape unless approved.
- D09 — Image/R2 upload missing contract: Profile/cover/blog/essay image upload has no frozen operation in 86; video upload explicitly disabled. R2 choice already confirmed. Resolution: Approve image protocol/schema/permission/size/lifecycle; track gap without inventing endpoint. Block image-dependent acceptance only.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy

## Blog execution continuation — 2026-10-11

Latest user permits documented technical choices. [Component evidence](../BLOG_COMPONENT.md) and [agent decisions](../AUTONOMOUS_EXECUTION_DECISIONS.md) supersede old decision waits for implemented operations. All9 canonical Blog APIs have shared HTTP/PG and actual Frontend client proof. Full feature/browser acceptance remains a separate gate.
