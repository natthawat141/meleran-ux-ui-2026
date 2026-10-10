# Free Enroll — execution component

11 ต.ค. 2026. เพิ่ม HTTP command ของ ENROLL-01 จาก internal grant ที่ตรวจแล้ว; ไม่ปิดทั้ง task, Auth/provider หรือ G-LEARNING จาก fixtures.

## Confirmed sources / exact operation

- Final 1.6 §1.2 `enrollment.create_self`, §2.1 account readiness, §2.4, §3.3, §5.3, §6.3. Learner/Instructor ลงคอร์สคนอื่นได้; Admin ไม่มี Enrollment สำหรับจัดการ. ฟรี Published เท่านั้น. หนึ่งบัญชี/คอร์สมีสิทธิ์ตลอดอายุรายการเดียว; ส่งซ้ำคืนเดิม.
- Canonical Draft `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` ไม่เปลี่ยน. อ่าน [ENROLL-01 subset](contracts/ENROLL-01.openapi.json) สำหรับ exact schemas/errors.
- **POST /api/v1/courses/{id}/enroll** · `post_courses_id_enroll` · optional `EmptyRequest` → 200 `EnrollmentDto` `{id,course_id,source,access:'lifetime',granted_at}`. 200 อยู่ใน canonical สำหรับทั้ง create/replay; ไม่เพิ่ม endpoint.
- ติดตาม A01/A02/A07/E01/E02/E10 ตาม [ENROLL-01](tasks/ENROLL-01.md); tests ด้านล่างเป็น component evidence ไม่ใช่ full acceptance ของ cases เหล่านี้.

## Authorization / validation

Handler opt-in `AuthoritativeAudience('web')` + normalized Learner/Instructor roles; ใช้ Web session cookie เดิมและ exact `x-melearn-app: web`. ไม่เชื่อ CSV compatibility roles, actor/source/price/score จาก client. Admin ที่มี Learner role ร่วมยังถูกปฏิเสธ. Owner ถูกปฏิเสธด้วยบัญชีจริงก่อน grant.

บัญชี Admin-created พร้อมเรียนโดยไม่ต้องมีอีเมล; self-email ต้อง verified; Google ต้องมี verified flag จาก provider-owned flow ไม่เชื่อ origin อย่างเดียว. This is stored-principal enforcement, not a claim that Firebase/login/link flows are implemented.

`EmptyRequestPipe` รับ omitted body หรือ `{}` เท่านั้น; fields เพิ่ม/array คืน safe 422. JSON `null`/malformed ถูก parser ปฏิเสธ 400. ไม่มีการรับ user_id, source หรือ price เพื่อเปลี่ยนสิทธิ์. Wire fields ทั้งหมดมาจาก server.

Missing/expired/revoked/disabled proof → 401; wrong header/app/role/unverified/owner → 403; missing/non-Published/no publish time → 404; paid course → 409. Public detail/private fields ไม่ถูกส่งกับ error. Null หรือ zero stored price เป็นฟรีตาม model เดิม; client เปลี่ยนราคาไม่ได้.

## Ownership / transaction mechanics

- Auth-owned `PrincipalService.requireLearning(tx, sessionReference)` ตรวจสดใน transaction หลัง guard; ไม่รับ account_id ที่ resolve เก่าแทน proof. Locks Session shared + Account exclusive + normalized existing roles shared **ก่อน Course**. Account exclusive lock กันการเพิ่ม Admin role ใหม่ด้วย FK ระหว่าง grant; การ lock role ที่มีอย่างเดียวกันกรณีนี้ไม่ได้.
- Enrollments-owned `FreeEnrollmentService`: ReadCommitted transaction → authority locks → Course `FOR SHARE` → ตรวจ Published/owner/price → existing `EntitlementWriter.grantEntitlement(tx, actor.id, course.id, 'free')` → commit. ไม่เปิด transaction/network ใหม่ใน participant.
- Course shared lock กันการเปลี่ยนราคา/สถานะ/เจ้าของระหว่างตรวจและ grant. Future authoring must acquire its exclusive Course lock; no authoring protocol invented here.
- Unique `(accountId,courseId)` + parameterized `INSERT ON CONFLICT DO NOTHING` คืน grant เดิมโดยไม่ทับ original source/time/completion snapshot. ไม่ออก certificate/record progress/สร้าง Payment/RedeemCode.
- Removed obsolete check-then-create prototype free-grant method; own Enrollment list ยังเป็น legacy implementation ที่รอ review ไม่ได้ประกาศ verified.
- ไม่มี schema/migration/dependency, seed, runtime migrate, provider call, STG หรือ deployment.

## Evidence / reproducible checks

`test/database/free-enrollment.pg-spec.ts`: **13 actual Nest HTTP/PostgreSQL tests**. Canonical serialization, omitted/empty body, reconnect/no session refresh, zero-price/Instructor, verification origins, Admin/mixed/roleless/owner denial, paid/hidden courses, spoofed fields, proof lifecycle/audience, stale reference rejected inside command, six concurrent requests one grant, preserved original source/academic snapshot, actual SQL rollback/safe 500. `pg_blocking_pids` proves concurrent price change and new Admin role grant wait until the authorized transaction ends; later requests see changed state.

`scripts/verify-frontend-detail.cjs`: retains **6 public Catalog client checks**, adds **7 Free Enroll client checks** using unchanged fullstack `createCatalogApi.enrollFree`/decoder → built Nest HTTP → owned `melearn_test` fixtures. Create, reconnect/replay, two concurrent repeats, owner403, paid409, anonymous401; read-back matches original grant. Session fixtures isolate the component from incomplete login/provider/browser gates; no mock fetcher or provisional server. Services/fixtures are cleaned up.

From backend: typecheck, boundary/blueprint gates, foundation/components tests, database suite with process-only `ALLOW_TEST_DATABASE_RESET=yes`, build, runtime smoke, then frontend-detail harness. Run no-write smoke/client fixtures after DB suites, not concurrently. Total local regression **49 + 16 + 104 = 169 tests**, plus 13 frontend-client checks. Hosted Nest CI [38081191962](https://github.com/natthawat141/meleran-tutor/actions/runs/38081191962) passed on code SHA `e28d8abff1bad684f6693ceb12d1e4c79658a18b` with the same 169 tests + 13 client checks. [EXECUTION_STATUS](EXECUTION_STATUS.json) tracks this code evidence; the metadata-only documentation checkpoint skips a redundant CI run.

## Remaining blockers / agent boundaries

ENROLL-01 whole task remains BLOCKED: own Enrollment list/query/progress projection review, complete normalized Auth/login/provider/role writers and real authenticated browser G-LEARNING still required. D01–D03 and existing list/revision/result decisions remain unresolved. No cookie TTL/CSRF/password/provider policy frozen by this component. Existing frontend source and canonical OpenAPI/113 cases are unchanged.

Follow-up agents read this document + ENROLL-01 subset and relevant dependency component; do not rewrite Scope, infer free access from Admin management privileges, broaden public projections, replace grant source, mutate academic history or change applied migrations.
