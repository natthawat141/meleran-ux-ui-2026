# ACCOUNT-01 — GET /me component

สถานะ: component implementation; ACCOUNT-01 ทั้ง task ยัง NEEDS_DECISION.

## ขอบเขตที่ยืนยัน

- Final 1.6 §2.1, §3.5, §6.2: อ่านเฉพาะบัญชีตนเอง, ไม่ส่งรหัสผ่าน, ไม่เชื่อ ID/role/eligibility ที่ client ส่ง; unverified email ยังอ่านบัญชีตนเองได้.
- Draft `GET /me`, `get_me`, `CurrentUser` ใน [contract subset](contracts/ACCOUNT-01.openapi.json): 11 required root fields; required-nullable username/email/avatar; profile มี 10 optional strings และ 2 optional string arrays (max30). Root snake_case/nested camelCase คงเดิม.
- Contract 1.0.0-draft.1; SHA256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3`; ไม่แก้ canonical และไม่ freeze decisions.

## Technical implementation

Accounts controller opt-in fresh normalized authority เฉพาะ GET. SelfProfileService เปิด ReadCommitted transaction แล้วเรียก Auth public SelfProfileReader; Auth เป็นเจ้าของ identity/credential queries. Session/Account shared locks และ existing role shared locks ผ่าน requireSelfRead ตรวจ identity ซ้ำหลัง guard. Admin namespace ต้องมี normalized Admin; Web/Admin header เลือก namespace ไม่ให้สิทธิ์. Account edit ต้องรอจบ read transaction.

DTO คืน roleGrants เท่านั้น ไม่มี CSV fallback. learning_eligible มาจาก principal เดิม: Admin=false; Learner/Instructor ต้อง admin_created หรือ emailVerified. Google origin อย่างเดียวไม่ใช่หลักฐาน verified provider. Fixture identity เป็น trusted database input สำหรับ component ไม่ใช่ proof ของ Firebase login.

Bounded select อ่าน LocalCredential.accountId เฉพาะมี credentialหรือไม่ และ ExternalIdentity.method; ไม่เลือก passwordHash/provider/project/subject. auth_methods dedupe/sort เฉพาะ password/google ที่บันทึกไว้ ไม่ตรวจ provider network และไม่สร้าง/link identity. ไม่อ้างว่า shared Account lock เป็น protocol สำหรับ concurrent credential/link writers ในอนาคต; ต้อง review writer locking ใน Auth task.

profile projection whitelist declared fields; ไม่เติม defaults ใน optional fields, ไม่เปลี่ยนค่าสตริง/array และไม่คืน internal metadata. Unknown stored metadata ไม่ใช่ wire field จึง omit โดยไม่แก้ข้อมูลเก็บ. Malformed JSON/object/type/array bound หรือ unknown authentication method คืน masked500 ไม่มี repair/fallback/diagnostic leak. นี่คือ response boundary ไม่ตัดสิน null/normalization ของ PATCH.

ไม่มี query account ID เป้าหมายจาก client, side-effect, provider call, schema/migration/dependency change. Legacy PATCH ยังอยู่ภายใต้ tracked prototype exceptions; ไม่อ้างว่า profile mutation/Auth cutover เสร็จ.

## Evidence และตรวจซ้ำ

- `test/database/self-profile.pg-spec.ts`: 14 actual HTTP/PG tests; exact canonical shape, own binding/foreign PII, all normalized roles/audiences, stored origin/verification, method projection without sensitive selects, all optional fields/max30, unknown metadata/no repair, session/disabled/post-guard changes, corrupt profile/unsupported method/safe SQL failure, reconnect/parallel no writes และ real pg_blocking_pids account-edit wait.
- `scripts/verify-frontend-detail.cjs`: 8 named unchanged authSessionApi.me/decodeCurrentUser checks ตาม built Nest → Test PostgreSQL; nullable Learner/Instructor/Admin, anonymous401, saved fixture reconnect/whitelist, corrupt500/no repair, read-only identity/session/academic values, network failure. ใช้ actual fetch/decoder; config/session fixtures ไม่ใช่ browser login. ดู EXECUTION_STATUS สำหรับผลที่ผ่านจริง.
- Targeted: `ALLOW_TEST_DATABASE_RESET=yes node node_modules/jest/bin/jest.js --config test/jest-database.json --runInBand --runTestsByPath test/database/self-profile.pg-spec.ts`; test helper allowlists melearn_test/runtime role/loopback. Build ก่อนรัน frontend harness; ไม่ใช้ live database/resetทั้งระบบ.

## Remaining gates

PATCH/D02 username/null/array semantics และ image protocol/D09 ยังไม่ปิด; AUTH-01/AUTH-BASE-01/PROVIDER-AUTH-01 session/provider protocols D01/D03, Firebase credential/actual provider login และ authenticated browser G-AUTH ยังไม่ผ่าน. A03/A09/full113 acceptance ไม่ผ่านจาก read tests นี้. ไม่มี STG/deploy หรือ migrationข้อมูลจริง.

Verified code SHA: `d3230b4e4013a6df135ec2a802065e91fa9bd64c`; [hosted Nest CI 38090915871](https://github.com/natthawat141/meleran-tutor/actions/runs/38090915871) passed 302 tests + 74 client checks, build/smoke/blueprint/boundaries. Profile PATCH/provider login/browser and full acceptance remain unverified.
