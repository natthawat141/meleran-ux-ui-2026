# REDEEM-02 — Atomic one-time redemption

Status: **BLOCKED** · Priority: P1 · Module: redeem

รอ dependencies: REDEEM-01, ENROLL-01

## Read set และ traceability

Execution 11 ต.ค. 2026: internal caller-owned RedeemWriter consumes/grants
atomically and competes with actual Admin revoke. See
[REDEEM_TRANSACTION_COMPONENT](../REDEEM_TRANSACTION_COMPONENT.md) for locks,
rollback/audit/source preservation and 21 shared PG tests. Public POST /me/redeem
is not implemented; input/lifecycle/eligibility orchestration and full gates
remain pending. Whole task BLOCKED, original acceptance IDs unchanged.

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.1 (line 169); §2.4 (line 264); §3.3 (line 437); §4.5 (line 956); §5.4 (line 1050); §6.3 (line 1189)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- [OpenAPI subset](../contracts/REDEEM-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| POST | /me/redeem | post_me_redeem | #/components/schemas/RedeemRequest | 200: #/components/schemas/WireRedeemResult; 201: #/components/schemas/WireRedeemResult |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- POST /me/redeem → redeem_code.redeem_self; security [{"WebSession": []}, {"AdminSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] ผ่าน eligibility/role/owner checksก่อนconsume; code Used/Revoked/unknownไม่grant
- [CONFIRMED_SCOPE] มี Enrollment เดิมคืนเดิมและไม่ใช้โค้ดใหม่
- [CONFIRMED_SCOPE] consume+grant+actor/time/enrollment link ใน transactionเดียว
- [CONFIRMED_SCOPE] สองบัญชี redeem codeเดียวมีผู้สำเร็จคนเดียว; grant failure rollbackเป็นUnused

## Data / transaction / dependencies

- Entities: RedeemCode, User, Course, Enrollment
- [Domain model](../DOMAIN_MODEL.md) §TX-REDEEM — Redeem vs revoke
- PROPOSED_TECHNICAL execution: Lock Code and entitlement key in consistent order; recheck Unused and eligibility. Existing Enrollment returns without consuming. Code used_by/time/enrollment+central grant commit together. Revoke competes on same Unused row; failure rollback. No expiry added.
- Dependencies: [REDEEM-01](REDEEM-01.md), [ENROLL-01](ENROLL-01.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/redeem/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/redeem/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- same-code race, revoke race, injected grant failure
- Admin/own/unverified denied without consuming
- already-enrolled no consumption; old unused code lifetime

Feature gate: **G-REDEEM** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A01 | สมัครด้วยอีเมลแล้ว Enroll ก่อนยืนยัน | ปฏิเสธ หลังยืนยันจึงลงเรียนได้ |
| A07 | Admin สร้าง Username/Password โดยไม่มีอีเมล | Login และ Enroll/Redeem ได้ทันทีตามสิทธิ์คอร์ส |
| E03 | Instructor Redeem คอร์สคนอื่น | ได้สิทธิ์เรียน แต่ไม่ได้ Editor/คิวตรวจงาน |
| E04 | Instructor Redeem คอร์สตนเอง หรือ Admin Redeem | ปฏิเสธ รหัสยังไม่ถูกใช้ |
| E05 | Admin ออกโค้ดและผู้เรียนใช้สำเร็จ | ผูกคอร์สถูกต้อง ระบุ User และเวลาใช้ |
| E06 | ใช้รหัสไม่มีอยู่หรือ Used/Revoked | ไม่ได้สิทธิ์ใหม่ |
| E07 | สองบัญชีใช้รหัสเดียวกันพร้อมกัน | สำเร็จคนเดียว อีกคนไม่ถูกสร้าง Enrollment จากรหัสนี้ |
| E08 | บันทึกสิทธิ์ล้มเหลวระหว่าง Redeem | ไม่ทิ้งรหัส Used ที่ไม่มีสิทธิ์ ลองใหม่ได้ตามผลจริง |
| E09 | มี Enrollment อยู่แล้วและ Redeem รหัสใหม่ของคอร์สเดิม | คืนสิทธิ์เดิม ไม่ใช้รหัสเพิ่ม |
| E10 | ใช้โค้ดที่ออกไว้นาน และกลับมาเรียนหลังลงเรียนไปนาน | ไม่มีเงื่อนไขหมดอายุทั้งโค้ดและสิทธิ์เรียน |
| E11 | Admin ยกเลิก Unused | เป็น Revoked มีผู้ทำ/เวลา แลกไม่ได้ |
| E12 | Admin ยกเลิก Used | ปฏิเสธ สิทธิ์เรียนและใบรับรองเดิมยังอยู่ |
| E13 | ยกเลิก Unused พร้อมกับ Redeem | สำเร็จได้หนึ่งทาง ไม่เกิดทั้ง Revoked และให้สิทธิ์จากรหัสเดียวกัน |
| P08 | Redeem สำเร็จระหว่างรอผลจ่าย หรือมี Payment จ่ายซ้ำจริง | ใช้ Enrollment เดิม เก็บผลเงินทุกรายการ ไม่ใช้โค้ดเพิ่ม ไม่สร้าง Refund policy อัตโนมัติ |
| P12 | Redeem สำเร็จก่อน Webhook ของ Payment เดิม | เชื่อม Payment กับ Enrollment เดิม ไม่สร้างสิทธิ์ซ้ำและไม่เขียนทับ source redeem |

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
