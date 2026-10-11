# FOUNDATION-01 — Harden existing HTTP foundation

Status: **DONE** · Priority: P0 · Module: foundation

ไม่มี dependency หรือ business/protocol decision ค้าง; planning blueprint พร้อมให้ review

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): architecture/HTTP foundation จาก canonical
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [Foundation schema context](../contracts/FOUNDATION-01.openapi.json) — canonical error/validation components; ไม่มี API operation ใหม่
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

ไม่มี API ใหม่หรือ endpoint เพิ่มในชุดนี้

## บริบทและข้อกำหนด

- [PROPOSED_TECHNICAL] ใช้Nest/Express/Prismaโครงเดิม; แยกtestfixturesออกจากstartup
- [PROPOSED_TECHNICAL] validation/error/request_id/JSONตามcanonical; ไม่เปลี่ยนHTTP businesspath
- [PROPOSED_TECHNICAL] ไม่ติดตั้งlibหรืออัปเกรดmajor; strictTypeScriptและDTOclassmetadataแทนanyตามส่วนที่แก้

## Data / transaction / dependencies

- Entities: ไม่มี business table
- [Domain model](../DOMAIN_MODEL.md) §NO_WRITE — HTTP foundation/unavailable capability
- PROPOSED_TECHNICAL execution: No business DB write/file upload; error response follows canonical; startup does not seed/migrate.
- Dependencies: ไม่มี
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/main.ts + src/app.module.ts
- backend/src/shared/errors + shared/auth
- backend/test/bootstrap/validation/contract tests; tsconfig/Jest config as required

## Tests และ acceptance

- malformed JSON/unknown fields/422/errors required-nullable
- startupไม่มีDBseed/migrate; test hostใช้bootstrapเดียวกับapp
- schema DTO mapping และ secrets/log redaction

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

ไม่มีรหัส acceptance ของ feature โดยตรง; เป็น prerequisite ไม่เพิ่ม case ใหม่แทน 113 cases

## Definition of Done

- Bootstrap ไม่มี seed/migration/provider side effect และ tests ไม่เชื่อม/ล้าง DB เดิมโดยไม่ตั้งใจ
- Typed validation/error boundary รักษา canonical shapes; typecheck และ targeted bootstrap/error/DTO tests ผ่าน โดยไม่ตัดสิน D01/D02 เอง
- Test harness รับ isolated Test PostgreSQL configuration และปฏิเสธ unsafe reset; Foundation unit/bootstrap checks ใช้ stubs ได้ ไม่ต้องรอ DB-01
- ไม่แก้ schema, session protocol, business behavior หรือเพิ่ม endpoint; บันทึกไฟล์/commands/results ให้ review

## Decisions / สิ่งที่ห้ามแก้

ไม่มี business/protocol decision เฉพาะ task; ตรวจ dependency/environment ก่อนเริ่ม

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy

## Execution evidence — 2026-10-11

See [EXECUTION_STATUS.md](../EXECUTION_STATUS.md) and reviewed migration/test results. This closes the technical task; it does not replace feature acceptance.
