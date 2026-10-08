# R4b Auth/Catalog + R7 progress — provisional API

อัปเดต 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## สถานะ

เชื่อม flow ที่ย้ายแล้วเข้ากับ in-memory provisional API เฉพาะ `vite dev` เพื่อเตรียม UI และ API seams ระหว่างรอ Backend ไม่มีการประกาศว่า R4a contract frozen, Backend พร้อม หรือ Production ใช้งานได้

## สิ่งที่ย้าย/ต่อแล้ว

- แก้ `price: null` สำหรับคอร์สฟรีในเอกสารให้ตรง mock/decoder
- Web Landing, `/courses` และรายละเอียดคอร์สใช้ Catalog API ชุดเดียวใน dev; URL จาก Landing ส่ง course ID ที่ API รองรับ
- Login ของ Web/Admin ใช้ `POST /auth/login`; เปิดแอปใหม่ตรวจ `GET /me`; ออกจากระบบใช้ `POST /auth/logout`
- Dev HTTP server forward cookie จาก browser; Web/Admin ใช้ชื่อ cookie แยกกันเพื่อไม่เขียนทับ session เมื่อรันบน `localhost` ports ต่างกัน
- Admin Vite มี proxy และเปิด provisional server ได้เอง
- เพิ่ม TanStack Query providers แยก app; sign in/out ล้าง cache ของ app นั้น
- Web free enrollment ต่อ `POST /courses/{id}/enroll`, และหน้าคอร์สของฉันอ่าน `GET /me/enrollments`; ผู้สอนลงคอร์สตนเองและ Admin ถูกปฏิเสธตาม mock rules; paid course ยังรอ R8
- R7 Web routes สำหรับ enrolled-course list, course outline, lesson content, complete/resume, quiz attempt/save/submit/result และ certificates ใช้ Query hooks
- Instructor `/teach/reviews` อ่าน queue จาก API และให้คะแนน essay/image เฉพาะคอร์สของผู้สอน
- R7 API pages เปิดใน dev เท่านั้น; production build คง local prototype pages จน backend integration พร้อม

## สถานะงานที่ยังไม่ครบ

- `R4a` ยัง Draft: ไม่มี Backend owner/OpenAPI ยืนยัน DTO, session policy, public fields, Money, pagination และ error codes
- Auth register, verification/reset, Google OAuth, Admin business APIs และ `/explore` ยังไม่ย้าย
- Authoring, Payment/Redeem, AI/Transcript ยังไม่ย้าย; คงไว้ในเฟส R6/R8/R9 ตามแผน
- Provisional server เก็บข้อมูลใน memory; restart แล้วข้อมูลหาย ไม่ใช่ persistence หลายเครื่อง
- ยังต้องเปิด Web/Admin browser จริงและตรวจ login, cookies, free enrollment, lesson/resume, quiz auto/manual grade, certificate, cross-user denial และ responsive states
- Docker ไม่ได้รันตามคำสั่งผู้ใช้

## ขอบเขตการตรวจรอบนี้

- `npm run typecheck` ผ่านครบ Web/Admin/legacy
- `npm run check:boundaries` ผ่าน
- `npm run build` ผ่านทั้ง Web และ Admin; มีคำเตือน dependency `use client` และ chunk ขนาดเกิน 500 kB ตามเดิม
- ไม่ได้รันชุด tests หรือ browser end-to-end ใน checkpoint นี้; รายงานนี้ไม่กล่าวอ้างว่า functional acceptance ผ่าน

## ขั้นตอน dev

- Web: `npm run dev:web`; ตัวอย่าง learner `learner@example.test` / `mock-password-1`, instructor `instructor-a@example.test` / `mock-password-1`
- Admin: `npm run dev:admin`; ตัวอย่าง admin `admin` / `mock-password-1`
- server อยู่ใน memory ที่ `127.0.0.1:8787`; login, enrollment และ progress เป็นข้อมูลสมมติในเครื่องเท่านั้น

## ขั้นต่อไปของ R7

ตรวจ UI flows ใน browser และแก้สิ่งที่พบ จากนั้นปิด acceptance matrix ตาม Final 1.6 สำหรับ progress/completion snapshot, >70% pass threshold, highest graded attempt, pending essays, owner-only grading, certificate uniqueness และ resume; แยกผลที่ยืนยันได้จาก mock ออกจาก backend evidence ทุกข้อ
