# R0 Inventory และ Architecture Review — Melearn Final 1.6

วันที่ 7 ตุลาคม 2026 · Lead review บน `refactor/v1-api-ready`

สถานะ: สำรวจ source และตรวจ baseline แล้ว เอกสารนี้เสนอ execution plan เพื่อให้เจ้าของอนุมัติก่อน R1 ยังไม่มีการแก้ source, runtime config, dependencies, URL หรือฟีเจอร์ ไม่มีการ deploy/merge main การจัดประเภทและขอบเขต architecture ด้านล่างเป็นผลตัดสินของ Lead จากหลักฐาน ไม่ใช่การรับ candidate ของ subagent โดยอัตโนมัติ

## 1. ขอบเขต หลักฐาน และ revision

- Repository ที่ตรวจ: `D:\code\elearn-prod\elearning-ux-v2`; source baseline `19ec7aa3389a14dd79328a1c8e8285c24f171865`; upstream `origin/refactor/v1-api-ready`; working tree/index สะอาดก่อนสำรวจ
- Local/remote `main`, `prototype` และ peeled tag `prototype-2026-10-07` ตรงกับ `fa491b46aebe6beaa408ba30ab92b28fd478d8fd` ก่อนเขียนรายงาน; checkpoint ของเอกสารจะเดินต่อเฉพาะ refactor branch
- อ่าน [Final 1.6](MELEARN_V1_SCOPE.md), [UI_SPEC](UI_SPEC.md), [CODE_SPEC](CODE_SPEC.md), [แผนล่าสุด](FRONTEND_REFACTOR_PLAN_TH.md), AGENTS/workspace guide, delegation/checkpoint policy และ [R0 workflow](../.codex/workflows/r0-inventory.md) สำเนา scope ชั้น workspace/repository มี SHA-256 ตรงกัน `BB349F08F6BAC5DC1F4EA15539450ECF11B53533C0CC5D83B30075C039564680`
- ใช้ GPT-6 Luna xhigh สำรวจ Routes, State, Scope พร้อมกัน; เมื่อ State จบ ใช้ agent เดิมทำ Shared UI/Authoring ต่อ รวมสี่บทบาท สูงสุดสาม subagents พร้อมกัน ทุกบทบาท read-only และไม่เขียนรายงานเอง
- Lead ตรวจ consumer chains, business gaps และ baseline เอง ไม่มีการอ่าน/แก้ reference repositories หรือไฟล์ secrets
- หลัง R1 ย้าย/ถอน source ลิงก์ evidence ของ source ผูกกับ Git baseline revision ใน §1 เพื่อให้อ่านประวัติได้ ไม่ใช่ลิงก์ implementation ปัจจุบัน
- Evidence เป็น path/line/symbol ของ source baseline; ใช้ลิงก์ `#L...` เพื่ออ้างบรรทัดบน Git แยก **ปัจจุบัน**, **target ที่ยืนยันแล้ว**, **ข้อเสนอในแผน**, **ยังไม่มีหลักฐาน runtime/server** ออกจากกัน

## 2. ข้อสรุป architecture ของ Lead

คงโครงสร้างที่ผู้ใช้เลือก: `apps/web`, `apps/admin`, `packages/ui`, `packages/api-client`, `packages/contracts` ใช้ feature-first และแยก route/page orchestration ต่อแอป การเปลี่ยนนี้ต้องย้าย ownership ของ state และ dependency ด้วย การย้ายโฟลเดอร์อย่างเดียวไม่ทำให้พร้อม API

ลำดับที่เสนอคือ **inventory → แยกส่วนที่ต้องเก็บ → ถอนความสามารถนอก scope → เตรียม authoring boundary → split apps → tokens/router → contract ต่อ flow → query/API → migrate → integration → packaging/acceptance** ต้องแยก functional changes จาก structural batches และตรวจย้อนแต่ละชุดได้

Backend เป็นผู้ตัดสิน identity/permission, enrollment, progress/completion, score, payment/fulfillment, certificate และ AI quota/history; frontend guards และ mock adapters ใช้ขึ้น UX/ทดสอบเท่านั้น

## 3. ปัญหาปัจจุบันและผลกระทบ

| ID | ข้อเท็จจริงที่ตรวจ | ผลต่อ refactor / การตัดสินของ Lead |
| --- | --- | --- |
| ARCH-01 | [App.tsx](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L6) static import ทุกบทบาท; lazy เฉพาะ AI ที่ L56; มี 89 route declarations / 87 feature routes | Admin dependencies อยู่ในแอปเดียวกับ Web; แยก entry/build/import graph จริง ไม่ใช้ role guard เป็น bundle boundary |
| ARCH-02 | [main.tsx](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/main.tsx#L38) ประกอบ Mantine/Ant/BrowserRouter/LmsProvider; [Shell](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/Shell.tsx#L126) เลือก navigation หลายบทบาทและจำลอง role | แยก providers/layout/session ต่อแอป; shell/sidebar ไม่ใช่ shared business component |
| ARCH-03 | [store.tsx](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/store.tsx#L225) 1,761 บรรทัด/~101 KB; [LmsData](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/types/index.ts#L419) รวม resource, session, commerce, history | แต่ละ resource มีเจ้าของเดียว; ตัด network resources ออกจาก Context ทีละ flow ไม่สร้าง Query+store ซ้ำถาวร |
| ARCH-04 | [loadData](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/store.tsx#L99) merge fixtures/users/attempts/assignments/finance/inbox; effect L230 persist ทั้งก้อน | ถอน route อย่างเดียวไม่ถอน side effects; R1 ต้องจัด loader/seed/actions และรักษาข้อมูลเดโมเดิมโดยไม่ reset |
| ARCH-05 | [learner helper](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L117) รับ learner/admin แต่ไม่รับ Instructor; [startAttempt](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/store.tsx#L1135) จำกัด learner/admin | ขัด scope §§2.2,3.2–3.3; Instructor ที่เรียนคอร์สอื่นต้องเข้าเรียน/ผล/ใบรับรองตาม enrollment ได้; Admin preview ห้ามสร้างผลเรียน |
| ARCH-06 | [gradeAttempt](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/store.tsx#L1241) ใช้ canManageCourse ซึ่งรับ Admin; `/teach/.../grade` รับ Admin ที่ App L226 | scope §3.4 ให้ Instructor เจ้าของตรวจ; Admin อ่านผลเพื่อดูแลได้ แต่ห้ามให้ grading capability ตาม prototype |
| ARCH-07 | [submitAttempt](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/store.tsx#L1180), grade L1251 ปัดคะแนนก่อนเทียบ `>= passPercent` default 60; [AssessmentEditor](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/chapter/AssessmentEditor.tsx#L40) ให้ตั้งเกณฑ์ | scope §2.6 ต้องส่งครบ/ตรวจครบและ **คะแนนจริง >70%**; เพิ่ม boundary tests 70 พอดี/ใกล้เกณฑ์ และ highest completed attempt ใน R7 ไม่ใช้ตัวเลขที่ปัดเพื่อ display ตัดสิน |
| ARCH-08 | [awardCertificate](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/store.tsx#L201) ผูก course/user, ใช้รายการปัจจุบัน; [Enrollment](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/types/index.ts#L202) ไม่มี source/completion snapshot; [CourseProgress](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/common.tsx#L167) ปัดเปอร์เซ็นต์ | R7 ต้อง enrollment-linked completion/attempt/certificate snapshots และไม่แสดง 100% ก่อนครบจริง; resume ยังขาด |
| ARCH-09 | [removeCourse](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/store.tsx#L605) cascade ลบผลเรียน/enrollment/certificate; Course type ยังมี archive | scope §§2.3,4.6 ไม่มี archive/คำสั่งทำประวัติหาย; ถอด action/ทางเข้าเหล่านี้ใน functional cleanup รักษา reference protection |
| ARCH-10 | [Admin courses](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L487) และ [review](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/CourseReviewPage.tsx#L23) ไป `/teach`; active Curriculum re-export ที่ [CurriculumPages L7](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CurriculumPages.tsx#L7) | สองบทบาทใช้ editor จริง แต่ page/store/router coupling สูง; Admin ต้องมี own routes ไม่ copy page ทั้งก้อนหรือ import ข้ามแอป |
| ARCH-11 | [registry](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/config/features.ts#L90) Checkout/Redeem/AccessCodes อยู่ `commerce`; learner roster อยู่ `analytics` L108–109 | ก่อนถอน commerce/analytics ต้องย้าย retained route ownership; CODE_SPEC ท้ายไฟล์ที่บอกแยก payments แล้วขัด source; matrix/test ปัจจุบันไม่จับความต่างเชิง scope |
| ARCH-12 | [CommercePages](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/CommercePages.tsx#L10) รวม Stripe+Redeem+Orders; [simulatePayment](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/store.tsx#L942) และ [commitCashCodeRedemption](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/lib/access-code-utils.ts#L24) สร้าง Order/share | R1 ต้องแยก Redeem และหยุด Order/share side effects ก่อนลบ Orders; code expiry/multi-use/discount model ไม่เป็น RedeemCode contract |
| ARCH-13 | [getReviewQueue](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/api/analytics.ts#L65) ถูกใช้จาก [queue L6](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/LearnerReviewQueuePage.tsx#L6) และ [grading L11](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/QuizPages.tsx#L11); queue ยัง import analytics.css L9 | ย้าย helper/styles ที่ใช้จริงไป assessment ก่อนถอน dashboard; `learning-history` มีทั้ง retained history guards และ Assignment logic |
| ARCH-14 | [VideoEditor](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/chapter/VideoEditor.tsx#L29) รับ MP4/WebM/base64; [ChapterPreview](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/chapter/ChapterPreview.tsx#L36) ใช้ video tag | ยังไม่ใช่ YouTube flow ตาม scope; R6/R7 ต้องปรับ source/player/validation และ Upload unavailable โดยรักษาภาพปก/ภาพคำตอบ |
| ARCH-15 | [AuthPages](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AuthPages.tsx#L46) Google จำลอง; [DemoAccountPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AuthPages.tsx#L362) Reset ผ่าน email query/local action; [signIn](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/store.tsx#L274) อ่านบัญชี local | ยังไม่มี server auth/Google/Resend/Reset proof; Admin create Username/Password และเพิ่ม Instructor ต้องทำตาม contract ไม่ migrate request/invite เป็น requirement |
| ARCH-16 | [AI model](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/ai-chat-model.ts#L1) มี draft/เฉลยใน UI model, local history; [mock](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/api/ai-practice-mock.ts#L40) ไม่เรียก model | R9 ต้อง server history/quota/knowledge/result; practice creation response ห้ามส่งเฉลย/คำอธิบายก่อนตอบตาม scope §6.11 |
| ARCH-17 | Theme แตกใน [theme.ts](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/theme.ts#L25), [shadcn.css](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/shadcn.css#L10), styles/system-theme, Landing provider/CSS; main L12–15 กำหนด import order | token source เดียว + adapters; ทำ CSS migration ทีละ owner ตรวจ computed style/cascade ไม่เพิ่ม Tailwind Preflight ทับ library ทั้งระบบ |

ขนาด source ที่วัดจากไฟล์ข้อความ: `styles.css` 861 บรรทัด, `system-theme.css` 855, ChapterWorkspace 732, AdminPages 626, types 574, LearnerAiPage 573, CoursePages 540; ขนาดไฟล์เป็นตัวชี้จุดตรวจ ไม่ใช่กฎว่าทุกไฟล์ใหญ่ต้องแตกหรือไฟล์เล็กต้องรวม

## 4. KEEP / ADAPT / REMOVE matrix

**KEEP** = เก็บความสามารถ/UX ที่อยู่ใน scope แต่ยังต้องย้าย boundary/integrate; **ADAPT** = เก็บเป้าหมายและปรับ business/API behavior; **REMOVE** = ถอนความสามารถรอบ V1; **MISSING** = งานที่ scope ต้องมีแต่ยังไม่มีหลักฐาน implementation จริง ไม่ใช่เหตุให้ตัดออก

| Capability | Lead decision | Current evidence | Final 1.6 / งานที่ต้องทำ |
| --- | --- | --- | --- |
| Landing/About/โลโก้/ฟอนต์/public chrome | KEEP | App L125–126; pages/landing; UI_SPEC §§1–7 | รักษาหน้าตา; public presenter แยกจาก demo seed; newsletter ปัจจุบันระบุ mock ห้ามยกระดับเป็นระบบส่งอีเมลใหม่ |
| Catalog/รายละเอียด Published, guest/member context | KEEP + ADAPT data | App L127–145; pages/public, member | §§1,2.3,3.2,6.3; public projection ไม่คืนเนื้อหา/เฉลย/Transcript |
| Public instructor presentation | KEEP presentation | App L148–155; PublicPages | ส่วนประกอบข้อมูลผู้สอนใน catalog/landing; ไม่เพิ่ม instructor marketplace/API directory requirement |
| Guest ทดลอง full lesson `/courses/:slug/preview` | REMOVE guest access; KEEP owner/admin preview | CourseLessonPreviewPage L16–58; lib/course-preview L26 | §§3.2,6.4–6.5 ห้ามคืน restricted lesson ให้ Guest; old URL แสดงสถานะ/ทางเข้าที่มีสิทธิ์ ไม่เปิดเนื้อหาเดิม |
| Email/Username login, register/profile | ADAPT; server MISSING | AuthPages L82,177; store L274,290; AccountPages/Profile | §§2.1,6.2; session server, schema field visibility ไม่ส่ง password/token |
| Verify link/resend/Reset/Google link/login | ADAPT + MISSING service | AuthPages L46,362,499; store L318,358,1406 | §§2.1,5.8,9.1; Resend/24h/one-use/reset proof; Admin-created no-email exemption; ไม่ auto merge Google email |
| Admin create user/เพิ่ม Instructor | ADAPT + MISSING complete flow | AdminPages L95,154; store changeUserRole/invite actions | §§2.1–2.2,6.2; admin ตั้ง Username/Password, เพิ่ม Instructor ใน User เดิม; ไม่ยก unrestricted role selector เป็น permission contract |
| Instructor request/invite/onboarding | REMOVE | AuthPages L296,362; App L159,166,246–247; store L1264–1404 | §8; `/admin/instructors` ปรับเป็น directory/เพิ่ม Instructor ไม่ลบงานนี้ไปด้วย |
| Course editor/Curriculum/Chapter/Quiz definition | KEEP + ADAPT | CoursePages; CurriculumWorkspace; ChapterWorkspace; QuizEditorPage | §§2.3,6.5; shared editor core ได้เมื่อ interface ชัด แต่ orchestration แยกแอป |
| Course review/publish/version conflict | KEEP + ADAPT | CourseReviewPage; lib/course-review; store save/review | §§2.3,5.2; revision ที่ Admin ตรวจตรงข้อมูลจริง; published edit ทันที; AI update ไม่ invalidate approval |
| Archive/ปิดขาย/ลบคอร์สทำประวัติหาย | REMOVE | CoursePages actions; store L605; CourseStatus | §§2.3,4.6,8; เก็บ history guards ของ item/quiz และข้อมูลผลเรียน |
| YouTube lesson/player | ADAPT + MISSING correct media flow | VideoEditor L35–40; LessonPages/video; ChapterPreview L36 | §§2.3,9.2 V01/V03; embed/error/permission; ไม่ใช้ watched duration เป็น completion |
| Upload Video/Mux/Bunny | REMOVE successful upload capability; optional unavailable control | VideoEditor file/base64 branch; Mux env declaration only | §8,V02; unavailable response/no record/no overwrite; ภาพยังอยู่ใน scope |
| Free Enroll/My courses/Lesson/Resume | ADAPT; resume MISSING | store L920,1123; LessonPages; App L117,171–185 | §§2.4–2.5,6.4; Instructor เรียนคนอื่นได้; owner/Admin preview ไม่ทำผลเรียน; server persistence |
| Course Quiz/Answer/retake/ผลสูงสุด | ADAPT | store L1135–1234; learner/QuizPages | §§2.6,5.6,9.4; >70 จริง, complete answers/pending, snapshots, server grade, submitted immutable |
| Instructor owner grading/queue/learner roster | KEEP + ADAPT | QuizPages; LearnerReviewQueuePage; InsightPages L124; analytics helpers | §§3.4,6.6; เก็บ course learner/results ที่จำเป็น; ถอด admin grading และ analytics navigation |
| Academic analytics/Pre–Post comparison dashboard/CSV | REMOVE dashboard/comparison; KEEP necessary learner/results read model | InstructorAnalyticsPage; analytics pages; comparisonSets | §§1,3.4,8 ไม่มี comparison dashboard ใน V1; ไม่ถอน basic roster/queue/attempt result ตามชื่อ analytics |
| Assignment แยก/แจ้งเตือน assignment | REMOVE | AssignmentsPage; store L1419; learning-history L9–40 | §8; course Quiz ยังมี; legacy attempt references ต้องไม่หาย |
| Certificate ตนเอง/download/auto issue | ADAPT + MISSING server artifact/snapshot | AccountPages L14,97; store awardCertificate L201 | §§2.7,6.7,9.5; one per enrollment, recipient/course snapshot, retain completion after added content |
| Public certificate verify | REMOVE | App L256; VerifyCertificatePage | §6.7 ระบุไม่อยู่ในรอบแรก; ไม่แทนด้วย API public ใหม่ |
| Admin global certificate browser/download | REMOVE standalone V1 screen; KEEP course completion status | Admin CertificatePages L16; App L253–254 | §1.2 มี certificate.read_self; §§3.4,6.7 ให้ดูผลตามงานจัดการ ไม่เพิ่ม read/download-all permission เอง |
| Stripe checkout/result/pending/error | KEEP client behavior + ADAPT query | api/payments L91,133,145; StripePaymentPages; Commerce wrapper | §§2.4,6.5.1,9.3.1; reuse validation/abort/timeout; Backend/Webhook MISSING; result GET ไม่ fulfill |
| Redeem/Admin issue-used-revoke codes | ADAPT | AccessCodesPage; CommercePages L15,43; store L942 | §§2.4,5.4,6.3; one-use/no-expiry/Unused–Used–Revoked, atomic enrollment, no Order/share/discount |
| Cart/Order history/discount/price alerts | REMOVE | CartPage; CommercePages/OrderPages; CourseCartButton; store cart/quote actions | §8; ถอด watchers/mockPriceEmails/links พร้อม page ไม่ถอด payment/redeem |
| Finance/refund/share/payout/referral | REMOVE capability | Finance pages; businessAnalytics; store payouts/referral; AccessCode utils | §8; Payment abnormal status read ขั้นต่ำยังอยู่; ไม่สร้าง refund policy ใหม่ |
| Inbox/ถามผู้สอน | REMOVE | InboxPage, api/inbox, store inbox, mock loader | §8; ถอน contacts/attachments/drafts/navigation ไม่เปลี่ยน course content ownership |
| Blog Published read/Admin draft-write-publish | KEEP + ADAPT | BlogPages; BlogAdminPages; store L401 | §§2.8,6.10, B01–B04; lesson article คนละ domain; `/articles/:id` เดิมไม่เปลี่ยนเพราะ API ตัวอย่าง `/blog/{slug}` |
| AI chat/history/search/rename/delete/เลือกคอร์ส | KEEP UX + ADAPT | LearnerAiPage, ai-chat-model | §§2.9–2.10,6.11; database/server authorization/quota MISSING; Admin แชตตนเองได้ ไม่อ่านของคนอื่น |
| AIPractice ในแชต | ADAPT + MISSING real generation/result API | ai-practice-mock; AiResponse; model practice_set | §§2.11,5.12,6.11, AI24–29; no early answer keys, stored snapshot, answer result server, ไม่เปลี่ยน Quiz/progress/cert |
| Admin ai_enabled/Transcript | KEEP + ADAPT API/projection | store L580,592; ChapterWorkspace L274 | §§2.9,6.11; admin-only save แยก draft; Instructor save ต้องไม่ overwrite Transcript |
| AI Knowledge/Big Data/Admin learner-chat dashboard/auto transcript | REMOVE requirement/ห้ามเพิ่ม | ไม่พบ live dedicated service; mock business reports คนละความสามารถ | §8; เก็บ server metadata/history เพื่อใช้ภายหลังโดยไม่สร้าง dashboard |
| Notifications review/grade | ADAPT existing aid; REMOVE assignment branch | WorkspaceNotifications; store submit/grade/saveAssignment | ไม่เพิ่ม notification platform/email/push requirement; UI link ต้องยึด role/course; server wiring ต่อเมื่ออยู่ใน agreed contract |
| Runtime feature gates | KEEP technical gate + ADAPT registry | config/features; FeatureRoute; feature-release tests | §8 ไม่ทำ release dashboard; ไม่ตั้ง released เพราะ migrate/build ผ่าน |
| LINE/co-instructors/release CMS | REMOVE requirement/ห้ามเพิ่ม | ไม่พบ complete current flow | §8; ห้ามถือว่า missing เท่ากับต้องสร้าง |

รายการ **REMOVE** ข้างต้นเป็น scope proposal สำหรับ approval ไม่ใช่ไฟล์ที่ถูกลบแล้ว; ความสามารถที่ไม่ใช่ V1 ไม่กำหนดวันส่งเฟสอื่น

## 5. Target folder structure และ dependency direction

```text
apps/
  web/src/
    app/{router,providers}/       # public/auth/learner/instructor modules
    layouts/                     # Public/Auth/Learner/Instructor
    features/
      public/ auth/ account/ courses/ blog/
      course-authoring/ learning/ assessment/ certificate/
      payment/ redeem/ ai/ instructor/
    shared/                      # เฉพาะ Web ที่ไม่ใช่ business resource store
    main.tsx
  admin/src/
    app/{router,providers}/       # auth/admin modules
    layouts/                     # Admin/Auth
    features/
      auth/ account/ users/ instructors/ courses/
      course-authoring/ course-review/ learners/
      redeem/ payment/ blog/ ai/
    shared/
    main.tsx
packages/
  ui/                            # tokens/adapters/controls/rich-content primitives
  api-client/                    # transport/error/cancellation infrastructure
  contracts/                     # agreed DTOs/errors/validators per flow
  course-authoring/               # conditional proposal; bounded editor core only
docs/
```

ไม่มีคำสั่งสร้างโฟลเดอร์ว่างทั้งหมด `api/hooks/pages/components` อยู่ใน feature เท่าที่มี actual consumers; `shared/api` ภายในแต่ละแอปประกอบ client ของแอป ส่วน endpoint/query hooks อยู่ใน feature; `courses` ไม่เป็น editor และ `assessment` ไม่เป็น Quiz definition editor

กฎ: apps → packages, packages → apps ห้าม, web ↔ admin ห้าม, package cycles ห้าม; CI ต้องตรวจ import direction ตั้งแต่ R2 พร้อม source dependency graph ของ retained slices

### 5.1 Shared package boundary และสิ่งที่ไม่ shared

| Package | รับผิดชอบ | ห้ามรวม |
| --- | --- | --- |
| ui | semantic tokens/source, Ant/Mantine/Tailwind adapters, Button/Field/Dialog/feedback primitives, avatar/image picker/presentation primitives หลังแยก data props, rich document editor/renderer ที่ reuse จริง | useLms, role switches, course/payment/progress selectors, admin navigation, endpoint calls, resource DTO ทั้งก้อน |
| api-client | configured base URL/credentials strategy, JSON handling, normalized errors, timeout/AbortSignal, request correlation | courseApi/userApi/payment business endpoints, auto grant enrollment, global user cache, demo account identity |
| contracts | DTO/enums/requests/responses/error codes และ runtime validation ที่ backend ร่วมรับต่อ flow; public/learner/management views แยก | LmsData, seed fixtures, client draft models, passwords/hash/verification secrets ใน frontend response, browser-local migrations |
| course-authoring (conditional) | editor draft types และ controlled Video/Article/Assessment/Preview/Curriculum presentation ที่พิสูจน์ reuse; callbacks/capabilities/links/ID factory จาก caller | route pages, auth/permission policy, API/Query hooks, localStorage persistence, Admin-only Transcript mutation, course approval commands |

ไม่ shared เพียงหน้าตาคล้าย: PublicCatalog กับ AdminCourses; learner attempt กับ Quiz editor; user profile กับ AdminUser detail; learner certificate กับ global admin listing; CourseCard/StatusTag/ContentTypeIcon/CourseProgress ที่ยังรู้ domain ต้องอยู่ใน feature หรือ typed shared domain boundary ที่มี evidence ห้ามโยน `common.tsx` ทั้งไฟล์เข้า ui

`DirectorySearch` มีทั้ง pure display และ router hook ต้องแยกถ้า reuse; `ImageUploadField` มี FileReader/base64 เป็น prototype input behavior ไม่ใช่ production upload API; RichDocument/renderer ต้องตกลงรูปแบบ rich content/validation และ sanitization ไม่ถือว่า `unknown`/HTML เป็น approved contract

### 5.2 Course Authoring extraction decision

**Lead ยืนยัน reuse ระหว่างบทบาทได้แล้ว แต่ยังไม่อนุมัติย้าย page ทั้งก้อนเป็น package**: Admin ไป source editor เดียวกับ Instructor จริง ผ่าน `/teach` และ ChapterWorkspace ใช้ VideoEditor/RichTextEditor/AssessmentEditor/ChapterPreview; shared leaf components ส่วนใหญ่รับ controlled props แต่มี imports ของ prototype types/data/CSS และ page มี store/router/draft/save/Transcript coupling

ข้อเสนอคือเตรียม bounded editor core interface ใน R2a หากต้องใช้ editor พร้อมกันตอน split ให้ extract เฉพาะส่วนนี้เป็น `packages/course-authoring` หลังเจ้าของ approve แผนและตรวจ package interface gate ไม่สร้าง package ตามชื่อหรือก่อนมีผู้ใช้สองแอป ถ้ายังแยก interface ไม่ได้ R2a ถือว่าค้างและยังไม่ declare split สำเร็จ ไม่แก้ด้วย cross-app imports/copy editor/วาง business editor ใน ui

Gate ต้องระบุ draft value + onChange, save-result/dirty/conflict lifecycle ของ caller, stable client ID factory, navigation callbacks/preview data, capability flags เพื่อ UX, scoped CSS ที่ต้องใช้; ไม่มี import จาก apps/store/data seeds; Admin Transcript UI inject เป็น slot/callback แยกจาก learning draft save; library dependencies มี owner และทั้งสอง builds ผ่าน R6 ทบทวนหลังเชื่อม API จริงก่อนขยาย core

## 6. Route ownership และ URL migration

เก็บ Web URLs เดิมของความสามารถที่อยู่ใน scope: `/articles`, `/explore/courses`, `/account/profile`, `/learn/courses/:courseId/videos|articles/:itemId`, `/teach/...` ไม่เปลี่ยนเป็นตัวอย่าง `/blog` หรือ `/learn/.../items` ระหว่าง structural migration

| พื้นที่ | Owner / target guard | Mapping ที่ต้องรักษาหรือเตรียม |
| --- | --- | --- |
| Public/Auth/catalog/blog | Web | `/`, `/about`, `/courses*`, `/instructors/:id`, `/articles*`, login/register/verify/forgot/reset; `/courses*` สมาชิก redirect ไป `/explore/courses*` คง slug/query/hash |
| Learner learning/assessment/certificate/payment/redeem | Web | `/learn*` ที่ retained, `/account/certificates*`, `/checkout/:courseId`, `/checkout/:orderId/result`; Learner/Instructor ของคอร์สอื่นตามบัญชี+enrollment ไม่เปิด Admin ทำผลเรียน |
| Instructor management/grade/roster | Web | `/teach/courses*`, `/teach/quizzes*`, `/teach/reviews`, `/teach/attempts/:attemptId/grade`, `/teach/learners`; owner check แยก learner enrollment |
| Admin users/instructors/course/review/codes/blog | Admin | retained `/admin*`; `/admin/instructors` เปลี่ยนหน้าที่จาก request/invite เป็น directory/assign; `/admin/access-codes` เดิมรองรับเฉพาะ redeem capability |
| Admin editor/curriculum/preview/learner results | Admin own pages | **proposed** `/admin/courses/new`, `/:courseId/settings|curriculum|chapters/:chapterId|preview|learners`, `/admin/quizzes[/:quizId]`; ต้อง map legacy Admin `/teach` links/params ก่อนเปิด split |
| Admin account/AI own conversations | Admin own orchestration | **proposed** `/admin/account/profile`, `/admin/ai`; ไม่ตัด Admin own AI ตาม scope แต่ไม่ทำหน้าอ่านแชตคนอื่น; shared AI UI extraction ต้องพิสูจน์ interface เพิ่ม ไม่บังคับ package ใหม่จาก R0 |
| Admin abnormal Payment read | Admin payment feature | **proposed** `/admin/payments/:paymentId` ตาม contract §6.5.1; ไม่คืน Orders/Finance dashboard |
| removed routes | ไม่มี V1 owner | ถอด nav/actions/gates; direct URLs ได้ not-found/ข้อความเลิกใช้ที่ไม่ให้ข้อมูลเก่า; ไม่ redirect finance/inbox/assignment ไปฟีเจอร์อื่นแล้วอ้างเทียบเท่า |
| system/login/error boundaries | แต่ละแอป | not-found/no-access/loading/error/unauthenticated เป็นของแต่ละ app; admin login callback/entry ต้องกำหนดก่อน session integration |

ชื่อ URL Admin ใหม่เป็น **ข้อเสนอพร้อม migration requirements** ไม่ใช่ route ที่สร้างหรือ hosting decision แล้ว การ deploy แบบคนละ origin กับ path routing ต้องเลือกให้ตรงกันใน R2 ก่อนเปิด independent deployments

Migration ledger ต่อ route ต้องบันทึก old path/role → owner/canonical target → preserved params/query/hash → compatibility lifetime → test/rollback owner ตัวอย่าง Admin old `/teach/courses/:id/curriculum` ไป Admin own curriculum แต่ Instructor URL เดิมคงอยู่; legacy shim ใช้ trusted session/capabilities และ allowlisted target origin/path ไม่รับ arbitrary `next`/`returnTo` เป็น external redirect

`/checkout/:orderId/result` เปลี่ยน **parameter meaning** ได้โดยรักษา URL shape: Stripe ใช้ payment ID, Redeem แยก result path/adapter ตาม contract ไม่สร้าง Order Domain เพราะชื่อเดิม ต้องวาง compatibility ของ `channel=redeem`, `code`, `ref` ที่จะถอนก่อนเปลี่ยน R1/R8; old used redemption แสดงสิทธิ์เดิมโดยไม่ใช้โค้ดใหม่/สร้างรายการซ้ำ

Preserve queue `course|courseId`, `mode`, `q`, `returnTo`; editor `item/add/view/course/chapter`; login `next`; AI `courseId/attemptId/questionId`; directory search/pagination/back; retake/snapshot URL ownership. RedirectCourseQuiz ปัจจุบันส่ง not-found ไป `/404` ที่จบ wildcard ต้องมี consistent behavior ใน R3 ไม่เปลี่ยน slug หรือ ID โดยอัตโนมัติ

## 7. State ownership และ data authority

| Data / lifetime | Owner ใน target | ปัจจุบัน / reader-writer / งานย้าย |
| --- | --- | --- |
| Session/current account/capabilities | Backend session + AuthProvider ต่อแอป | store currentUserId/signIn demo; provider ดู lifecycle ไม่เก็บ users/courses ทั้งระบบ |
| Users/profile/auth identities/verification/reset | Backend; account/auth/users feature Query | AuthPages/AdminUsers/Profile; mutation response field visibility; ไม่คัดลอก credentials/token model ใน types |
| Course/catalog/review/content/Quiz definition | Backend; feature Query แยก public/manage projections | saveCourse/Chapter/Workspace/Quiz → Catalog/authoring/review; reuse server IDs/revisions |
| Enrollment/source/lifetime access | Backend; learning/redeem/payment query | enrollFree/simulatePayment → MyCourses/Lesson/AI; ไม่ให้สิทธิ์จาก URL/client status |
| Progress/resume/completed_at/snapshot | Backend; learning query | boolean course:item:user → Lesson/common progress; current model ไม่มี resume/completion snapshot |
| QuizAttempt/submitted Answers/snapshot/high score | Backend; assessment query | start/saveDraft/submit/grade → result/queue; server-accepted answer draft เป็น server state, unsent input เป็น UI draft |
| Certificate/document snapshot | Backend; certificate query/download | awardCertificate → Account; one per enrollment/recipient/course snapshot; UI ไม่ออกใบเอง |
| Payment/status/event/fulfillment | Backend; payment query | payment client response ปัจจุบันอยู่ component state; ไม่มี PaymentEvent server ที่ตรวจได้ |
| RedeemCode lifecycle | Backend; redeem feature query/mutation | AccessCode mixed model/simulatePayment; atomic used+enrollment; Admin Unused revoke only |
| BlogPost Published/Draft | Backend; blog query แยก access | saveBlogPost → reader/admin; ไม่ใช้ lesson article type แทน domain |
| ai_enabled/Transcript | Backend; Admin ai feature query/mutation | saveVideoTranscript/setCourseAiEnabled → editor/AI; Admin-only projection/save แยก learning draft |
| AI conversation/messages/context/practice results | Backend; ai query | ai-chat-model local history + mock → chat; unsent draft ไม่ใช่ sent Message; no early answer keys |
| AI usage/reservation/reset_at | Backend; account-scoped ai query | ไม่พบ daily quota implementation; 20 success/วันไทย/request_id ทุก role |
| Editor/form/grading/composer unsent draft | Local UI/form owner ต่อ page/feature | React draft/sessionStorage ตาม user+resource; baseline revision/conflict/dirty; refetch ไม่ทับ draft และ submit success ค่อยล้าง |
| Selected item/sidebar/modal/view mode/upload preview | Local UI state ต่อ component/layout | ไม่ย้ายเป็น server store; transient URLs/object URLs ต้อง cleanup |
| Search/filter/page/safe returnTo | Router URL state ต่อ app | shared control props ได้ แต่ router hooks อยู่ app; validate allowed path |
| Query cache/refetch/invalidation | QueryProvider ต่อแอป | แต่ละ app มี cache เอง; key ต้องแยก account/access projection/resource; logout/account switch cancel + clear sensitive cache |
| Cart/Orders/share/payout/referral/inbox/requests/invites/assignments/comparison | REMOVE active state/actions | loader/fixtures/actions/components consumer chain ต้องถอด; legacy stored fields รักษาแบบ inert compatibility ตามแผน ไม่ reset browser |
| Review/grade notification aid | Feature/UI ตาม agreed endpoint | ถอด assignment branches; backend scope ไม่รับรอง notification service ใหม่ |

Persistence keys ที่ต้องทำ compatibility: `stay-elearn-ux-v2` (store), AI user-specific key ใน ai-chat-model, `melearn-grading-draft:<user>:<attempt>` ใน QuizPages, quiz editor draft key และ Inbox per-user/thread draft key ดู source ตำแหน่งใน appendix State evidence ไม่ใช้ key เหล่านี้เป็น server identity

ระหว่างย้ายให้มี data owner เดียวต่อ slice: adapter อ่าน prototype resource → feature API/Query แล้วถอน store reader/writer ของ slice นั้น ไม่ dual-write backend และ localStorage ทิ้งไว้ถาวร In-progress server attempt กับ unsent UI answers แยกชัดตาม contract

Web/Admin ต่าง origin ไม่ใช้ localStorage เป็น shared backend ชุดที่ต้องแก้/อ่านข้อมูลข้ามแอปต้องเลือก shared test API/mock service ที่มีแหล่งข้อมูลเดียวก่อนตรวจ integration; fixture-only builds ใช้ตรวจ isolated rendering ได้แต่ห้ามอ้าง cross-app consistency. กรณี API ยังขาดให้แสดง readiness/error ชัด ไม่ fake success หรือส่ง demo User ID ไปยืนยันตัวตน

## 8. Safe execution plan R0 → R13

| Phase | ขอบเขต / ข้อพึ่งพา | เกณฑ์ผ่านก่อน checkpoint |
| --- | --- | --- |
| R0 | Inventory/review นี้ + baseline + URL/state/package ledger | ส่งรายงาน/แผนพร้อมหลักฐาน ให้เจ้าของ approve ก่อน source implementation |
| R1a | แยก retained dependencies **ขั้นต่ำ**: grading helper/CSS, learner roster gate, Payment/Redeem wrapper, pure history guards; ปรับ FEATURES/matrix/tests | import chains ยังครบ; retained deep links/queue/draft/result ไม่หาย; semantic payment/redeem/roster ไม่ผูก feature ที่กำลังถอน |
| R1b | Functional scope cleanup: nav/routes/inline actions ของ REMOVE; Admin grading/public restricted preview/public verify/unsafe course deletion; Admin instructor directory แยก requests | ไม่มีทางทำ capability ที่ถอน; management/results ที่ scope ให้ยังอยู่; ไม่เพิ่ม API/security claims จาก client checks |
| R1c | ถอน out-of-scope actions/fixtures/loader branches/styles/dependencies และ tests ที่ยืนยัน capability ถอน; Redeem adapter ขั้นต่ำไม่สร้าง Order/share ก่อนถอน simulatePayment | reopen saved demo ไม่ reseed inbox/finance/assignments; historical attempts/enrollments/certificates ไม่ถูกลบ; used codes ไม่กลับ unused; ข้อมูลที่เก็บเดิมไม่ reset |
| R2a | Authoring boundary prep + migration ledger + workspace decisions; bounded shared editor core ถ้าจำเป็นตาม §5.2 | ไม่มี prototype data/store/router imports ใน core; caller owns save/draft/permissions/Transcript/navigation; ไม่ copy page ทั้งก้อน |
| R2b | สอง entries/workspace/build/aliases/scripts + basic CI + dependency-direction checks | Web build ไม่ import Admin source; Admin build ไม่ import Web source; apps/packages typecheck/test/build ที่มีจริง; preview mode เปิด retained prototype flow ได้ |
| R3a/R3b | Token source/theme adapters/shared controls และ nested router/layouts แยก batches | รักษา computed look/flow; focus/hover/disabled/contrast/responsive; no uncontrolled global override/Preflight; migration deep link/refresh/back/no-access ผ่าน |
| R4a | Agree contracts ต่อ flow จาก Final 1.6 กับ backend; session/origin/media shape/conflict/idempotency | success/error examples/projections/version/owner; status draft จน backend รับร่วม; ไม่มี LmsData contract |
| R4b | transport/query/cache/account boundary/mock adapter หลัง contract ที่ flow ใช้ | credentials strategy/abort/timeout/runtime validation, cache isolation; mutation invalidation; no dual resource owner; reuse payments parser tests |
| R5 | Auth/Profile/Admin user-create/Instructor assign/Public/catalog/Blog ตาม contracts | Admin-created exemption, Username/Google/Verify/Reset/error; remove arbitrary role operations; retained URLs unchanged; prototype auth ยังไม่ใช่ real auth |
| R6 | Authoring/review/YouTube/Admin Transcript + bounded extraction review | save atomic/conflict/draft/preview/order/approved reset/published edits; no successful Upload Video; Transcript save ไม่ทับ learning draft |
| R7 | Enroll/learn/resume/assessment/owner grading/completion/certificate | >70 exact, highest graded complete attempt, pending/no early cert, snapshots, role flows, added content preserves completion; immutable submitted answers |
| R8 | Payment/Redeem real integration frontend; Admin abnormal Payment/code lifecycle | webhook-only/read-only GET; source/pending/error/already-enrolled/revoke/used race scenarios ต้อง server proof; ไม่กลับไปสร้าง Order/discount/share |
| R9 | AI Chat/knowledge/history/quota/practice + Admin own AI orchestration | DB/context/ownership, server 20 success/day Thai, request duplicate/reservation, no early keys/practice effect on progress; evidence จริงแยก mock |
| R10 | Cross-app/API integration acceptance ตาม scope บท 9; ถอน replaced legacy resource owners | real persistence/permissions/concurrency/Stripe test mode/AI; no fake fallback ใน flow ที่ประกาศพร้อม |
| R11 | Container images แยก/static runtime/health/SPA fallback จาก monorepo root | reproducible build/assets/deep links/config; no Vite dev/preview production server; no credentials ฝัง frontend |
| R12 | ต่อ basic CI: dependency-aware checks/promotion/environment/rollback; CD หลังเลือก hosting | shared/root lock/config triggers dependents; pipelines/deployment rights แยก; ไม่เปิด auto-deploy ระหว่าง refactor เอง |
| R13 | Final acceptance revision เดียวกันก่อนเสนอรวม main | ทั้งสอง runtime artifacts + browser/API/scope tests + rollback evidence; main Final 1.6 เป็นเป้าหมาย ไม่ merge/deploy จนได้รับคำสั่ง |

ลำดับ R5–R9 เป็น dependency graph ไม่บังคับ serial ทั้งหมด: เตรียม contract ของ flow ถัดไปได้, learning ไม่ต้องรอ editor ทั้งหมดถ้า contract พร้อม, R11/basic R12 ทำหลัง R2 ได้แต่ไม่แทน R10 server acceptance. ทุก phase แตก verified commits ตาม flow ห้ามทำ whole-repo rewrite/formatting

## 9. จุดที่แผนเดิมต้องแก้จาก R0

1. R1 ต้องมี retained-dependency step ก่อน delete และถอน side effects/seed loader ด้วย; semantic registry ของ payment/redeem/roster ยังไม่แยกจริง
2. R2 ต้องมี authoring interface gate ก่อน split builds; reuse จริงแต่ย้าย pages/store/router ไม่ได้ตามชื่อ package
3. ทำ route migration ledger ทั้ง Admin `/teach`, Admin account/own AI, payment result parameter meaning และ URLs ที่ถอด ไม่เปลี่ยน `/articles` ตาม API ตัวอย่าง
4. แยก Admin management permission จาก owner grading; Instructor learner flow ต้องแก้ทั้ง route/action/API ไม่ใช่เมนูอย่างเดียว
5. เพิ่ม functional acceptance >70/no rounding/highest attempt, completion/resume/snapshots, forbidden destructive delete/public preview/verify, correct YouTube/unavailable upload
6. ระบุ missing Auth/Admin create/Google/Resend/Reset/AI quota/knowledge/DB และ Payment-to-learning data owner ให้ชัด ไม่เริ่มจากสมมติว่า API/client ไม่มีเลยหรือ prototype พร้อมแล้ว
7. Shared UI migration แยก primitive/domain/business และ rich renderer dependencies; ทดสอบ cascade/import order/layer ก่อนถอน global CSS
8. Baseline tests ผ่านบางชุดเป็น historical behavior; ต้องปรับ test scope ใน R1 และเพิ่ม meaningful acceptance ของ retained flow ไม่ลด checks เพื่อให้จำนวนเท่าเดิม
9. Preview/production feature environment เป็น release gate แยกจาก builds; default production build ปิดทุก prototype feature ห้ามแก้เป็น released เพื่อให้ demo เปิดได้
10. Add explicit decision register/phase blockers: workspace tool, origins/session, shared mock service, contract owners, production config/media/upload storage, hosting/CD. ไม่เอาทุก decision มาบล็อก R1

## 10. Baseline verification และขอบเขตที่ยังไม่ได้ตรวจ

| Check | ผลจริง |
| --- | --- |
| `npm.cmd run typecheck` | PASS (`tsc --noEmit`, strict ตาม tsconfig); ไม่มี source fix |
| `node --test tests/*.test.ts tests/*.test.mjs` | PASS 51/51, fail/cancel/skip 0; Node `v24.14.0`; native TS+MJS helper/client/registry tests ไม่ใช่ full browser/backend tests |
| `npm.cmd run build` | PASS Vite `7.3.6`, 49.13s; warnings ignored module `use client` ใน dependencies และ chunk >500KB |
| Build artifact | index JS 2,980.83kB/gzip901.44kB; CSS483.98kB/gzip79.20kB; AI lazy JS295.35kB/gzip88.50kB; dist เป็น generated ignored output ไม่ commit |
| Read-only browser at `http://127.0.0.1:5174` | Landing แสดง; session ที่มีอยู่เป็น Admin; `/courses` redirect `/explore/courses`; Admin list→จัดบทเรียนไป `/teach/courses/course-writing/curriculum`; deep navigation เปิดได้; `/teach/reviews`แสดง queue/grade actions ให้ Admin; `/articles`แสดง Published list; console error snapshot ว่าง |
| Browser preservation | ไม่ sign-in/out/switch role/reset storage/สร้างหรือบันทึกคอร์ส/กด grade/จ่ายเงิน; navigation อาจ trigger persistence effect ของ prototype เอง ไม่อ้าง browser snapshot ไม่ถูกเขียนโดยแอป |
| Default production gates | source/tests ยืนยันทุก feature ยัง prototype และ production เปิด released เท่านั้น; build ผ่านไม่เท่ากับ retained routes เปิดใน production |

ยังไม่ได้ตรวจ Guest session ที่ logout จริง, Instructor/Learner lifecycle ครบ, save/grade/redeem/checkout mutation, mobile/keyboard/contrast ครบทุกหน้า, actual Stripe/Google/Resend/AI/backend/DB, cross-device/concurrency/deployment. ไม่มีผล live endpoint/server acceptance ใน R0; service readiness ไม่ได้พิสูจน์จาก client tests ที่ inject fetcher

## 11. Risks / blockers / decision register

| ประเด็น | ผลกระทบ | จัดการเมื่อใด |
| --- | --- | --- |
| Cleanup ทำ retained helpers/roster/payment/redeem หาย | R1 regression blocker | consumer/gate ledger R1a, tests+browser retained flow ก่อนถอน |
| local loader reseeds legacy fields/used code history | R1 data preservation blocker | explicit compatibility/no-reset; preserve identifiers/history, หยุด active legacyside effects |
| authoring core ยังผูก types/data/CSS/store | R2 split blocker | R2a interface gate; proof app imports เพียง package public exports |
| package manager/workspace/build tool ยังไม่เลือก | R2 decision | ใช้ npm/lock เดิมเป็น base ในการประเมิน ไม่ติดตั้งเครื่องมือหรือเปลี่ยน lock ช่วง R0; เลือกก่อน R2 ไม่บังคับ Turbo/Nx |
| Admin own AI reuse/interface ยังไม่พร้อม | R2/R9 planning risk | preserve scope และ own route; prove minimal reusable chatrenderer ถ้าต้อง extract ไม่ copywholepage/เพิ่ม genericbusinesspackage เอง |
| origins/session/credentials/CORS/CSRF/redirect strategy | R4 auth integration blocker | ตัดสินร่วม backend/security ก่อน auth จริง; frontend defaultscredentials include ไม่ใช่ข้อตกลงแล้ว |
| contracts/backend ยังไม่มีร่วมรับ | per-flow R4a/R10 blocker | contractowner/version/projection/example; draftmock เตรียม UX ได้แต่ไม่เรียก frozen/integrated |
| Payment status จาก server แต่ Learning ยัง local | R8 end-to-end blocker | enrollment queryinvalidate/refetch server owner หลัง Webhook ไม่เติม local สิทธิ์เองเพื่อแก้หน้าเรียน |
| server grade/quota/atomicredeem/snapshot | R7–R10 acceptance blocker | serverpermissions/idempotency/races/exactscore tests ไม่ย้าย clientalgorithms แล้วอ้าง ready |
| Theme layers/global override/oldstyles | R3 visual regression risk | computedbaseline+semantictokens/adapters scoped CSS; ย้ายทีละ owner ไม่ redesign |
| richercontent/uploads/answerimage persistence | R6/R7 contract decision | uploadstorage/limits/resourceURL+documentformat/sanitization; base64local ไม่ใช่ APIcontract; Video ไม่ใช้ upload |
| domain/package tests พึ่ง mockseed/inlinedsource | R1/R2 test maintenance | ย้าย tests ตาม ownership และ replaceout-of-scope assertions; ไม่ใช้ helperpass เป็น UX/securityproof |
| hosting/CI provider/imageconfig/promotion ยังไม่เลือก | R11/R12 blocker เฉพาะ CD | Cloud Run candidate; explicitpublicruntimeconfig strategy/independentrollback ก่อน publish |

**Approval boundary:** review matrix, R1a–c functional changes/ข้อมูลเดิม, R2a shared-editor gate และ route migration proposals ก่อนเริ่ม source เฉพาะประเด็น technical ที่ยังเปิดตัดสินใน phase ที่เกี่ยวข้อง ไม่ถามธุรกิจ Final 1.6 ที่ยืนยันแล้วซ้ำ

## 12. Checkpoints และ rollback

เก็บ prototype/tag เดิมตลอด; sourcebaseline ตรง SHA ใน§1. R0 checkpoint เฉพาะ report/แผน/ลิงก์เอกสาร หลังตรวจ links/whitespace; R1 เป็น verified commits แยก dependency-prep/functionalcleanup/loadercleanup; R2–R9 แยกตาม flow และผ่าน typecheck/tests/build+browserchecks ที่สัมพันธ์ก่อน push

ก่อนแต่ละ batch ตรวจ dirty/index/HEAD ใหม่ รักษางานอื่น stage explicit paths เท่านั้น ย้อนด้วย revertverifiedcommit ไม่ rewritepublishedhistory; code rollback ไม่คืน localStorage/database โดยอัตโนมัติ Browser/schema compatibility และข้อมูลจริงเป็นงานแยก ไม่มีการ exportbrowserdata/secrets เข้ารายงาน/Git

## 13. Source inventory appendices

### 13.1 Route → Page → guard/layout/gate

ตารางทุก route ของ baseline อยู่ด้านล่าง; page ที่ชื่อ alias/re-export ต้องตามไปยัง activeimplementation ตาม§3 ARCH-10. `FeatureRoute` เป็น outergate, learner/instructor/admin/paymentUser เป็น helpers ของ prototype ไม่ใช่ targetpermission. ระบบ fallback `/403`/`*` ใช้ PublicShell เอง

L = learner/admin; I = instructor/admin; P = learner/instructor; A = admin; M = learner/instructor/admin **ทั้งหมดเป็น current prototype guard** ไม่ใช่ permission ที่อนุมัติสำหรับ V1. PublicCourseEntry คืน PublicCatalog/PublicCourseDetail หรือ redirect ตาม session; page own layout ต้องตาม implementation ไม่ถือว่าเป็น PublicShell โดยอัตโนมัติ.

| Route declaration | Active page / implementation | Current guard/layout | Current feature key |
| --- | --- | --- | --- |
| [/](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L125) | [LandingPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/landing/LandingPage.tsx#L54) | page own layout | publicSite |
| [/about](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L126) | [AboutPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/landing/AboutPage.tsx#L22) | page own layout | publicSite |
| [/courses](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L127) | [PublicCourseEntry](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L62) | Guest Public / member redirect | courseCatalog |
| [/courses/:slug](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L128) | [PublicCourseEntry](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L62) | Guest Public / member redirect | courseCatalog |
| [/courses/:slug/preview](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L129) | [CourseLessonPreviewPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/public/CourseLessonPreviewPage.tsx#L12) | PublicShell | courseCatalog |
| [/explore/courses](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L130) | [MemberCatalogPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/member/CatalogPage.tsx#L12) | M / Workspace | courseCatalog |
| [/explore/courses/:slug](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L138) | [MemberCourseDetailPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/member/CourseDetailPage.tsx#L12) | M / Workspace | courseCatalog |
| [/articles](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L146) | [BlogIndexPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/blog/BlogPages.tsx#L75) | page own layout | blog |
| [/articles/:id](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L147) | [BlogArticlePage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/blog/BlogPages.tsx#L209) | page own layout | blog |
| [/instructors/:id](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L148) | [InstructorProfilePage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/PublicPages.tsx#L9) | PublicShell | publicSite |
| [/login](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L156) | [LoginPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AuthPages.tsx#L82) | page own layout | auth |
| [/register](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L157) | [RegisterPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AuthPages.tsx#L177) | page own layout | auth |
| [/become-instructor](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L158) | [BecomeInstructorPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AuthPages.tsx#L296) | PublicShell | instructorOnboarding |
| [/invite/:token](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L166) | [DemoAccountPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AuthPages.tsx#L362) (`invite`) | page own layout | instructorOnboarding |
| [/verify-email](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L167) | [VerifyEmailPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AuthPages.tsx#L499) | page own layout | auth |
| [/forgot-password](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L168) | [DemoAccountPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AuthPages.tsx#L362) (`forgot`) | page own layout | auth |
| [/reset-password](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L169) | [DemoAccountPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AuthPages.tsx#L362) (`reset`) | page own layout | auth |
| [/learn](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L171) | [LearnerDashboardPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/DashboardPages.tsx#L17) | L / Workspace | learning |
| [/learn/courses](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L172) | [MyCoursesPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/DashboardPages.tsx#L145) | L / Workspace | learning |
| [/learn/redeem](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L173) | [RedeemCourseCodePage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/CommercePages.tsx#L15) | L / Workspace | commerce |
| [/learn/assignments](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L174) | [AssignmentsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AssignmentsPage.tsx#L33) | L / Workspace | assessment |
| [/learn/ai](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L175) | [LearnerAiPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/LearnerAiPage.tsx#L567) | M / standalone | aiTeacher |
| [/learn/inbox](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L182) | [InboxPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/inbox/InboxPage.tsx#L53) | L / Workspace | inbox |
| [/learn/courses/:courseId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L183) | [LearnerCoursePage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/LessonPages.tsx#L55) | L / Workspace | learning |
| [/learn/courses/:courseId/videos/:itemId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L184) | [VideoLessonPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/LessonPages.tsx#L154) | L / Workspace | learning |
| [/learn/courses/:courseId/articles/:itemId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L185) | [ArticleLessonPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/LessonPages.tsx#L236) | L / Workspace | learning |
| [/learn/courses/:courseId/quizzes/:itemId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L186) | [RedirectCourseQuiz](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L284) | L / Workspace | assessment |
| [/learn/quizzes/:quizId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L187) | [QuizIntroPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/QuizPages.tsx#L16) | L / Workspace | assessment |
| [/learn/attempts/:attemptId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L188) | [QuizAttemptPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/QuizPages.tsx#L116) | L / Workspace | assessment |
| [/learn/attempts/:attemptId/result](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L189) | [QuizResultPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/QuizPages.tsx#L263) | L / Workspace | assessment |
| [/checkout/:courseId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L190) | [CheckoutPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/CommercePages.tsx#L38) | P / Workspace | commerce |
| [/checkout/:orderId/result](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L191) | [CheckoutResultPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/CommercePages.tsx#L147) | P / Workspace | commerce |
| [/account/orders](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L192) | [OrdersPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/CommercePages.tsx#L195) | L / Workspace | commerce |
| [/account/cart](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L193) | [CartPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/CartPage.tsx#L17) | L / Workspace | commerce |
| [/account/orders/:orderId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L194) | [OrderDetailPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/CommercePages.tsx#L249) | L / Workspace | commerce |
| [/account/certificates](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L195) | [CertificatesPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/AccountPages.tsx#L13) | L / Workspace | certificates |
| [/account/certificates/:certificateId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L196) | [CertificateDetailPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/AccountPages.tsx#L97) | L / Workspace | certificates |
| [/account/profile](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L197) | [ProfilePage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/AccountPages.tsx#L196) | M / Workspace | profile |
| [/teach](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L206) | [InstructorDashboardPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CoursePages.tsx#L32) | I / Workspace | instructorCourses |
| [/teach/finance](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L207) | [InstructorFinancePage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/InstructorFinancePage.tsx#L15) | I / Workspace | finance |
| [/teach/analytics](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L208) | [InstructorAnalyticsRoute](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/InstructorAnalyticsRoute.tsx#L7) | I / Workspace | analytics |
| [/teach/courses/:courseId/analytics](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L209) | [CourseAnalyticsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/analytics/CourseAnalyticsPage.tsx#L15) | I / Workspace | analytics |
| [/teach/courses/:courseId/analytics/learners/:learnerId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L210) | [LearnerAnalyticsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/analytics/LearnerAnalyticsPage.tsx#L14) | I / Workspace | analytics |
| [/teach/assignments](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L211) | [AssignmentsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AssignmentsPage.tsx#L33) | I / Workspace | assessment |
| [/teach/inbox](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L212) | [InboxPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/inbox/InboxPage.tsx#L53) | I / Workspace | inbox |
| [/teach/reviews](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L213) | [LearnerReviewQueuePage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/LearnerReviewQueuePage.tsx#L14) | I / Workspace | assessment |
| [/teach/courses](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L214) | [InstructorCoursesPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CoursePages.tsx#L130) | I / Workspace | instructorCourses |
| [/teach/courses/new](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L215) | [CourseEditorPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CoursePages.tsx#L225) | I / Workspace | instructorCourses |
| [/teach/courses/:courseId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L216) | [InstructorCourseOverviewPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CoursePages.tsx#L485) | I / Workspace | instructorCourses |
| [/teach/courses/:courseId/settings](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L217) | [CourseEditorPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CoursePages.tsx#L225) | I / Workspace | instructorCourses |
| [/teach/courses/:courseId/curriculum](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L218) | [CurriculumPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CurriculumWorkspace.tsx#L82) | I / Workspace | instructorCourses |
| [/teach/courses/:courseId/chapters/:chapterId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L219) | [ChapterEditorPage → ChapterWorkspace](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/ChapterWorkspace.tsx#L35) | I / Workspace | instructorCourses |
| [/teach/courses/:courseId/videos/:itemId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L220) | [ContentEditorPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CurriculumPages.tsx#L88) (`video`) | I / Workspace | instructorCourses |
| [/teach/courses/:courseId/articles/:itemId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L221) | [ContentEditorPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CurriculumPages.tsx#L88) (`article`) | I / Workspace | instructorCourses |
| [/teach/courses/:courseId/quizzes](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L222) | [QuizManagerPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/QuizPages.tsx#L17) | I / Workspace | instructorCourses |
| [/teach/quizzes](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L223) | [QuizManagerPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/QuizPages.tsx#L17) | I / Workspace | instructorCourses |
| [/teach/quizzes/:quizId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L224) | [QuizEditorPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/QuizEditorPage.tsx#L121) | I / Workspace | instructorCourses |
| [/teach/quizzes/:quizId/attempts](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L225) | [QuizAttemptsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/QuizPages.tsx#L89) | I / Workspace | assessment |
| [/teach/attempts/:attemptId/grade](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L226) | [GradeEssayPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/QuizPages.tsx#L146) | I / Workspace | assessment |
| [/teach/courses/:courseId/preview](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L227) | [CoursePreviewPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/InsightPages.tsx#L12) | I / Workspace | instructorCourses |
| [/teach/courses/:courseId/learners](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L228) | [InstructorLearnersPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/InsightPages.tsx#L124) | I / Workspace | analytics |
| [/teach/learners](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L229) | [InstructorLearnersPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/InsightPages.tsx#L124) | I / Workspace | analytics |
| [/admin](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L231) | [AdminDashboardPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L28) | A / Workspace | operations |
| [/admin/business-analytics](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L232) | [AdminBusinessAnalyticsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L18) | A / Workspace | analytics |
| [/admin/finance](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L233) | [AdminInstructorFinancePage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminInstructorFinancePage.tsx#L37) | A / Workspace | finance |
| [/admin/reports/finance](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L234) | [AdminFinanceReportPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L23) | A / Workspace | finance |
| [/admin/analytics](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L235) | [AnalyticsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/AnalyticsPage.tsx#L14) | A / Workspace | analytics |
| [/admin/analytics/courses/:courseId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L236) | [CourseAnalyticsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/analytics/CourseAnalyticsPage.tsx#L15) | A / Workspace | analytics |
| [/admin/analytics/courses/:courseId/learners/:learnerId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L237) | [LearnerAnalyticsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/analytics/LearnerAnalyticsPage.tsx#L14) | A / Workspace | analytics |
| [/admin/assignments](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L238) | [AdminAssignmentsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AssignmentPages.tsx#L19) | A / Workspace | assessment |
| [/admin/inbox](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L239) | [InboxPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/inbox/InboxPage.tsx#L53) | A / Workspace | inbox |
| [/admin/articles](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L240) | [AdminBlogPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/BlogAdminPages.tsx#L18) | A / Workspace | blog |
| [/admin/articles/new](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L241) | [AdminBlogEditorPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/BlogAdminPages.tsx#L150) | A / Workspace | blog |
| [/admin/articles/:id/edit](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L242) | [AdminBlogEditorPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/BlogAdminPages.tsx#L150) | A / Workspace | blog |
| [/admin/users](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L243) | [AdminUsersPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L95) | A / Workspace | operations |
| [/admin/users/:id](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L244) | [AdminUserDetailPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L211) | A / Workspace | operations |
| [/admin/instructors](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L245) | [AdminInstructorRequestsPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L343) | A / Workspace | instructorOnboarding |
| [/admin/instructors/:id](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L246) | [AdminInstructorRequestDetailPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L424) | A / Workspace | instructorOnboarding |
| [/admin/courses](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L247) | [AdminCoursesPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L461) | A / Workspace | instructorCourses |
| [/admin/courses/reviews](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L248) | [CourseReviewPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/CourseReviewPage.tsx#L8) | A / Workspace | instructorCourses |
| [/admin/courses/:courseId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L249) | [AdminCourseDetailPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L591) | A / Workspace | instructorCourses |
| [/admin/orders](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L250) | [AdminOrdersPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/OrderPages.tsx#L24) | A / Workspace | commerce |
| [/admin/orders/:orderId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L251) | [OrderDetailPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/CommercePages.tsx#L249) | A / Workspace | commerce |
| [/admin/access-codes](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L252) | [AccessCodesPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AccessCodesPage.tsx#L20) | A / Workspace | commerce |
| [/admin/certificates](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L253) | [AdminCertificatesPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/CertificatePages.tsx#L15) | A / Workspace | certificates |
| [/admin/certificates/:certificateId](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L254) | [CertificateDetailPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/AccountPages.tsx#L97) | A / Workspace | certificates |
| [/certificates/verify/:code](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L256) | [VerifyCertificatePage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/AccountPages.tsx#L158) | PublicShell | certificates |
| [/403](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L264) | [NoAccessPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/SystemPages.tsx#L5) | PublicShell | system (no feature gate) |
| [*](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L272) | [NotFoundPage](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/SystemPages.tsx#L16) | PublicShell | system (no feature gate) |

### 13.2 State/persistence evidence

| จุด | Symbols / lines / consumers |
| --- | --- |
| Main snapshot | store STORAGE_KEY L52, loadData L99, update L243, commitLearningChange L267, persistence effect L230; types L419 LmsData |
| Fixtures/read models | data imports L6–7, initialData L111; store loader L123–169; mocks typed-fixtures/inbox/businessAnalytics/instructorComparisonDemo |
| Course/content/Blog/AI mutations | store saveCourse L451, saveChapter L625, saveChapterWorkspace L707, saveItem L782, saveQuiz L835, saveBlogPost L401, setCourseAiEnabled L580, saveVideoTranscript L592 |
| Learning/completion | store enrollFree L920, markContentDone L1123, startAttempt L1135, saveAttemptDraft L1153, submitAttempt L1161, gradeAttempt L1241, awardCertificate L201; LessonPages L171,L260 อ่าน progress |
| AI history/draft | ai-chat-model storage key L39, loader L91, save L120; LearnerAiPage L94–108,L147–150persistthreads; draft ยังอยู่ใน localhistory |
| Grading draft | QuizPages L187,L191,L222,L238; key ประกอบ account+attempt; previous/next L246–261; ยังไม่เป็น grade ก่อน submit |
| Quiz editor draft/save | QuizEditorPage L142,L153,L185,L219,L224; sessiondraft+baseline; อ่าน localStorage เพื่อ confirmpersist แทน mutationack จริง |
| Inbox draft | InboxPage L358,L415,L473; ถอน activeUI/write ใน R1 ไม่ resetbrowserhistory |
| Network proof | api/payments L98,L133,L145; frontendfetch จริง/responsevalidation แต่ไม่มี backend/Webhooksource ใน repository |

### 13.3 Page → components → layout/state/CSS dependencies

ตารางนี้จับ consumer chains ที่มีผลต่อการแยกแอปและการถอนฟีเจอร์ ส่วน route ทุกหน้าอยู่ใน §13.1 ไม่ได้อ้างว่า leaf component ทุกตัวเหมาะกับ shared package

| Current consumer chain | Dependency ที่ตรวจ / จุดย้าย |
| --- | --- |
| main → AppRoutes → FeatureRoute → RolePage → WorkspaceShell | [main L34](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/main.tsx#L34), [App L77](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L77), [FeatureRoute L6](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/FeatureRoute.tsx#L6); main เป็นเจ้าของ library providers/CSS และ RolePage ห่อ workspace ของทุกบทบาท |
| PublicCourseEntry → PublicShell → PublicCatalog/PublicCourseDetail | [App L62](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L62); อ่าน currentUser แล้วเปลี่ยนไป member catalog; projection และ shell ของ public/member ต้องแยก |
| AdminCourses/CourseReview → /teach → CourseEditor/Curriculum/Chapter/Preview | [AdminPages L487](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/AdminPages.tsx#L487), [CourseReview L23](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/CourseReviewPage.tsx#L23); ไม่มี Admin editor implementation อีกชุดในปัจจุบัน |
| CourseEditor → Ant Form → useLms/saveCourse → /teach overview | [CoursePages L225](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CoursePages.tsx#L225); form draft อยู่ใน page, Admin assignment/AI controls อยู่ในหน้าเดียวกัน; host ต้องรับผิดชอบ save/navigation/capabilities |
| CurriculumPages export → CurriculumWorkspace | [re-export L7](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CurriculumPages.tsx#L7), [active page L82](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CurriculumWorkspace.tsx#L82), CSS import L23; ไม่ใช้ ChapterEditorPage เดิมใน CurriculumPages เป็นหลักฐานของ route chapter |
| ChapterWorkspace → VideoEditor/RichTextEditor/AssessmentEditor → ChapterPreview | [imports L22](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/ChapterWorkspace.tsx#L22), CSS L27, React draft L79, save L257, preview draft L723; route params/store/save/draft/dirty เป็นของ host; controlled editor core เป็น extraction candidate |
| ChapterWorkspace → Admin Transcript draft/save | [Transcript L271](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/ChapterWorkspace.tsx#L271), Admin UI L659; แยก persistence และ capability จาก chapter draft ห้าม Instructor save ส่ง Transcript เดิมกลับไปทับ |
| /teach video/article routes → ContentEditorPage เดิม | [App L220](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/App.tsx#L220), [CurriculumPages L88](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/CurriculumPages.tsx#L88); ยัง active และใช้ Ant Form/TextArea/saveItem แม้ chapter workspace ใช้ editor ใหม่ ต้องเลือก migration path ของทั้งสองทาง |
| QuizPages re-export → QuizEditorPage → RichTextEditor/form/preview | [re-export L87](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/QuizPages.tsx#L87), [active page L121](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/QuizEditorPage.tsx#L121), CSS L10; session draft L153, restore baseline L185, save acknowledgement อ่าน localStorage L219; ห้ามยก persistence นี้เป็น shared package |
| Chapter article/Quiz prompt/Admin Blog → RichTextEditor | [editor L133](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/chapter/RichTextEditor.tsx#L133), [Blog consumer L296](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/admin/BlogAdminPages.tsx#L296); reuse จริง ใช้ Tiptap/Ant/image helper; แยก upload adapter และ rich-document validation ก่อนย้ายเข้าขอบเขต ui |
| AssessmentEditor/VideoEditor/ChapterPreview | [Assessment L17](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/chapter/AssessmentEditor.tsx#L17), [Video L5](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/chapter/VideoEditor.tsx#L5), [Preview L6](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/chapter/ChapterPreview.tsx#L6); controlled props แต่พึ่ง Quiz/VideoItem/Chapter และ createId จาก app จึงเป็น authoring domain core ไม่ใช่ generic ui |
| LearnerReviewQueue/GradeEssay → getReviewQueue/analytics.css | [queue L6](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/LearnerReviewQueuePage.tsx#L6), [QuizPages L11](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/instructor/QuizPages.tsx#L11); retained dependency ต้องแยก helper/CSS/navigation ก่อนถอน analytics pages |
| CommercePages → StripePaymentPages + Redeem → simulatePayment | [wrapper L10](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/pages/learner/CommercePages.tsx#L10), [payments client L133](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/api/payments.ts#L133); คง Stripe validation/status flow แยก Redeem ให้ไม่สร้าง Order/share ก่อนถอน legacy actions |
| common.tsx → app types/data/helpers + presentation + domain cards | [imports L2](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/components/common.tsx#L2); ย้าย primitives ทีละตัว พร้อม props ที่ไม่ขึ้นกับ LmsData ไม่ย้ายทั้งไฟล์เข้า packages/ui |

### 13.4 Theme/CSS owner inventory

- Entry order: [main L10–15](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/main.tsx#L10) โหลด library/fonts แล้ว `shadcn.css` → `styles.css` → `system-theme.css` → `workspace-responsive.css`; page imports เพิ่ม stylesheet อีกชั้น ลำดับ source นี้ไม่ใช่ผล computed style ทุก route
- Token collision: [shadcn root L53](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/shadcn.css#L53) และ [styles root L1](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/styles.css#L1) ใช้ชื่อ `--primary` ฯลฯ ร่วมกัน; theme provider ที่ [theme L25](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/theme.ts#L25) ยังใช้สีเดิม ส่วน Landing มี provider/CSS ของตน ห้ามเลือกค่าจาก declaration แรกแล้วถือว่าใช้ทั่วแอป
- Global overrides: [styles input L48](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/styles.css#L48) / L739 และ [system-theme input L494](https://github.com/natthawat141/meleran-ux-ui-2026/blob/19ec7aa3389a14dd79328a1c8e8285c24f171865/src/system-theme.css#L494) มีรัศมีต่างกันพร้อม `!important`; table backgrounds ที่ styles L52 / system-theme L518 ก็ทับกัน; styles L575 ประกาศ legacy section
- Target: เจ้าของ semantic tokens ชุดเดียวใน packages/ui; Tailwind utilities อ่าน tokens, Ant/Mantine adapters อ่านแหล่งเดียวกัน; scoped feature CSS สำหรับ editor/content ที่เหมาะสมยังใช้ได้ ไม่กำหนดว่าต้องเปลี่ยน CSS ทุกไฟล์เป็น utilities
- R3 ต้องบันทึก computed baseline และผล primary/hover/focus/disabled, spacing/responsive ของ retained pages ก่อนเปลี่ยน cascade; อย่าเปิด Preflight หรือถอน global override ทั้งก้อนโดยไม่มีผลตรวจ ไม่ถือว่า source inspection นี้ผ่าน visual acceptance แล้ว
