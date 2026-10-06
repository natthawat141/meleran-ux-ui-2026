# Feature Release Matrix — Melearn

อัปเดต 6 ตุลาคม 2026 · โครงการ UX prototype · อ้างอิงขอบเขต [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md) Final 1.6

Final 1.6 เป็นแหล่งตัดสิน scope รอบ 1 เดือน ส่วนคู่มือ V3 และ behavior ในต้นแบบเป็นข้อมูลอ้างอิงเมื่อไม่ขัดกับ Final 1.6 เอกสารนี้เทียบ scope ที่ยืนยันกับเส้นทางปัจจุบันใน `src/App.tsx`; การมี route หรือคลิกได้ไม่ใช่หลักฐานว่าฟีเจอร์พร้อมใช้จริง

## ขอบเขตและสถานะ

Phase 1 หมายถึงอยู่ในขอบเขตส่งมอบเดือนแรกที่ยืนยันใน Final 1.6 รวมหน้า public ที่จำเป็นต่อการเข้าถึงคอร์สและ Blog ตามบทบาท ส่วน Later / ยังไม่ทำ หมายถึงอยู่นอก scope เดือนแรก ไม่มีวันที่หรือคำมั่นว่าจะทำในรอบถัดไป ไม่ใช่ลำดับที่อนุมัติให้เริ่มพัฒนา

| Feature key | Feature | Phase / scope | UI | Business Rule | Backend | Runtime | Staging | Production |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `publicSite` | หน้าแรก / เกี่ยวกับ / ประวัติผู้สอน | 1 | Prototype | Approved: หน้าแรกเป็นทางเข้าสาธารณะ; About/Profile ที่เกินจาก public catalog เป็นเนื้อหา prototype ปัจจุบัน | None; browser prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `auth` | บัญชี / Login / Google / ยืนยันและกู้รหัสผ่าน | 1 | Prototype + Demo | Approved: สมัคร/Login, verify link ใช้ครั้งเดียวใน 24 ชม., Google ผูกบัญชีเดิม, สมัครอีเมลต้องยืนยันก่อน Enroll/Redeem/เรียน; บัญชีที่ Admin สร้างเริ่มเรียนได้ทันที | None; browser accounts | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `courseCatalog` | รายการและรายละเอียดคอร์ส Published / Preview | 1 | Prototype | Approved: Guest และสมาชิกดูรายการ/รายละเอียด Published; preview และสิทธิ์เรียนตามสถานะคอร์ส/Enrollment | None; fixtures | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `learning` | Enroll ฟรี / คอร์สของฉัน / วิดีโอ / บทอ่าน / Progress | 1 | Prototype | Approved: Enroll ฟรีหรือ Redeem ก่อนเรียน; วิดีโอ/บทอ่านจบด้วยการกด; เก็บ progress และเรียนต่อ | None; browser enrollment/progress | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `profile` | ข้อมูลบัญชีและการเชื่อมบัญชี | 1 | Prototype | Approved: ดู/แก้ข้อมูลตนเองและเชื่อม Google กับบัญชีเดิม; ห้ามแก้ข้อมูลผู้อื่น | None; browser state | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `instructorOnboarding` | คำขอ/คำเชิญผู้สอน | Later | Prototype / Demo | Approved exclusion: ไม่มีคำขอเป็น Instructor หรือระบบคำเชิญ; Admin เพิ่ม Instructor โดยตรง | None; browser demo | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `instructorCourses` | Authoring / เนื้อหา / Quiz definition / Admin review | 1 | Prototype | Approved: Instructor ดูแลคอร์สตนเอง; ส่งตรวจให้ Admin อนุมัติก่อนเผยแพร่ครั้งแรก; ใช้ YouTube Link ไม่ upload | None; browser mutations | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `assessment` | Quiz / attempts / grading / ผลและ completion | 1 | Prototype | Approved: เก็บ snapshot ตอนเริ่ม, ทำซ้ำได้, ใช้คะแนนสูงสุด, Instructor เจ้าของตรวจข้อเขียน/ภาพ | None; client controlled | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `assignments` | Assignment ที่แยกจากแบบฝึกหัดในคอร์ส | Later | Prototype | Approved exclusion: Assignment แยกจาก Quiz ในคอร์สไม่อยู่ในรอบแรก | None; browser demo | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `certificates` | ออก / แสดง / ตรวจสอบใบรับรอง | 1 | Prototype | Approved: ออกเมื่อ progress ครบและแบบฝึกหัดผ่านตามเกณฑ์; เก็บ completion snapshot เพื่อคงใบเดิม | None; browser state | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `accessCodes` | Redeem / Admin ออกและจัดการ Redeem Code | 1 | Prototype | Approved: Admin ออก/ดู/ยกเลิก Unused; โค้ดผูกคอร์สใช้ครั้งเดียว; ผู้มีสิทธิ์ Redeem ได้ Enrollment | None; browser state | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `payments` | Stripe Checkout / ผลจ่าย / ให้สิทธิ์อัตโนมัติ | 1 | Prototype; เรียก Payment API / อ่านสถานะ Backend | Approved: ให้ Enrollment source stripe จาก Webhook ที่ตรวจแล้วเท่านั้น; Success Page อ่านสถานะ; Redeem ยังเป็นอีกช่องทาง; ไม่มี Cart/Order history แบบเต็ม | None; ไม่มี Stripe API/Webhook จริง | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `commerce` | Cart / Orders / ส่วนลด | Later | Prototype | Approved exclusion: Cart/Order history แบบเต็มและส่วนลดยังไม่ทำ | None; simulated | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `operations` | Admin overview / บัญชี / เพิ่มผู้สอน | 1 | Prototype | Approved: Admin สร้างบัญชี เพิ่ม Instructor จัดการคอร์ส อนุมัติ และออก/ดูโค้ด | None; browser admin actions | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `analytics` | Analytics การเรียนและรายงานธุรกิจ | Later | Prototype | Approved exclusion: ไม่ทำ Business Analytics, Big Data หรือ pipeline วิเคราะห์รอบแรก | None; local read models | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `finance` | รายได้ / ส่วนแบ่ง / การจ่ายเงิน | Later | Prototype | Approved exclusion: ไม่มีส่วนแบ่ง รายงานการเงิน การจ่ายเงิน หรือ Refund | None; demo calculations | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `inbox` | กล่องข้อความและถามผู้สอน | Later | Prototype | Approved exclusion: ไม่ทำ Inbox หรือถามผู้สอนในรอบแรก | None; browser messages | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `blog` | อ่าน Blog / Admin เขียนและเผยแพร่ | 1 | Prototype | Approved: ทุกบทบาทอ่าน Published; Admin เขียน แก้ และเผยแพร่ | None; browser articles | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `aiTeacher` | AI Course Support / Transcript / ประวัติและโควตา | 1 | Demo; ยังไม่เชื่อม AI จริง | Approved: AI Course Support, Transcript, คำสั่งสร้างแบบฝึกหัดในแชต ประวัติ และ 20 prompts สำเร็จ/บัญชี/วันไทย; หน้าวิเคราะห์ Admin ทำภายหลัง | None; local demo | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |

ทุกสถานะ Runtime เริ่มที่ `prototype` เพราะ repository นี้ยังเป็น browser-local prototype ไม่มี Production API, persistence, auth enforcement, payment หรือ server authorization ที่ผ่านตรวจรับ การระบุ Phase 1 บอก scope ที่ยืนยัน ไม่ได้แปลว่า implementation เสร็จหรือเปิดใช้งานจริง

Feature key `accessCodes` แยกจาก `commerce`: รอบแรกมี Redeem และเครื่องมือ Admin จัดการโค้ด และมี `payments` สำหรับซื้อรายคอร์สผ่าน Stripe แล้วได้สิทธิ์ทันที ไม่มีตะกร้า/Order history แบบเต็ม `assignments` แยกจาก `assessment` ตามข้อยกเว้น Assignment ที่อยู่นอก scope

Final 1.6 ไม่ทำ Referral และไม่มี Referral route ใน `App.tsx`; หน้าวิเคราะห์คำถาม AI สำหรับ Admin ก็ยังไม่มี route และไม่ใช่ส่วนของ `aiTeacher` learner flow

## Environment gate

| Runtime status | Local / Preview | Staging | Production |
| --- | --- | --- | --- |
| `prototype` | เปิด | ปิด | ปิด |
| `integration` | เปิด | เปิด | ปิด |
| `released` | เปิด | เปิด | เปิด |
| `disabled` | ปิด | ปิด | ปิด |

`VITE_APP_ENV` รับเฉพาะ `development`, `preview`, `staging`, `production`; ค่าที่ระบุแต่ไม่ถูกต้อง fail closed เป็น `production`. เมื่อไม่ระบุ ค่า dev server เป็น `development`, Vite mode `preview`/`staging` ใช้ตามชื่อ และ non-dev mode อื่นใช้ `production`. ค่า environment ถูกฝังตอน build; ไม่เปลี่ยนจาก query string หรือ localStorage

คำสั่งตรวจ UX prototype:

```powershell
npm.cmd run dev -- --port 5174
npm.cmd run build -- --mode preview
npm.cmd run preview -- --port 4173
```

Build default เป็น production และปิด route ของ prototype ทั้งหมด `/403` และ `*` ยังคงเป็น system fallback ตามเดิม `FeatureRoute` แสดง `NotFoundPage` ก่อน render role guard ของ feature ที่ถูกปิด การ gate route ไม่ปิด inline actions และไม่ใช่ security boundary; ทุก API operation ในระบบจริงยังต้องตรวจ identity, role, ownership, entitlement, state และข้อมูลส่วนตัวฝั่ง server

## Route inventory จาก App.tsx

รายการนี้ต้องมี route/key คู่ตรงกับ `ROUTE_FEATURES` ทุกเส้นทางจริง ส่วน `/403` และ `*` เป็น system fallback ไม่มี Feature key

| Route | Feature key |
| --- | --- |
| `/` | `publicSite` |
| `/about` | `publicSite` |
| `/instructors/:id` | `publicSite` |
| `/login` | `auth` |
| `/register` | `auth` |
| `/verify-email` | `auth` |
| `/forgot-password` | `auth` |
| `/reset-password` | `auth` |
| `/invite/:token` | `instructorOnboarding` |
| `/courses` | `courseCatalog` |
| `/courses/:slug` | `courseCatalog` |
| `/courses/:slug/preview` | `courseCatalog` |
| `/explore/courses` | `courseCatalog` |
| `/explore/courses/:slug` | `courseCatalog` |
| `/articles` | `blog` |
| `/articles/:id` | `blog` |
| `/admin/articles` | `blog` |
| `/admin/articles/new` | `blog` |
| `/admin/articles/:id/edit` | `blog` |
| `/become-instructor` | `instructorOnboarding` |
| `/learn` | `learning` |
| `/learn/courses` | `learning` |
| `/learn/courses/:courseId` | `learning` |
| `/learn/courses/:courseId/videos/:itemId` | `learning` |
| `/learn/courses/:courseId/articles/:itemId` | `learning` |
| `/learn/redeem` | `accessCodes` |
| `/admin/access-codes` | `accessCodes` |
| `/learn/assignments` | `assignments` |
| `/teach/assignments` | `assignments` |
| `/admin/assignments` | `assignments` |
| `/learn/ai` | `aiTeacher` |
| `/learn/inbox` | `inbox` |
| `/teach/inbox` | `inbox` |
| `/admin/inbox` | `inbox` |
| `/learn/courses/:courseId/quizzes/:itemId` | `assessment` |
| `/learn/quizzes/:quizId` | `assessment` |
| `/learn/attempts/:attemptId` | `assessment` |
| `/learn/attempts/:attemptId/result` | `assessment` |
| `/teach/reviews` | `assessment` |
| `/teach/quizzes/:quizId/attempts` | `assessment` |
| `/teach/attempts/:attemptId/grade` | `assessment` |
| `/teach/courses/:courseId/quizzes` | `instructorCourses` |
| `/teach/quizzes` | `instructorCourses` |
| `/teach/quizzes/:quizId` | `instructorCourses` |
| `/teach` | `instructorCourses` |
| `/teach/courses` | `instructorCourses` |
| `/teach/courses/new` | `instructorCourses` |
| `/teach/courses/:courseId` | `instructorCourses` |
| `/teach/courses/:courseId/settings` | `instructorCourses` |
| `/teach/courses/:courseId/curriculum` | `instructorCourses` |
| `/teach/courses/:courseId/chapters/:chapterId` | `instructorCourses` |
| `/teach/courses/:courseId/videos/:itemId` | `instructorCourses` |
| `/teach/courses/:courseId/articles/:itemId` | `instructorCourses` |
| `/teach/courses/:courseId/preview` | `instructorCourses` |
| `/admin/courses` | `instructorCourses` |
| `/admin/courses/reviews` | `instructorCourses` |
| `/admin/courses/:courseId` | `instructorCourses` |
| `/account/profile` | `profile` |
| `/account/certificates` | `certificates` |
| `/account/certificates/:certificateId` | `certificates` |
| `/admin/certificates` | `certificates` |
| `/admin/certificates/:certificateId` | `certificates` |
| `/certificates/verify/:code` | `certificates` |
| `/checkout/:courseId` | `payments` |
| `/checkout/:orderId/result` | `payments` |
| `/account/orders` | `commerce` |
| `/account/cart` | `commerce` |
| `/account/orders/:orderId` | `commerce` |
| `/admin/orders` | `commerce` |
| `/admin/orders/:orderId` | `commerce` |
| `/admin` | `operations` |
| `/admin/users` | `operations` |
| `/admin/users/:id` | `operations` |
| `/admin/instructors` | `instructorOnboarding` |
| `/admin/instructors/:id` | `instructorOnboarding` |
| `/teach/analytics` | `analytics` |
| `/teach/courses/:courseId/analytics` | `analytics` |
| `/teach/courses/:courseId/analytics/learners/:learnerId` | `analytics` |
| `/teach/courses/:courseId/learners` | `analytics` |
| `/teach/learners` | `analytics` |
| `/admin/business-analytics` | `analytics` |
| `/admin/analytics` | `analytics` |
| `/admin/analytics/courses/:courseId` | `analytics` |
| `/admin/analytics/courses/:courseId/learners/:learnerId` | `analytics` |
| `/teach/finance` | `finance` |
| `/admin/finance` | `finance` |
| `/admin/reports/finance` | `finance` |
| `/403` | — |
| `*` | — |
## การอัปเดต

เมื่อเปลี่ยน route หรือ feature ให้แก้ `FEATURES`, `ROUTE_FEATURES` และ inventory นี้พร้อมกัน; tests ตรวจ route coverage, wrapper, phase, runtime status และคู่ route/key ระหว่างเอกสารกับ code การเลื่อนเข้า/ออก Phase ต้องยึด Final 1.6 หรือคำยืนยันใหม่จากเจ้าของ ไม่ใช้ข้อเสนอ Phase ใน V3 มาแทน

การ build/typecheck ผ่านไม่ได้ยืนยัน Business Rule, API readiness, UX acceptance, staging หรือ production readiness การปล่อย Production ต้องมีหลักฐานตาม scope และการตรวจรับที่ตกลงแยกต่างหาก

Stripe และ AI สร้างแบบฝึกหัดเพิ่มตามคำยืนยันล่าสุดใน Final 1.6 สถานะ runtime ยัง prototype; renderer เดิมมีโจทย์ฝึก mock แต่ยังไม่มีคำสั่งสร้างชุดฝึกจาก model และยังไม่มี Stripe integration จริง ชื่อ `:orderId` ของ route ผลจ่ายเดิมไม่บังคับสร้าง Order Domain
