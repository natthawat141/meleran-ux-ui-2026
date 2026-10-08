# Feature Release Matrix — Melearn

อัปเดต 7 ตุลาคม 2026 · หลัง R1 scope cleanup บน `refactor/v1-api-ready`

ยึด [Final 1.6](MELEARN_V1_SCOPE.md) และ [execution plan](FRONTEND_REFACTOR_PLAN_TH.md) ส่วน [config](../src/config/features.ts) กำหนด runtime gates ตาม environment การอนุมัติ scope ไม่ใช่ backend readiness ทุก feature ยัง `prototype`; default production ปิด prototype routes การตรวจ build ผ่านไม่เปลี่ยนเป็น integration/released

R1a แยก Payment/Redeem/roster ออกจาก legacy gates แล้ว R1b/R1c ถอน Cart/Orders/Finance/Inbox/Assignment/comparison dashboards/request/invite/public full lesson preview/public certificate verification/global Admin certificate viewer และ Admin grading ก่อน deep refactor รายงานผลและข้อจำกัดอยู่ใน [R1 report](R1_SCOPE_CLEANUP_REPORT_TH.md)

Source แยกเป็น Web/Admin apps และยังเป็น browser-local prototype; การย้าย feature slices, Query/contracts และ server integration ยังดำเนินต่อ Runtime status ต้องมีหลักฐานตรง revision ก่อนเลื่อน ตาม CODE_SPEC ไม่เปิดทุกอย่างเพื่อให้ demo ทำงานใน production

## ภาพรวม feature

Phase เป็น metadata ลำดับส่งมอบที่ source ใช้ ไม่ใช่เลข R0–R13 หรือกำหนดวัน UI Prototype หมายถึงมี implementation ไม่ใช่ผ่าน flow/visual acceptance ทั้งหมด Business scope ยืนยัน Final 1.6 แล้ว แต่กติกา server/transport/contracts ของ implementation ต้องตกลงร่วม backend

| Feature key | Feature | Phase (เสนอ) | UI | Business Rule | Backend | Runtime | Staging | Production |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| `publicSite` | Landing / About / ประวัติผู้สอน | 1 | Prototype | Final 1.6 | Static + ข้อมูลจำลอง | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `auth` | Login / Register / Verify / Reset | 1 | Prototype | Final 1.6 | None; local prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `courseCatalog` | Catalog และรายละเอียด Published | 1 | Prototype | Final 1.6 | None; local prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `learning` | Enroll / My courses / Lesson / Resume | 1 | Prototype | Final 1.6 | None; local prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `profile` | บัญชีส่วนตัว | 1 | Prototype | Final 1.6 | None; local prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `instructorCourses` | สร้าง/แก้คอร์ส / Review / รายชื่อผู้เรียน | 2 | Prototype | Final 1.6 | None; local prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `assessment` | Quiz / Attempts / ตรวจคำตอบเจ้าของคอร์ส | 3 | Prototype | Final 1.6 | None; local prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `certificates` | ใบรับรองของบัญชีตนเอง | 3 | Prototype | Final 1.6 | None; local prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `payments` | Stripe Checkout / อ่านสถานะ Payment | 4 | Prototype | Final 1.6 | Client HTTP มีแล้ว; backend/webhook ไม่ได้พิสูจน์ | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `redeem` | Redeem / ออกและยกเลิกรหัสแลกคอร์ส | 4 | Prototype | Final 1.6 | Prototype adapter ใน browser; ไม่ใช่ server atomicity | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `operations` | Admin users / Instructor directory / Course management | 5 | Prototype | Final 1.6 | None; local prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `blog` | Published Blog / Admin editor | 6 | Prototype | Final 1.6 | None; local prototype | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `aiTeacher` | Melearn AI / AIPractice / Transcript | 6 | Prototype | Final 1.6 | Mock/local history; model/DB/quota ยังไม่เชื่อม | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |

## ความสามารถที่ไม่มี route แยก

- Free Enrollment อยู่ใน course detail; Instructor เรียนคอร์สอื่นได้เมื่อเข้าเงื่อนไขบัญชี/enrollment เจ้าของ/Admin ใช้ management preview และไม่สร้างผลเรียน
- Admin เพิ่ม Instructor ให้ User เดิมผ่าน user detail; real create-user/auth/Resend/Google ยังต้องทำใน R5
- ai_enabled/Transcript อยู่ใน authoring เฉพาะ Admin; AIPractice แยกจาก Quiz/progress/certificate
- การอ่าน Payment status ไม่ fulfill; Stripe Webhook/backend เป็นผู้ให้สิทธิ์จริง
- Retired local collections อยู่ใน inert compatibility snapshot เพื่อรักษาประวัติ ไม่ใช่ feature ที่เปิดใช้งานหรือ API contract
- Course edit/Quiz definition, >70% exact score, completion/certificate snapshots, YouTube และ Query integration ยังต้องปรับใน R6–R9 ตามรายงาน R0 ไม่อ้างว่า R1 ทำครบแล้ว

## Runtime environments

Development/preview เปิด prototype; staging ต้อง integration/released; production ต้อง released Invalid environment/status fail closed ระบบ fallback `/403` และ `*` ไม่ผูก feature guards ใช้เพื่อแสดง error/not-found

## Inventory baseline จาก App.tsx ก่อน split

ตารางนี้เก็บ canonical feature inventory จาก R1 ก่อนแยก router: 61 route declarations, 59 feature routes และ 2 system fallbacks. R2–R3 ย้าย declarations ไปยัง WebRouter/AdminRouter และมี Admin path mappings; tests/workspace-route-ownership.test.mjs ตรวจ owner และ compatibility ปัจจุบัน. URLs ของ retained routes คงเดิมใน Web; Admin authoring ใช้ `/admin/*` และเส้นทาง `/teach/*` ที่รองรับจะ redirect ตาม migration map ส่วน retired paths จบที่ not-found.

| Route | Feature key | Current UX guard/layout |
| --- | --- | --- |
| `/` | `publicSite` | Public / page layout |
| `/about` | `publicSite` | Public / page layout |
| `/courses` | `courseCatalog` | Guest Public / member redirect |
| `/courses/:slug` | `courseCatalog` | Guest Public / member redirect |
| `/explore/courses` | `courseCatalog` | บัญชีทุกบทบาท |
| `/explore/courses/:slug` | `courseCatalog` | บัญชีทุกบทบาท |
| `/articles` | `blog` | Public / page layout |
| `/articles/:id` | `blog` | Public / page layout |
| `/instructors/:id` | `publicSite` | Public / page layout |
| `/login` | `auth` | Public / page layout |
| `/register` | `auth` | Public / page layout |
| `/verify-email` | `auth` | Public / page layout |
| `/forgot-password` | `auth` | Public / page layout |
| `/reset-password` | `auth` | Public / page layout |
| `/learn` | `learning` | Learner / Instructor ตามสิทธิ์ |
| `/learn/courses` | `learning` | Learner / Instructor ตามสิทธิ์ |
| `/learn/redeem` | `redeem` | Learner / Instructor ตามสิทธิ์ |
| `/learn/ai` | `aiTeacher` | บัญชีทุกบทบาท / standalone AI |
| `/learn/courses/:courseId` | `learning` | Learner / Instructor ตามสิทธิ์ |
| `/learn/courses/:courseId/videos/:itemId` | `learning` | Learner / Instructor ตามสิทธิ์ |
| `/learn/courses/:courseId/articles/:itemId` | `learning` | Learner / Instructor ตามสิทธิ์ |
| `/learn/courses/:courseId/quizzes/:itemId` | `assessment` | Learner / Instructor ตามสิทธิ์ |
| `/learn/quizzes/:quizId` | `assessment` | Learner / Instructor ตามสิทธิ์ |
| `/learn/attempts/:attemptId` | `assessment` | Learner / Instructor ตามสิทธิ์ |
| `/learn/attempts/:attemptId/result` | `assessment` | Learner / Instructor ตามสิทธิ์ |
| `/checkout/:courseId` | `payments` | Learner / Instructor ตามสิทธิ์ |
| `/checkout/:orderId/result` | `payments` | Learner / Instructor ตามสิทธิ์ |
| `/account/certificates` | `certificates` | บัญชีทุกบทบาท / self data |
| `/account/certificates/:certificateId` | `certificates` | บัญชีทุกบทบาท / self data |
| `/account/profile` | `profile` | บัญชีทุกบทบาท |
| `/teach` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/reviews` | `assessment` | Instructor เจ้าของคอร์ส |
| `/teach/courses` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/courses/new` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/courses/:courseId` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/courses/:courseId/settings` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/courses/:courseId/curriculum` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/courses/:courseId/chapters/:chapterId` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/courses/:courseId/videos/:itemId` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/courses/:courseId/articles/:itemId` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/courses/:courseId/quizzes` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/quizzes` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/quizzes/:quizId` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/quizzes/:quizId/attempts` | `assessment` | Instructor owner / Admin manage |
| `/teach/attempts/:attemptId/grade` | `assessment` | Instructor เจ้าของคอร์ส |
| `/teach/courses/:courseId/preview` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/courses/:courseId/learners` | `instructorCourses` | Instructor owner / Admin manage |
| `/teach/learners` | `instructorCourses` | Instructor owner / Admin manage |
| `/admin` | `operations` | Admin |
| `/admin/articles` | `blog` | Admin |
| `/admin/articles/new` | `blog` | Admin |
| `/admin/articles/:id/edit` | `blog` | Admin |
| `/admin/users` | `operations` | Admin |
| `/admin/users/:id` | `operations` | Admin |
| `/admin/instructors` | `operations` | Admin |
| `/admin/courses` | `instructorCourses` | Admin |
| `/admin/courses/reviews` | `instructorCourses` | Admin |
| `/admin/courses/:courseId` | `instructorCourses` | Admin |
| `/admin/access-codes` | `redeem` | Admin |
| `/403` | — | Public / page layout |
| `*` | — | Public / page layout |

UX guards ไม่ใช่ security enforcement Backend ต้องตรวจ identity/permissions/enrollment/ownership ใหม่ทุก request ไม่ใช้ browser role/IDs เป็นหลักฐาน

## วิธีเปลี่ยนสถานะและตรวจรับ

ปรับ status เฉพาะเมื่อมีหลักฐานของ flow/API และ runtime artifact ตรง revision; ตรวจ typecheck/native regressions/build/browser ตามส่วนที่เปลี่ยน อัปเดต matrix/config/tests พร้อมกัน ไม่ถือว่า mock tests หรือ build ผ่านเท่ากับ backend readiness และไม่ deploy จาก checkpoint โดยอัตโนมัติ
