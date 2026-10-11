# CERT-01 — Own certificate list/detail/download

Status: **PENDING** · Priority: P2 · Module: certificates

ต้องปิด D07; D02 constraints/profile semantics confirmed แล้ว

Execution update 11 ต.ค. 2026: canonical GET /me/certificates/{id} now has
13 actual HTTP/PostgreSQL tests and unchanged certificateApi.get/decoder
integration in [CERTIFICATE_DETAIL_COMPONENT](../CERTIFICATE_DETAIL_COMPONENT.md).
This metadata read is independent of D07 file rendering. List/query protocol,
automatic completion/issuance, download, full Auth and browser G-CERTIFICATE
remain incomplete; whole task stays NEEDS_DECISION and no case is closed.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.7 (line 327); §3.2 (line 415); §4.5 (line 956); §5.7 (line 1095); §6.7 (line 1292)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/CERT-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /me/certificates | get_me_certificates | ไม่มี body | 200: #/components/schemas/CertificatePage |
| GET | /me/certificates/{id} | get_me_certificates_id | ไม่มี body | 200: #/components/schemas/WireServerCertificate |
| GET | /me/certificates/{id}/download | get_me_certificates_id_download | ไม่มี body | 200: #/components/schemas/CertificateDownload |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- GET /me/certificates → certificate.read_self; security [{"WebSession": []}, {"AdminSession": []}]
- GET /me/certificates/{id} → certificate.read_self; security [{"WebSession": []}, {"AdminSession": []}]
- GET /me/certificates/{id}/download → certificate.read_self; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] หนึ่ง completed Enrollment มีใบเดียว ออกอัตโนมัติ ไม่เพิ่ม issue endpoint
- [CONFIRMED_SCOPE] ชื่อผู้เรียน/คอร์ส/date/code เป็น snapshot ณ ออก
- [CONFIRMED_SCOPE] เจ้าของเท่านั้นอ่าน/download; file failure retry จาก completed snapshotเดิม
- [CONFIRMED_SCOPE] เพิ่มเนื้อหาหลังจบไม่ทำให้ใบ/สถานะเดิมหาย

## Data / transaction / dependencies

- Entities: Enrollment, Certificate
- [Domain model](../DOMAIN_MODEL.md) §TX-CERT — Private download/retry
- PROPOSED_TECHNICAL execution: Certificate issue is internal participant of TX-COMPLETE, UNIQUE enrollment/code. Download verifies persisted owner/completion, builds/reads file under approved format D07; failure never resets completion or issues another Certificate.
- Dependencies: [COMPLETION-01](COMPLETION-01.md), [AUTH-01](AUTH-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/certificates/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/certificates/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- exactly-once issue/repeated download; another account denied
- file failure and retry no new cert; MIME/filename once approved
- rename/content edits preserve original certificate

Feature gate: **G-CERTIFICATE** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A09 | บัญชี Admin สร้างเชื่อม Google แล้ว Logout/Login ด้วย Google | กลับ User เดิม Role คอร์ส Progress คะแนน และใบรับรองเดิมยังอยู่ |
| Q05 | Choice ผ่าน แต่ข้อเขียน/ภาพยังรอตรวจ | ยังไม่สรุปผ่านจากผลครั้งนั้น ไม่ออกใบรับรองก่อนครบ |
| F01 | เนื้อหาและแบบฝึกหัดผ่านครบ | Progress 100% ออกใบรับรองอัตโนมัติ |
| F02 | Refresh/เรียกตรวจจบซ้ำ/ดาวน์โหลดหลายครั้ง | ใบรับรองเดิม ไม่ออกใบซ้ำ |
| F04 | เพิ่มบทเรียนหลังผู้เรียนได้ใบรับรองแล้ว | สถานะจบและใบเดิมยังอยู่ เรียนเพิ่มเป็นทางเลือก |
| F06 | บัญชีอื่นอ่าน/ดาวน์โหลดใบรับรองของผู้เรียน | ปฏิเสธ |
| F07 | สร้างไฟล์ใบรับรองขัดข้องแล้วลองใหม่ | ออกจากผลจบเดิมได้ ไม่ต้องเรียนใหม่ ไม่สร้างใบซ้ำ |
| F08 | จบ 100% แล้วเพิ่มบท/แก้แบบฝึกหัด | completed_at และ completion_snapshot เดิมยังอยู่ ใช้อธิบายผลจบเดิมได้ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D07 — Certificate file delivery: Business certificate auto-issue and private access confirmed; text mock is not a real file contract. MIME/filename/PDF generation/storage/retry protocol absent. Resolution: Approve file contract and justified library/adapter; completion/metadata design remains independent of file renderer.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy

## Renewed authorization continuation — 2026-10-11

Latest user permits agent decisions with a written record. See [technical decisions](../AUTONOMOUS_EXECUTION_DECISIONS.md) and [current component evidence](../AUTONOMOUS_CONTINUATION_COMPONENT.md). The current EXECUTION_STATUS/CONTINUATION_QUEUE override old planning waits above. No idle user-decision blocker for the implemented subset; full feature acceptance is still tracked separately.

## Download execution override — 2026-10-11

All3 canonical CERT APIs now have component proof. Latest user-authorized D07 technical selection retains text/plain JSON and actual persisted issuance. [Download evidence](../CERTIFICATE_DOWNLOAD_COMPONENT.md);8 PG/4 unchanged actual Frontend checks. PDF/storage/signing not frozen;full browser/original acceptance pending.
