# BLOG-01 — Public published blog reads

Status: **NEEDS_DECISION** · Priority: P2 · Module: blog

ต้องปิด D05, D16 และ storage projection gaps

## Storage review — 11 ต.ค. 2026

ยังไม่เปิด Blog detail: PublicBlogDetail บังคับ `content`, `category`,
`reading_minutes` แต่ BlogPost ที่ผ่าน DB-05 ยังไม่มีฟิลด์เหล่านี้. Create/Patch
ไม่มี reading_minutes และ category optional-on-create; ห้ามเดาค่า/default
หรือสูตรอ่าน. JSON null/omitted mapping ของ content_doc ต้อง review ด้วย.
ดู [Contract/storage gaps](../CONTRACT_STORAGE_GAPS.md); DB-05 DONE เป็น
physical batch evidence ไม่ใช่การอนุมัติ Blog authoring/response policy ทั้งหมด.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.8 (line 338); §3.2 (line 415); §5.9 (line 1116); §6.10 (line 1347)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/BLOG-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /blog | get_blog | ไม่มี body | 200: #/components/schemas/PublicBlogPage |
| GET | /blog/{slug} | get_blog_slug | ไม่มี body | 200: #/components/schemas/PublicBlogDetail |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /blog → blog.read_public; security []
- GET /blog/{slug} → blog.read_public; security []

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] ทุกคนอ่านPublishedเท่านั้น Draftซ่อน404/listไม่คืน
- [CONFIRMED_SCOPE] Blogเป็นคนละdomainกับLesson ไม่มีEnrollment/Progress/Certificate side effect
- [HTTP_DRAFT] summaryไม่ส่งeditor/private audit/fullcontent; detailตามschema

## Data / transaction / dependencies

- Entities: User, BlogPost
- [Domain model](../DOMAIN_MODEL.md) §READ — Read scoped projections
- PROPOSED_TECHNICAL execution: No write; apply principal/resource/Published scope before selecting fields; deterministic sort and page limits from canonical. No public GET grants/charges/completes.
- Dependencies: [DB-05](DB-05.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/blog/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/blog/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- draft vs published visibility; slug unknown
- public summary vs detail field schema; pagination
- read-back and no learning writes

Feature gate: **G-BLOG** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| B01 | Admin สร้าง Draft และดูตัวอย่าง | ข้อมูล/ภาพ/รูปแบบยังอยู่ สาธารณะยังอ่าน Draft ไม่ได้ |
| B02 | Admin Publish บทความ | Guest และทุกบทบาทอ่าน Published ได้ |
| B04 | Admin แก้ Published แล้วบันทึก | บทความแสดงข้อมูลใหม่ ไม่กระทบ Progress หรือใบรับรอง |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D05 projection/authoring subreview: plain content vs rich document, category default when omitted, JSON null handling and reading_minutes derivation are still unresolved; see CONTRACT_STORAGE_GAPS.md. No defaults/reading algorithm are inferred.

- D16 — List query, cursor and public/PII projection review: OpenAPI x-pending-decisions and Flow AB D7 still leave cursor expiry/search/sort/filter semantics and visibility/PII review open. Current schema fixes wire fields/limits, but a deterministic backend query/cursor design has not been reviewed. Resolution: Review per flow: keep canonical query/response fields, choose deterministic sort tuple and cursor binding to filters/principal, decide expiry and permitted search fields. Use public canonical projections only; do not broaden PII. Close the Catalog subset first so the public vertical slice need not wait for Auth/provider decisions.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
