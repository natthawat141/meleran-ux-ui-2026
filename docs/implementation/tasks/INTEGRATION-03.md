# INTEGRATION-03 — Cross-feature acceptance/release evidence

Status: **BLOCKED** · Priority: P2 · Module: integration

รอ dependencies: AI-04, AI-05, AUTH-02, AUTH-03, BLOG-03, CATALOG-02, CI-01, INTEGRATION-02, LEARN-02, MGMT-05, PAY-02, PROVIDER-STRIPE-01, REDEEM-02, REVIEW-02, VIDEO-01

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §9.7 (line 1632)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- อ่าน [Acceptance Map 113 cases](../ACCEPTANCE_MAP.md) และ feature gates ใน Execution Plan; ไม่เพิ่ม API operation
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

ไม่มี API ใหม่หรือ endpoint เพิ่มในชุดนี้

## บริบทและข้อกำหนด

- [PROPOSED_TECHNICAL] 113casesต้องมีSHA+contracthash+environment+commands/data/UIproof
- [PROPOSED_TECHNICAL] Redeemส่งมอบพร้อมAI supportตาม§2.9;ทุกchannelให้AIentitlementเหมือนกัน
- [PROPOSED_TECHNICAL] release/staging/provider/migrationapproval/smoke/rollbackเป็นfuturegatesไม่authorizationให้deploy
- [PROPOSED_TECHNICAL] dependencies ของ gate นี้ครอบคลุมทุก task ผ่าน DAG; ทุก feature ต้องมี integration evidence ก่อนรวม acceptance ไม่รอทำ 86 operations แล้วเริ่มตรวจ UI

## Data / transaction / dependencies

- Entities: ไม่มี business table
- [Domain model](../DOMAIN_MODEL.md) §TEST-WORKFLOW — Isolated feature acceptance workflow
- PROPOSED_TECHNICAL execution: Exercise real feature HTTP writes/reads and their reviewed transactions on isolated Test PostgreSQL. Fixture setup is test-owned and never app-startup seed. Capture UI/contract/permission/persistence/concurrency/recovery evidence; clean up only the explicit test dataset. No provider production calls, cloud resources, release deployment or live migration.
- Dependencies: [AI-04](AI-04.md), [AI-05](AI-05.md), [AUTH-02](AUTH-02.md), [AUTH-03](AUTH-03.md), [BLOG-03](BLOG-03.md), [CATALOG-02](CATALOG-02.md), [CI-01](CI-01.md), [INTEGRATION-02](INTEGRATION-02.md), [LEARN-02](LEARN-02.md), [MGMT-05](MGMT-05.md), [PAY-02](PAY-02.md), [PROVIDER-STRIPE-01](PROVIDER-STRIPE-01.md), [REDEEM-02](REDEEM-02.md), [REVIEW-02](REVIEW-02.md), [VIDEO-01](VIDEO-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- melearn-tutor-frontend/apps/web/src/features/<related-feature>/api + hooks
- melearn-tutor-frontend/apps/admin/src/features/<related-feature>/api where relevant
- feature browser evidence/test fixtures; no shared transport business logic

## Tests และ acceptance

- 113coverage; no mock fallback; provider sandbox separate; recovery

Environment prerequisite: isolated Test PostgreSQL connection ที่ตรวจเป้าหมายแล้ว; ถ้ายังไม่มีให้คง BLOCKED.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

Verification gate ของ acceptance ทั้ง 113 IDs ใน [Acceptance Map](../ACCEPTANCE_MAP.md); task นี้ตรวจ evidence รวม ไม่ใช่ implementation owner และไม่ประกาศผ่านด้วย handler/test count

## Definition of Done

- ทุก predecessor task และ feature gate มี evidence; ไม่มี decision ที่กระทบ feature ค้าง
- ครบ 113 original IDs พร้อม per-case result, source/contract hash, code revision, environment, steps/commands, API/UI/DB proof และ known limitations; ไม่มี ID ถูกแทนด้วย test count
- ตรวจ cross-feature permissions, persistence/restart, concurrency/rollback และ provider sandbox recovery; mock failure ไม่ fallback
- Release readiness/rollback/migration review แยกบันทึก; ไม่ deploy หรือ run production migration ใน task นี้

## Decisions / สิ่งที่ห้ามแก้

ไม่มี business/protocol decision เฉพาะ task; ตรวจ dependency/environment ก่อนเริ่ม

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
