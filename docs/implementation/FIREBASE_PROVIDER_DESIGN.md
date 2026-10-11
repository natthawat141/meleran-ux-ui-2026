# Firebase / Nest / Resend — ชุด C ที่ยืนยันแล้ว

สถานะ: **ownership CONFIRMED; HTTP delta และกลไกด้านล่าง PROPOSED_TECHNICAL**.
คำยืนยันผู้ใช้ 11 ต.ค. 2026: “ยืนยันชุด C ให้จัดทำ contract delta และ provider design”.
เอกสารนี้เป็นแบบลงมือทำต่อจาก Final 1.6 §2.1/§3.1 ไม่ใช่ business specification ใหม่.

Canonical ปัจจุบันยัง `1.0.0-draft.2`, SHA256
`b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be`.
Delta ที่ตรวจแยกได้: [AUTH_FIREBASE_DELTA_DRAFT.openapi.json](contracts/AUTH_FIREBASE_DELTA_DRAFT.openapi.json).
ยังไม่รวมสอง operation นี้ใน 86 defined และยังคง 5 deferred เดิมครบ.

## ขอบเขตความเป็นเจ้าของ

| ข้อมูล/การกระทำ | Owner ที่ยืนยัน | ผลต่อ implementation |
| --- | --- | --- |
| Email/password และ Google credential | Firebase Authentication | Nest ไม่เก็บรหัส Email ซ้ำ ไม่ทำ OAuth จำลอง |
| Username/password ไม่มี Email | Nest Auth | ใช้ LocalCredential/kernel ที่มีอยู่ ไม่สร้าง fake Firebase Email |
| Account ID, role, eligibility, app session | Nest/PostgreSQL | Firebase UID และ claims ไม่เป็น app role; Web/Admin แยก session |
| เชื่อมบัญชี | Nest Auth | ต้องมี app session และตรวจ Firebase proof; ไม่มี email auto-merge |
| Verification/recovery proof | Nest Auth | purpose/account-bound, ใช้ครั้งเดียวภายใน 24h ตาม Scope |
| ส่งลิงก์ | Resend | ใช้ server-generated proof และ template; ไม่ส่งผ่าน browser |

## Contract delta ที่เสนอ

| Operation | Request / success | ข้อกำหนด |
| --- | --- | --- |
| `POST /auth/firebase/exchange` | `{id_token,audience}` → `200 {user:CurrentUser}` | Anonymous แต่ต้องตรวจ token; audience=`web/admin` ต้องตรง `x-melearn-app`; ออก cookie เฉพาะ audience นั้น |
| `POST /auth/firebase/link` | `{id_token}` → `200 CurrentUser` | มี app session ของ audience ที่เลือก; ผูกกับ Account ของ session เท่านั้น; ไม่ออก/เปลี่ยน session |

ข้อเสนอขนาด `id_token`: 1–16384 ตัวอักษร; reject unknown fields.
ไม่มี UID/email/role/account_id จาก caller. ใช้ ErrorEnvelope เดิม; proposal ระบุ
422 validation, 401 invalid/expired/revoked proof หรือ session, 403 local-disabled/
Admin eligibility, 409 binding conflict และ safe 503 provider unavailable.
Exchange Admin ต้องมี normalized Admin grant ที่ Nest ยืนยันแล้ว; Google signup
ไม่สร้าง Admin. ไม่มี token/hash/provider diagnostics ใน response/log.

**Pending wire review:** ขนาด token, error codes, 503 retry policy, first-bind
registration และ proof freshness ต้องตรวจรวมกับ Frontend ก่อน canonical revision.
ไม่ประกาศว่า delta นี้ frozen หรือพร้อมเปิด public routes แล้ว.

## Exchange algorithm

1. Validate JSON/header/Origin ตาม transport design; ห้ามเลือก audience จาก cookie ตัวอื่น.
2. Provider adapter ตรวจ signature, issuer, configured project audience, expiry,
   UID, revoked/disabled user และ sign-in method. ใช้ official Admin verifier พร้อม
   revocation check; ไม่รับ custom token หรือ client-declared verified flag.
3. ทำ remote verification **ก่อน**เริ่ม DB transaction. หลังจากนั้น transaction
   ล็อก identity key `(provider,project,subject)` แล้วหา binding โดย key นี้เท่านั้น.
4. Existing binding: ล็อก Account และ recheck disabled/normalized roles; ออก
   selected app session ด้วย SessionWriter เดิม. Unverified self-email ยังอ่าน/
   แก้โปรไฟล์ได้ แต่ไม่ได้ learning eligibility ตาม Scope.
5. First Email binding: ต้องมี registration intent ที่ server ออกให้จาก
   `/auth/register`; ห้ามรับ Firebase Email user ใด ๆ แล้วข้าม approved registration
   constraints. Exact bootstrap wire ยัง PENDING จึงไม่เปิด branch นี้.
6. First Google binding: สร้างเฉพาะ Scope-approved account origin/role เมื่อ
   reviewed signup protocol พร้อม. Email ชนบัญชีเดิมต้องกลับไป login แล้ว explicit
   link; ไม่รวม account/enrollment/history. การตัดสิน collision/error ยังอยู่ใน delta.
7. Commit binding/account/session พร้อมกัน แล้วส่ง cookie; provider failure หรือ
   uniqueness conflict ต้องไม่สร้าง account/session ซ้ำหรือทิ้ง partial binding.

ID token ที่ verified แล้วไม่ได้หมายความว่ามีสิทธิ์เรียนหรือเป็น Admin. Firebase
default verification ไม่ตรวจ revoked token ต้องเลือก explicit check.
[Official verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens),
[session revocation](https://firebase.google.com/docs/auth/admin/manage-sessions).

## Explicit link algorithm

1. Remote token verification เช่นเดียวกับ exchange; require recent provider
   reauthentication ตาม freshness mechanism ที่ต้อง review (ยังไม่กำหนดจำนวนวินาที).
2. Transaction recheck current Session → Account ตาม existing PrincipalService.
   ใช้ per-account session-writer advisory serialization เมื่อจำเป็น; อย่าล็อก
   Account ก่อน Session แล้วทำให้เกิด reverse lock order กับ reset/logout.
3. Serialize identity key ก่อน insert; DB unique `(provider,project,subject)` เป็น
   last line of defense. Binding เดิมของ Account เดียวกันคืนเดิมโดยไม่มี duplicate
   write; binding ของ Account อื่นคืน conflict โดยไม่ย้าย ownership.
4. Preserve Account ID, local credential, role, enrollment, scores, certificate,
   payment และ app sessions. Email change/verified propagation ต้องใช้ reviewed
   account projection rule ไม่ใช้ payload จาก client.
5. ทำ provider calls นอก transaction และไม่ merge accounts. กรณี provider mutation
   เช่น link credentials ใน Firebase ต้องกำหนด rollback/retry ผ่าน durable intent;
   Nest binding endpoint นี้ไม่ได้อ้างว่า remote mutation เป็น atomic กับ PostgreSQL.

## Verification / recovery และ existing routes

| Existing canonical route | Owner / proposed compatibility |
| --- | --- |
| `POST /auth/register` | Nest validates approved input; Firebase creates Email credential through server adapter; durable registration intent binds the approved signup to one Account |
| `POST /auth/login` | Local Username branch uses existing kernel; Email branch requires reviewed Firebase client sign-in → exchange migration, ไม่ลอง Email password ใน LocalCredential |
| `POST /auth/verify-email` | Consume Nest verification proof once, within 24h; provider verification acknowledgement/retry must complete before local eligibility is granted |
| `POST /auth/resend-verification-email` | Resend delivers server-generated link; replacement/old-proof validity follows Scope or stays PENDING where unspecified |
| `POST /auth/password-reset/request` | Resolve recovery target without account enumeration; issue purpose-bound proof only when a valid recovery identity exists |
| `POST /auth/password-reset/confirm` | Consume proof + update owned credential + revoke every app audience; provider reset side effect requires durable intent/outbox reconciliation |

**ห้าม sync Firebase password กับ local Username password อัตโนมัติ**.
Recovery target เป็น credential owner ที่ผูก proof ไว้ ไม่เลือกจาก Email string
อย่างเดียว. Local account ไม่มี Email ต้องไม่ทำ recovery ผ่าน fake address.
Linked local/Firebase account ที่มีหลาย credential ต้องระบุ recovery purpose ก่อน
implementation; current reset request ไม่เพิ่ม field เงียบ ๆ.

Firebase generated action links รองรับ custom sender แต่ไม่เป็นหลักฐานว่าลิงก์ทุก
ชนิดบังคับอายุ 24h แบบ Melearn. ต้องใช้ Nest proof gate/custom handler ที่ป้องกัน
การใช้ provider link นอก gate หรือระบุข้อจำกัดเป็น PENDING.
[Official action-link mechanism](https://firebase.google.com/docs/auth/admin/email-action-links).

## DB-06 design delta — Schema Owner คนเดียว

Logical proposals ต่อไปนี้ยังไม่มี migration/DDL ในชุดงานนี้:

- `AuthProof`: hash ของ opaque random token, account/registration intent,
  purpose, credential owner/identity, issued_at, expires_at, consumed_at.
  ไม่เก็บ plain token; expires_at = issued_at + 24h สำหรับ Scope-defined links.
  Unique token hash; FK owner; atomic conditional consume ที่เวลา DB.
- `AuthRegistrationIntent`: server-approved origin/input metadata และ Firebase
  binding state; ไม่เก็บ plain password ใน queue/log/database.
- `AuthProviderIntent/Outbox`: dedupe key, operation, target identity, state,
  attempts และ result metadata ที่ redact; local commit กับ remote effect ไม่ atomic.
- `authRevocationPending` หรือ revocation watermark: deny new exchange ขณะ reset
  ยัง revoke remote ไม่ครบ; retry failure ไม่ทำให้ old credential ได้ app session ใหม่.

Physical columns/index/checks, provider retry/cancellation, cleanup/retention และ
ข้อจำกัด reconciling remote failures เป็น PENDING; ห้ามเลือก policy อายุ retention
หรือ retry count เอง. ไม่เปลี่ยน 9 migrations เดิม.

### Provider failure boundary ที่ห้ามซ่อน

Outbox เก็บ metadata/revocation/mail intent ได้ แต่ **ห้ามใส่ plaintext password**
เพื่อ retry credential change. Firebase credential write กับ PG commit ไม่เป็น
transaction เดียวกัน. ถ้า provider เปลี่ยนรหัสแล้ว process หยุดก่อน local finalize:
deny exchange ด้วย durable reset intent/revocation gate, reconcile revoke และ
ไม่ตอบ `password_changed` ก่อนยืนยันผลครบ. การ retry password write โดยไม่มี
password แล้วทำให้สำเร็จเองยังไม่มีวิธีที่ยืนยันในสเปก; client retry/proof-claim
และ incomplete recovery response ต้อง review จึงคง Reset HTTP เป็น PENDING.

Local-only recovery ใช้ kernel reset participant กับ proof consumption/all-app
revocation ใน transaction เดียว. Firebase-owned password ต้องผ่าน provider adapter;
Google account password ไม่เปลี่ยนจาก Melearn reset. ไม่รวมสอง credential write
เพียงเพราะ linked Account เดียวกัน.

Metadata-only ENV inspection 11 ต.ค.: Firebase public Web keys/project fields SET,
`GOOGLE_APPLICATION_CREDENTIALS` EMPTY, `RESEND_API_KEY` SET, `RESEND_FROM` EMPTY.
ไม่เปิดเผยค่า private. Empty credential file ENV ไม่พิสูจน์ว่า ADC ไม่มี; ต้องตรวจ
server identity/project ผ่าน adapter preflight โดยไม่สร้าง key/IAM ใหม่. From ยัง
ไม่พร้อมสำหรับ delivery gate. Public Web config ไม่ทดแทน server verification.

## Deferred migration และจำนวน operation

4 Google deferred (`GET /auth/google/start`, `GET /auth/google/callback`,
`POST /me/auth-identities/google`, `GET /me/auth-identities/google/callback`) ต้อง map จาก
canonical inventory จริงก่อน revise; ใช้ delta metadata บันทึก exact paths.
เสนอ supersede browser redirect ด้วย Firebase SDK + exchange/link. เก็บ historical
records พร้อม replacement references; Stripe deferred คงเดิม. จำนวนใหม่ต้องคำนวณ
ตาม decision ที่ review แล้ว ไม่บอกว่ายัง 86 หาก activate 2 routes เพิ่ม.

## งานและ gates ที่พร้อมเดินต่อ

1. **AUTH-DESIGN-C:** ownership approval + concrete delta/provider design (ชุดนี้).
2. **DB-06:** review physical schema/lock order/outbox; apply เฉพาะ isolated Test PG
   เมื่อแบบพร้อม. ไม่ต้องรอ DB-06 เพื่อทำ profile/redeem/read APIs ที่ไม่ใช้ proof.
3. **PROVIDER-AUTH-01:** official adapter interface + fake/emulator failure tests;
   select/pin `firebase-admin` หลังตรวจ Node compatibility และ dependency delta.
   เหตุผลใช้ SDK: signature/key rotation/revocation/user operations ไม่ควรเขียนเอง.
   ยังไม่ติดตั้ง library และไม่ใส่ Analytics SDK ใน backend.
4. **AUTH-01/02/03:** reviewed wire cutover, local/provider tests, Frontend Email/
   Google/Username/link/reset flows; required scopes และ namespace checks.

Tests: bad issuer/project/signature, expired/revoked/disabled token, wrong sign-in
method, provider timeout, email collision/no merge, same-link replay, two-account
identity race, reset vs exchange, session revoked after guard, rollback, one-use
24h exact boundary, no PII/hash leakage และ Account/academic data unchanged.
Provider acceptance ต้องใช้ sandbox evidence; adapter test ไม่แทน live provider gate.

PENDING: reviewed first-bind/recovery/freshness/transport protocol, SDK version,
server credential availability และ Resend verified From. ไม่สร้าง IAM/key/user
จริงหรือส่ง mail จริงเพื่อปิด design gate. งาน API อื่นเดินต่อได้.
