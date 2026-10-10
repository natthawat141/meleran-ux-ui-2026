# Backend feature delivery — 10 ตุลาคม 2026

EF Core 10/Npgsql PostgreSQL persistence, local Username Auth/Profile, Admin account reads/Instructor assignment และ Catalog/Free Enrollment. โค้ดมี 13 business operations; ไม่ใช่ backend ครบ 86 operations และ Frontend ยังใช้ HTTP mock.

| Endpoint | ทำแล้ว / ข้อจำกัด |
| --- | --- |
| POST /api/v1/auth/login | Username/password ของบัญชี local; password hashing ผ่าน ASP.NET Identity PasswordHasher, iteration 210,000; Firebase Email/Google ยังไม่ implement |
| POST /api/v1/auth/logout | revoke session ฝั่ง server และ clear cookie เฉพาะ app; 204 |
| GET /api/v1/me | CurrentUser ตาม wire fields ของ canonical Draft |
| PATCH /api/v1/me | display_name/username/avatar_url/profile; reject role/email/verification/unknown fields; preserve camelCase keys ใน profile; optimistic concurrency |
| POST /api/v1/admin/users | Admin session สร้าง local Learner ไม่มีอีเมล; 201, default role Learner เท่านั้น; email ที่ไม่ใช่ null ยังไม่รองรับจนมี verification flow |
| GET /api/v1/admin/users | Admin session/role เท่านั้น; q ค้น display name/username/email; limit 1–50 default 20; cursor; summary ไม่ส่ง profile/auth identities/password hash |
| GET /api/v1/admin/users/{id} | Admin session/role เท่านั้น; profile/auth_methods ตาม schema; account ไม่พบ 404 |
| GET /api/v1/admin/instructors | Admin session/role เท่านั้น; Instructor summaries + pagination ตาม contract |
| POST /api/v1/admin/users/{id}/instructor | Admin เท่านั้น; เพิ่ม Instructor และรักษา Learner; Admin target 409 invalid_state; เก็บ added_by/added_at; เรียกซ้ำคืน grant เดิม; body ไม่ใส่หรือ {} เท่านั้น |
| GET /api/v1/courses | Published เท่านั้น; search/category/level/free-paid filter, limit/cursor |
| GET /api/v1/courses/{id} | Published detail + public outline; ไม่มี lesson content/answer keys/transcript |
| POST /api/v1/courses/{id}/enroll | คอร์สฟรี; eligibility/role/owner/status checks; unique account/course และ serializable grant transaction; สมัครซ้ำได้ enrollment เดิม |
| GET /api/v1/me/enrollments | เฉพาะเจ้าของ session; course + persisted initial progress state; ยังไม่มี endpoint บันทึกการเรียน/คะแนน |

## Session protocol ของ implementation ช่วงพัฒนา

- Opaque secret 32 bytes; DB เก็บ SHA-256 digest, account ID, audience, expires/revoked. ไม่เก็บ raw cookie secret.
- Web/Admin ใช้ชื่อ `melearn_web_session` / `melearn_admin_session`; HttpOnly, SameSite=Strict, path=/api/v1, TTL 12 ชั่วโมง. Secure เปิดนอก Development/Testing. Account disabled/role ที่ถูกถอน/expiry ตรวจจาก DB ทุก request.
- `x-melearn-app: web|admin` เลือก session เท่านั้น ไม่ให้ permission; Admin management ต้องใช้ Admin audience + role จาก server.
- Mutations ต้องมี custom header และ Origin ต้องอยู่ใน `Cors__AllowedOrigins__N` เมื่อ browser ส่งมา; CORS credentials เฉพาะ exact origins. Responses ไม่ cache. Login จำกัด 10 attempts/IP/minute ใน process.
- Production ต้องมี same-site Web/Admin/API domains หรือ gateway เพื่อใช้ Strict cookie; ยังไม่รับรอง cross-site pages.dev → run.app. Distributed rate limits/trusted proxy และ session cleanup ยังต้องทำก่อน deploy.

## Database และการเริ่มใช้งาน

Models: accounts, local_credentials, external_identities (เตรียมไว้ ยังไม่มี verifier/linking), app_sessions, courses, course_chapters, course_items (metadata สำหรับ public outline), enrollments. ไม่เก็บ plaintext password; ไม่มี runtime seed/demo login.

`auth_methods` อ่านจาก local credential และ external identities ที่ผูกจริง ไม่อนุมานจาก origin. กรณี linked Google ใน test ใช้ identity ที่ seed ใน relational test host; ไม่ใช่หลักฐาน Firebase linking จริง. Admin account status active/pending เป็น projection ของ self-email verification ตาม R4A ไม่เพิ่ม suspension/approval lifecycle.

มี migrations `InitialAccounts`, `CatalogEnrollment`, `InstructorGrantAudit` และ [SQL สำหรับ review](INITIAL_SCHEMA.sql). Generate/check ไม่เชื่อม DB. ยังไม่ได้ apply Cloud SQL; ไม่ auto-migrate เมื่อ API startup.

1. สร้าง application database/DB user และ grants ตาม [Cloud SQL setup](CLOUD_SQL_SETUP_TH.md); runtime ไม่ใช้ postgres administrator.
2. ใส่ `ConnectionStrings__Melearn` ใน ignored `.env`; เปิด Auth Proxy ตาม setup. `scripts/dev.ps1` โหลด .env ให้ API แต่ dotnet ef ไม่โหลด .env เอง: process env สำหรับ migration ต้องตั้งเอง หรือใช้ migration runner/SQL ที่ review แล้วโดย migration user.
3. `dotnet tool restore`; apply migrations ด้วย `dotnet ef database update --project src/Melearn.Infrastructure --startup-project src/Melearn.Infrastructure` เมื่อ process environment มี connection ที่ถูกต้อง. คำสั่งนี้เปลี่ยน DB; ชุดงานนี้ยังไม่ได้รัน.
4. ใส่ `Bootstrap__AdminUsername`, `Bootstrap__AdminPassword` (12–1024 ตัวอักษร), `Bootstrap__AdminDisplayName` ใน .env แล้วรัน `scripts/dev.ps1 -Operation BootstrapAdmin` ด้วย operator ที่มี DB access. รันได้เมื่อ accounts ว่างเท่านั้น; ไม่เปิด HTTP listener; ไม่เพิ่ม Admin ในฐานที่มีผู้ใช้อยู่แล้ว. ลบ bootstrap password หลังสำเร็จ.
5. ใส่ origins ของ Web/Admin ที่ใช้งานจริงใน `Cors__AllowedOrigins__0`, `Cors__AllowedOrigins__1`; รัน `scripts/dev.ps1`. ส่ง credentials: include และ x-melearn-app ใน client. อย่าเปลี่ยน Frontend ทั้งระบบมา real API เพราะ endpoint อื่นยังไม่มี.

คำขอและ response หลักอ้าง `../../docs/api-contract/openapi.json`. ข้อจำกัด Backend เพิ่มเติมที่ต้อง sync กับ frontend/mock ก่อน freeze: local login เท่านั้น, admin-created password ขั้นต่ำ 12, profile avatar HTTPS, session/CSRF protocol ข้างต้น และ admin email provisioning ยังไม่รองรับ. ยังไม่ประกาศ canonical Draft เป็น final.

## Verification และงานค้าง

- Locked restore / Release build / architecture + HTTP relational tests: รายงานผลล่าสุดใน README. Test DB เป็น SQLite relational ใน test host; ไม่ใช่หลักฐาน live PostgreSQL/provider acceptance.
- ทดสอบ login invalid/disabled, admin escalation, isolation/logout, profile unknown/invalid fields, concurrent edits, draft visibility, filters/cursors, own enrollments, paid/unverified/admin/owner restrictions และ duplicate enrollment.
- PostgreSQL migration SQL generate ผ่าน; SQL apply/real DB connectivity และ concurrent PostgreSQL serializable/unique-conflict branch ยังไม่ตรวจสด.
- Firebase project/config/token verifier/linking, email/reset/recovery, Authoring/Review/Publish, Learning/Assessment/Certificate, Management learner/results/summary และ Blog, Payment/Redeem, AI, Resend และ R2 upload ยังไม่ implement.
- ยังไม่เชื่อม Frontend จริง, ไม่ deploy, ไม่เปลี่ยน IAM, ไม่สร้าง resource เพิ่ม และไม่รัน Docker local. `/health/ready` ยัง 503 เป็น development gate จนตรวจ runtime dependencies และ flow ที่ต้องเปิดจริง.

อ้างอิง: [Npgsql EF Core 10](https://www.npgsql.org/efcore/release-notes/10.0.html), [ASP.NET PasswordHasher](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.identity.passwordhasher-1), [EF Core concurrency](https://learn.microsoft.com/en-us/ef/core/saving/concurrency).

## หลักฐานสเปกสำหรับชุด Admin management

- Final 1.6 §2.1/2.2 และ permission user.assign_instructor: Admin เพิ่ม Instructor; บัญชีเดิมเรียนคอร์สอื่นได้.
- Canonical OpenAPI: GET /admin/users, GET /admin/users/{id}, GET /admin/instructors, POST /admin/users/{id}/instructor; ไม่เพิ่มหรือแก้ endpoint/schema ใน canonical เพื่อให้ตาม implementation.
- `../../docs/api-contract/API_CONTRACT_R4A_DRAFT_TH.md` §4: status projection, summary/detail fields, preserve Learner, reject Admin target, added_by/added_at. Cursor `o:<offset>` ตามตัวอย่างใน canonical; ordering ตาม ID เป็นรายละเอียด persistence ไม่เปลี่ยน business policy.
- Tests ตรวจ schema snapshot + permissions, search/pagination/empty, pending verification, idempotent grant/audit, malformed body, unknown account และ multi-method auth. Snapshot เป็น subset ของ canonical สำหรับ standalone Backend tests ไม่ใช่ API contract อีกชุด.
- Findings เรื่อง session/password policy และ Admin create พร้อม email ใน DECISION_AUDIT_TH.md ยังเปิดอยู่; งานชุดนี้ไม่ freeze policies หรือประกาศ feature Auth ครบ.
