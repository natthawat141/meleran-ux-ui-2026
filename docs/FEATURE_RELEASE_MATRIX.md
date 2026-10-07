# Feature Release Matrix — Melearn

อัปเดต 5 ตุลาคม 2026 · ขอบเขต `elearning-ux-v2` · ตรวจจาก route และ source จริง

เอกสารนี้เป็นหน้าเดียวสำหรับดูว่าแต่ละ feature อยู่เฟสใด มีหลักฐานพร้อมระดับไหน และยังขาดอะไร ส่วน [config](../src/config/features.ts) เป็นแหล่งที่โค้ดอ่านเพื่อเปิด route ตาม environment ไม่สร้าง Dashboard, CMS, database feature flags หรือ deployment management เพิ่ม

**แอปนี้ยังเป็น interactive prototype ไม่ใช่ Production backend** มี 88 route ใน `App.tsx`: 86 route ที่ผูก feature และ 2 route ระบบ (`/403`, `*`) ทุก feature เริ่มเป็น `prototype` ไม่มี feature ที่อ้างว่า `integration` หรือ `released` เพียงเพราะคลิกหน้าเว็บได้หรือ build ผ่าน

## น้ำหนักของข้อมูล

- คำยืนยันตรงจากเจ้าของล่าสุดมีน้ำหนักเหนือเอกสารร่างและพฤติกรรมต้นแบบ
- ตารางนี้แยก UI, Business Rule, Backend, Runtime และหลักฐานการตรวจ จึงไม่ใช้สถานะเดียวแทนทุกเรื่อง
- Phase เป็น **ข้อเสนอลำดับส่งมอบ** ไม่ใช่การอนุมัติขอบเขต วันส่งงาน หรือสแตก และไม่มีผลเปิด route
- Runtime และการผูก route ต้องตรง [`FEATURES` / `ROUTE_FEATURES`](../src/config/features.ts) tests จะตรวจความสอดคล้องกับตารางนี้เมื่อแก้ code
- Staging / Production ในตารางหมายถึง **ความพร้อมที่ผ่านการตรวจรับ** ไม่ใช่ข้อกล่าวอ้างว่าไม่มีเว็บไซต์ที่ deploy ไว้ ปัจจุบันไม่มีหลักฐาน backend/integration/release acceptance สำหรับ feature เหล่านี้

กติกาที่เจ้าของยืนยันในการทบทวน 5 ต.ค. 2026: Instructor ซื้อคอร์สคนอื่นได้, ซื้อคอร์สตนเองไม่ได้เพราะมีสิทธิ์ดู, Admin ซื้อไม่ได้เพราะดูคอร์สทั้งหมดได้, Instructor เผยแพร่คอร์สตนเองได้หลัง Admin อนุมัติ **ยืนยันกติกาแล้วไม่ได้แปลว่า implementation เสร็จ**

[Inbox permission spec](INBOX_PERMISSION_SPEC.md) มีขอบเขตผลิตภัณฑ์ที่เจ้าของยืนยัน 1 ต.ค. 2026 อยู่แล้ว แต่รายละเอียดและ implementation ยังมีช่องว่าง ไม่ย้อนสถานะกติกานั้นเป็น TBD ทั้งหมด และไม่ตีความว่าสิทธิ์ดูคอร์สของ Admin ให้อ่านข้อมูลส่วนตัวหรือแชตทั้งหมดได้

## ภาพรวม feature

UI = Prototype หมายถึงมีหน้า/interaction ใน source ยังไม่ใช่การรับรองว่าทุก flow หรือทุกหน้าผ่าน UX acceptance; Demo หมายถึงมีส่วนจำลองหรือ placeholder ชัดเจน

Business Rule = Reviewing (ต้องทบทวน), Partial (มีบางกติกายืนยันแล้ว แต่ยังไม่ครบ), Approved scope (ยืนยันขอบเขตที่ลิงก์อ้างอิง; รายละเอียดคงค้างยังต้องตอบ) ไม่มีการเขียน Approved ทั้ง feature จากตัวอย่างในแชต

Backend = None หมายถึงยังไม่มี Production API/persistence/auth/enforcement สำหรับ feature ใน repo นี้ แม้มีไฟล์ชื่อ `src/api/` ซึ่งเป็น local selectors/read-models; Static หมายถึงเนื้อหาเว็บบางส่วนไม่ต้องใช้ backend แต่ยังต้องตรวจรับสำหรับ release

| Feature key | Feature | Phase (เสนอ) | UI | Business Rule | Backend | Runtime | Staging | Production |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| `publicSite` | Landing / About / ประวัติผู้สอน | 1 | Prototype; Landing มีทิศทาง UX ที่ยืนยัน | Partial: UX บางส่วนยืนยัน; ข้อมูล/ขอบเขต release ยังต้องตรวจ | Static + ข้อมูลผู้สอนจำลอง | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `auth` | Login / Register / Email / Password recovery | 1 | Prototype + Demo verification/email | Reviewing: session, verification, reset token, suspension | None; บัญชีใน browser | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `courseCatalog` | Public/Member catalog / detail / lesson preview | 1 | Prototype | Reviewing: visibility, preview, availability | None; course fixtures | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `learning` | My courses / Free Enrollment / Video / Article / Progress | 1 | Prototype | Partial: Instructor เรียนคอร์สคนอื่นได้; access/completion ยังต้องทบทวน | None; browser enrollment/progress | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `profile` | บัญชีและรูปโปรไฟล์ | 1 | Prototype | Reviewing: field/privacy/update policies | None; browser account/upload | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `instructorOnboarding` | ขอ/เชิญผู้สอน / Admin พิจารณา | 2 | Prototype + Demo invite | Partial: UX รับสิทธิ์ผ่าน Admin; กฎ provisioning ยังต้องทบทวน | None; browser requests/invites | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `instructorCourses` | Authoring / บทและเนื้อหา / Quiz definition / Admin review | 2 | Prototype; approval gate ยังขาด | Partial: Publish หลัง Admin อนุมัติยืนยันแล้ว; revision ยังเปิด | None; browser course mutations | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `assessment` | Quiz attempt / งานมอบหมาย / ตรวจข้อเขียน / ผลคะแนน | 3 | Prototype | Partial: Instructor เรียนคอร์สอื่น; attempt/grading/completion ยังทบทวน | None; client scoring/snapshot | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `certificates` | ออก/แสดง/ตรวจสอบใบรับรอง | 3 | Prototype | Reviewing: eligibility, issue/revoke/reissue, verification privacy | None; browser certificates | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `commerce` | Cart / Checkout / Orders / ส่วนลดและรหัสแลกคอร์ส | 4 | Prototype; payment จำลอง | Partial: กติกาผู้ซื้อยืนยัน; payment/refund/code policy ยังเปิด | None; simulated payment/orders | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `operations` | Admin overview / ผู้ใช้และข้อมูลบัญชี | 5 | Prototype | Reviewing: operator scopes, audit, suspension/recovery | None; browser admin actions | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `analytics` | ผลการเรียน / รายงานธุรกิจ / รายชื่อผู้เรียน | 6 | Prototype | Reviewing: metrics, source events, privacy/PII | None; local read-model + synthetic fixtures | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `finance` | รายได้ผู้สอน / ส่วนแบ่ง / รายงานและยอดโอน | 6 | Prototype | Reviewing: ledger, share/refund/fee/settlement | None; demo finance calculations | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `inbox` | ข้อความ Learner / Instructor / Admin | 6 | Prototype | Approved scope: [กติกา Inbox](INBOX_PERMISSION_SPEC.md); รายละเอียดคงค้างยังเปิด | None; browser participants/messages | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `blog` | อ่านบทความ / Admin เขียนและแก้ | 6 | Prototype | Partial: UX ให้ Admin เขียน; publishing/content policy ยังทบทวน | None; browser articles | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |
| `aiTeacher` | Melearn AI / ประวัติแชต / บริบทคอร์ส | 6 | Demo; ยังไม่เชื่อม AI จริง | Reviewing: scope, retrieval/access, data policy | None; demo responses/local history | `prototype` | ยังไม่ผ่าน | ยังไม่พร้อม |

Phase 6 ของ Blog เป็นตำแหน่ง Later ที่เสนอเพื่อจัด inventory ไม่ใช่ scope ที่เจ้าของอนุมัติ กรณีต้องเปิดก่อนให้ย้ายตาม business review ไม่ต้องเปลี่ยน Phase ของ feature อื่น

## Phase ที่ใช้อ้างอิง

อ้างอิงข้อเสนอในเอกสารฉบับเต็ม Melearn Phase 0 V3 ที่ส่งให้เจ้าของทบทวน 5 ต.ค. 2026 ยังไม่ถือว่าอนุมัติแล้วทั้งหมด ตัวอย่างจากแชตก่อนหน้าใช้ Quiz Phase 2 / Commerce Phase 3 จึงใช้ลำดับ V3 ต่อไปนี้อย่างชัดเจน ไม่รวมสองเลขเป็นกติกาเดียว:

| Phase | เส้นทางส่งมอบที่เสนอ | ข้อพึ่งพาสำคัญ |
| --- | --- | --- |
| 0 | ตกลง business rules / permissions / states / API และ technical plan | เจ้าของตอบ decision ที่กระทบ slice แรก |
| 1 | Register → Login → Browse free published course → Enroll → Learn → Save/Resume progress | auth/session, availability, access/progress จริง |
| 2 | Instructor provision ขั้นต่ำ → Draft → เนื้อหา/Quiz definition → Admin approve → Instructor publish | ขั้น Admin review ต้องมาพร้อม authoring; ไม่รอ Phase 5 |
| 3 | Attempt → Submit → Auto/manual grading → Completion → Certificate ตาม scope ที่รับ | snapshot ที่เริ่ม attempt, grading audit, eligibility |
| 4 | Cart/Checkout → Order/Payment → Verified confirmation → Enrollment | support/recovery/reconciliation ขั้นต่ำต้องมาพร้อมเงิน |
| 5 | Operations ครบตามขอบเขตที่รับ | user management, audit, refund/certificate lifecycle; งาน dependency บางส่วนทำมาก่อน |
| 6 / Later | Analytics / Finance / Inbox / AI / Blog ตามลำดับที่เลือก | events/ledger/server permissions/data policy ที่ตกลง |

Quiz definition อยู่ `instructorCourses` Phase 2; การทำข้อสอบและตรวจผลอยู่ `assessment` Phase 3 ไม่ใช่การเปิดทั้ง assessment ใน Phase 2 ขั้น Admin instructor provisioning และ review ขั้นต่ำอยู่ Phase 2 แม้ operations ฉบับเต็มอยู่ Phase 5

## ความสามารถที่ไม่ได้มี route แยก

| ความสามารถ | Feature ที่รับผิดชอบ | หลักฐานและงานที่ยังขาด |
| --- | --- | --- |
| Login / Register | `auth` | [AuthPages](../src/pages/AuthPages.tsx) เรียก [store](../src/store.tsx); ต้องแทน demo credentials/browser users ด้วย auth/session จริง |
| Verify email / Forgot / Reset | `auth` | มีหน้า แต่ VerifyEmail ระบุจำลอง; reset ยังไม่ใช่ token/email service Production |
| Free Enrollment | `learning` | `enrollFree` ใน store ถูกเรียกจาก course detail; ไม่มี `/enroll` route; ต้องตรวจ identity, published/free state, duplicate และ entitlement ที่ server |
| ซื้อคอร์ส / เพิ่มตะกร้า | `commerce` | action อยู่ในหน้า catalog/detail ด้วย; role เดิมยังอนุญาต learner/admin และกัน Instructor ต้องปรับตามกฎใหม่ก่อน release |
| Save/Resume progress | `learning` | state อยู่ใน browser ไม่ใช่ persistence ข้ามอุปกรณ์ |
| Publish Course | `instructorCourses` | [CoursePreviewPage](../src/pages/instructor/InsightPages.tsx) ยังเปลี่ยน `status: published` โดยตรง ต้องมี Admin approval/version gate |
| Quiz start/submit | `assessment` | store มี attempt snapshot แล้ว แต่ยังเป็น client-controlled และ startAttempt กัน Instructor ออกจาก learner attempt |
| ใบรับรองอัตโนมัติ | `certificates` | ปุ่ม/route ใบรับรองถูก gate แต่ side effect ใน learning/scoring ต้องตรวจตามนโยบายเมื่อเริ่ม release |
| ส่งข้อความจากบทเรียน | `inbox` | ปุ่มถามผู้สอนและ notification อยู่ในหน้า learning ด้วย; route gate ไม่บังคับ participant/access/API |
| Newsletter / Google login / AI replies | feature ของหน้าที่แสดง | หน้า/ปุ่มไม่ได้เป็นหลักฐานว่าบริการภายนอกต่อแล้ว ต้องระบุการเชื่อมจริงและสถานะ error |

**ขอบเขตโค้ดรอบนี้เป็น route gate** การเปิดฟีเจอร์หนึ่งไม่ได้ปิด/เปิดทุกปุ่มหรือ side effect ที่ฝังอยู่ในอีกฟีเจอร์โดยอัตโนมัติ ก่อนย้าย catalog/learning/auth เป็น released ต้องตรวจ inline actions และ dependencies เหล่านี้ด้วย อย่า release กลุ่มใหญ่ที่ยังมี prototype action ปะปน หากส่งมอบเพียงบางส่วนให้แยก feature key ของส่วนนั้นก่อน

## สถานะ runtime และ environment

| Runtime | ความหมาย | Development / Preview | Staging | Production |
| --- | --- | --- | --- | --- |
| `prototype` | UI/flow จำลอง ยังไม่เชื่อมระบบจริงครบ | เปิด | ปิด | ปิด |
| `integration` | เริ่มต่อ API/persistence จริง และมี integration evidence | เปิด | เปิด | ปิด |
| `released` | ผ่าน business/technical/staging acceptance ของ scope ที่เปิด | เปิด | เปิด | เปิด |
| `disabled` | ปิดไว้ทุก environment | ปิด | ปิด | ปิด |

ไม่มี status ชื่อ Business Approved ใน config เพราะการอนุมัติธุรกิจไม่เท่ากับ backend พร้อม ใช้คอลัมน์ Business Rule และหลักฐานในเอกสารนี้

[`FeatureRoute`](../src/components/FeatureRoute.tsx) ตรวจ environment ก่อน render child จึงไม่เรียก role gate หรือ redirect ไป Login สำหรับ feature ที่ปิด แต่แสดง NotFoundPage เดิม เมื่อ feature เปิดจึงใช้ role/ownership guard เดิมตามปกติ กติกานี้ไม่ขยายสิทธิ์ Instructor/Admin และไม่ได้แก้ช่องว่าง business rules ใน store

ตั้ง environment ที่ build ผ่าน `VITE_APP_ENV` เฉพาะ `development`, `preview`, `staging`, `production` ถ้าไม่มีค่า: dev server = development; mode preview = preview; mode staging = staging; non-dev mode อื่นรวม production/ค่าที่ไม่รู้จัก = production หากใส่ explicit value ผิด = production (ปิดไว้ก่อน) ไม่อ่าน query string หรือ localStorage เป็นตัวเปิด feature

`VITE_APP_ENV` เป็น public build setting ไม่ใช่ secret ไม่สามารถเปลี่ยนจาก query string หรือเปลี่ยน config ที่ server หลังส่ง bundle แล้ว ต้อง rebuild หากจะเปลี่ยน environment การใช้ `VITE_APP_ENV` override ตั้งใจเปิด Preview ได้ จึงต้องตรวจค่าของงาน build ก่อนเผยแพร่ ไม่ถือว่า route gate ทดแทน CI/CD หรือ server permissions

```powershell
# Local walkthrough: เปิด prototypes เหมือนเดิม
npm.cmd run dev -- --port 5174

# Bundle สำหรับ UX preview: ยังไม่มีฟีเจอร์ Production
npm.cmd run build -- --mode preview
npm.cmd run preview -- --port 4173

# Bundle สำหรับ Staging: integration + released
npm.cmd run build -- --mode staging

# Default Production bundle: released เท่านั้น
npm.cmd run build
```

`npm run preview` เป็นเพียง server ที่เสิร์ฟ bundle ที่ build ไว้ **ไม่เปลี่ยน bundle จาก Production ให้เป็น Preview** ต้อง build ด้วย mode preview ก่อน เมื่อไม่มี released feature Production/Staging จะแสดง 404 สำหรับทุก feature route ตามที่ตั้งใจ โดย `/403` และ fallback `*` ยังแสดงหน้าระบบเดิม

รอบนี้ไม่แก้ค่า build บน Cloudflare/GitHub/บริการภายนอก และไม่สั่ง deploy ถ้ามี pipeline ที่ใช้ `npm run build` เพื่อแสดง Prototype ต้องตั้ง mode preview ในงาน pipeline นั้นโดยเจาะจง การตรวจ source/build ครั้งนี้ไม่ใช่การยืนยันสถานะ pipeline หรือเว็บไซต์ที่ deploy อยู่จริง

Route gate ไม่ป้องกันการอ่าน bundle ไม่เอา code ออกจาก bundle และไม่ใช่ security boundary ของ API Backend ต้องตรวจ identity, role, ownership, access, state และข้อมูลส่วนตัวทุก operation

## Inventory จาก App.tsx

ตารางนี้ครอบคลุมทุก route ที่มีใน [App.tsx](../src/App.tsx) รูปแบบ `:id` / `:slug` คือ parameter ไม่ใช่ URL ตัวอย่างที่ควรใส่ตรง ๆ คอลัมน์ Guard เป็น **พฤติกรรม route เดิม** ไม่ใช่ permission Production ที่รับรองแล้ว `learner/admin` บนหน้าผู้เรียนจึงเป็นช่องว่างที่ยังต้องปรับตามกติกา Instructor เรียนคอร์สอื่น

### publicSite

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/` | `publicSite` | `LandingPage` | Public entry |
| `/about` | `publicSite` | `AboutPage` | Public entry |
| `/instructors/:id` | `publicSite` | `InstructorProfilePage` | Public entry |

### auth

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/login` | `auth` | `LoginPage` | Public entry |
| `/register` | `auth` | `RegisterPage` | Public entry |
| `/verify-email` | `auth` | `VerifyEmailPage` | Public entry |
| `/forgot-password` | `auth` | `DemoAccountPage` | Public entry |
| `/reset-password` | `auth` | `DemoAccountPage` | Public entry |

### courseCatalog

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/courses` | `courseCatalog` | `PublicCourseEntry` | Public entry |
| `/courses/:slug` | `courseCatalog` | `PublicCourseEntry` | Public entry |
| `/courses/:slug/preview` | `courseCatalog` | `CourseLessonPreviewPage` | Public entry |
| `/explore/courses` | `courseCatalog` | `MemberCatalogPage` | learner / instructor / admin |
| `/explore/courses/:slug` | `courseCatalog` | `MemberCourseDetailPage` | learner / instructor / admin |

### learning

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/learn` | `learning` | `LearnerDashboardPage` | learner / admin |
| `/learn/courses` | `learning` | `MyCoursesPage` | learner / admin |
| `/learn/courses/:courseId` | `learning` | `LearnerCoursePage` | learner / admin |
| `/learn/courses/:courseId/videos/:itemId` | `learning` | `VideoLessonPage` | learner / admin |
| `/learn/courses/:courseId/articles/:itemId` | `learning` | `ArticleLessonPage` | learner / admin |

### profile

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/account/profile` | `profile` | `ProfilePage` | learner / instructor / admin |

### instructorOnboarding

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/become-instructor` | `instructorOnboarding` | `BecomeInstructorPage` | Public entry |
| `/invite/:token` | `instructorOnboarding` | `DemoAccountPage` | Public entry |
| `/admin/instructors` | `instructorOnboarding` | `AdminInstructorRequestsPage` | admin |
| `/admin/instructors/:id` | `instructorOnboarding` | `AdminInstructorRequestDetailPage` | admin |

### instructorCourses

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/teach` | `instructorCourses` | `InstructorDashboardPage` | instructor / admin + ownership |
| `/teach/courses` | `instructorCourses` | `InstructorCoursesPage` | instructor / admin + ownership |
| `/teach/courses/new` | `instructorCourses` | `CourseEditorPage` | instructor / admin + ownership |
| `/teach/courses/:courseId` | `instructorCourses` | `InstructorCourseOverviewPage` | instructor / admin + ownership |
| `/teach/courses/:courseId/settings` | `instructorCourses` | `CourseEditorPage` | instructor / admin + ownership |
| `/teach/courses/:courseId/curriculum` | `instructorCourses` | `CurriculumPage` | instructor / admin + ownership |
| `/teach/courses/:courseId/chapters/:chapterId` | `instructorCourses` | `ChapterEditorPage` | instructor / admin + ownership |
| `/teach/courses/:courseId/videos/:itemId` | `instructorCourses` | `ContentEditorPage` | instructor / admin + ownership |
| `/teach/courses/:courseId/articles/:itemId` | `instructorCourses` | `ContentEditorPage` | instructor / admin + ownership |
| `/teach/courses/:courseId/quizzes` | `instructorCourses` | `QuizManagerPage` | instructor / admin + ownership |
| `/teach/quizzes` | `instructorCourses` | `QuizManagerPage` | instructor / admin + ownership |
| `/teach/quizzes/:quizId` | `instructorCourses` | `QuizEditorPage` | instructor / admin + ownership |
| `/teach/courses/:courseId/preview` | `instructorCourses` | `CoursePreviewPage` | instructor / admin + ownership |
| `/admin/courses` | `instructorCourses` | `AdminCoursesPage` | admin |
| `/admin/courses/:courseId` | `instructorCourses` | `AdminCourseDetailPage` | admin |

### assessment

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/learn/assignments` | `assessment` | `AssignmentsPage` | learner / admin |
| `/learn/courses/:courseId/quizzes/:itemId` | `assessment` | `RedirectCourseQuiz` | learner / admin |
| `/learn/quizzes/:quizId` | `assessment` | `QuizIntroPage` | learner / admin |
| `/learn/attempts/:attemptId` | `assessment` | `QuizAttemptPage` | learner / admin |
| `/learn/attempts/:attemptId/result` | `assessment` | `QuizResultPage` | learner / admin |
| `/teach/assignments` | `assessment` | `AssignmentsPage` | instructor / admin + ownership |
| `/teach/reviews` | `assessment` | `LearnerReviewQueuePage` | instructor / admin + ownership |
| `/teach/quizzes/:quizId/attempts` | `assessment` | `QuizAttemptsPage` | instructor / admin + ownership |
| `/teach/attempts/:attemptId/grade` | `assessment` | `GradeEssayPage` | instructor / admin + ownership |
| `/admin/assignments` | `assessment` | `AdminAssignmentsPage` | admin |

### certificates

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/account/certificates` | `certificates` | `CertificatesPage` | learner / admin |
| `/account/certificates/:certificateId` | `certificates` | `CertificateDetailPage` | learner / admin |
| `/admin/certificates` | `certificates` | `AdminCertificatesPage` | admin |
| `/admin/certificates/:certificateId` | `certificates` | `CertificateDetailPage` | admin |
| `/certificates/verify/:code` | `certificates` | `VerifyCertificatePage` | Public entry |

### commerce

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/learn/redeem` | `commerce` | `RedeemCourseCodePage` | learner / admin |
| `/checkout/:courseId` | `commerce` | `CheckoutPage` | learner / admin |
| `/checkout/:orderId/result` | `commerce` | `CheckoutResultPage` | learner / admin |
| `/account/orders` | `commerce` | `OrdersPage` | learner / admin |
| `/account/cart` | `commerce` | `CartPage` | learner / admin |
| `/account/orders/:orderId` | `commerce` | `OrderDetailPage` | learner / admin |
| `/admin/orders` | `commerce` | `AdminOrdersPage` | admin |
| `/admin/orders/:orderId` | `commerce` | `OrderDetailPage` | admin |
| `/admin/access-codes` | `commerce` | `AccessCodesPage` | admin |

### operations

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/admin` | `operations` | `AdminDashboardPage` | admin |
| `/admin/users` | `operations` | `AdminUsersPage` | admin |
| `/admin/users/:id` | `operations` | `AdminUserDetailPage` | admin |

### analytics

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/teach/analytics` | `analytics` | `InstructorAnalyticsRoute` | instructor / admin + ownership |
| `/teach/courses/:courseId/analytics` | `analytics` | `CourseAnalyticsPage` | instructor / admin + ownership |
| `/teach/courses/:courseId/analytics/learners/:learnerId` | `analytics` | `LearnerAnalyticsPage` | instructor / admin + ownership |
| `/teach/courses/:courseId/learners` | `analytics` | `InstructorLearnersPage` | instructor / admin + ownership |
| `/teach/learners` | `analytics` | `InstructorLearnersPage` | instructor / admin + ownership |
| `/admin/business-analytics` | `analytics` | `AdminBusinessAnalyticsPage` | admin |
| `/admin/analytics` | `analytics` | `AnalyticsPage` | admin |
| `/admin/analytics/courses/:courseId` | `analytics` | `CourseAnalyticsPage` | admin |
| `/admin/analytics/courses/:courseId/learners/:learnerId` | `analytics` | `LearnerAnalyticsPage` | admin |

### finance

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/teach/finance` | `finance` | `InstructorFinancePage` | instructor / admin + ownership |
| `/admin/finance` | `finance` | `AdminInstructorFinancePage` | admin |
| `/admin/reports/finance` | `finance` | `AdminFinanceReportPage` | admin |

### inbox

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/learn/inbox` | `inbox` | `InboxPage` | learner / admin |
| `/teach/inbox` | `inbox` | `InboxPage` | instructor / admin + ownership |
| `/admin/inbox` | `inbox` | `InboxPage` | admin |

### blog

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/articles` | `blog` | `BlogIndexPage` | Public entry |
| `/articles/:id` | `blog` | `BlogArticlePage` | Public entry |
| `/admin/articles` | `blog` | `AdminBlogPage` | admin |
| `/admin/articles/new` | `blog` | `AdminBlogEditorPage` | admin |
| `/admin/articles/:id/edit` | `blog` | `AdminBlogEditorPage` | admin |

### aiTeacher

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/learn/ai` | `aiTeacher` | `LearnerAiPage` | learner / admin |

### System fallbacks

| Route | Feature key | Component | Guard เดิม |
| --- | --- | --- | --- |
| `/403` | — | `NoAccessPage` | Public entry; ไม่ผูก feature |
| `*` | — | `NotFoundPage` | Public entry; ไม่ผูก feature |

## วิธีเปลี่ยนสถานะและตรวจรับ

1. เจ้าของยืนยัน business rules เฉพาะ scope มีวัน ผู้ยืนยัน และลิงก์ requirement/decision อย่าย้าย status จากจำนวนหน้าที่ทำเสร็จ
2. Dev ทำ API/persistence/server permission/error/recovery ตาม scope แก้ `FEATURES` เป็น integration เมื่อมีหลักฐานการต่อระบบจริง และอัปเดตตาราง/ช่องว่าง/route ใน PR เดียวกัน
3. ผ่าน typecheck/build และ tests ที่ตรงกฎ พร้อม browser/API flow และ staging evidence ไม่ใช้ build ผ่านแทน auth/payment/access enforcement
4. เปลี่ยน released เมื่อ scope ทั้งกลุ่มและ dependencies ผ่านตามข้อรับงาน ถ้าได้เพียงบาง route ให้แยก feature key ห้ามเปิด prototype อื่นในกลุ่มตามไปด้วย
5. ผู้ดูแลตรวจ environment/build configuration ก่อน release; deployment และเปิดเงินจริงต้องได้รับคำสั่งเจาะจง การ push ไม่ได้ยืนยันว่า deploy เสร็จ
6. หากพบปัญหา ใช้ disabled เพื่อปิด route ทุก environment ใน build ถัดไป พร้อมบันทึกเหตุผล ไม่อ้างว่าเป็น runtime kill switch หรือ rollback ข้อมูล

หลักฐานต่อ feature ที่ควรเพิ่มเมื่อเริ่มพัฒนาจริง: owner, requirement/decision ที่รับแล้ว, PR/commit, API/test results, staging environment และวันที่ตรวจ, accepted scope, known gaps และ release/rollback record ขณะนี้ยังไม่ได้กำหนดชื่อผู้รับผิดชอบหรือวันส่งแทนเจ้าของ

เมื่อลงมือจริงใช้ GitHub Projects บริหารงานได้: Backlog → UI Prototype → Business Approved → Development → Integration → Staging → Released card เชื่อมมายัง section ของ feature นี้และ PR ที่เกี่ยวข้อง ตารางนี้อธิบายความพร้อม; board อธิบายงานที่กำลังทำ; config กำหนดว่า code เปิด route อะไร ไม่ต้องสร้าง dashboard อีกชุด รอบนี้ไม่ได้สร้างหรือแก้ Project บน GitHub

## จุดเริ่มต้นงานถัดไป

เริ่มทบทวน Phase 1: auth/session, course visibility/preview, free enrollment, learning access และ progress/completion ก่อนให้ Dev implement ไม่ถือว่า Login/Register/Catalog/Free Enrollment Approved เพราะปรากฏเช่นนั้นในตัวอย่างแชต จากนั้นทำ slice ที่ต่อ API และเก็บข้อมูลจริงผ่านอุปกรณ์/บัญชีต่างกันได้

ข้อกำหนดที่ยืนยันแล้วแต่ source ยังไม่ครบและต้องติดตาม: Instructor เรียน/ซื้อคอร์สอื่น, owner ไม่ซื้อคอร์สตัวเอง, Admin ไม่ซื้อ, publish ต้องผ่าน approval, quiz snapshot/server authority, private inbox permissions และ entitlement recovery หลังเงินยืนยัน รอบนี้ไม่ได้แก้กฎหรือ backend เหล่านี้

## แหล่งหลักฐาน

ผลตรวจรอบนี้ (5 ต.ค. 2026):

- `npm.cmd run typecheck` ผ่าน; `node --test tests/feature-release.test.ts` ผ่าน 5 tests รวม policy ทุก status/environment, fallback environment, registry, wrapper ของทุก route และความสอดคล้องของเอกสาร
- Build แบบ Production, Preview และ Staging ผ่าน มี warning จาก `use client` ของ dependencies และขนาด bundle ซึ่งไม่ได้แก้ในงานนี้
- ตรวจ AST ของ element ใน route ก่อน/หลังเพิ่ม wrapper: ทั้ง 88 route รักษาลำดับและ element/role guard เดิม
- Browser Local ที่ `127.0.0.1:5174`: Login เปิดได้ และบัญชี Admin เดิมยังเปิด `/learn` ได้ตาม guard เดิม ไม่ reset หรือเปลี่ยนบัญชีในการตรวจ
- Browser Preview bundle: `/login` เปิดได้; `/learn` สำหรับผู้ไม่ล็อกอินส่งไป `/login?next=%2Flearn`
- Browser Staging bundle: `/login` และ `/learn` แสดง 404 ก่อน role guard
- Browser Production bundle: `/login`, `/learn`, `/admin/finance` แสดง 404 ก่อน role guard
- ตรวจลิงก์เอกสารและ whitespace ผ่าน การตรวจนี้ไม่ใช่การทดสอบ backend, การตรวจทุกหน้า/อุปกรณ์, การรับ UX ทั้งระบบ หรือการตรวจเว็บไซต์ที่ deploy อยู่

- [AGENTS](../AGENTS.md), [UI spec](UI_SPEC.md), [Code spec](CODE_SPEC.md): ขอบเขต prototype และข้อกำหนดการทำงาน
- [App.tsx](../src/App.tsx): route/role guard ที่ inventory อ้างอิง
- [features.ts](../src/config/features.ts), [FeatureRoute.tsx](../src/components/FeatureRoute.tsx): registry และ environment gate ที่โค้ดใช้จริง
- [store.tsx](../src/store.tsx), [AuthPages](../src/pages/AuthPages.tsx), [CommercePages](../src/pages/learner/CommercePages.tsx): browser-local accounts/enrollment/payment/attempts
- [Course preview/publish](../src/pages/instructor/InsightPages.tsx): approval gap ที่ตรวจจาก source
- [Analytics read-model](../src/api/analytics.ts), [Business reporting](../src/api/businessAnalytics.ts), [Synthetic fixtures](../src/mocks/businessAnalytics.ts): local calculations ไม่ใช่ Production API
- [Inbox permission spec](INBOX_PERMISSION_SPEC.md), [Inbox API selectors](../src/api/inbox.ts): ขอบเขตที่ยืนยันและ implementation gaps
- [AI page](../src/pages/learner/LearnerAiPage.tsx): demo responses/local history
- [Feature release tests](../tests/feature-release.test.ts): environment/status policy, route coverage และความสอดคล้องของ registry/เอกสาร

เอกสารนี้เป็น snapshot จาก source ในรอบงาน 5 ต.ค. 2026 และต้องอัปเดตไปกับการเปลี่ยน route/status ใน PR เดียวกัน ไม่อนุมาน backend, stack, provider, deadline หรือ approval เพิ่มจากแหล่งตัวอย่าง
