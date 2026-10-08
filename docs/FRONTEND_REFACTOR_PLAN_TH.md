# แผน Frontend Refactor — Melearn Final 1.6

อัปเดต 8 ตุลาคม 2026 · branch งาน `refactor/v1-api-ready`

ปรับแผนตาม [ผล R0 Inventory และ Lead Architecture Review](R0_INVENTORY_ARCHITECTURE_REVIEW_TH.md): inventory ครบ 89 routes, แยก retained dependencies ก่อน scope cleanup, เตรียม authoring interface ก่อน split apps และแยก functional acceptance ออกจาก structural migration

สถานะ: **R0, R1, R2a, R2b, R3a–R3e code gates และ R4b-prep ผ่านแล้ว; R5c ย้าย Web/Admin pages ชุดแรก และ R5d ย้าย Admin management เข้า app ownership ผ่าน local typecheck, tests, boundary และ Admin build; R5 ยังเปิด.** Responsive spot-check ก่อนหน้าของ Landing 390/320px และ Admin Login 390px ผ่าน; visual/accessibility acceptance ที่เหลือยังเปิด; R4a ยังเป็น Draft; authenticated UI spot-check ผ่านเฉพาะหน้าตัวอย่าง. CI run [37755754842](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37755754842) ของ `bf0516a` ผ่านทุก job. วันที่ 8 ต.ค. จัดทำ [API Contract Draft](API_CONTRACT_R4A_DRAFT_TH.md) และ [Acceptance Matrix](FRONTEND_API_ACCEPTANCE_MATRIX_TH.md); ไม่มี Backend owner/OpenAPI ยืนยัน จึงยังไม่ frozen. R4b-prep เพิ่ม generic HTTP/error transport ที่ inject policy และ decoder โดยไม่เลือก endpoint/session; Query hooks ของแต่ละ flow ยังรอ contract ที่ Backend ยืนยัน ดู [รายงาน R4b-prep](R4B_PREP_REPORT_TH.md). ดู [รายงาน R3b](R3_CSS_TOKENS_REPORT_TH.md), [รายงาน R3c](R3C_ROUTE_MODULES_REPORT_TH.md), [รายงาน R3d](R3D_RICH_DOCUMENT_REPORT_TH.md), [รายงาน R3e](R3E_UI_PRIMITIVES_REPORT_TH.md), [ผลตรวจ UI Final 1.6](FRONTEND_V1_6_UI_AUDIT_TH.md), [รายงาน R3a](R3_THEME_PROVIDER_REPORT_TH.md), [รายงาน R5c](R5C_WEB_ADMIN_PAGE_OWNERSHIP_TH.md) และ [รายงาน R5d](R5D_ADMIN_MANAGEMENT_OWNERSHIP_TH.md). ยังไม่ deploy/merge main; R6 หยุดรอคุยตามคำสั่งผู้ใช้; R10/R13 ต้องรอ Backend/API evidence และ R13 ต้องตรวจ artifact/pipeline ที่เลือกแล้วด้วย

## 1. ผลลัพธ์ที่ต้องการและสิ่งที่ยังไม่สรุป

- `apps/web` รวม Guest/Learner/Instructor; `apps/admin` เป็น React อีกแอปใน repository เดียว มี router/layout/provider/build/config แยกและรองรับ independent deployment; R5c ย้ายหน้า Web/Admin ชุดแรกเข้า app แล้ว ส่วน modules ใน `src/` ที่ยังใช้ผ่าน `@legacy` เป็น compatibility bridge ระหว่างการย้าย ไม่ใช่ target structure ถาวร
- Feature-first + route boundary + server state แยกจาก UI state; `App.tsx` มีหน้าที่ประกอบ providers/router
- `courses` ดู Catalog/รายละเอียด; `course-authoring` เป็น feature สร้าง/แก้คอร์ส รวม Curriculum/Quiz Editor ที่ยืนยันแล้ว ส่วน `packages/course-authoring` เป็น candidate for extraction เมื่อ R0/R6 พิสูจน์การใช้ร่วมและ dependency boundary ไม่ import หน้าอีกแอปหรือคัดลอก editor ทั้งก้อน
- TanStack Query ดูแลข้อมูลจาก API; Tailwind ดูแล layout/spacing/responsive; shared UI และ library providers อ่าน theme tokens ชุดเดียว
- API contract และข้อผิดพลาดตกลงร่วมกับ backend ต่อ flow ก่อนทำ hooks ของ flow นั้น ไม่เอา mock schema/localStorage เป็นข้อกำหนด server และไม่รอ freeze ทุก endpoint พร้อมกัน
- ลำดับคือ inventory → retained-dependency prep → scope cleanup → authoring boundary → split apps → shared UI/router → contract → API/Query → migrate features; รักษาหน้าตา/flow ที่ยังอยู่ใน scope และตรวจ/ย้อนแต่ละชุดได้ ไม่เสียเวลาย้ายฟีเจอร์ที่ตกลงว่าจะถอน
- เริ่ม basic CI หลัง split apps; เพิ่ม Containerization และ deployment pipeline ช่วงเตรียมส่งมอบ โดยเก็บงาน Integration/Acceptance แยกไว้

Backend language/framework, database, วิธี session/credentials, hosting/domains และ media provider นอก YouTube ยังไม่สรุป การมี Containerization/CI-CD ในแผนไม่ใช่การเลือกปลายทางหรืออนุญาต deploy/ย้ายข้อมูลจริง Cloud Run เป็น hosting candidate สำหรับ Web/Admin services แยก ไม่ใช่ข้อกำหนดที่เลือกแล้ว

## 2. จุดอ้างอิง Git และข้อเท็จจริงปัจจุบัน

ตรวจ checkout และ remote วันที่ 7 ต.ค. 2026: source baseline ของ R0 คือ `19ec7aa3389a14dd79328a1c8e8285c24f171865` บน `refactor/v1-api-ready`; working tree/index สะอาดก่อนสำรวจ ส่วน local/remote `main`, `prototype`, tag `prototype-2026-10-07` (peeled commit) คงที่ `fa491b46aebe6beaa408ba30ab92b28fd478d8fd` การ commit รายงาน/แผนเดินต่อเฉพาะ refactor branch

R0 ตรวจ `npm.cmd run typecheck`, native tests 51/51 และ `npm.cmd run build` ผ่าน พร้อม browser navigation ของ session Admin ที่มีอยู่โดยไม่ทำ mutation มี build warnings และยังไม่ได้ตรวจ learner/instructor lifecycle, mobile/visual acceptance หรือ API/server integration รายละเอียดและข้อจำกัดอยู่ในรายงาน R0 §10 ผลนี้ไม่ใช่หลักฐานว่า prototype ผ่าน Final 1.6 หรือ backend พร้อม

| ส่วนปัจจุบัน | หลักฐาน/ปัญหาที่ต้องแยก |
| --- | --- |
| `apps/web/src/main.tsx`, `apps/admin/src/main.tsx` | Entry/providers/CSS order แยกตาม app แล้ว; root `index.html`, `src/main.tsx`, `src/App.tsx` ถอดใน R5c; legacy modules ยังเป็น bridge |
| `src/components/Shell.tsx` | Navigation ของหลายบทบาทอยู่ร่วมกัน |
| `src/store.tsx`, `src/data.ts`, `src/types/index.ts` | ข้อมูล/action/persistence จำลองหลาย feature อยู่ก้อนเดียว อย่าใช้เป็น API schema โดยอัตโนมัติ |
| `apps/admin/src/features/management/pages/AdminPages.tsx` | Admin management page module ย้ายเข้า Admin แล้ว; Course Authoring/Review และ Access Codes ยังเป็น legacy bridge แยกตาม phase |
| `src/pages/instructor/CoursePages.tsx`, `CurriculumWorkspace.tsx`, `ChapterWorkspace.tsx`, `src/components/chapter/` | Authoring ที่ต้องตรวจ import จริงและแยกส่วนร่วม |
| `src/pages/learner/CommercePages.tsx`, `src/api/payments.ts` | Checkout มี client เรียก Payment API แล้ว แต่ repository ไม่มี backend/webhook จริง; ต้องย้ายและรักษา error/pending behavior ไม่อ้างว่าเริ่มจากไม่มี API เลย |
| `src/pages/learner/LearnerAiPage.tsx`, `src/api/ai-practice-mock.ts` | AI/ชุดฝึกยังมี mock ไม่ใช่การเชื่อม AI/database จริง |
| `src/theme.ts`, `src/shadcn.css`, `src/styles.css`, `src/system-theme.css`, `src/workspace-responsive.css` | Tokens/providers/overrides หลายแหล่ง ต้องรวม owner และตรวจ cascade |
| `src/config/features.ts`, `docs/FEATURE_RELEASE_MATRIX.md`, `tests/` | Feature/runtime/route inventory ต้องปรับพร้อม source/test ของชุดนั้น ไม่เปิด released จากการย้ายไฟล์ |

ตารางนี้เป็นภาพรวม; รายงาน R0 §§3–7 และ 13 มี matrix, route ครบทุก declaration, state, active implementation และ CSS/authoring consumer chains ก่อนลงมือแต่ละชุดต้องตรวจ source/branch/dirty work อีกครั้ง

## 3. โครงสร้างเป้าหมาย

```text
apps/
  web/
    src/
      app/                 # router, providers, App
      layouts/             # Public, Auth, Learner, Instructor
      features/            # domain ที่ Web ใช้
      shared/              # ของทั่วไปที่ใช้เฉพาะ Web
      main.tsx
  admin/
    src/
      app/                 # router, providers, App
      layouts/             # Admin และ Auth
      features/            # งาน Admin
      shared/              # ของทั่วไปที่ใช้เฉพาะ Admin
      main.tsx
packages/
  ui/                      # shared controls, tokens, theme adapters
  api-client/              # HTTP infrastructure และ normalized errors
  contracts/               # API DTO/contracts ที่ตกลงร่วมกัน
docs/
```

โครงสร้างนี้เป็นส่วนที่ freeze แล้วสำหรับ Frontend เป้าหมาย ไม่ใช่คำสั่ง rename repository/checkout เป็น `melearn-tutor`; workspace, entry points และแยก build ของ Web/Admin สร้างแล้วใน R2b. Root `src/main.tsx`, `src/App.tsx` และ `index.html` ถูกถอดใน R5c เพราะไม่ใช่ runtime entry; Web/Admin เป็นเจ้าของหน้า slices ที่ย้ายแล้ว ส่วน modules, state, types และ CSS ที่ยังอยู่ใต้ `src/` ถูกใช้ผ่าน `@legacy` เป็น bridge และยังต้อง migrate ตาม R5–R9; โฟลเดอร์เป้าหมายที่ยังไม่มีจะเกิดตาม feature slices ไม่สร้างโครงว่างทั้งหมดล่วงหน้า ดู [รายงาน R5c](R5C_WEB_ADMIN_PAGE_OWNERSHIP_TH.md)

`packages/course-authoring` อยู่นอกโครงสร้างบังคับ: R0 ยืนยันแล้วว่า Admin และ Instructor ใช้หน้า editor เดียวกันจริง แต่ page ยังผูก useLms/router/storage R2a ต้องพิสูจน์ controlled editor core interface ก่อน split หากต้อง extract ให้รับ draft/callbacks/capabilities/ID factory จาก host และไม่มี app/store/seed imports; host เป็นเจ้าของ save/dirty/conflict/navigation และ Admin Transcript แยกจาก learning draft R6 ทบทวน boundary หลังต่อ API ห้าม import ข้าม apps, copy editor ทั้งก้อน หรือซ่อน business editor ใน packages/ui เพื่อหลบ boundary

ภายใน feature มี `api/`, `hooks/`, `pages/`, `components/` และ types เท่าที่มีงานใช้จริง ไม่แยกไฟล์เล็กทุกฟังก์ชันเป็นข้อบังคับ เป้าหมายคือตาม bug/flow ได้ในเจ้าของ feature เดียว

Apps import packages ได้; packages ไม่ import apps; ไม่ให้ Web import `apps/admin/src` หรือกลับกัน; แยก shell/pages ออกจาก reusable authoring และป้องกันวงจร dependency ส่วน API เฉพาะ feature อยู่ใน app ที่ใช้ ไม่ย้าย business API ทั้งหมดเข้า client กลาง

## 4. Feature ownership และขอบเขต Final 1.6

| Feature/ส่วน | Web | Admin / shared |
| --- | --- | --- |
| `auth`, `account` | สมัคร/Login/Google/Verify/Reset/Profile ตามบัญชี | Admin auth/session boundary ของตัวเอง; บัญชีเดียวกันต้องยึดตัวตน server ไม่สร้าง user store อีกชุด |
| `public`, `courses` | Landing/About และ Catalog/รายละเอียด Published; เก็บบริบท guest/member ต่างกัน | Admin course directory เป็นหน้าจัดการคนละแบบ ไม่ใช้ Catalog เปิด Draft |
| `blog` | อ่านบทความ Published | Admin สร้าง/แก้/เผยแพร่ Blog; rich-content renderer ใช้ร่วมได้ |
| `learning` | My courses, Enroll ฟรี, Lesson, Progress, Resume; Instructor เรียนคอร์สคนอื่นได้ | Preview เพื่อจัดการไม่สร้าง Enrollment/Progress จริง |
| `course-authoring` | Pages ของผู้สอนสำหรับคอร์สตนเอง | Pages ของ Admin สร้าง/แก้แทน ระบุ Instructor หนึ่งคน; editor/curriculum/quiz definition เป็น candidate for shared extraction ตาม R0/R6 |
| `assessment` | ทำ Quiz/ผล/คะแนนสูงสุด; ผู้สอนดูและตรวจคำตอบในขอบเขตคอร์ส | Admin ดูรายชื่อ/ผลตามงานจัดการ; Instructor เจ้าของเป็นผู้ตรวจข้อเขียน/ภาพตาม quiz.grade; ห้ามยก Admin grading จาก prototype ไปใช้; การทำแบบฝึกหัดกับการนิยาม Quiz เป็นคนละหน้าที่ |
| `certificate` | ดู/ดาวน์โหลดใบรับรองของตน | คงสถานะ completion ในงานจัดการ; ไม่มี permission เปิด/download ใบทุกคน ไม่ย้าย standalone global certificate browser หรือเพิ่ม revoke/reissue เอง |
| `payment` | Stripe ซื้อรายคอร์สและหน้าผล/รอ/error | ดูข้อมูล Payment ผิดปกติขั้นต่ำ ไม่มี Finance/Refund dashboard |
| `redeem` | ใช้โค้ดรับสิทธิ์ | Admin ออกโค้ด ดูผู้ใช้ ยกเลิกเฉพาะ Unused; แยกจาก discount code |
| `ai` | Chat/history/search/rename/delete/AIPractice | ตั้ง `ai_enabled` และ Transcript ต่อ Video; Admin มีแชตของตนใน app ของตน; ไม่มีหน้าอ่านแชตบัญชีอื่น |
| `instructor` | Workspace overview/navigation และรายชื่อผู้เรียนของคอร์สตน | ไม่เป็นก้อนรวม editor/learning/payment ซ้ำ; Admin เพิ่มบทบาทผ่านงาน `users` |
| `users`, `course-review`, `codes` | ไม่มีหน้าปฏิบัติการ Admin ใน Web | Admin สร้างบัญชี/เพิ่มผู้สอน, ตรวจอนุมัติ/ส่งกลับ/เผยแพร่, จัดการโค้ด |

ชื่อ feature/ไฟล์ย่อยปรับให้พอดีกับ implementation ได้ แต่ ownership ของ `courses` กับ `course-authoring` และขอบเขตสิทธิ์เป็นข้อที่ตกลงแล้ว

งานที่เก็บไว้ครบตามบท 1 ของ scope รวม Resend Verification Link/Reset, Stripe และ AI สร้างแบบฝึกหัดในเดือนแรก การทำงานจริงต้องตรวจจาก server ไม่ใช่ปุ่มที่คลิกได้

รายการที่จะถอดใน R1 ก่อนย้ายโครงสร้าง: Cart/Order history เต็ม, Inbox/ถามผู้สอน, Finance/ส่วนแบ่ง/จ่ายเงิน/Refund flow, Business Analytics/Big Data, Referral, ขอเป็นผู้สอน/คำเชิญ, ผู้สอนร่วม, Archive, Assignment แยก, LINE login, AI Knowledge Dashboard/ถอดเสียงอัตโนมัติ/หน้า Admin ดูคำถามคนอื่น และ Release Dashboard ตามบท 8 การยังไม่ทำไม่ใช่การตั้งนโยบายธุรกิจใหม่

R1 ถอนตามความสามารถและ import/action dependencies ไม่ลบไฟล์จากชื่อ analytics/commerce อย่างเดียว ผล R0 เพิ่มการถอด Admin grading, Guest full lesson preview, public certificate verification และ standalone Admin global certificate browser ตาม permission ที่ scope ยืนยัน; owner/Admin management preview กับ learner results ยังอยู่ และหยุด destructive course deletion ที่ทำประวัติหาย ตัวอย่าง `src/pages/instructor/QuizPages.tsx` และ `src/pages/instructor/LearnerReviewQueuePage.tsx` ใน baseline R0 ใช้ `getReviewQueue` จาก `src/api/analytics.ts`; หลัง R1 ใช้ `src/lib/assessment-review.ts` ซึ่งเป็นส่วนตรวจคำตอบที่ต้องรักษาไว้ เช่นเดียวกับ Payment API และ Redeem ที่อยู่ใกล้ Commerce เดิม R1a แยก retained helpers แล้วและ R1b/R1c ถอนเจ้าของที่ไม่ใช้

Upload Video/Mux/Bunny ยังไม่เปิด ใช้ YouTube Link; UI upload อาจอยู่ได้แต่ต้องแสดงยังไม่พร้อมและไม่เก็บไฟล์จริง ภาพปก/ภาพคำตอบเป็นอีกขอบเขต ไม่ถอดรวมไปด้วย

## 5. Route และ state boundary

- Web แยก Public/Auth/Learner/Instructor route modules พร้อม nested layouts; Admin แยก auth/management routes ของตัวเอง มี loading/error/no-access/not-found และเปิดตรง/refresh ได้
- URL ปัจจุบันเช่น `/articles`, `/account/profile`, `/explore/courses` ต้องทำ route mapping ก่อนเปลี่ยน ไม่เปลี่ยนเป็น `/blog` หรือ `/account` ตามตัวอย่าง architecture โดยอัตโนมัติ จัด redirects/deep links/back paths เมื่อมีแผนย้าย URL ที่รับแล้ว
- Admin ปัจจุบันไป `/teach/...` ให้ map เป็นหน้า Admin ของตัวเอง ไม่พาผู้ใช้ข้ามแอปเพื่อแก้คอร์ส ส่วน authoring ที่ extract เมื่อมีหลักฐานรับ callbacks/links จาก caller
- Guards ดู session/capabilities เพื่อ UX ไม่ใช้ enum role เดียวบล็อก Instructor จาก learner flows Backend เป็นผู้บังคับสิทธิ์และข้อมูลที่คืน
- Query keys ต้องมี resource/context/account scope ที่เหมาะสม; logout/เปลี่ยนบัญชีไม่เห็น cache ของคนก่อน Mutation สำเร็จต้อง invalidate/update queries ที่สัมพันธ์กันภายในแอป; ข้ามแอป refetch ตามนโยบาย ไม่แชร์ memory cache
- Form/editor/คำตอบที่กำลังกรอกเป็น UI draft แม้มีข้อมูลขนาดใหญ่ Draft ต้องไม่หายจาก refetch และไม่กลายเป็นผลเรียนก่อนบันทึก
- เลือก data owner ต่อ slice ให้ชัดก่อนย้าย ไม่เก็บ courses/payments/progress ซ้ำทั้ง Query และ Context/Zustand; UI แสดงผลจาก server แต่ไม่คำนวณสิทธิ์/คะแนนเป็นหลักฐานจริง
- ช่วงยังไม่มี API ใช้ mock adapter/fixtures หลัง boundary ที่ระบุชัด เมื่อทดสอบ Web/Admin แก้ข้อมูลร่วมกันต้องมีแหล่งทดสอบที่สอดคล้องกัน localStorage ของสอง origin ไม่ใช่ shared backend ให้เลือกวิธีทดสอบนี้ก่อนชุดที่เกี่ยวข้อง

## 6. แบ่งงานและเกณฑ์ตรวจรับ

R0 สำรวจ/ตรวจ baseline เสร็จแล้ว ผู้ใช้สั่งให้ทำต่อวันที่ 7 ต.ค. 2026; R1a/R1b/R1c ผ่าน checks และบันทึก checkpoint แล้ว ชุด functional changes ต้องระบุ before/after และ acceptance ของ flow ที่จะเปลี่ยนตาม matrix/risks ของ R0 ก่อนเริ่ม ไม่ถือว่าการรับรายงานนี้อนุญาตตัดเพิ่มฟีเจอร์ทันที

| ชุด | งาน / ข้อพึ่งพา | เกณฑ์รับ |
| --- | --- | --- |
| R0 — Inventory/baseline (เสร็จ) | [รายงาน R0](R0_INVENTORY_ARCHITECTURE_REVIEW_TH.md): 89 routes/87 feature mappings, keep/adapt/remove, state/API gaps, authoring reuse และ theme consumer chains | typecheck/build/native tests 51 ผ่าน; Admin browser navigation ตรวจแล้วพร้อมข้อจำกัด; ส่งแผนให้เจ้าของ approve ก่อน source changes |
| R1a — Retained dependency prep | หลัง approve R0 แยก grading helper/CSS, roster gates, Payment/Redeem wrappers และ history guards ขั้นต่ำก่อนถอนเจ้าของเดิม | retained routes/helpers ทำงาน; registry/matrix/tests แยก payment/redeem/roster จาก commerce/analytics ที่จะถอน ไม่ตั้ง released จากการย้าย |
| R1b — Functional scope cleanup | ถอน out-of-scope nav/routes/actions รวม permission gaps ที่ R0 ระบุ; Admin instructor directory แยก requests/invites | capability ที่ถอนไม่มีทางเข้า; owner grading/learner list/Payment/Redeem/management preview ยังอยู่; removed URLs มี migration behavior ไม่มี restricted data |
| R1c — State/loader cleanup | ถอน legacy actions/seed/loader/side effects/styles/dependencies; Redeem adapter ขั้นต่ำไม่สร้าง Order/share ก่อนถอน simulatePayment; ปรับ tests ของ capability ที่ถอน | reopen demo เดิมไม่ reseed legacy; used codes ไม่กลับ Unused; attempts/enrollment/certificate เดิมไม่ถูกลบ; ไม่ reset browser data; prototype/tag คงเดิม |
| R2a — Authoring boundary + migration ledger (ผ่าน metadata gate) | แยก controlled Course metadata core; route ledger กำหนด owner/target และ Admin `/teach` compatibility; เลือกแนว npm workspaces จาก npm lockfile | metadata editor ไม่มี app/store/data/router/seed imports; host เป็นเจ้าของ form draft/save/navigation/AI; ตรวจด้วย 2 boundary tests; curriculum/chapter/quiz editors และ public package ยังไม่ผ่าน extraction gate; ดู [route ledger](ROUTE_MIGRATION_LEDGER_TH.md) |
| R2b — Workspace Web/Admin + basic CI (code gate ผ่าน) | npm workspaces; entry/build/aliases/scripts แยก; shared UI public exports; contracts/API-client มี public exports ว่างจนมี contract; CI typecheck/test/build + dependency-direction check | Web/Admin routes/builds แยก; admin `/teach/*` allowlist → `/admin/*`; Web ไม่ import Admin source; checks แยกผ่าน; localStorage แยกตาม originและไม่มีการอ้าง sync/API readiness; browser visual QA ยังเปิด |
| R3a — Shared TypeScript theme/provider (ผ่าน) | ย้าย Mantine theme, Ant theme adapter และ UI-only provider ไป `packages/ui`; apps ยังเป็นเจ้าของ Router/LmsProvider | Web/Admin ใช้ config, locale ไทย, light default และ provider order ชุดเดียว; ค่าเดิมกับ CSS import order คงเดิม; typecheck/build ทั้งสอง apps และ legacy ผ่าน |
| R3b — CSS/Tailwind semantic tokens (code gate ผ่าน; UX QA ค้าง) | `packages/ui/src/design-tokens.json` เป็น source; TypeScript theme adapters อ่าน resolver เดียวกัน; generator สร้าง CSS variables/Tailwind theme; app stylesheet แต่ละตัว import shared Tailwind และลงทะเบียน source ของ app/shared/legacy ใน compiler chain เดียวกัน; รักษา Landing profile แบบ scoped | `npm.cmd run tokens:check`, `typecheck` และ Web/Admin production builds ผ่าน; CSS outputs มี shared utilities `.h-8`, `.bg-primary`, `.text-primary`; browser smoke เปิด Web Landing และ Admin dashboard ได้และพบเนื้อหาหลัก; ยังไม่มีการยืนยัน computed styles, contrast, keyboard และ responsive ครบ จึงไม่ถือว่า visual acceptance ผ่าน |
| R3c — Route-module extraction (ผ่าน) | แยก declarations ตาม Public/Auth/Learner/Instructor/System และ Admin Entry/Management/Authoring/System; ย้าย access wrappers เข้า router boundary; คง URL, redirect, query/hash, route owners และ app boundary; เปรียบเทียบ snapshot กับ R3b | Web 50/Admin 35 routes ตรง baseline ตาม path/feature key/element/order; access behavior มี regression tests; checker อ่าน composed modules ใหม่; App entry เหลือ composition; browser preview ยืนยัน public deep link/back และ unauthenticated redirect; authenticated UI/visual accessibility/responsive ยังไม่ครบ — ดู [รายงาน R3c](R3C_ROUTE_MODULES_REPORT_TH.md) |
| R3d — Shared rich document renderer (ผ่าน) | ย้ายเฉพาะ `RichDocument`, type และ `textDocument` แบบ props-only ไป `packages/ui`; 7 consumers ที่ render อย่างเดียวไม่ import Tiptap editor/uploader; editor และ feature ownership เดิมคงอยู่ | เทียบ renderer กับ baseline แล้ว behavior/class/URL filters ตรงกัน; renderer import React เท่านั้น; focused/security tests 7/7, suite 93/93, typecheck, boundary, Web/Admin build และ diff check ผ่าน — ดู [รายงาน R3d](R3D_RICH_DOCUMENT_REPORT_TH.md) |
| R3e — Shared form primitives (code gate ผ่าน) | ย้าย Alert/Button/Field/Input/Label/Separator implementation จาก legacy UI folder ไป `packages/ui`; AuthPages consume public package exports; package ประกาศ peer deps; no business flow changes | Web/Admin/legacy typecheck, 93 tests, boundary/token checks, Web/Admin build และ diff check ผ่าน; Admin `/login` render spot-check ผ่าน, Web browser tab ถูก loopback block — ดู [รายงาน R3e](R3E_UI_PRIMITIVES_REPORT_TH.md) |
| R4a — API Contract ต่อ flow | Draft/decision register จาก scope อยู่ใน [เอกสาร R4a](API_CONTRACT_R4A_DRAFT_TH.md); เมื่อติดต่อ Backend ได้ให้ตกลง DTO/enums/request/response/errors, credentials/permissions, states, pagination และ idempotency ทีละ flow | **ปัจจุบันยังเป็น draft** ไม่มี Backend owner/OpenAPI; contract จะ frozen ต่อ flow เมื่อมี success/error examples และผู้รับผิดชอบร่วม; prototype schema ไม่กลายเป็น contract โดยอัตโนมัติ; ไม่ต้อง freeze ทุก endpoint พร้อมกัน |
| R4b — API client/Query foundation | **R4b-prep ผ่านแล้ว:** `packages/api-client` มี injectable HTTP/error transport; เพิ่ม R4b-flow แยกตาม flow หลัง contract ของ flow ผ่าน R4a เพื่อเพิ่ม Query hooks/cache/mutations และ mock adapter เท่าที่จำเป็น | Prep ผ่าน focused tests, typecheck, boundary check และ Web/Admin build; ไม่ฝัง API origin, session/credentials default, envelope, business DTO, retries หรือ mock fallback. Flow gate ยังต้องพิสูจน์ payload validation, loading/error/cancel, cache isolation เมื่อเปลี่ยนบัญชี และไม่ให้ hooks กำหนด contract ย้อนกลับ |
| R5-prep — Shared theme/Profile boundaries (ผ่าน) | ย้าย `landingTheme` เข้า `packages/ui`; About/Blog ใช้ public export และ Blog ระบุ base CSS เอง; แยก `ProfilePage` จาก `AccountPages.tsx` โดยคง legacy export/route; ดู [theme prep](R5A_LANDING_THEME_PREP_TH.md) และ [Profile boundary](R5B_PROFILE_PAGE_BOUNDARY_TH.md) | Typecheck, 93 tests, boundary/token checks, Web/Admin build ผ่าน; Admin article direct route/mobile drawer spot-check ผ่าน. ไม่มี app page/route/API/business-flow migration; R5 page migration ยังเปิด |
| R5 — Public/auth/account/blog + app ownership | **ทำบางส่วนใน R5c/R5d:** ย้าย Landing/About, public Catalog/detail, Instructor profile, Certificate pages, Web/Admin Profile wrappers, Web Blog reader, Admin Blog list/editor/article preview และ Admin dashboard/users/instructors/course management เข้าแอปเจ้าของ; root legacy runtime entry ถูกถอด ดู [รายงาน R5c](R5C_WEB_ADMIN_PAGE_OWNERSHIP_TH.md) และ [รายงาน R5d](R5D_ADMIN_MANAGEMENT_OWNERSHIP_TH.md) | Typecheck/tests/boundary และ Admin build ผ่านบน code checkpoint `bf0516a`; CI run 37755754842 กำลังตรวจ. Auth, Blog CSS/chrome/store/data adapters, Course Review/Access Codes bridges และ ProfileSettings form ยังมี legacy bridge. R5 ยังเปิด; API ไม่พร้อมจึงไม่มี fake success; ไม่ย้ายฟีเจอร์ที่ถอนใน R1 กลับมา |
| R6 — Course authoring/review | หลัง R3/R4b และ contracts ที่เกี่ยวข้อง แยก pages/editor/curriculum/chapter/content/Quiz definition กับ Admin review; ตัดสิน shared extraction ตาม evidence R0 และ dependency จริง | มีบันทึก extract/ไม่ extract พร้อมเหตุผล; ไม่มี cross-app imports/copy editor ทั้งก้อน; owner/Admin manage, draft/save/preview/ordering ไม่เสีย; YouTube/รูป/rich text ใช้ได้; Preview ไม่สร้างผลเรียน |
| R7 — Learning/assessment/certificate | หลัง R4b และ contracts auth/course/assessment ย้าย Enroll→Learn→Attempt→Grade→Complete→Certificate โดยไม่ต้องรอ editor ทั้งหมดถ้า contract พร้อม | คะแนนจริง >70% โดยไม่ปัด, highest completed graded attempt, pending/no early certificate, enrollment/completion/certificate snapshots และ Resume ตรงบท 2/9; Instructor เรียนคอร์สอื่นได้; grading จำกัด owner; server evidence แยกจาก mock |
| R8 — Payment/redeem | หลัง R4b และ contracts auth/course/enrollment/payment/redeem ย้าย client/หน้าผล/โค้ด แยกสอง features | Success page อ่านสถานะ ไม่ fulfill; Enrollment query อ่าน server หลัง webhook ไม่เติม local rights; pending/error/already-enrolled ถูกต้อง; Redeem one-use/no-expiry/Unused–Used–Revoked ไม่มี Order/share/discount; concurrency/idempotency ตรวจ server |
| R9 — AI/Transcript/AIPractice | หลัง R4b และ contracts auth/enrollment/AI ย้าย UI/history/API boundary กับ Admin Transcript controls | บริบทตามสิทธิ์และ Admin own AI; history/rename/delete/unsent draft ไม่เสีย; AIPractice ไม่ส่งเฉลยก่อนตอบ/ไม่เปลี่ยน Progress; 20 Prompt สำเร็จ/วันไทยและ duplicate request ต้องมี server evidence |
| R10 — Integration ของ flows | หลัง migrations ของ flow ที่เกี่ยวข้อง ตรวจสองแอปกับ API จริงตามบท 9 และตามเก็บ dead code ของ retained slices ที่ถูกแทนแล้ว | Persistence ข้าม session/device, server permissions/ownership/enrollment, Stripe webhook และ AI จริงมีหลักฐาน; ไม่มี mock fallback ใน flow ที่ประกาศพร้อม; ไม่แทนงานนี้ด้วย build image |
| R11 — Containerization | **Configuration prep มีแล้ว แต่ยังไม่ verified:** Dockerfiles แยก, monorepo-root context, non-root NGINX/SPA fallback และ smoke runner มีใน repo; build หยุดระหว่าง `npm ci` ตามคำสั่งผู้ใช้ไม่ให้รัน Docker เพราะใช้ RAM | Docker image build, health/assets/deep-link และ custom-port smoke ยังไม่ผ่านการรัน; ไม่มี API URL/session/secrets ใน image config. ต้องรันทดสอบที่ได้รับอนุญาตก่อนปิด gate |
| R12 — CI/CD เตรียมส่งมอบ | **CI-only workflow ผ่าน runner แล้ว:** [run 37748971907](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37748971907) สำหรับ commit `e81acc2` ผ่าน path selection, shared checks, Web/Admin typecheck/build และ artifact upload; ไม่มี Docker job, registry, deploy, secrets หรือ hosting decision | Run นี้ตรวจทั้งสอง app หลัง R5 theme/consumer/Profile-prep; hosting, CD promotion/configuration, service permissions และ rollback ยังรอเลือก; Cloud Run ยังเป็น candidate. มีคำเตือน action/runner รุ่นใหม่แต่ไม่ทำให้ job fail |
| R13 — Final acceptance/เตรียม main | **ทำ local acceptance prep แล้ว แต่ยังไม่ผ่าน:** tests/typecheck/boundary/token/build และ preview spot-check ผ่าน; R5–R9 migration, R10 API/server evidence และ R11 runtime package verification ยังเหลือ; R12 CI-only ผ่านบน checkpoint ที่บันทึกไว้ | Local gates ไม่แทน end-to-end API/server evidence; R11 container runtime ไม่ได้รันตามคำสั่งผู้ใช้เพราะใช้ RAM. หลักฐานต้องชี้ revision เดียวกันก่อนรวม main เป็น Final 1.6. Backend/API owner ยังไม่มี จึงปิด R10/R13 ไม่ได้ |

ลำดับคือข้อพึ่งพา ไม่ใช่กำหนดวันส่ง R3 แตกเป็น R3a–e เพื่อแยก theme adapters, CSS/Tailwind tokens, route migration, rich renderer และ form primitives ให้ตรวจ/ย้อนเป็นชุด; R5 มี theme preparation และหน้า app-owned หลาย slices แล้ว แต่ Auth, profile form และ Blog legacy adapters/styles ยังเป็น bridge; R5–R9 แตกเป็น commit ตาม flow; R4a ของ flow ถัดไปเตรียมได้ระหว่าง migrate flow ที่ตกลงแล้ว R11/R12 เตรียม build/CI ได้หลัง split โดยไม่ต้องรอ backend ทั้งหมด แต่ final acceptance ของ API ต้องรอหลักฐานจริง R0 ใช้ Luna xhigh สำรวจแบบ read-only สี่บทบาทแล้ว

### 6.1 Contract freeze และ authoring extraction

- R4a ส่งมอบ DTO/enums, request/response success/error, field visibility, permission/state และตัวอย่างให้ mock/test ใช้ร่วมกัน ยืนยันต่อ flow กับ backend ก่อน R4b/hooks ของ flow นั้น หาก backend ยังไม่รับให้ระบุเป็น draft แทนคำว่า frozen
- Contract เปลี่ยนต้องอัปเดต version/consumers/fixtures/validation/tests ของ slice พร้อมกัน ไม่แก้ server response เพื่อเอาใจ hook โดยไม่มี review; frontend ขึ้นรูป UX ด้วย draft adapter ได้ แต่ไม่อ้างว่า integrate แล้ว
- R0 บันทึก reuse แล้ว; R2a ตรวจ components/dependencies/props/callbacks/draft ownership เป็น interface gate ก่อน extraction ที่จำเป็นต่อ split และ R6 ทบทวนหลัง integrate แยก feature ownership ไว้เสมอ ไม่ยก permission/API/navigation ของสองแอปมารวมเพราะหน้าตาเหมือนกัน

### 6.2 Containerization และ CI/CD future work

- มี `apps/web/Dockerfile` และ `apps/admin/Dockerfile` พร้อม `.dockerignore`, NGINX configs และ smoke runner โดย build context จาก monorepo root เพื่อรวม lockfile/shared packages; สร้าง image สำหรับ app ที่เลือก ไม่ bundle อีก app ติดไปด้วย. เป็น configuration prep เท่านั้น ยังไม่มีหลักฐาน image build/runtime เพราะไม่ได้รัน Docker ตามคำสั่งผู้ใช้
- ใช้ production build และ static server พร้อม health endpoint, asset caching และ SPA fallback; deep link เช่น `/learn/...` หรือ route Admin ต้อง refresh ได้ health ผ่านบอก runtime เปิดได้ ไม่ได้ยืนยัน auth/payment/AI ทำงานจริง
- Basic CI ใน R2 ต้องตรวจตั้งแต่เริ่มแยกแอป ไม่รอ R12; ขั้น R12 เพิ่ม path filtering ตาม dependency graph เปลี่ยน `packages/ui`, `api-client`, `contracts` ต้องตรวจ apps ที่ใช้ (ถ้าทั้งคู่ใช้ให้ตรวจทั้งคู่) รวม root lockfile/workspace/TypeScript/build config; docs-only ตรวจเอกสารตาม scope ไม่ต้อง build ทุกอย่าง
- CI quality checks กับ CD publish/deploy เป็นคนละขั้น; เตรียม pipeline/rollback ไม่ใช่เปิดระบบจริง ไม่ตั้ง auto-deploy ทุก push ระหว่าง refactor และไม่เปลี่ยน default branch/service/domain โดยอัตโนมัติ
- ถ้าเลือก Cloud Run ให้แยก Web/Admin services และ container ฟัง `0.0.0.0` ที่ `PORT` ตาม [Cloud Run runtime contract](https://docs.cloud.google.com/run/docs/container-contract); การใช้ `PORT` เป็นของ server ที่เสิร์ฟ static build ไม่ใช่การเปลี่ยนค่าฝั่ง browser ขณะ runtime
- วิธี public API URL/configuration สำหรับแต่ละ environment ต้องเลือกก่อนทำ image promotion เพราะ Vite build-time values อยู่ใน bundle; แยกค่าที่ browser เห็นออกจาก deployment credentials ไม่ฝัง secret ใน image/frontend
- ผู้ให้บริการ CI, artifact registry, hosting, environment names, credentials, domains/session integration และการเปิดจริงต้องตัดสินในชุดเทคนิคที่เกี่ยวข้อง Cloud Run ยังเป็น candidate หากเลือก hosting แบบอื่นให้ปรับ packaging/CD ตามปลายทาง ไม่เปลี่ยน architecture ของสองแอปตามชื่อ provider

## 7. แยก refactor ออกจาก functional changes

Structural batch ย้าย ownership/import/router/state boundary โดยรักษาผลที่ผู้ใช้เห็น; functional batch เปลี่ยนให้ตรง Final 1.6 เช่น approval/สิทธิ์เรียน/ถอด Cart ต้องระบุ before/after กับกรณีตรวจรับต่างหาก หากโครงสร้างเก่าทำให้แยกไม่ได้ให้ชี้ความต่างก่อนลงมือ ไม่ใช้คำว่า refactor กลบการเปลี่ยนพฤติกรรม

เกณฑ์ที่ห้ามเปลี่ยนเอง: Webhook ที่ backend ตรวจเป็นทางให้สิทธิ์ Stripe; account read status ไม่ fulfill; Redeem แยกส่วนลด; Progress/คะแนน/Certificate server-controlled; AIPractice แยก Quiz; 20 Prompt สำเร็จต่อบัญชีต่อวัน Asia/Bangkok; Transcript/AI enable เป็น Admin ตาม scope

การใช้งานกับ API จริงต้องตกลง request/response/errors/credentials และมี backend ให้ตรวจ สิ่งที่ frontend ทำเสร็จก่อนคือ boundary/types/UX/error handling ไม่ประกาศว่า production-ready จาก typecheck/build หรือ mock tests

## 8. ตรวจงานและ checkpoint

- ใช้ [GIT_CHECKPOINT_POLICY_TH.md](GIT_CHECKPOINT_POLICY_TH.md): ตรวจ dirty/staged work ก่อนทุกชุด รักษางานผู้อื่น stage เฉพาะ path ที่มอบหมาย commit/push หลังตรวจผ่าน รายงาน SHA/branch/ผล push
- เอกสารอย่างเดียวตรวจลิงก์/path/ความสอดคล้อง/whitespace ไม่ต้อง build; source ปัจจุบันใช้ `npm.cmd run typecheck` และ `npm.cmd run build` พร้อม regression/flow ที่สัมพันธ์ หลัง R2 ต้องกำหนด scripts ตรวจทั้งสองแอปจริง ไม่ใส่คำสั่งที่ยังไม่มีว่าเคยผ่าน
- ไม่เปลี่ยน feature เป็น `released` เพราะย้ายไฟล์แล้ว Feature matrix แยก business scope, runtime readiness และหลักฐาน API; ทดสอบ feature gates เดิมเมื่อแตะ registry/routes
- เก็บโครงสร้างเดิมเฉพาะช่วงมีผู้ใช้จริง เมื่อ slice ใหม่แทนแล้วถอน dead code/dead CSS ของ slice นั้นในชุดที่ตรวจได้ ไม่ทิ้ง store สองแหล่งถาวร และไม่ reset browser data เพื่อให้ตรวจผ่าน
- ย้อนชุดที่เผยแพร่ด้วย revert ตาม policy; code rollback ไม่ใช่การคืนข้อมูล browser/database ตรวจ baseline อีกครั้งก่อน rename จำนวนมาก
- `main` เป็นเป้าหมาย Final 1.6 เมื่อผ่านเกณฑ์ของงานที่พร้อมรวมแล้ว รอบเอกสารนี้ไม่ merge/เปลี่ยน default branch/deploy และไม่แตะ `prototype` หรือ tag

## 9. สิ่งส่งมอบของรอบนี้และงานถัดไป

เอกสารนี้เริ่มจากการส่งมอบ [R0 Inventory และ Architecture Review](R0_INVENTORY_ARCHITECTURE_REVIEW_TH.md) และถูกปรับตาม checkpoint R1–R3c; การเปลี่ยน phase จดหลักฐานไว้ใน report/route ledger ที่เกี่ยวข้อง ไม่ได้แก้ขอบเขต Final 1.6 หรือเลือก backend, database, auth transport และ hosting แทนเจ้าของผลิตภัณฑ์

R0, R1a–c, R2a, R2b code gate, R3a–e, R4b-prep และ R5 theme/consumer/Profile preparation ผ่าน local gates แล้ว; R3b ใช้ JSON token source + deterministic CSS generator เชื่อม Tailwind, legacy CSS variables และ Mantine/Ant adapters โดยไม่ตั้งใจเปลี่ยน feature หรือ route. R3d แยก renderer props-only และ R3e ย้าย form primitives ไป package UI โดยไม่ย้าย Auth business logic. R5c ย้าย Landing/About, Guest Catalog/detail, Instructor profile, Certificate pages และ Web Profile wrapper เข้า Web; Admin Blog list/editor เข้า Admin; R5d ย้าย Admin management pages และ CSS เข้า Admin app; root legacy entry ถูกถอด. Typecheck ทั้งสาม projects, boundary, token check และ production build Web/Admin ผ่านตาม checkpoints ที่ระบุในรายงาน; `bf0516a` ผ่าน typecheck, 94 tests, boundary และ Admin build. Development preview ยืนยัน Landing, About, Guest Catalog 3 courses และ course detail ใน checkpoint ก่อนหน้า; รอบ R5d ไม่ทำ visual browser acceptance. `LandingChrome`/base CSS, Auth, Blog article/read, management store/data adapters และ profile form ยังเป็น legacy bridge; API/business-flow migration ไม่มี. Preview ก่อนหน้าใน [ผลตรวจ UI](FRONTEND_V1_6_UI_AUDIT_TH.md) ตรวจ routes อื่นบางส่วน แต่ R13 responsive/accessibility matrix ยังไม่ครบ. การเข้า `/` ผ่าน production preview ถูก prototype feature gate แสดง Not Found ตาม `src/config/features.ts`; development mode แสดง Landing ตามปกติ. รอบนี้ไม่มี login submit, profile/blog mutation หรือ Docker. R4a API Contract ยังเป็น Draft เพราะไม่มี Backend owner/OpenAPI; R4b-prep ไม่มี Query hooks/API integration. R11 Docker image/runtime ยัง unverified ตามคำสั่งไม่รัน Docker; R12 CI run [37748971907](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37748971907) บน commit `e81acc2` ผ่านครบทุก job รวม shared checks และ Web/Admin typecheck/build/artifact upload. R5 ยังไม่เสร็จ; R6 หยุดรอคุยตามคำสั่งผู้ใช้; R7–R9, R10 และ R13 ยังเปิด โดย R10/R13 ต้องมี Backend/API evidence และ R13 ต้องตรวจ packaging/runtime ที่ตกลงแล้วก่อนรวม main
