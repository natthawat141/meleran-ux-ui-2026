# Provisional API Mock (Flow A–H)

สถานะ: **Mock สำหรับ dev/test เท่านั้น** ไม่ใช่ API contract ไม่ใช่ Backend และไม่ใช่หลักฐานว่าระบบหลังบ้านพร้อมแล้ว

ที่อยู่: `tools/provisional-api/` (ไม่อยู่ใน `apps/` หรือ `packages/` และไม่ถูก import จาก runtime ของแอป) ข้อมูลเริ่มต้นเป็นข้อมูลสมมติทั้งหมด

## 1. ขอบเขตและกติกา

- ธุรกิจยึด `MELEARN_V1_SCOPE.md` Final 1.6; รูปแบบ API (path, field, error, pagination, Money) ยึด [R4a Draft](API_CONTRACT_R4A_DRAFT_TH.md) ซึ่งเป็น **[ข้อเสนอ]** ที่ Backend ยังไม่ยืนยัน
- ใช้ได้เฉพาะ environment `development`/`test` (ถ้าเรียกใน environment อื่นจะ throw) ทุก response มี header `x-melearn-mock: provisional-api`
- ไม่ใช่ fallback: โค้ดแอปห้าม import mock และห้ามสลับไปใช้เมื่อ API จริงล้มเหลว (มี test คุม)
- มี Frontend OpenAPI Draft และ generated HTTP DTO ใน `packages/contracts`; ยังไม่ freeze กับ Backend
- เป็น server จำลองใน memory แบบ fetch-compatible: เสียบเข้า `createHttpClient({ fetcher })` ของ `@melearn/api-client` ได้โดยไม่แก้ client
- Deterministic: นาฬิกาและ id ถูกฉีดได้ (ไม่มี `Math.random`, `Date.now`, `process.env`, network ใน mock) ทำให้ test ซ้ำได้
- session ของ `createFetcher()` แยก cookie jar ต่อ caller; dev HTTP server รับ/ส่ง cookie ของ browser และแยกชื่อ cookie Web/Admin (`x-melearn-app`) เพื่อให้สอง Vite app ใช้ session คนละชุด; Base path ใน test คือ `/mock-api/v1`

วิธีใช้ (ใน test):

```js
import { createWorld, accounts } from './support/provisional-api.mjs';
const world = createWorld();
const learner = world.browser();
await learner.login(accounts.learner);
const response = await learner.post('courses/crs_mock_002/enroll');
```

OpenAPI ตรวจ mapping ของ route arrays ครบ; dev Stripe simulator ไม่ใช่ Backend contract. Mock ตรวจ session audience เทียบ app header และ Login audience mismatch แล้ว; provider OAuth/webhook ยังคงเป็น fake. ดู [schema/examples](../packages/contracts/openapi/openapi.json).

## 2. Routes ที่มี (91 operations: 86 Draft + 5 provider-deferred)

| Flow | จำนวน | Routes |
| --- | --- | --- |
| A Auth | 17 | `POST auth/register`, `auth/verify-email`, `auth/resend-verification-email`, `auth/login`, `auth/logout`, `auth/password-reset/request`, `auth/password-reset/confirm`; `GET auth/google/start`, `auth/google/callback`; `POST me/auth-identities/google`; `GET me/auth-identities/google/callback`; `GET/PATCH me`; `POST admin/users`, `admin/users/:id/instructor`; ข้อเสนอเพิ่ม `GET admin/users`, `admin/instructors` |
| B Catalog/Enrollment | 4 | `GET courses`, `courses/:id`, `me/enrollments`; `POST courses/:id/enroll` |
| C Learning/Progress | 5 | `GET learn/courses/:id`, `learn/courses/:id/items/:item_id`, `me/progress`; `POST learn/items/:id/complete`; `PUT learn/items/:id/resume` |
| D Quiz/Grading/Certificate | 10 | `POST learn/items/:id/attempts`; `PUT learn/attempts/:id/answers`; `POST learn/attempts/:id/submit`; `GET learn/attempts/:id`, `learn/items/:id/results`; `GET instructor/grading-queue`; `PUT instructor/attempts/:id/questions/:question_id/grade`; `GET me/certificates`, `me/certificates/:id`, `me/certificates/:id/download` |
| E Authoring/Review | 14 | `POST instructor/courses`, `admin/courses`; `GET instructor/courses`, `admin/courses`, `courses/:id/authoring`, `courses/:id/authoring-preview`; `PATCH courses/:id`; `POST courses/:id/videos/uploads` (503), `courses/:id/submit-review`, `courses/:id/publish`; `GET admin/course-reviews`, `admin/course-reviews/:id`; `POST admin/course-reviews/:id/approve`, `.../return` |
| F Stripe/Redeem | 8 | `POST me/payments/checkout`; `GET me/payments/:id`; `POST webhooks/stripe`; `GET admin/payments/:id`; `POST me/redeem`; `POST/GET admin/redeem-codes`; `POST admin/redeem-codes/:id/revoke` |
| G AI | 11 | `PATCH admin/courses/:id/ai-support`; `GET/PUT admin/courses/:id/videos/:itemId/ai-transcript`; `POST/GET me/ai/conversations`; `GET me/ai/conversations/:id/messages`; `PATCH/DELETE me/ai/conversations/:id`; `GET me/ai/usage`; `POST me/ai/conversations/:id/messages`; `PUT .../messages/:messageId/practice/answers` |
| H Blog | 7 | `GET blog`, `blog/:slug`; `GET/POST admin/blog`; `PATCH admin/blog/:id`; `GET admin/blog/:id/preview`; `POST admin/blog/:id/publish` |

ตัวจำลอง Stripe (`api.stripe`: `completed`, `asyncSucceeded`, `asyncFailed`, `expired`, `sign`, `failNextFulfilment`) ใช้ใน test เพื่อส่ง webhook ที่เซ็นแล้ว; ไม่มี Stripe จริง

สำหรับ browser QA ใน `development` เท่านั้น มี `POST dev/mock-stripe/payments/:id/complete` ฝั่ง Web: ตรวจว่าเป็นผู้ซื้อเจ้าของ Payment ที่ยัง pending/processing แล้วสร้าง signed mock event และส่งผ่าน Stripe webhook handler ปกติ; Admin ใช้ไม่ได้. Route นี้ไม่ถูกติดตั้งใน `test` และ mock API ปฏิเสธการสร้างใน `production`; มันไม่ใช่ route หรือ contract สำหรับ Backend จริง.

บัญชีและข้อมูลตัวอย่างอยู่ใน `tools/provisional-api/seed.ts` (รหัสผ่านสมมติเดียวกันทุกบัญชี) ห้ามนำไปใช้เป็นข้อมูลจริง

## 3. กติกาธุรกิจที่ mock บังคับ (จาก Scope Final 1.6)

- คอร์สสาธารณะ/รายการ/detail เห็นเฉพาะ Published; Draft, Pending, Approved ตอบ 404 เหมือนไม่มีอยู่; Outline สาธารณะไม่มี video URL, เนื้อหา, เฉลย, หมายเหตุรีวิว
- Admin approve/return; owner Instructor หรือ Admin Publish ได้หลัง current approval; Instructor ส่งรีวิวได้เฉพาะคอร์สตัวเอง; แก้ระหว่างรอรีวิวทำให้รีวิวเก่า stale (approve ไม่ได้); คอร์ส Published แก้แล้วมีผลทันที
- สมัครเรียน: ฟรีเท่านั้นผ่าน `enroll`; คอร์สเสียเงินต้อง Stripe หรือ Redeem; หนึ่ง Enrollment ต่อ (ผู้ใช้, คอร์ส); Admin และเจ้าของคอร์สสมัครไม่ได้; self-email signup ต้องยืนยันอีเมลก่อน, บัญชี Admin-created ได้ตาม eligibility ของ server
- Progress = รายการที่เรียนจบ ÷ รายการปัจจุบัน ไม่ปัดขึ้น; Quiz ผ่านเมื่อคะแนน **มากกว่า** 70% (เท่ากับ 70% ไม่ผ่าน คำนวณแบบจำนวนเต็ม); ใช้ attempt ที่ตรวจแล้วสูงสุด ไม่ลดจากครั้งหลัง; snapshot ข้อสอบถูกล็อกตั้งแต่เริ่มทำ; ข้อเขียนต้อง Instructor เจ้าของตรวจ
- เรียนครบ 100% → สร้าง snapshot และใบรับรองเดียวต่อ Enrollment; เพิ่มเนื้อหาภายหลังไม่ทำให้คอร์สที่จบแล้วถอยกลับ
- Stripe: Checkout ไม่ให้สิทธิ์; มีเฉพาะ webhook ที่เซ็นถูกต้องที่ให้สิทธิ์; idempotent ตาม `event_id`; fulfilment ที่ล้มเหลวลองใหม่ได้; หน้า status อ่านอย่างเดียว
- Redeem: โค้ดใช้ครั้งเดียว; ไม่ว่าโค้ดไม่มี/ใช้แล้ว/ถูกเพิกถอน ตอบเหมือนกัน (ไม่เปิดเผยว่ามีอยู่) และหนึ่งโค้ดมีผู้ชนะเดียว
- AI: 20 prompts สำเร็จต่อวันตามเวลา Bangkok พร้อม reservation; idempotent ด้วย `request_id` (replay ไม่หักโควตา); โจทย์ฝึกซ่อนเฉลยจนกว่าจะตอบ; การตอบฝึกไม่สร้าง Attempt และไม่เสียโควตา; Admin เท่านั้นที่เปิดใช้ AI และจัดการ transcript; transcript ไม่ออกทาง route อื่นใดนอก Admin route
- Upload Video ตอบ 503 `video_upload_not_available` (ผู้ใช้ยืนยันว่ายังไม่เปิดใน V1); วิดีโอใช้ URL
- `Enrollment.source` คือ `free | stripe | redeem`

## 4. สถานะต่อ flow: mock / draft / รอ Backend

| Flow | Mock | Draft (ข้อเสนอ) | รอ Backend |
| --- | --- | --- | --- |
| A | server, cookie jar, outbox อีเมลสมมติ, Google จำลองด้วย `mock_google_*` | cookie session, login แยก audience, error code, ระยะลิงก์ 24 ชม./60 นาที, cooldown 60 วินาที | session/CSRF จริง, นโยบายรหัสผ่าน, rate limit, Google OAuth จริง, อีเมลจริง (Resend) |
| B | catalog/enroll/me | query, cursor, Money, enrollment DTO | ลำดับ/ขนาดหน้า, field สาธารณะ, ใช้ id หรือ slug |
| C/D | learn, progress, attempt, grading, certificate | รูป attempt/answer, JSON stand-in ของใบรับรอง | รูปไฟล์ใบรับรองจริง, นโยบายแก้คะแนน, การล็อก concurrent attempt |
| E/H | authoring, review, blog | `expected_revision`, chapters แทนที่ทั้งชุด, สถานะรีวิว | semantics อัปเดตหลักสูตรแบบ nested, slug policy |
| F | checkout, webhook, redeem, ตัวจำลอง Stripe | event→สถานะ, path redeem/admin | event mapping จริง, retry, race ของ redeem |
| G | ผู้ช่วย AI แบบ deterministic | quota/reservation, รูป practice | ผู้ให้บริการ AI, ล็อกโควตา, retention ของ transcript |

## 5. สมมติฐานที่ใช้เฉพาะใน mock

**Flow A**: สมัครแล้วไม่สร้าง session; ลิงก์ยืนยันที่ใช้แล้วตอบ 200 `already_verified`, หมดอายุ 410; resend รับ session หรือ `{email}` และตอบ 202 เสมอ; รหัสผ่าน ≥ 8 ตัว; รีเซ็ตรหัสผ่านปิดทุก session; Admin เป็น Instructor ไม่ได้ (409 `admin_account`); `GET admin/users` และ `GET admin/instructors` เป็นข้อเสนอที่ไม่อยู่ใน Scope ชัดเจน

**Flow B**: ค้นหาด้วย id เท่านั้น; `limit` นอกช่วง → 422; query ที่ไม่รู้จัก/ซ้ำ → 422; cursor opaque (`o:<n>`); Admin และเจ้าของคอร์ส → 403 `enrollment_not_allowed`

**Flow C/D**: ตรวจข้อเขียนเฉพาะ Instructor เจ้าของ (Admin 403); ดาวน์โหลดใบรับรองเป็น JSON `{filename, content_type: 'text/plain', content}`; ข้อเลือกหลายคำตอบให้คะแนนแบบถูกทั้งหมด; ไม่มีการแก้คะแนนหลังตรวจ; ทำซ้ำเมื่อมี attempt ค้างอยู่จะได้ attempt เดิม

**Flow E/H**: chapters แทนที่ทั้งชุดโดย server สร้าง id; ต้องส่ง `expected_revision`; แก้คอร์ส Approved/Pending → กลับเป็น Draft (รีวิว Pending → stale); field ที่ server เป็นเจ้าของ (`status`, `ai_enabled`, `revision` ฯลฯ) ส่งมาจะ 422; รายการคอร์สของผู้เขียนมีเฉพาะของตน; มุมมองผู้เขียนเห็นแค่ flag `has_ai_transcript` ไม่เห็นเนื้อ transcript; slug บล็อกที่ Publish แล้วเปลี่ยนไม่ได้

**Flow F**: (ผู้ใช้, `request_id`) เดียวกันได้ payment เดิม (200); `request_id` ต่างกันสร้าง payment ใหม่ (ประเด็นจ่ายซ้ำให้ Backend ตัดสิน); Redeem ของคอร์สตัวเองยังบอกเหตุผล (เพราะผู้ใช้รู้โค้ดอยู่แล้ว)

**Flow G**: AI ตอบ deterministic แบบ synchronous; Admin และ Instructor เจ้าของแนบคอร์ส AI-enabled ที่ Published ได้; แหล่งความรู้นับจากคำอธิบายคอร์ส + บทความที่ไม่ว่าง + transcript ที่บันทึก; ทดสอบความล้มเหลวด้วย marker `__mock_ai_fail__` และ `__mock_ai_malformed_practice__`

## 6. คำถามสำหรับ Backend owner

1. Session: ผู้ใช้ยืนยัน Login/session Web/Admin แยกกันแล้ว; cookie/token transport, SameSite, CSRF, อายุ session และ deployment attributes ยังรอ Backend
2. นโยบายรหัสผ่านและ rate limit ของ login, สมัคร, ส่งอีเมลซ้ำ, รีเซ็ตรหัสผ่าน (รูป 429 และ `Retry-After`)
3. Google OAuth: การจับคู่บัญชีเดิม, การลิงก์/ยกเลิกลิงก์, ข้อมูลที่รับกลับมา
4. สิทธิ์ที่ยังขัดกัน: ใครดู/แก้รายการผู้ใช้และ Instructor ได้ (ข้อเสนอ `GET admin/users`)
5. Pagination จริง (cursor/page), ลำดับ default, ขนาดสูงสุด, การค้นหาภาษาไทย
6. Public field visibility และ id กับ slug
7. Nested curriculum: แทนที่ทั้งชุดหรือ patch ทีละระดับ; การแก้คอร์สหลัง Approved/Published ที่ต้องรีวิวซ้ำหรือไม่
8. นโยบายแก้คะแนนหลังตรวจ และการแข่งกันของ attempt
9. รูปแบบไฟล์ใบรับรองจริง (PDF/รูป) และวิธีดาวน์โหลด
10. Stripe: event mapping, retry/ordering ของ webhook, การ refund, `request_id` ต่างกันแต่คอร์สเดียวกัน (จ่ายซ้ำ)
11. Redeem: path จริง, การแข่งกันของโค้ดเดียว, ระยะเวลาโค้ด, การเพิกถอนหลังใช้
12. AI: ผู้ให้บริการ, การล็อกโควตา/reservation, retention ของ conversation และ transcript, ขนาด transcript สูงสุด
13. Video: เมื่อเปิด Upload ในอนาคต path และสถานะ processing
14. Request id ใน error และรูปแบบ timestamp (UTC ISO 8601)

## 7. สิ่งที่ตรวจแล้ว

ณ 8 ตุลาคม 2026 ชุดเต็ม `npm.cmd test` ผ่าน 175/175 tests. Tests ของ provisional API ครอบ auth, boundaries, integration, learning, payments, authoring, AI, catalog และ dev server; จำนวน test เปลี่ยนได้ตามการพัฒนา ให้ใช้ผลคำสั่งล่าสุดเป็นหลัก

- integration คุมการทำงานข้าม flow: คอร์สฟรี (enroll → เรียน → ผ่านควิซ → จบครั้งเดียว → ใบรับรองเดียว), attempt สูงสุดตัดสิน, คอร์สเสียเงิน (checkout ไม่ให้สิทธิ์, webhook เท่านั้น), redeem ไม่รั่วและมีผู้ชนะเดียว, response ฝั่งผู้เรียนไม่มีเฉลย/หมายเหตุ/transcript, authoring→catalog (สาธารณะหลัง Admin publish เท่านั้น), AI quota/transcript, blog
- boundary คุม: environment guard, ไม่มี reference จาก `apps/`/`packages/`, ไม่มี `Math.random`/`Date.now`/`process.env`/network ใน mock, `@melearn/api-client` ไม่รู้จัก mock
- ทุก test ตรวจ `unexpectedErrors` ของ mock ว่าเป็นศูนย์ (500 `mock_internal_error` หมายถึงบั๊กใน mock)

ข้อจำกัด: test พิสูจน์ว่า mock สอดคล้องกันเองและกับ Scope เท่านั้น ไม่พิสูจน์ว่า Backend จริงจะตอบเหมือนกัน

## 8. สถานะ Frontend integration — 9 ต.ค. 2026

Web/Admin ใช้ app-owned HTTP client และ Query ทั้ง Authoring, Instructor management/grading, Admin management/review และ Blog editor รวมกับ Auth/Catalog/Learning/Payment/Redeem/AI ที่ย้ายก่อนหน้า. `packages/store` และ browser business persistence ถอนแล้ว; API failure ไม่ fallback ไป snapshot. Build default remote, dev default mock.

Draft wire DTO และตัวอย่าง request/response/validation/error อยู่ [API Contract Draft](API_CONTRACT_R4A_DRAFT_TH.md); Backend ยังไม่ freeze. ดู [progress/ข้อจำกัด/หลักฐาน](R7_API_MOCK_PROGRESS_TH.md). Mock ไม่ส่ง global LmsData snapshot; resources แยก scope/owner และ public fields.

Dev server default 8787; Vite รับ `MELEARN_MOCK_PORT` สำหรับ isolated preview. Standalone รับ port ผ่าน CLI argument. ข้อมูล/session/history อยู่ใน memory และหายเมื่อ restart. ไม่มี real Google/email/Stripe/AI/media services หรือ durable database; production containers ไม่รวม mock server.

Browser หลักฐานรอบก่อนอ้าง revision เก่า. รอบ migration ล่าสุดเปิด preview ถูก ERR_BLOCKED_BY_CLIENT จึงยังไม่ผ่าน interactive UI acceptance. R10/R13 real integration gates ยังเปิด.
