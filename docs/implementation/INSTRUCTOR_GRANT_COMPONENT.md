# MGMT-02 — เพิ่ม Instructor ผ่าน normalized identity

11 ต.ค. 2026 · Component evidence; full MGMT-02/G-MANAGEMENT ยังไม่ผ่าน. Canonical Draft `1.0.0-draft.1`, SHA256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3`.

`POST /api/v1/admin/users/{id}/instructor` / `post_admin_users_id_instructor` ยึด Scope §2.2, §5.1, §6.2/6.9 และ MGMT-02. Request strict EmptyRequest; response 200 AssignInstructorResponse พร้อม CurrentUser ครบ required/null. Admin audience + normalized Admin role เท่านั้น; Admin target 409 ตาม task protocol, unknown account 404.

Management Controller/Service เรียก Auth public InstructorGrantWriter ใน caller transaction. ไม่มี Management Prisma identity write บน path นี้. ลบ role-string assignment เดิม; Account creation writer เดิมยังเป็น tracked exception รอ MGMT-01 ไม่ประกาศว่า Auth/Management cutover ทั้งหมดเสร็จ.

## Transaction และ projection

- Lock Session shared → Account actor/target sorted by ID exclusive → fresh Admin authority → normalized roles → write. Lock Accounts ก่อน requireAdmin ใช้ shared Account lockเพื่อไม่เกิด upgrade deadlock เมื่อ Admin ส่ง request ใส่กัน; opposite requests ตรวจจริงแล้วคืน conflict.
- Target roles อ่านจาก UserRole เท่านั้น; existing role string ไม่ให้สิทธิ์. Account exclusive lockป้องกัน concurrent FK-backed role insert รวมถึง Admin. Normalized Instructor grant, original actor/time และ compatibility role mirror เขียนใน transaction เดียว; revision เพิ่มครั้งเดียวต่อ new grant.
- Grant กับ audit ใช้ PostgreSQL instant เดียวกัน; UTC mapping ตรงแม้ session timezone Bangkok. Repeat ไม่เปลี่ยน original audit, revision, role strings หรือทำ read-repair. Existing normalized Instructor ที่ไม่มี audit เก่าคืน nullable จริง; conflicting legacy audit ไม่ถูกทับ/ใช้เติม roles เงียบ ๆ.
- เก็บบัญชีเดิม/บทบาทเดิม/credentials/linked identities/session/enrollment/progress/certificate. ไม่ยืนยันอีเมล ไม่สร้างบัญชี/session/learning grant หรือเปลี่ยน eligibility จากการเพิ่ม Instructor.
- ใช้ Auth-local bounded CurrentUser projection ร่วมกับ GET /me; canonical profile whitelist/linked methods โดยไม่ select hash/provider subject. หาก stored shape ไม่ถูกต้องหรือ SQL ล้มเหลว rollbackทั้ง grant/audit แล้วคืน safe500.
- No schema/migration/contract/library/provider/cloud/STG/deployment change. การ sync compatibility string เป็น transition adapter; canonical authorization ยังคง normalized UserRole.

## Evidence และ remaining gates

18 actual HTTP/Test PostgreSQL cases: fresh Admin/namespace, role tampering, revocation after guard, strict request, exact DTO/private fields, original history, immediate GET /me/public Instructor consistency, repeated/different Admin/concurrent grant/reconnect, truthful old-null audit, Admin/self/unknown targets, opposite Admin requests, actual SQL/projection rollback, real pg_blocking_pids wait on new Admin role insert, UTC/Bangkok audit และ conflicting old audit preservation.

8 checks: unchanged `frontend/apps/admin/src/shared/api/resources.ts` resource transport + actual `decodeManagementResponse` ที่ UI ใช้ → built Nest → Test PostgreSQL. Success/canonical/persistence, parallel replay/reconnect, namespace403, Admin409, unknown404, anonymous401, body422, network failure. Injectเฉพาะconfigured client; actual fetch/decoder ไม่ mock. เป็น transport/decoder component evidence ไม่ใช่การเปิด Admin page หรือ React hook/browser acceptance.

Full task ยังขาด GET /admin/instructors directory/query protocol, complete Auth/Login/provider/normalized creation writers และ actual Management browser gate/A04. ไม่ปิด 113 numbered acceptance จาก component tests. ดู [execution status](EXECUTION_STATUS.md).

Verified code SHA: `fc622a25b1f4a2f52f16b97e0e8f78ac463ddd29`; [hosted Nest CI 38094636720](https://github.com/natthawat141/meleran-tutor/actions/runs/38094636720) passed 49 foundation + 28 feature units + 294 PG = 371 tests, build/smoke และ 106 actual client checks. Full task/feature/acceptance remain open.
