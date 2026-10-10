# R4a — API Contract Draft สำหรับคุยกับ Backend

วันที่ 9 ตุลาคม 2026 · สถานะ **Draft — ยังไม่มี Backend owner ยืนยัน**

เอกสารนี้เตรียมข้อกำหนด API จาก [MELEARN_V1_SCOPE.md](../MELEARN_V1_SCOPE.md) เพื่อให้ Frontend และ Backend ตกลงทีละ flow; ผู้ใช้อนุญาตให้ Frontend ทำ Draft types/mock/hooks ต่อได้ก่อน Backend พร้อม ปัจจุบันมี Frontend OpenAPI Draft ให้ตรวจแล้ว แต่ยังไม่มี Backend implementation/owner จึงห้ามนำ candidate path/payload ด้านล่างไปเรียกว่า frozen contract หรือใช้สร้าง production integration โดยไม่ผ่านการยืนยันร่วมกัน

เริ่มอ่าน inventory และ JSON ของทุก feature ที่ [API Contract แยก 14 ฟีเจอร์](API_CONTRACT_FEATURES_TH.md): methods/path, request/response examples, fields/validation/permissions และช่องว่าง provider/media. เป็น readable projection ที่สร้างจาก OpenAPI แหล่งเดียว ไม่ใช่ schema อีกชุด. รายละเอียด request/response/error ของ Flow A และ B อยู่ใน [Flow A/B Draft](API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) (ยังเป็น draft เช่นกัน) และ Mock API ทุก flow สำหรับ dev/test อยู่ใน [Provisional API Mock](../../frontend/docs/PROVISIONAL_API_MOCK_TH.md) (ไม่ใช่ contract)

## Contract source และผลตรวจ 9 ต.ค. 2026

แหล่ง schema ของ HTTP คือ [OpenAPI 3.1 Draft](openapi.json) version `1.0.0-draft.1`: 86 operations มี request/response schema, required/optional/null, enum, permission, validation/error envelope และ JSON examples จาก synthetic fixtures. Inventory รวม 91 operations; อีก 5 รายการแยกไว้ใน `x-deferred-operations`. ทุก operation ที่กำหนดมีตัวอย่าง success (204 ไม่มี body); video upload มีตัวอย่าง 503 ตาม scope. ไม่ใช้ seed/database model หรือ UI compatibility types เป็น contract.

**ยืนยันจากผู้ใช้:** บัญชี/identity ชุดเดียว แต่ Login และ session ของ Web/Admin แยกกัน; Logout ปิดเฉพาะ session ของแอปนั้น. `audience` และ `x-melearn-app` เลือกพื้นที่แอป ไม่ใช่หลักฐาน permission. Backend ต้องผูก audience กับ session และตรวจ role/ownership/state เอง. Cookie names ใน OpenAPI เป็นตัวอย่าง; transport, domain/path, CORS, CSRF, TTL/revocation ยังต้องตกลงก่อน freeze.

TypeScript สำหรับ Backend handoff ใช้ `@melearn/contracts/http` ซึ่ง generate จาก OpenAPI. ไฟล์ `src/generated/` ห้ามแก้มือ; `http-responses.ts`, `management-http.ts` และ DTO exports เดิมเป็น compatibility aliases. `User`, `Course`, `PaymentIntent`, `QuizAttempt` และ presentation models ที่ root export ไม่ใช่ wire DTO หรือ database blueprint. ถ้า JSON/nullable/enum ในตัวอย่าง Markdown เก่าขัดกับ OpenAPI ให้ยึด schema และ examples ใน OpenAPI ฉบับนี้ แล้วปรับพร้อมกันเมื่อ Backend review.

```powershell
npm.cmd ci
npm.cmd run contracts:setup
npm.cmd run contracts:validate
npm.cmd run contracts:generate
npm.cmd run contracts:check
npm.cmd test
```

`contracts:check` ตรวจ generated types ไม่ drift และ mapping ของ mock operations; CI เรียกก่อน tests. `contracts:examples` รัน tests เพื่ออัปเดต examples จาก synthetic fixtures ที่ผ่าน JSON Schema เท่านั้น ไม่เก็บ cookies/headers หรืออ่านบัญชีจริง. Generator แยก dependencies ใน `tools/contract-codegen` เพื่อไม่เปลี่ยน compiler ของ Web/Admin; ไม่มี generated SDK หรือ transport ตัวใหม่.

ผลตรวจ request/response ใช้ Ajv ใน tests; ไม่ใส่ Ajv ทั้งชุดลง browser bundle. Integration helper ตรวจ response และ successful request body ของ mock ตาม schema; negative tests ส่ง invalid body ได้. ครอบคลุมกรณีผิดชนิด/unknown request fields/private fields ใน public response. Actual learning/payment adapters ตรวจว่ารักษา course/enrollment projections ครบ รวม `access`, `source`, `granted_at`; Free course ใช้ `price: null`. ไม่ใช่หลักฐานว่า runtime decoder ทุกหน้าตรวจครบทุก field หรือ Backend จริงผ่านแล้ว.

Price ใช้ canonical `Money` (`amount_minor` จำนวนเต็มไม่ติดลบ, `currency: THB`) ทั้ง request/response. เป็น Frontend Draft/mock ปัจจุบัน; สกุลเงินเพิ่มต้อง review contract. Checkout response ต้องมี `already_enrolled` boolean: false มี payment_id/checkout_url; true มี course_id/full enrollment. `request_id` รับ 1–64 ตัวอักษร และยังกำหนด lifetime/payload-conflict policy ร่วมกับ Backend.

### ขอบเขตที่เริ่ม Backend ได้และเรื่องที่ยังเปิด

เริ่ม Auth/Profile, Catalog/Enrollment, Learning/Assessment, Authoring/Review, Management/Blog และ app-side Payment/Redeem/AI ตาม Draft ได้ทีละ flow. ก่อน freeze ให้ผู้รับผิดชอบ Backend review success/error examples และ tests ร่วมกัน.

- Google sign-in/link start/callback และ Stripe webhook (5 operations) ยังไม่มี provider protocol ที่ยืนยัน: ห้ามนำ `mock_google_*`, mock signature หรือ flat mock event ไปสร้าง Production handler. App-side checkout/status DTO มีแล้ว; event/version/signature ของ provider ต้องกำหนดแยก.
- `x-pending-decisions` ระบุ session deployment, username validation ที่ยังต่างกัน, pagination/search, rich documents/media, idempotency และการจัดการ conflict/delete/audit/visibility.
- Course publish ปัจจุบันรับ `{}` และ server ตรวจ approved review ตรง current course revision; explicit client revision guard รวม return-review ยังต้องตกลง. Blog PATCH/publish/unpublish/delete บังคับ expected_revision ทุกกรณีแล้ว; missing/invalid 422, stale 409.
- Submit-review บังคับ owner Instructor ตาม Final 1.6 แล้ว; Admin action ถอนและ AdminSession ไม่ใช่ security ของ operation นี้. Backend ต้อง enforce ซ้ำ.
- Certificate download ใน mock เป็น text fixture, AI เป็น synchronous fake และ video upload ตอบ unavailable. ต้องตกลง real media/download/async protocols.

OpenAPI นี้เป็น **Frontend Draft** ไม่ใช่ Backend-approved contract; browser/mobile/keyboard และ durable Backend/provider integration ยังเป็น acceptance ที่เปิดอยู่. การเปลี่ยน base URL อย่างเดียวไม่รับประกันว่าเชื่อมระบบจริงผ่าน.

## วิธีอ่านสถานะ

- **ยืนยันแล้ว** — business behavior/permission ที่ Final 1.6 กำหนด
- **ข้อเสนอ** — รูปแบบ API ที่เสนอเพื่อคุย ไม่ใช่ข้อบังคับต่อ Backend
- **รอ Backend/เจ้าของระบบ** — decision หรือ evidence ที่ยังไม่มี ห้ามเดาแทน

`packages/contracts` มี Draft HTTP DTO แล้ว: Auth (`CurrentUser`, `LoginRequest`, `UpdateProfileRequest`), Catalog, Public Blog และ response DTO ที่ API clients ใช้ใน `http-responses.ts`. `packages/api-client` เป็น generic HTTP transport; business endpoints/decoders/config อยู่ใน feature/app. การทำ Draft ไม่ต้องรอ Backend แต่การ freeze และ production integration ยังต้องตกลงร่วมกัน. `User`, `Course`, `QuizAttempt` และโมเดลต้นแบบที่ยัง export เพื่อ compatibility ไม่ใช่ HTTP DTO และห้ามนำมาเป็นแบบสร้าง database/API.

## หลักร่วมที่ยืนยันแล้ว

1. Backend เป็น source of truth สำหรับ identity, role/capability, ownership, enrollment, progress, attempt/score, completion/certificate, payment fulfillment, redeem state และ AI quota/history
2. Client route guard มีไว้ช่วย navigation/UX เท่านั้น ทุก endpoint ต้องตรวจ authentication, permission, resource ownership และ current state ฝั่ง server ซ้ำ
3. Web กับ Admin เป็นคนละ React app แต่ใช้ identity/backend rules ชุดเดียวกันได้ ทั้งสองแอปไม่มี shared in-memory store หรือ query cache
4. Instructor ใช้ learner flow และซื้อคอร์สของ Instructor คนอื่นได้ แต่ซื้อคอร์สตนเองไม่ได้; Admin ซื้อคอร์สไม่ได้
5. Stripe ให้สิทธิ์เรียนหลัง Backend ตรวจ webhook จาก Stripe แล้วเท่านั้น; success page อ่านสถานะได้ แต่ห้ามสร้าง Enrollment หรือยืนยันจ่ายเอง
6. Redeem เป็นสิทธิ์เรียนอีกช่องทางหนึ่ง ไม่ใช่ส่วนลด, cart หรือ order-history feature; code ใช้ได้ครั้งเดียวและ Admin ยกเลิกได้เฉพาะก่อนใช้
7. คะแนน, progress, completion snapshot, certificate และ AI usage ที่มีผลต่อสิทธิ์/ผลเรียนต้องคำนวณหรือบันทึกโดย server
8. Request/response ด้านล่างไม่ส่ง password, session token, answer key, Stripe secret หรือข้อมูลของ principal อื่นกลับไปยัง browser
9. ผู้สมัครเองด้วยอีเมลที่ยังไม่ยืนยันห้าม Enroll ฟรี, ซื้อผ่าน Stripe, Redeem หรือเริ่มเรียน; บัญชีที่ Admin สร้างเป็นข้อยกเว้นตาม scope
10. Google identity ที่ตรงบัญชีเดิมต้องให้ผู้ใช้ Login บัญชี Melearn เดิมแล้ว Link Google เอง ห้าม auto-link/auto-merge หรือสร้างบัญชีซ้ำ
11. AI quota นับเมื่อคำตอบ Assistant บันทึกสำเร็จ (`succeeded`) เท่านั้น; pending กันสิทธิ์ชั่วคราว, failed คืนสิทธิ์, การตอบ AIPractice ไม่นับเพิ่ม และ response ตอนสร้างชุดฝึกห้ามส่ง `correct_option`, เฉลย หรือ `explanation` ก่อนผู้เรียนตอบ
12. Video upload ในรอบนี้ยังไม่พร้อม: `POST /courses/{id}/videos/uploads` ต้องตอบ `VIDEO_UPLOAD_NOT_AVAILABLE` พร้อมข้อความ “ขออภัย ระบบนี้ยังไม่พร้อมใช้งาน” โดยไม่สร้างไฟล์หรือ upload record
13. Payment status ที่ยืนยันแล้วคือ `pending | processing | succeeded | failed | cancelled | expired`; fulfillment status คือ `pending | granted | failed`

## Cross-cutting contract — ข้อเสนอและคำถามเปิด

| หัวข้อ | สถานะ/รายการคุย |
|---|---|
| API base path/version | **รอ Backend** — `/api/v1` เป็นตัวอย่างเท่านั้น |
| ID และ enum | **รอ Backend** — รูปแบบ ID, casing ของ enum และการคง ID ข้าม version |
| เวลา | **ข้อเสนอ** — ส่งเวลาเป็น ISO-8601 UTC; UI แปลงตาม timezone ที่ scope ระบุ เช่น quota ใช้วัน Asia/Bangkok |
| Success envelope | **Draft implemented** — คืน resource โดยตรงตาม HTTP mock/client; ตัวอย่างในภาคผนวก. Backend review ก่อน freeze |
| Error envelope | **ข้อเสนอ** — มี machine-readable `code`, safe user-facing `message` และ `request_id`; Backend ยืนยัน HTTP status/code mapping |
| Pagination/filter/sort | **รอ Backend** — รูปแบบ cursor/offset, default/max page size และ allowlist ของ sort/filter |
| Session transport | **ยืนยันแยก Login/session Web/Admin** — transport, cookie attributes, CSRF/CORS, TTL/revocation และ origins ยังรอ Backend |
| Concurrency | **ข้อเสนอ** — mutation ที่แก้ resource ใช้ `version`/`If-Match` หรือกลไกเทียบเท่า; conflict ต้องไม่เขียนทับเงียบ ๆ |
| Retry/idempotency | **ข้อเสนอ** — ระบุ operation ที่ต้องรับ idempotency key และพฤติกรรมเมื่อ key เดิมใช้กับ payload ต่างกัน |
| PII และ field visibility | **รอ Backend** — ระบุ field ที่คืนได้ในแต่ละ capability; ไม่คืนข้อมูลเพียงเพราะ UI ซ่อนคอลัมน์ |

## ลำดับ contract ต่อ flow

Candidate paths เป็นเพียงตัวช่วยสนทนา ต้องเทียบกับ routing convention ของ Backend ก่อนตรึงชื่อจริง

### A. Auth และ Account

**ยืนยันแล้ว:** สมัคร/เข้าสู่ระบบ/ยืนยันอีเมล/กู้รหัสผ่าน/แก้ profile ตาม scope; Admin สร้างบัญชีและเพิ่ม role Instructor ได้; ผู้ใช้ที่ Admin สร้างอาจเข้าสู่ระบบด้วย Username โดยไม่มีอีเมล; การยืนยันอีเมลใช้ link อายุ 24 ชั่วโมง ใช้ครั้งเดียว; Username และอีเมลใช้เข้าสู่ระบบได้; Google ที่ตรงบัญชีเดิมต้อง Login บัญชีเดิมก่อน Link ห้าม auto-merge; สมัครอีเมลเองที่ยังไม่ยืนยัน Login ได้แต่ทำธุรกรรมเรียนไม่ได้

**Candidate operations (paths ตาม scope เป็นตัวช่วย ไม่ใช่ frozen server spec):** `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification-email`, `POST /auth/login`, Google sign-in/callback, `POST /me/auth-identities/google`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`, `POST /auth/logout`, `GET/PATCH /me`, `POST /admin/users`, `POST /admin/users/{id}/instructor`. ต้องยืนยัน OAuth callback/session และ success/error examples กับ Backend

**Request/response ที่ต้องยืนยัน:** identifier แบบ username/email, account status, verification status, safe profile fields, capability claims และ `next`/return path เป็นข้อมูล frontend เท่านั้น ไม่ใช่ permission claim. Admin create-user response ต้องไม่คืน password/hash และการเพิ่ม Instructor ต้องตรวจ actor Admin พร้อมบันทึกผู้ทำ/เวลา

**รอ Backend:** credential/session transport, duplicate username/email rules, lockout/rate limits, OAuth callback details, token/link consumption, session expiry/revocation, cross-origin cookie policy สำหรับ Web/Admin. ห้ามเอา password/session ลง localStorage หรือ query cache

### B. Public Catalog และ Enrollment

**ยืนยันแล้ว:** Guest ดูเฉพาะ Published course; ข้อมูล public ต้องไม่เปิด draft/private lesson/answer key; ผู้สมัครอีเมลเองที่ `email_verified=false` ห้าม Enroll/เริ่มเรียน (ยกเว้นบัญชีที่ Admin สร้าง); ผู้เรียน enroll คอร์สฟรีได้ตามกติกา; paid entitlement มาจาก Stripe webhook หรือ Redeem; ห้าม Admin ซื้อ และห้าม Instructor ซื้อคอร์สของตนเอง

**Candidate operations:** `GET /courses`, `GET /courses/{id}`, `POST /courses/{id}/enroll`, `GET /me/enrollments`; Redeem and Admin code operations are in Flow F.

**Response ขั้นต่ำที่ต้องตกลง:** public course card/detail, published state, price/currency, permitted preview content, enrollment state/source/granted time และ pagination/filter metadata

**รอ Backend:** catalog filters/sort, visibility/preview policy, guest/member route variants, free-enroll idempotency, already-enrolled response, public cache headers และ field visibility

### C. Learning, Progress และ Resume

**ยืนยันแล้ว:** เปิดบท/รายการได้เมื่อ principal มี effective access; Instructor ยังเรียนคอร์สคนอื่นได้; Progress/Resume เป็นข้อมูลของผู้ใช้; การเปิดหน้าอย่างเดียวไม่ใช่หลักฐานเรียนจบ; การแก้ curriculum ภายหลังห้ามทำลาย history และ completion snapshot เดิม

**Candidate operations:** `GET /learn/courses/{id}`, `GET /learn/courses/{id}/items/{item_id}`, `GET /me/progress`, `POST /learn/items/{id}/complete`, `PUT /learn/items/{id}/resume`; assessment and grading operations are in the Quiz section below.

**Response ขั้นต่ำที่ต้องตกลง:** access mode จาก server, visible content/version, learner's progress per item, completion status/time และ conflict/removed-item treatment โดยไม่เปิดเนื้อหาที่ไม่มีสิทธิ์

**รอ Backend:** นิยาม `completed` ต่อ video/article, autosave cadence, resume precision, curriculum revision behavior, pagination และ reconciliation เมื่อเนื้อหาที่มี history ถูกแก้/ยกเลิก

### D. Quiz, Attempt, Grading และ Certificate

**ยืนยันแล้ว:** Quiz attempt/answer/score, owner-scoped essay/image grading, progress และ certificate เป็น server-owned; คะแนนผ่านต้องมากกว่า 70% ด้วยคะแนนดิบ (70% พอดีไม่ผ่าน); ผู้เรียนดูผลตนเอง; Instructor ตรวจงานในคอร์สที่ตนเป็นเจ้าของ; Certificate อ้าง completion snapshot ณ วันที่จบ

**Candidate operations:** start attempt, save answer, submit attempt, read own result, instructor review queue, grade pending written/image answers, read/download own certificate.

**Response ขั้นต่ำที่ต้องตกลง:** immutable quiz/content version for attempt, attempt state, raw score/max score, pass status, pending/manual grading status, highest completed graded attempt, completion timestamp/snapshot reference และ certificate metadata

**รอ Backend:** attempt retry/idempotency, autosave/submit race, score rounding/display only, essay partial grading and grade revision audit, completion calculation, certificate issuance idempotency, immutable snapshot representation และ content-edit conflict behavior

### E. Course Authoring และ Review

**ยืนยันแล้ว:** Instructor แก้ได้เฉพาะคอร์สตนเอง; Admin สร้าง/แก้แทนและเลือก Instructor owner หนึ่งคน; การเผยแพร่ครั้งแรกต้องผ่าน Admin approval; Instructor submit draft เพื่อ review; Admin approve/return พร้อมเหตุผล และ Admin เผยแพร่แทน Instructor ได้; การแก้ Approved ก่อน Publish ทำให้กลับ Draft และต้องตรวจใหม่; Preview ของ Admin ไม่สร้าง enrollment/progress; stale review ต้องไม่อนุมัติเนื้อหาเวอร์ชันเก่าเงียบ ๆ

**Candidate operations (scope examples):** `POST /instructor/courses`, `POST /admin/courses`, `PATCH /courses/{id}`, chapter/content/Quiz child-resource commands, `GET /courses/{id}/authoring-preview`, `POST /courses/{id}/submit-review`, `GET /admin/course-reviews`, `POST /admin/course-reviews/{id}/approve`, `POST /admin/course-reviews/{id}/return`, `POST /courses/{id}/publish`, and a roster/results read operation for `course.learners_read`.

**Response ขั้นต่ำที่ต้องตกลง:** owner, lifecycle state, revision/version, review record/reviewer/reason, field-level validation errors และ preview access mode

**รอ Backend:** nested resource update semantics (whole replacement vs patch), revision token/precondition, approval tied to exact revision, conflict response, rich-text/image payload limits, YouTube URL validation และ author/admin audit fields. Upload-not-ready response is confirmed above; implementation/runtime evidence is still required.

### F. Stripe Payment และ Redeem

**ยืนยันแล้ว:** ซื้อรายคอร์สผ่าน Stripe Checkout; server คำนวณ/ยืนยันราคาและให้ entitlement หลังตรวจ webhook; success/status page เป็น read-only; ผู้สมัครอีเมลเองที่ยังไม่ยืนยันห้ามซื้อหรือ Redeem (บัญชี Admin-created ได้ตาม scope); Redeem code ไม่หมดอายุ, ใช้ครั้งเดียว, แยกจาก discount; Admin ออก code และ revoke ได้เฉพาะ Unused; Redeem สำเร็จสร้าง entitlement โดยไม่สร้าง cart/order/share flow

**Candidate operations:** create Stripe checkout for one course, read only that owner's `GET /me/payments/{id}`, Admin inspect one abnormal payment via `GET /admin/payments/{id}`, redeem one code, Admin issue codes, list code status/users and revoke one unused code. Do not add a list-all-payments or order-history page/API in this scope.

**Request/response ขั้นต่ำที่ต้องตกลง:** checkout รับเฉพาะ `course_id` และ request/idempotency reference ตาม contract; response เป็น hosted Stripe URL ที่ตรวจปลายทาง allowlist; status อ่าน payment/webhook fulfillment/enrollment result ตาม status enums ที่ยืนยันแล้ว; redeem response แสดง status โดยไม่รับ `user_id`, amount, discount หรือ grant source จาก client

**รอ Backend:** currency/amount snapshot, Stripe event mapping/signature verification/replay, webhook retry/reconciliation, mapping จาก Stripe events ไปยัง status enums ที่ยืนยันแล้ว, checkout retry, return URL allowlist, duplicate payment, redeem race/atomic consume, issued-code secrecy และ audit log. Webhook เป็น server-to-server เท่านั้น ไม่เป็น endpoint ของ browser app

### G. AI Chat, Transcript และ AIPractice

**ยืนยันแล้ว:** User เห็น/ค้นหา/เปลี่ยนชื่อ/ลบประวัติของตน; คำถาม/คำตอบและ AIPractice เก็บใน database; Transcript/AI enabled ตั้งโดย Admin; แสดง Transcript แยกจาก draft; AIPractice เป็น snapshot ใน chat ไม่ใช่ QuizAttempt และไม่เพิ่ม Progress/Certificate; จำกัด 20 successful prompts ต่อบัญชีต่อวันตาม Asia/Bangkok. Count 1 เมื่อ Assistant response สำเร็จและบันทึกลง Database (`succeeded`); pending กันสิทธิ์ชั่วคราว, failed ไม่เพิ่ม count และคืนสิทธิ์ชั่วคราว; การตอบ AIPractice ไม่คิด prompt เพิ่ม; generation response ต้องไม่ส่ง `correct_option`, เฉลย หรือ `explanation` จนผู้เรียนตอบข้อนั้น

**Candidate operations:** `PATCH /admin/courses/{id}/ai-support`, `GET /admin/courses/{id}/videos/{itemId}/ai-transcript`, `PUT /admin/courses/{id}/videos/{itemId}/ai-transcript`; `POST/GET /me/ai/conversations`, `GET /me/ai/conversations/{id}/messages`, `PATCH/DELETE /me/ai/conversations/{id}`, `GET /me/ai/usage`, `POST /me/ai/conversations/{id}/messages`, and `PUT /me/ai/conversations/{id}/messages/{messageId}/practice/answers`.

**Response ขั้นต่ำที่ต้องตกลง:** conversation/message IDs, role, status pending/succeeded/failed, safe error code, course/video context permitted by server, request ID, completion time, immutable practice snapshot, answer/result and remaining quota policy

**รอ Backend:** provider/timeout behavior, context retrieval permissions, transaction/locking method that enforces the confirmed quota rule, retry/idempotency, concurrent prompt race, retention/delete semantics, search scope/indexing และ transcript revision vs course draft

### H. Blog (Public read / Admin write)

**ยืนยันแล้ว:** Public อ่านเฉพาะ Published; Admin สร้าง Draft, แก้/preview และ Publish; การแก้ Published มีผลทันที; Blog เป็นคนละ domain กับ Article content ในคอร์ส และ Instructor ไม่มีสิทธิ์จัดการ Blog

**Candidate operations:** `GET /blog`, `GET /blog/{slug}`, `POST /admin/blog`, `PATCH /admin/blog/{id}`, `GET /admin/blog`, `GET /admin/blog/{id}/preview`, `POST /admin/blog/{id}/publish` ตามตัวอย่างใน Final 1.6

**Request/response ขั้นต่ำที่ต้องตกลง:** title/slug/cover/excerpt/content, Draft/Published state, author/editor/timestamps, public list/detail fields และ validation ของ publish-ready content

**รอ Backend:** rich-content schema/image storage, slug uniqueness/redirect behavior, pagination/filter, optimistic concurrency และ cache invalidation/publication visibility

## Error examples — illustrative only

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดแล้วตรวจอีกครั้ง",
    "request_id": "example-request-id"
  }
}
```

`VERSION_CONFLICT` เป็นตัวอย่างเพื่อคุย stale course review/authoring; code, HTTP status และข้อความจริงต้องให้ Backend ยืนยัน. Contract ต้องมีกรณี success และ error อย่างน้อยต่อ permission denied, missing/hidden resource, validation, invalid state, stale version, idempotent retry, rate limit และ dependency unavailable ตาม flow ที่เกี่ยวข้อง

## Gate ก่อนเรียก contract ของ flow ว่า frozen

สำหรับแต่ละ flow ต้องมี Backend owner/reviewer และ revision ที่ระบุได้ พร้อม:

1. OpenAPI/endpoint definition หรือ request/response DTO พร้อมตัวอย่าง success/error ที่รันกับ server ได้
2. Authentication/permission/field visibility และ state transition ที่ server บังคับใช้
3. Validation, pagination, conflict, cancellation/retry/idempotency ตามความจำเป็น
4. Test fixtures/schema validation ที่ผูกกับ contract revision และระบุการเปลี่ยน version
5. Frontend owner ยืนยันว่า UX loading/empty/error/pending/success รองรับ response จริง

ก่อน gate นี้: ใช้คำว่า **draft**; ห้ามสร้าง production hooks/claim API integration. เมื่อ Backend ยังไม่มี สามารถทำ UI/adapter preparation แยกได้ แต่ adapter ต้องป้าย prototype/mock ชัดและแยกจาก future server contract

## ลำดับที่เสนอสำหรับการคุยกับ Backend

1. Auth identity/session + published Catalog/detail + free Enrollment
2. Learning access, progress/resume + Quiz attempt/owner grading + completion/certificate
3. Course authoring/review concurrency
4. Stripe status/webhook boundary + Redeem atomic one-use flow
5. AI history/practice/quota + Admin transcript/AI-enabled controls

ลำดับนี้เป็นข้อเสนอเพื่อให้เริ่ม integration flow แรกได้เร็ว: Auth + Admin user management → Public Catalog/Blog + enrollment → Learning/assessment/completion → authoring/review/roster → Stripe/Redeem → AI/Transcript. ไม่ได้บังคับ Backend ให้ freeze ทุก endpoint ก่อนเริ่มทำงานที่ไม่ขึ้นต่อกัน

## Out of scope ของ contract รอบนี้

ไม่เพิ่ม API สำหรับ Cart/Order history เต็ม, Refund/Finance dashboard, Revenue share, Referral, Inbox/ถามผู้สอน, Assignment แยก, ผู้สอนร่วม, Archive, Admin grading, Big Data/Release dashboards หรือ Admin ดูแชตของผู้เรียน เพราะไม่ได้อยู่ในขอบเขต Final 1.6 รอบแรก

ไม่เลือก Backend framework/database, session provider, hosting, media provider นอก YouTube, live payment credentials หรือ deployment service แทนเจ้าของผลิตภัณฑ์


## Screen HTTP Draft — Authoring / Instructor / Admin / Blog (9 ต.ค. 2026)

ภาคผนวกนี้เป็น **Draft ที่ implement/test กับ HTTP mock แล้ว** ตามคำสั่งผู้ใช้ ไม่ใช่ frozen Backend spec. ตัวอย่าง error ตัวพิมพ์ใหญ่ด้านบนเป็น illustrative เก่า; integration ปัจจุบันใช้ lowercase codes ตามด้านล่าง. Auth/Profile/Catalog แบบละเอียดอ่าน [Flow AB Draft](API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md); Learning/Assessment/Certificate/Payment/Redeem/AI wire responses อยู่ [http-responses.ts](../../frontend/packages/contracts/src/http-responses.ts). ภาคผนวกนี้เติมหน้าที่เพิ่งถอน store.

Canonical types: [management-http.ts](../../frontend/packages/contracts/src/management-http.ts), [blog.ts](../../frontend/packages/contracts/src/blog.ts). Business/API adapters อยู่ใน feature ของแต่ละ app; shared course-authoring มี pure form conversion. UI camelCase models ไม่ใช่ JSON schema ของ Backend. ID/timestamps/revision/owner/history/score มาจาก server.

### หน้าจอ → API → permission

ทุก path ด้านล่างต่อหลัง base `/mock-api/v1` (dev) หรือ `/api/v1` (remote draft). Query lists คืน `{ "items": [], "next_cursor": null }`, ใช้ `limit`/`cursor`; limit/default/maximum อ้าง mock config จน freeze. ไม่มี endpoint คืน store/LmsData ทั้งระบบ. Request/response Content-Type เป็น JSON; success คืน resource โดยตรง ไม่มี `data` wrapper.

| หน้าจอ/owner | Read | Write | Permission / response |
| --- | --- | --- | --- |
| Web Instructor dashboard | GET instructor/summary, instructor/courses, instructor/grading-queue | — | Instructor; course-owned counters/list/queue |
| Web/Admin course list/overview/settings | GET instructor/courses หรือ admin/courses; GET courses/{id}/authoring | POST instructor/courses หรือ admin/courses; PATCH courses/{id} | เจ้าของ Instructor หรือ Admin; AuthoringCourseDto |
| Curriculum/Chapter/Content/Quiz editor ทั้งสอง apps | GET courses/{id}/authoring; managed-quizzes/{quizId} สำหรับหา course/item จาก URL เดิม | PATCH courses/{id} พร้อม expected_revision + chapters | เป็น course aggregate resource เดียว, scoped permission; ไม่ใช่ global snapshot |
| Course review/approve/publish | GET admin/course-reviews, admin/course-reviews/{id}; Admin UI ใช้ latest_review ของ admin/courses ด้วย | POST courses/{id}/submit-review; admin/course-reviews/{id}/approve หรือ /return; courses/{id}/publish | submit โดย owner/Admin; approve/return Admin; publish owner/Admin หลัง current approval |
| Instructor course learners/attempts | GET courses/{id}/learners, courses/{id}/attempts, instructor/learners | — | owner Instructor; Admin read-only ได้สำหรับ course management |
| Web attempts/grade page | GET instructor/attempts/{id}, instructor/grading-queue | PUT instructor/attempts/{id}/questions/{questionId}/grade | owning Instructor เท่านั้น; Admin grade ถูกปฏิเสธ |
| Public Instructor | GET instructors/{id}, instructors/{id}/courses | — | public allowlist + Published courses เท่านั้น |
| Admin dashboard/users/instructors/user detail | GET admin/summary, admin/users, admin/instructors, admin/users/{id}, /enrollments, /attempts, admin/learners | POST admin/users; POST admin/users/{id}/instructor | Admin; roles เพิ่ม Instructor โดยคง Learner |
| Admin Blog editor/list/preview | GET admin/blog, admin/blog/{id}/preview | POST admin/blog, PATCH admin/blog/{id}, POST /publish, POST /unpublish, DELETE admin/blog/{id} | Admin only; AdminBlogDto/revision |
| Public Blog | GET blog, GET blog/{slug} | — | Published only; UI คง /articles/{id} แล้ว resolve slug จาก list |
| Admin video AI fields ใน Chapter | PATCH admin/courses/{id}/ai-support, GET/PUT admin/courses/{id}/videos/{itemId}/ai-transcript | API เดิม Flow G; แยกจาก authoring PATCH | Admin เท่านั้น; AI fields ไม่รวมใน editor draft/review payload |

AI toggle request `{ "ai_enabled": true }` → `{course_id,ai_enabled}`; transcript PUT `{ "text": "เนื้อหา" }` text <=200000 chars, GET/PUT คืน item_id/text/edited_by/edited_at (edited fields nullable) ตาม Flow G view. แยกจาก review revision. Video upload courses/{id}/videos/uploads คืน503 video_upload_not_available ไม่สร้าง record.

### 1. Course metadata และ curriculum

Instructor create request `POST instructor/courses`:

```json
{"title":"คอร์สใหม่","subtitle":null,"description":"รายละเอียด","cover_url":null,"category":"ทั่วไป","level":"เริ่มต้น","price":{"amount_minor":19900,"currency":"THB"},"outcomes":["อธิบายแนวคิดได้"]}
```

Admin create ใช้ body เดียวกันเพิ่ม `instructor_id` ของบัญชี Instructor ที่ valid. Instructor ส่ง owner เองไม่ได้. Free price ใช้ null; amount_minor คือหน่วยสตางค์และต้องเป็น integer >=0, currency THB; mock normalize amount_minor=0 เป็น null. แยก business free/paid จาก UI formatting.

Response `201` และ GET/PATCH ใช้ AuthoringCourseDto:

```json
{
  "id":"crs_001","slug":"course-crs_001","title":"คอร์สใหม่","subtitle":null,
  "description":"รายละเอียด","cover_url":null,"category":"ทั่วไป","level":"เริ่มต้น",
  "price":{"amount_minor":19900,"currency":"THB"},"outcomes":["อธิบายแนวคิดได้"],
  "instructor":{"id":"usr_owner","display_name":"ผู้สอน","avatar_url":null},
  "chapters":[],"status":"draft","revision":1,"published_at":null,"published_by":null,
  "created_by":"usr_owner","created_at":"2026-10-09T00:00:00.000Z",
  "updated_at":"2026-10-09T00:00:00.000Z","latest_review":null,"ai_enabled":false,"enrollment_count":0
}
```

IDs/slugs เป็น illustrative string; server กำหนดค่า ไม่ควรสร้าง permanent ID จาก UI. Metadata PATCH ใช้ `{ "expected_revision": 1, "title": "ชื่อใหม่" }`; fields ที่ไม่ส่งคงเดิม nullable fields ส่ง null เพื่อล้าง. Read-only fields owner/status/audit/revision/count ส่ง PATCH ไม่ได้ ยกเว้น Admin อาจส่ง instructor_id.

Curriculum PATCH ตัวอย่างสร้าง chapter/article/quiz ใหม่:

```json
{
  "expected_revision":1,
  "chapters":[{
    "title":"บทแรก","description":"คำอธิบายบท",
    "items":[
      {"type":"article","title":"บทอ่าน","body":"ข้อความย่อ","body_doc":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"ข้อความย่อ"}]}]},"reading_minutes":2},
      {"type":"video","title":"วิดีโอ","video_url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","description":"คำอธิบาย","duration":"05:00"},
      {"type":"quiz","title":"ทดสอบ","quiz":{"pass_percent":70,"questions":[
        {"type":"single_choice","prompt":"ข้อใดถูก","prompt_doc":null,"points":2,"options":[{"text":"ก"},{"text":"ข"}],"correct_option_indices":[1]},
        {"type":"essay","prompt":"อธิบาย","points":2,"response_mode":"either","rubric":"ดูความเข้าใจ","prompt_doc":null}
      ]}}
    ]
  }]
}
```

`chapters` คือ replacement ของ curriculum คอร์สนั้นทั้งก้อนตามลำดับ array. Client ต้อง preserve chapters/items ที่ไม่ได้แก้ ไม่ส่ง partial array ที่ทำให้รายการอื่นหาย. Backend ควร transaction validate ก่อน mutate; mock validation failure ไม่เขียน metadata บางส่วน. หากจะแตกเป็น chapter/item mutation endpoints ภายหลังต้องปรับ contract/client ร่วมกัน.

Existing chapter/item/question/option ส่ง `id` เดิม; new resource ละ `id` แล้ว server assign. UI temporary IDs ไม่ส่งเป็น ID จริง. ID ต้องอยู่ในคอร์สเดิม/option ใน question เดิม; unknown/foreign/duplicate IDs ปฏิเสธ. Reorder ใช้ลำดับ arrays ไม่ใช่ field sort จาก browser.

Response nested item เพิ่ม `id`, `has_history`, description/duration/reading_minutes; article คืน body/body_doc, video คืน video_url และ has_ai_transcript (ไม่มี transcript body). Quiz questions คืน generated option IDs และ `correct_option_ids` เฉพาะ authorized authoring detail; list/preview/learner ไม่ส่ง keys. Client writes ใช้ `correct_option_indices` zero-based เพื่อ new options; mock รองรับ existing correct_option_ids เพื่อ compatibility แต่ห้ามส่งสองรูปแบบพร้อมกัน.

| Field/rule | Validation ปัจจุบัน |
| --- | --- |
| title | string ไม่ว่าง หลัง trim; max120 |
| subtitle/description | string หรือ null; max240/max20000 |
| category/level | string; max80 |
| cover_url | string หรือ null; max2,000,000; URL/media policy ต้อง freeze เพิ่ม |
| outcomes | array ของ strings; ไม่ส่ง owner/audit fields |
| nested type | item video/article/quiz; question single_choice/multiple_choice/essay/image |
| quiz options/answers | choice >=2 options; single_choice key 1 ค่า; multiple_choice >=1 ค่า; IDs/indices unique และอ้าง option จริง |
| points | finite positive; quiz pass_percent fixed70; score ผ่าน raw >70% ไม่ใช่ >=70 หรือ rounded display |
| response_mode | text/image/either; rubric string/null, prompt_doc JSON/null |
| rich JSON | root doc, size <=2,000,000 serialized chars, depth<=30, nodes<=20,000; reject unsafe URL/prototype keys; renderer ยังต้อง allowlist |
| YouTube | validated YouTube URL; upload endpoint unavailable503 |
| history | ลบ/เปลี่ยน type รายการที่มีประวัติไม่ได้; แก้ quiz definition หลังมี attempt ไม่ได้; unchanged definition บันทึกได้; snapshot ประวัติไม่เปลี่ยน |

### 2. Review และ publish

Submit `POST courses/{id}/submit-review` body `{ "expected_revision": 2 }`; ต้องมี curriculum และ required metadata. Approve `POST admin/course-reviews/{reviewId}/approve` body `{ "expected_revision": 2 }`. Return body `{ "reason": "กรุณาเติมรายละเอียด" }` reason nonempty <=1000. Mock ตรวจ pending/current review ก่อน decision. Review resource คืน id/course_id/revision/status/submitted_by/submitted_at/decided_by/decided_at/reason ตาม read view; latest_review ใน course ไม่มี course_id ซ้ำ.

Publish `POST courses/{id}/publish` body `{}`; owner Instructor หรือ Admin ต้องผ่าน current-revision approval. ไม่ approve จาก client flag. Published edit มีผลทันทีตาม Final 1.6; edit ของ Approved/Pending ทำฉบับเดิมใช้ต่อไม่ได้และกลับ Draft ต้อง review ใหม่. Wire `pending_review` คือสถานะ business submitted_for_review; mapping นี้เป็น Draft ต้องยืนยัน enum กับ Backend ไม่สร้าง state เพิ่ม.

### 3. Instructor roster / attempt / grading

Roster response ใช้ ResourcePage<LearnerRosterDto>:

```json
{"items":[{"id":"enr_001","course_id":"crs_001","user_id":"usr_learner","learner_display_name":"ผู้เรียน","granted_at":"2026-10-09T00:00:00.000Z","completed_items":2,"total_items":4,"percent":50,"completed_at":null,"certificate":null}],"next_cursor":null}
```

Counts/percent/completion มาจาก server; completion เดิมใช้ snapshot หลังแก้ curriculum. Certificate ถ้ามีเป็น `{id,code,learner_name,issued_at}` snapshot ไม่ใช้ชื่อ account ปัจจุบันแทน. Unauthorized owner-scope read คืน404เพื่อไม่เผย resource.

`GET instructor/attempts/{id}` และ course/user attempts lists ใช้ ManagedAttemptDto:

```json
{
 "id":"att_001","course_id":"crs_001","item_id":"itm_quiz","user_id":"usr_learner","learner_display_name":"ผู้เรียน",
 "status":"pending_review","started_at":"2026-10-09T00:00:00.000Z","submitted_at":"2026-10-09T00:05:00.000Z","graded_at":null,
 "earned":null,"max":4,"passed":null,"choice_earned":2,"choice_max":2,
 "questions":[{"id":"q_essay","type":"essay","prompt":"อธิบาย","points":2,"prompt_doc":null,"rubric":"ความเข้าใจ","response_mode":"either"}],
 "answers":{"q_essay":{"text":"คำตอบ"}},"grades":{}
}
```

ตัวอย่างย่อ questions เฉพาะ essay; response จริงมี snapshot ทุกข้อที่คะแนน max อ้างอยู่. Questions ไม่ส่ง correct_option_ids; answers เป็น object keyed by question ID. State in_progress/submitted/pending_review/graded. Grade `PUT instructor/attempts/{id}/questions/{questionId}/grade`:

```json
{"score":1.5,"comment":"อธิบายเพิ่มได้"}
```

score finite 0..question.points, increment0.5; comment required string/null. pending_review และ owning Instructor เท่านั้น; Admin403. Server เก็บ graded_by/time และ finalize เมื่อ manual questions ครบ, รวม choice score และกำหนดผ่าน raw>70. Grade response เป็น WireAttemptView ตาม http-responses.ts (questions/answers/manual-question grades/result) ไม่ใช่ ManagedAttemptDto; reload read model หลังบันทึก. Frontend ไม่ส่งรวมคะแนนหรือ passed flag. Retry หลังบันทึกบางข้อจะข้าม grades ที่อ่านกลับมาแล้ว; real database concurrency/idempotency ยังต้องตกลง.

### 4. Admin accounts / dashboard / public Instructor

Admin summary `{course_count,enrollment_count,learner_count,pending_grading_count,user_count,pending_course_count}` integers. Instructor summary ไม่มี user_count/pending_course_count และนับเฉพาะ owned courses. Lists paginate scoped projections.

`GET admin/users/{id}` ตัวอย่าง:

```json
{"id":"usr_001","display_name":"ผู้เรียน","username":"student01","email":null,"email_verified":false,"avatar_url":null,"roles":["learner"],"origin":"admin_created","status":"active","created_at":"2026-10-09T00:00:00.000Z","profile":{"firstName":"ชื่อ","lastName":"นามสกุล","certificateName":"ชื่อบนใบรับรอง","interests":[],"learningGoals":[]},"auth_methods":["password"]}
```

Root username/email/avatar nullable. Profile ใช้ AccountProfile keys ตาม Flow AB (camelCase ใน profile ปัจจุบัน); optional profile fields อาจ omit; type ไม่รับ null ใน string profile fields. Fields อื่น: firstNameEnglish/lastNameEnglish/birthDate/phone/bio/school/educationLevel. status active/pending เป็น projection ของ self-email verification ไม่ใช่ suspended/account-approval lifecycle. Lists ไม่ส่ง full profile/auth methods/password/OAuth subject. Create `{username,password,display_name,email?}` →201 `{user,created_by,created_at}`; password8..128, username pattern/uniqueness ตาม Flow A, display_name max80, email nullable max254. POST admin/users/{id}/instructor `{}` → `{user,added_by,added_at}`; preserve learner role, deny Admin account409. UI ไม่มี revoke/suspend API ใน scope นี้.

Public Instructor `{id,display_name,avatar_url,bio}` เท่านั้น; courses Published-only ใช้ Catalog CourseDetailDto. Private username/email/phone/birthDate/auth fields ไม่ส่ง.

### 5. Blog editor → public

Create `POST admin/blog` body:

```json
{"slug":"article-unique-id","title":"บทความ","category":"ทั่วไป","cover_url":null,"excerpt":"คำอธิบายย่อ","content":"ข้อความ","content_doc":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"ข้อความ"}]}]}}
```

Create201/PATCH/preview/publish ใช้ AdminBlogDto:

```json
{"id":"blg_001","slug":"article-unique-id","title":"บทความ","category":"ทั่วไป","cover_url":null,"excerpt":"คำอธิบายย่อ","reading_minutes":2,"author":{"id":"usr_admin","display_name":"ผู้ดูแล"},"content":"ข้อความ","content_doc":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"ข้อความ"}]}]},"status":"draft","author_id":"usr_admin","editor_id":"usr_admin","revision":1,"created_at":"2026-10-09T00:00:00.000Z","updated_at":"2026-10-09T00:00:00.000Z","published_at":null}
```

PATCH ส่งเฉพาะ fields ที่แก้ได้ + expected_revision; content_doc null ล้าง rich doc, content string ไม่ใช่ null. UI generate stable slug ตอน create (ไม่มี input slug ใน UI เดิม); slug unique ตาม pattern `^[a-z0-9-]{3,80}$` ของ mock; stricter slug style เป็น freeze decision. เคย publish แล้วเปลี่ยน slug ไม่ได้แม้กลับ Draft เพื่อรักษา URL; redirect strategy เป็น Backend decision.

Blog title nonempty <=120, category nonempty <=40, excerpt nullable <=2000, content string <=200000, cover_url nullable <=2000000; rich JSON validation ใช้ rule เดียวกับ article. Unknown fields ปฏิเสธ.

Publish/unpublish body `{ "expected_revision": 1 }`; publish ต้องมี title และ content หรือ image rich document. Unpublish คืน draft resource. Delete body `{ "expected_revision": 1 }` → `{ "id": "blg_001", "deleted": true }`. DELETE JSON body เป็น Draft ต้องตกลง transport/If-Match convention กับ Backend. Client ทุก existing write ส่ง revision; mock ยอม omission สำหรับ compatibility กับ tests/older consumers แต่ Production ต้องยืนยันว่าจะ enforce required revision.

Public list summary ไม่มี content/content_doc/private audit; detailมี rich doc. ทั้งคู่มี category/read-time/author. Draft hidden404/listไม่คืน. Editor save success หลัง HTTP สำเร็จเท่านั้น; dirty draft ไม่ silently rebase revision จาก background refetch.

### 6. Errors และการตกลงก่อน freeze

Validation422:

```json
{"error":{"code":"validation_failed","message":"ข้อมูลที่ส่งไม่ถูกต้อง","details":{"fields":[{"field":"chapters[0].items[0].video_url","code":"invalid"}]}}}
```

Course stale409:

```json
{"error":{"code":"revision_conflict","message":"ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดแล้วตรวจอีกครั้ง","details":{"current_revision":3}}}
```

| HTTP/code | สาเหตุ/Frontend behavior |
| --- | --- |
| 401 unauthenticated | session ไม่มี/หมดอายุ; auth policy จัดการ ไม่ fallback business state |
| 403 forbidden | wrong role; hide/deny actions ตาม UX แต่ server ตรวจซ้ำ |
| 404 not_found | missing/hidden/out-of-owner/Draft public resource |
| 422 validation_failed | field paths + codes; preserve draft, แสดง safe local error text |
| 409 revision_conflict | โหลดล่าสุด/ตรวจ draft, ไม่เขียนทับอัตโนมัติ |
| 409 learning_history_conflict | remove/type/quiz definition ที่ทำลาย history |
| 409 invalid_state | wrong review/publish/grade lifecycle |
| 409 slug_taken/username_taken/email_taken | unique constraint conflict |
| 503 video_upload_not_available / dependency code | ตรวจ code จริงของ operation; mockไม่บันทึก upload; providerจริงยังไม่มี |

Resource client เก็บเฉพาะ allowlisted error code/field paths และ HTTP status; ไม่แสดง raw server message/HTML. Default transport ไม่อ่าน error body ถ้า featureไม่เลือก decoder. Abort/network/timeout ต่างจาก HTTP validation. Management/Authoring/Blog resources ตรวจ nested fields, enum/nullability, IDs, finite numbers, timestamps, rich JSON และ pagination ตาม operation ใน management-decoders.ts; operation ใหม่ที่ยังไม่มี schema ปฏิเสธด้วย invalid_payload. DTO compiler checks ไม่แทน Backend validation.

ก่อน freeze ต้องตกลง enum/ID/time/nullability, pagination/search/filter, rich doc/URL/size limits, nested aggregate transaction, revision enforcement/If-Match, idempotencyของcreate/grade, deletion/audit/retention, cookie/CORS/CSRF และ uploads/provider APIs. การทำ Backendตาม Draft ช่วยลดการย้าย UI รอบใหม่ แต่การเปลี่ยน base URL อย่างเดียวไม่รับประกัน real integration ผ่าน. R10/R13 ต้องตรวจ HTTP+browser+durable Backend ตาม acceptance matrix.

Runtime validator ไม่ใช่ frozen OpenAPI หรือการตรวจ permission จาก Frontend. Typed HTTP mock fixtures ผ่าน และ malformed payload ถูกปฏิเสธก่อนถึง UI; response ของ provider/Backend จริงยังต้องทำ integration acceptance.
