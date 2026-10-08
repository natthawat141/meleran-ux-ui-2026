# R4a — API Contract Draft สำหรับคุยกับ Backend

วันที่ 9 ตุลาคม 2026 · สถานะ **Draft — ยังไม่มี Backend owner ยืนยัน**

เอกสารนี้เตรียมข้อกำหนด API จาก [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md) เพื่อให้ Frontend และ Backend ตกลงทีละ flow; ผู้ใช้อนุญาตให้ Frontend ทำ Draft types/mock/hooks ต่อได้ก่อน Backend พร้อม ปัจจุบัน repository นี้ยังไม่มี Backend หรือ OpenAPI ให้ตรวจ จึงห้ามนำ candidate path/payload ด้านล่างไปเรียกว่า frozen contract หรือใช้สร้าง production integration โดยไม่ผ่านการยืนยันร่วมกัน

รายละเอียด request/response/error ของ Flow A และ B อยู่ใน [Flow A/B Draft](API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) (ยังเป็น draft เช่นกัน) และ Mock API ทุก flow สำหรับ dev/test อยู่ใน [Provisional API Mock](PROVISIONAL_API_MOCK_TH.md) (ไม่ใช่ contract)

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
| Success envelope | **ข้อเสนอ** — กำหนดให้สม่ำเสมอว่าจะคืน resource โดยตรงหรือมี `data`; อย่าลงโค้ดจนมีตัวอย่างจริง |
| Error envelope | **ข้อเสนอ** — มี machine-readable `code`, safe user-facing `message` และ `request_id`; Backend ยืนยัน HTTP status/code mapping |
| Pagination/filter/sort | **รอ Backend** — รูปแบบ cursor/offset, default/max page size และ allowlist ของ sort/filter |
| Session transport | **รอ decision** — cookie/session หรือ bearer, CSRF/CORS, refresh/logout behavior และการใช้ identity ข้าม origin ของ Web/Admin |
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
