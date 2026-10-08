# R7–R10 — Frontend/API mock progress

อัปเดต 9 ตุลาคม 2026 · `refactor/v1-api-ready` · ใช้ Final 1.6

สถานะ: **แก้ Auth/Profile และ DTO/config ที่ตรวจพบแล้ว แต่การถอน business localStorage ยังไม่ครบ**. ไม่มี Backend/OpenAPI จริง; Draft DTO ใช้พัฒนาและตรวจ mock ได้ตามคำสั่งผู้ใช้ ไม่ต้องรอ Backend เพื่อเริ่ม Frontend. การย้ายไฟล์/root `src` sunset ไม่ใช่การย้าย business state เสร็จ.

## ชุดแก้ล่าสุด

| ประเด็น | ผลปัจจุบัน | ขอบเขตที่ยังไม่เสร็จ |
| --- | --- | --- |
| Login → Profile ว่าง | Web/Admin อ่าน identity จาก API session เท่านั้น; Profile อ่าน `GET /me`, บันทึก `PATCH /me` และ refresh session; ไม่มี fallback ไป user ของ store; learner route ใช้ learning_eligible จาก server จึงไม่บังคับบัญชี Admin-created ที่ไม่มีอีเมลไปยืนยันอีเมล | Google OAuth/Media upload จริงยังไม่มี; Profile รองรับ URL รูปภาพ |
| DTO ไม่ตรง payload | Login ใช้ identifier/password/audience; CurrentUser nullable username/email/avatar, origin ที่ตรง mock และ profile object; Catalog nullable fields; direct error/success envelope; API response types ของ Learning/Assessment/Certificate/Payment/Redeem/AI/Admin อยู่ใน `packages/contracts/src/http-responses.ts` และ feature ใช้ aliases | DTO ยัง Draft; legacy/UI models ใน contracts ยังต้องถอนหลัง migrate ทุก consumer; ยังไม่มี strict decoder/typed requests ครบทุก operation หรือ OpenAPI |
| ข้อมูลหลายแหล่ง | Catalog, Landing course collection และ `/explore` ใช้ API ชุดเดียว; Public Blog/Landing articles ใช้ paginated API; Auth/Profile/learner flows ไม่ mount prototype provider; Admin Redeem/Payment/AI ใช้ API ในทุก build ไม่ fallback local page | Authoring/Instructor/Admin management/Admin Blog editor ยังใช้ `packages/store`/localStorage และไม่ได้แชร์ข้อมูลกับ API mock |
| Docker อ้าง src ที่ลบแล้ว | ถอด COPY src, ใส่ workspace manifests course-authoring/store ก่อน npm ci, build arguments สำหรับ API mode/base URL; runtime COPY เฉพาะ dist ของ app; API/mock paths ตอบ 404 แทน SPA HTML | ตรวจ Dockerfile/build context แบบ static ผ่าน; **ยังไม่ได้ build/run Docker ใหม่** เพราะ Docker daemon ติดต่อไม่ได้. รายงาน R11 เดิมอ้าง revision เก่า |

Profile update ไม่รับ roles/email_verified/OAuth state; mock ตรวจ username unique และวันเกิดก่อน mutation. ค่า certificateName/ชื่อจริงถูก snapshot ตอนออกใบรับรองครั้งแรก; แก้ profile ภายหลังไม่เปลี่ยนใบรับรองเก่า. Tests นี้พิสูจน์ in-memory server behavior เท่านั้น.

Public Blog เก็บ URL เดิม `/articles/:id`: list หา id/slug ก่อนขอ detail ด้วย slug และไม่เปิด Draft. Category/author/rich document metadata ยังไม่มีใน DTO ของ mock ปัจจุบัน; UI ใช้หมวดทั่วไปและ plain content, เวลาอ่านเป็นค่าประมาณ. ต้องเพิ่ม Draft fields/renderer acceptance เมื่อย้าย Admin Blog editor เพื่อให้ editor/public อ่านชุดเดียวกัน.

## API configuration

- แต่ละ app มี `src/shared/api/client.ts`/`config.ts`; packages/api-client เป็น transport กลาง ไม่ถือ business/session policy
- `VITE_API_MODE=mock|remote`; default Vite dev ใช้ mock, build ใช้ remote
- `VITE_API_BASE_URL` default mock `/mock-api/v1`, remote `/api/v1`; `VITE_API_CREDENTIALS` default include. เป็น build-time config, เปลี่ยนแล้วต้อง build ใหม่
- API failure แสดง loading/error/guest ตาม HTTP result ไม่ fallback localStorage. ปุ่ม/endpointจำลอง Stripe ถูกจำกัด mock mode
- Nginx ใน frontend container ยังไม่มี backend proxy; /api และ /mock-api คืน 404. ใช้ external base URL หรือเพิ่ม proxy หลังตกลง Backend/CORS/cookie/CSRF
- ทุก feature ยัง prototype ตาม release registry; production gate ไม่ถูกเปลี่ยนเป็น released จากการแก้นี้

## API flows ที่มีอยู่

- R7: My Courses, outline/lesson/resume/complete, attempt/save/submit/result, `/teach/reviews` queue และ certificate ใช้ API/query hooks
- R8: Checkout/Payment status, mock signed webhook, Redeem; Admin code create/search/revoke และ Payment lookup. Real Stripe redirect/webhook/database acceptance ยังเปิด
- R9: AI conversations/messages/context/quota/practice; Admin course AI toggle/transcript ใช้ deterministic mock. ไม่มี AI provider จริง
- ไม่มีการ reset demo data หรือนำ API session ไปเขียนใส่ store. Provider เดิมจำกัดใน `PrototypeDataBoundary` ของแต่ละ app; ไม่ได้ทำให้ข้อมูลเหล่านั้นกลายเป็น server state

## Inventory ของ localStorage ที่ยังต้องย้าย

| App / Route family | Source owner | งานถัดไปและ JSON/operation ที่ต้องเพิ่ม/ยืนยัน |
| --- | --- | --- |
| Web `/teach` และ `/teach/courses/*` | instructors, course-authoring | Course metadata/version, chapters/items/reorder, quiz/options/correct answer references, owner-scoped learners/summary; เพิ่ม runtime decoders และ async save/error/conflict states |
| Web `/teach/quizzes/*/attempts`, `/teach/attempts/*/grade` | instructors/QuizPages | ต่อ assessment API แทน attempts/users ใน store; API queue ปัจจุบันอยู่ `/teach/reviews` เท่านั้น |
| Web `/instructors/:id` | instructors/InstructorProfilePage | Public Instructor detail + published course list; ไม่มี public Instructor detail endpoint ใน mock ปัจจุบัน |
| Admin `/admin`, users/instructors/courses/reviews/learners | management, course-approval, course-authoring | API summaries/account detail/learning history/roster และ review/version operations; ห้ามคำนวณสิทธิ์/คะแนนจาก snapshot localStorage |
| Admin `/admin/articles/*` | blog | ย้าย editor/preview/list ไป Blog API; เพิ่ม category/read-time/rich document และ delete/unpublish ตาม scope; flow ปัจจุบันยังไม่มีครบ |

สิ่งเหล่านี้เป็น Frontend/mock work ที่ค้าง ไม่ใช่ข้ออ้างว่าต้องรอ Backend ทุกข้อ. ปิดได้ด้วย Draft DTO + mock operation + feature adapter/page migration ทีละ flow แล้วค่อยถอน packages/store. ห้ามแก้ด้วยการส่ง LmsData ทั้งก้อนเป็น API snapshot หรือย้าย localStorage ไป memory แล้วเรียกว่า API-ready.

## หลักฐานล่าสุด

- `npm.cmd test`: **191/191 ผ่าน** ครอบ login DTO, Profile refresh/new session, reject privileged fields/invalid DOB/duplicate username, certificate name snapshot, Blog pagination/draft filtering และ provider boundary
- `npm.cmd run typecheck`: Web/Admin/packages ผ่าน
- `npm.cmd run check:boundaries` และ `git diff --check` ผ่าน
- `npm.cmd run build`: Web/Admin ผ่าน; dependency use-client/chunk-size warnings ยังมี
- Browser: Login learner → Profile แสดงข้อมูล → บันทึกชื่อ/ชื่อจริง → refresh ยังอยู่; Admin Login → Profile บันทึกอีกบัญชี → Web ยังเป็นผู้เรียน. ตรวจซ้ำหลังถอด root persistence provider แล้ว Profile ทั้งคู่แสดงข้อมูล
- Browser: `/articles` แสดงสอง Published posts จาก mock, เปิด `/articles/blg_mock_001` แล้วเห็น content ที่ตรง API; Draft ไม่แสดง. ภาพ local proof อยู่ `D:/code/elearn-prod/artifacts/api-session-fix/`
- ยังไม่ได้ browser-interact ทุก R7–R9 flow ใหม่หลังแก้ config; responsive/accessibility matrix, real Google/Stripe/AI, database persistence และ production authorization ยังเปิด

## วิธีรันและขั้นตอนต่อไป

Web `npm run dev:web`, Admin `npm run dev:admin`; mock server memory ที่ 127.0.0.1:8787. Learner `learner@example.test`, Instructor `instructor-a@example.test`, Admin `admin`; รหัส mock `mock-password-1`. Restart mock แล้วข้อมูลธุรกิจจำลองหาย.

ต่อด้วย migration ตาราง localStorage ข้างบนพร้อม Draft JSON ของแต่ละหน้าจอ, ถอน store หลัง consumer เป็นศูนย์, ตรวจ Docker ใหม่เมื่อ daemon พร้อม. R10/R13 ยังไม่ผ่าน Backend/Final acceptance; ห้ามสรุปว่าเหลือแค่เปลี่ยน URL ก็ Production พร้อม.
