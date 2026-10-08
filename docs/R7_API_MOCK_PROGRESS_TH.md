# R7–R10 progress — provisional API integration

อัปเดต 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## สถานะ

R7–R9 มี app-owned Web/Admin pages, feature API adapters และ TanStack Query hooks สำหรับ provisional in-memory API ใน `vite dev`; ตรวจ authenticated R7 learning/quiz/grading/certificate และ R8 checkout→webhook mock จาก Browser แล้ว. R10 เดินได้เป็น automated และ browser mock integration บาง journey แต่ยังปิดไม่ได้เพราะไม่มี Backend/OpenAPI. ทุก feature ยังเป็น `prototype`; production build ใช้ implementation เดิมและไม่เรียก mock. ไม่มีการประกาศว่า R4a contract frozen, Backend พร้อม หรือ Production ใช้งานได้.

## สิ่งที่ย้าย/ต่อแล้ว

### R4b-prep / Auth / Catalog

- Web Landing, public Catalog และรายละเอียดคอร์สอ่านชุดข้อมูลเดียวจาก mock; signed-in users อยู่บน `/courses` แทน legacy `/explore` ใน dev. Guest course detail เปิดได้โดยไม่ถูก legacy demo session ส่งเข้า Login
- Web/Admin Login, `GET /me`, logout และ cookie แยก app ใช้ provisional API; ตรวจ HTTP session ด้วย cookie jar เดียวแล้วได้ `usr_learner`/`learner` และ `usr_admin`/`admin` แยกกัน
- Web free enrollment และ My Courses ใช้ Enrollment API; paid checkout ต่อ R8
- TanStack Query providers/cache แยกตาม app และ clear เมื่อเปลี่ยนบัญชี

### R7 — Learning / assessment / certificate

- Web My Courses, outline/lesson, resume/complete, quiz attempt/save/submit/result, Instructor grading queue และ certificates เรียก feature APIs/query hooks
- Mock integration tests ครอบ view ไม่สร้าง progress, resume, immutable submitted answers, exact 70% ไม่ผ่าน/71% ผ่าน, highest graded attempt, essay pending/owner-only grading, completion snapshot และออก certificate ครั้งเดียว
- Production routes คงหน้าเดิม; mock routes เปิดใน development เท่านั้น

### R8 — Payment / Redeem

- Web checkout เริ่ม mock Payment และหน้า result อ่าน status; ไม่ redirect ไป `checkout_url` และไม่เปิดสิทธิ์จาก URL กลับมาเอง. Development มีปุ่มจำลอง signed Stripe event ผ่าน webhook handler ปกติ เพื่อพิสูจน์ flow ใน mock เท่านั้น
- Web redeem ใช้ API; Admin สร้าง/ค้น/ยกเลิกรหัส โดยแสดงรหัสเต็มเฉพาะรอบสร้างและปกปิดย้อนหลัง
- Admin Payment lookup อ่านทีละ Payment ID พร้อม status, fulfillment, amount และ webhook events; ไม่มีรายการทั้งหมดหรือคำสั่ง refund
- Mock ปฏิเสธการเริ่ม Checkout/ออกโค้ดขายสำหรับคอร์สฟรี; integration tests ครอบ signed webhook simulator เท่านั้น, idempotency, fulfillment และ redeem race

### R9 — AI / Transcript / AIPractice

- Web chat รองรับสร้าง/ค้น/เปลี่ยนชื่อ/ลบ conversation, เลือก context ที่มีสิทธิ์, usage, ส่ง prompt และตอบชุดฝึกในแชต
- Admin เปิด/ปิด AI ต่อคอร์สและแก้ Transcript วิดีโอผ่าน API; ข้อมูลเป็น in-memory mock
- Tests ครอบ context authorization, history ownership, quota/day boundary/dedupe/failure และการไม่ส่งเฉลยก่อนตอบ/ไม่กระทบ Progress; ข้อความ AI ที่หน้าแสดงเป็น deterministic mock

## R10 และข้อจำกัดที่ยังเปิด

- Automated tests วิ่ง cross-flow บน provisional server ครอบ Auth/Catalog/Enrollment/Learning/Assessment/Certificate/Payment/Redeem/AI/Authoring/Blog/Admin rules; `npm.cmd test` ผ่าน 175/175
- Browser authenticated R7 journey: สมัครคอร์สฟรี → เรียนวิดีโอและบันทึกตำแหน่ง/ทำเสร็จ → ทำแบบทดสอบและได้ผล 4/4 หลัง Instructor เจ้าของคอร์สให้คะแนนข้อเขียน → ทำบทอ่านเสร็จ → หน้าเรียนยืนยัน 3/3, 100% และเปิดใบรับรอง `cert_0002`
- Browser authenticated R8 journey: Learner สร้าง Payment ของคอร์สเสียเงิน `crs_mock_002` → ปุ่มพัฒนาเรียก signed mock event → หน้า Payment แสดงชำระสำเร็จ/เปิดสิทธิ์และเข้าเรียนได้; Admin ค้น `pay_0001` แล้วเห็น `succeeded`, `granted`, enrollment และ event `checkout.session.completed`
- Browser checks เพิ่มเติม: URL รายละเอียดคอร์สแบบ slug ที่มีอยู่เดิม resolve ผ่าน public catalog list แล้วโหลดรายละเอียดด้วย id; Admin grading queue แสดงคำตอบเฉพาะคอร์สที่ตนเป็นเจ้าของและคิวหายหลังให้คะแนน
- Local HTTP smoke ยืนยัน Catalog 3 รายการ และ Web/Admin sessions แยกกันเมื่อใช้ mock server เดียว
- R10 **ยังไม่สมบูรณ์**: ไม่มี Backend owner/OpenAPI, database, Stripe credentials/webhook runtime หรือ AI provider; จึงไม่มีหลักฐาน persistence ข้าม session/device หรือ authorization จาก server จริง
- `R4a` ยัง Draft; DTO ของ mock ไม่ถูกนำไปใส่ `packages/contracts` และต้อง freeze กับ Backend ต่อ flow
- Auth register/verification/reset/Google, Admin business APIs, Course Authoring และ `/explore` ยังเป็น local/demo flows
- Mock server เก็บข้อมูลใน memory; restart แล้ว Payment/Enrollment/Progress/Attempt/Certificate/AI history/transcript หาย
- ยังไม่ได้ browser-interact ครบทุก flow: AI chat/practice, redeem, Admin สร้าง/เพิกถอน code และแก้ Transcript ยังต้องตรวจ; responsive/accessibility matrix ยังเปิด. Video URL ใน seed เป็น placeholder ที่ YouTube แจ้ง unavailable แต่หน้า progress/resume/complete ทำงานกับ mock ได้; ไม่ถือเป็นการตรวจสื่อจริง
- ไม่ถอน legacy fallback เพราะยังเป็นเส้นทาง production prototype; R10 cleanup รอ real API replacement
- R7–R10 flow validation ในรายงานนี้ไม่ได้รัน Docker; R11 container build/runtime verification ทำภายหลังแล้ว ดู [รายงาน R11](archive/reports/R11_CONTAINER_VERIFICATION_TH.md)

## การตรวจล่าสุด

- `npm.cmd run typecheck` ผ่าน Web/Admin/legacy
- `npm.cmd test` ผ่าน 175/175
- `npm.cmd run check:boundaries` ผ่าน
- `npm.cmd run build` และ token check ผ่านทั้ง Web/Admin; มี warnings `use client` ของ dependencies และ chunk เกิน 500 kB
- Browser smoke ผ่าน Web Landing/Guest course detail; authenticated R7 free-enrollment→assessment→grading→certificate และ R8 checkout→signed mock webhook→enrollment + Admin Payment lookup ผ่านบน Vite dev/mock ที่ viewport ปกติ. AI/redeem/transcript interactions, responsive/accessibility matrix, real Stripe/Backend persistence และ production authorization ยังไม่ผ่านการยืนยัน

## ขั้นตอน dev

- Web: `npm run dev:web`; ตัวอย่าง learner `learner@example.test` / `mock-password-1`, instructor `instructor-a@example.test` / `mock-password-1`
- Admin: `npm run dev:admin`; ตัวอย่าง admin `admin` / `mock-password-1`
- Web `http://127.0.0.1:5173/`, Admin `http://127.0.0.1:5174/`; mock server อยู่ใน memory ที่ `127.0.0.1:8787`. Login, Enrollment, Payment, progress และ AI เป็นข้อมูลจำลองเฉพาะเครื่อง

## สิ่งที่ต้องมีเพื่อปิด R10

Backend owner และ OpenAPI/contract ที่ยืนยันร่วมกัน, API environment/database, session/permission enforcement, durable Enrollment/Progress/Payment/Certificate/AI data, Stripe test-mode Checkout และ signature-verified webhook, AI provider/quota/history, แล้วจึงทำ authenticated browser acceptance และถอน legacy fallback ทีละ flow. ก่อนครบรายการเหล่านี้ R7–R9 เป็น mock/code gates เท่านั้นและ R10 ต้องแสดงสถานะ partial.
