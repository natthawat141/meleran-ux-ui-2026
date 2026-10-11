# INTEGRATION-02 — Username→Free Enroll vertical slice

Status: **BLOCKED** · Priority: P0 · Module: integration

รอ dependencies: AUTH-01, ACCOUNT-01, ENROLL-01, INTEGRATION-01

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.1 (line 169); §2.4 (line 264); §5.3 (line 1044)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- ไม่มี defined HTTP operation ใน task นี้; internal foundation/coordination หรือ deferred protocol เท่านั้น
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

ไม่มี API ใหม่หรือ endpoint เพิ่มในชุดนี้

## บริบทและข้อกำหนด

- [PROPOSED_TECHNICAL] remoteWeb/Adminlogin/sessionแยก; localadmin-createduserfixtureไม่มีemail
- [PROPOSED_TECHNICAL] grant/list/reloginจริงและnoAdmin/own/unverifiedfreegrant
- [PROPOSED_TECHNICAL] ตั้งtestorigins/transportตามdecisionไม่คัดStrict/12hต้นแบบเป็นconfirmed

## Data / transaction / dependencies

- Entities: User, Enrollment
- [Domain model](../DOMAIN_MODEL.md) §TEST-WORKFLOW — Isolated feature acceptance workflow
- PROPOSED_TECHNICAL execution: Exercise real feature HTTP writes/reads and their reviewed transactions on isolated Test PostgreSQL. Fixture setup is test-owned and never app-startup seed. Capture UI/contract/permission/persistence/concurrency/recovery evidence; clean up only the explicit test dataset. No provider production calls, cloud resources, release deployment or live migration.
- Dependencies: [AUTH-01](AUTH-01.md), [ACCOUNT-01](ACCOUNT-01.md), [ENROLL-01](ENROLL-01.md), [INTEGRATION-01](INTEGRATION-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- melearn-tutor-frontend/apps/web/src/features/<related-feature>/api + hooks
- melearn-tutor-frontend/apps/admin/src/features/<related-feature>/api where relevant
- feature browser evidence/test fixtures; no shared transport business logic

## Tests และ acceptance

- browserlogin/enroll/relogin+DBreadback; duplicate button/two tabs

Environment prerequisite: isolated Test PostgreSQL connection ที่ตรวจเป้าหมายแล้ว; ถ้ายังไม่มีให้คง BLOCKED.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

ไม่มีรหัส acceptance ของ feature โดยตรง; เป็น prerequisite ไม่เพิ่ม case ใหม่แทน 113 cases

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
