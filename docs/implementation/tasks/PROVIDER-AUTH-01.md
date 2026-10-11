# PROVIDER-AUTH-01 — Resolve/implement Firebase verified session/link protocol

Status: **NEEDS_DECISION** · Priority: P1 · Module: auth

ต้องปิด D01, D03; D02 constraints/profile semantics confirmed แล้ว

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.1 (line 169); §3.5 (line 475); §6.2 (line 1171)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.2 / SHA-256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be
- ไม่มี defined HTTP operation ใน task นี้; internal foundation/coordination หรือ deferred protocol เท่านั้น
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /auth/google/start | ไม่มี operationId — deferred | UNRESOLVED | UNRESOLVED |
| GET | /auth/google/callback | ไม่มี operationId — deferred | UNRESOLVED | UNRESOLVED |
| POST | /me/auth-identities/google | ไม่มี operationId — deferred | UNRESOLVED | UNRESOLVED |
| GET | /me/auth-identities/google/callback | ไม่มี operationId — deferred | UNRESOLVED | UNRESOLVED |

## บริบทและข้อกำหนด

- [UNRESOLVED_REQUIREMENT] 4deferredGoogle routesติดตามไว้ ห้ามimplementOAuthmockตรงๆ
- [UNRESOLVED_REQUIREMENT] FirebaseEmail/Googleproviderconfirmed; exchange/linkpathsยังproposalต้องapprovedcanonicalrevision
- [PROPOSED_TECHNICAL] verifyissuer/audience/expiry/signature/revocationpolicy; explicitlinkไม่auto-emailmerge
- [PROPOSED_TECHNICAL] localUsernameไม่มีfakeFirebaseemailและไม่มีpasswordbridgeที่เดาเอง

## Data / transaction / dependencies

- Entities: User, AuthIdentity, AppSession
- [Domain model](../DOMAIN_MODEL.md) §TX-LINK — Identity/verification consume
- PROPOSED_TECHNICAL execution: Lock original User/link proof; unique provider/project/subject; conditional unused/unexpired consumption and verified flag/link update together. Collision cannot move ownership. Provider verification before transaction.
- Dependencies: [AUTH-BASE-01](AUTH-BASE-01.md), [DB-06](DB-06.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/auth/providers/firebase.adapter.ts + identity/session service interfaces (planned)
- Auth controller only after approved canonical exchange/link revision; four deferred paths are inventory, not mandatory legacy implementation
- provider sandbox/identity collision/link/session tests; no Account/Management concurrent Auth edits

## Tests และ acceptance

- wrong-project/expired/revokedtoken; staleproof/linkconflict
- Web/Adminfirebasepersistenceisolation; UserID/coursehistory unchanged

Feature gate: **G-AUTH** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A02 | เข้าด้วย Google ที่ server ตรวจแล้ว | ใช้บัญชีและลงเรียนได้โดยไม่ยืนยันอีเมลซ้ำ |
| A09 | บัญชี Admin สร้างเชื่อม Google แล้ว Logout/Login ด้วย Google | กลับ User เดิม Role คอร์ส Progress คะแนน และใบรับรองเดิมยังอยู่ |
| A10 | เชื่อม Google ที่ผูกกับ User อื่นอยู่ | ปฏิเสธ ไม่รวมบัญชีหรือย้ายผลเรียน |
| A13 | บัญชีไม่มีอีเมลขอ Reset ทางอีเมล | ไม่ส่งให้ผู้รับที่ไม่ยืนยัน ต้องเพิ่ม/ยืนยันอีเมลหรือเชื่อม Google ก่อนใช้ช่องทางนี้ |
| A15 | ตรวจวิธี Login รอบแรก | มี Username/อีเมลและ Google ยังไม่มี LINE |
| A16 | Google Email ตรง User เดิมแต่ยังไม่เชื่อม | ให้ Login เดิมก่อน Link Google ไม่รวมบัญชีหรือสร้าง User เพิ่ม |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D01 — Session/security transport: Absolute session TTL 12h/no sliding, Web/Admin isolation, current-session Logout and all-app password-reset revocation confirmed 2026-10-11. Cookie/CSRF/CORS/origins/throttling remain technical/protocol review; do not reopen approved lifetime policy.
- D03 — Firebase + Resend verification/recovery ownership: Firebase Email/Google credential ownership, Nest local Username/app sessions, explicit linking/no email auto-merge and necessary exchange/link contract design approved 2026-10-11. Wire/proof/recovery/error design, dependency justification and provider verification remain open; four Google deferred records are retained.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy

Technical review packet: [Firebase exchange/link/recovery](../PROVIDER_AUTH_PROTOCOL_REVIEW.md). Approved direction is recorded; candidate wire delta remains separate from current Draft.2 operations.
