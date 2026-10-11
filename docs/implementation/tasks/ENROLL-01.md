# ENROLL-01 — Free grant and own enrollments

Status: **PENDING** · Priority: P0 · Module: enrollments

รอ dependencies: AUTH-01, CATALOG-01, DB-02

## Internal component evidence — 11 ต.ค. 2026

`EntitlementWriter` COMPONENT_VERIFIED: PostgreSQL 8 tests ผ่าน สำหรับ internal
create-or-return ใน transaction ของ caller; free/redeem/stripe คืน lifetime
wire fields เดิม, race สร้างหนึ่งสิทธิ์, ไม่ทับ source/time/completion state,
rollback/reconnect/FK checks. ไม่เปิด HTTP API และไม่รับ source proof จาก client.
Caller ต้องตรวจ eligibility/Published/type/owner และ source proof ก่อนเรียก,
รักษา lock order; serialization retry เป็นความรับผิดชอบของ owning command.
ไฟล์ `backend/src/features/enrollments/public/entitlement-writer.service.ts`
export ผ่าน EnrollmentsModule เพื่อให้ Redeem/Payments ใช้ public interface.
ยังไม่เปลี่ยน prototype Free Enroll/GET list ให้ถือว่าพร้อม; AUTH-01 และ
command orchestration/Frontend acceptance ยังค้าง. ไม่มี acceptance ID ปิดจาก
การทดสอบ persistence component นี้เพียงอย่างเดียว.

## Read set และ traceability

Execution update 11 ต.ค. 2026: POST free command now has 13 canonical HTTP/PG
tests and 7 unchanged frontend-client checks; [FREE_ENROLL_COMPONENT](../FREE_ENROLL_COMPONENT.md)
records fresh normalized authorization, locks, EmptyRequest and atomic replay.
The previous internal-only evidence above is historical. GET own list, complete
Auth/provider and authenticated browser feature gates remain incomplete;
whole ENROLL-01 stays BLOCKED and no original acceptance case is closed.

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.1 (line 169); §2.4 (line 264); §3.3 (line 437); §4.5 (line 956); §5.3 (line 1044); §6.3 (line 1189)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/ENROLL-01.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /courses/{id}/enroll | post_courses_id_enroll | #/components/schemas/EmptyRequest | 200: #/components/schemas/EnrollmentDto; 201: #/components/schemas/EnrollmentDto |
| GET | /me/enrollments | get_me_enrollments | ไม่มี body | 200: #/components/schemas/EnrollmentPage |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /courses/{id}/enroll → enrollment.create_self; security [{"WebSession": []}, {"AdminSession": []}]
- GET /me/enrollments → enrollment.read_self; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] หนึ่ง User/Course มี Enrollment เดียวและ lifetime; ส่งซ้ำคืนเดิม
- [CONFIRMED_SCOPE] ฟรี Published เท่านั้น; Admin/เจ้าของ/บัญชียังไม่พร้อมเรียนถูกปฏิเสธตาม Scope
- [PROPOSED_TECHNICAL] สร้างสิทธิ์ผ่าน grant กลาง; list เฉพาะ owner ไม่แต่ง progress หรือ grant จาก GET

## Data / transaction / dependencies

- Entities: User, Course, Enrollment, Progress
- [Domain model](../DOMAIN_MODEL.md) §TX-GRANT — One entitlement
- PROPOSED_TECHNICAL execution: Check eligibility/published/type/owner from server; lock/recheck relevant state and create-or-return via UNIQUE(user,course). Recover uniqueness/serialization conflicts to same valid result; never check-then-create without conflict handling. Keep immutable source of original grant.
- Dependencies: [AUTH-01](AUTH-01.md), [CATALOG-01](CATALOG-01.md), [DB-02](DB-02.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/enrollments/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/enrollments/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- two parallel free grants return same entitlement
- paid/unpublished/own/admin/unverified denied; zero unwanted rows
- rollback and restart; existing enrolled course

Feature gate: **G-LEARNING** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A01 | สมัครด้วยอีเมลแล้ว Enroll ก่อนยืนยัน | ปฏิเสธ หลังยืนยันจึงลงเรียนได้ |
| A02 | เข้าด้วย Google ที่ server ตรวจแล้ว | ใช้บัญชีและลงเรียนได้โดยไม่ยืนยันอีเมลซ้ำ |
| A06 | ผู้เรียน A อ่าน/แก้ Progress หรือ Attempt ของ B | ปฏิเสธ ไม่คืนข้อมูลส่วนตัวของ B |
| A07 | Admin สร้าง Username/Password โดยไม่มีอีเมล | Login และ Enroll/Redeem ได้ทันทีตามสิทธิ์คอร์ส |
| E01 | Enroll คอร์สฟรี แล้วกดซ้ำ | เรียนได้ มี Enrollment เดียว |
| E02 | เรียก Free Enroll กับคอร์สเสียเงิน | ปฏิเสธ ไม่ได้สิทธิ์ |
| E10 | ใช้โค้ดที่ออกไว้นาน และกลับมาเรียนหลังลงเรียนไปนาน | ไม่มีเงื่อนไขหมดอายุทั้งโค้ดและสิทธิ์เรียน |

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

## Renewed authorization continuation — 2026-10-11

Latest user permits agent decisions with a written record. See [technical decisions](../AUTONOMOUS_EXECUTION_DECISIONS.md) and [current component evidence](../AUTONOMOUS_CONTINUATION_COMPONENT.md). The current EXECUTION_STATUS/CONTINUATION_QUEUE override old planning waits above. No idle user-decision blocker for the implemented subset; full feature acceptance is still tracked separately.
