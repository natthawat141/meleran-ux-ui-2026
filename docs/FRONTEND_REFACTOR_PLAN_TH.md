# แผน Frontend Refactor — Melearn Final 1.6

วันที่ 7 ตุลาคม 2026 · branch งาน `refactor/v1-api-ready`

ปรับแผนตามการทบทวนครั้งที่สอง: ใช้ `apps/web`, cleanup หลัง inventory, authoring package ตามหลักฐาน, แยก Contract/Query และเพิ่ม Containerization/CI-CD โดยมี basic CI ตั้งแต่ split apps

สถานะ: ผู้ใช้ยืนยันทิศทาง Frontend และให้ปรับเอกสาร/เตรียมแผนแล้ว **ยังไม่เริ่ม implementation ไม่ตัดหรือเพิ่มฟีเจอร์ในรอบนี้** เมื่อมีคำสั่งลงมือจึงเริ่มชุดที่ระบุ ขอบเขตธุรกิจยึด [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md) Final 1.6; architecture/code ยึด [CODE_SPEC.md](CODE_SPEC.md) ข้อ 1.1; แบรนด์/shared UI ยึด [UI_SPEC.md](UI_SPEC.md) ไม่สร้างสเปกสีอีกชุด

## 1. ผลลัพธ์ที่ต้องการและสิ่งที่ยังไม่สรุป

- `apps/web` รวม Guest/Learner/Instructor; `apps/admin` เป็น React อีกแอปใน repository เดียว มี router/layout/provider/build/config แยก และรองรับ independent deployment
- Feature-first + route boundary + server state แยกจาก UI state; `App.tsx` มีหน้าที่ประกอบ providers/router
- `courses` ดู Catalog/รายละเอียด; `course-authoring` เป็น feature สร้าง/แก้คอร์ส รวม Curriculum/Quiz Editor ที่ยืนยันแล้ว ส่วน `packages/course-authoring` เป็น candidate for extraction เมื่อ R0/R6 พิสูจน์การใช้ร่วมและ dependency boundary ไม่ import หน้าอีกแอปหรือคัดลอก editor ทั้งก้อน
- TanStack Query ดูแลข้อมูลจาก API; Tailwind ดูแล layout/spacing/responsive; shared UI และ library providers อ่าน theme tokens ชุดเดียว
- API contract และข้อผิดพลาดตกลงร่วมกับ backend ต่อ flow ก่อนทำ hooks ของ flow นั้น ไม่เอา mock schema/localStorage เป็นข้อกำหนด server และไม่รอ freeze ทุก endpoint พร้อมกัน
- ลำดับคือ inventory → scope cleanup → split apps → shared UI/router → contract → API/Query → migrate features; รักษาหน้าตา/flow ที่ยังอยู่ใน scope และตรวจ/ย้อนแต่ละชุดได้ ไม่เสียเวลาย้ายฟีเจอร์ที่ตกลงว่าจะถอน
- เริ่ม basic CI หลัง split apps; เพิ่ม Containerization และ deployment pipeline ช่วงเตรียมส่งมอบ โดยเก็บงาน Integration/Acceptance แยกไว้

Backend language/framework, database, วิธี session/credentials, hosting/domains และ media provider นอก YouTube ยังไม่สรุป การมี Containerization/CI-CD ในแผนไม่ใช่การเลือกปลายทางหรืออนุญาต deploy/ย้ายข้อมูลจริง Cloud Run เป็น hosting candidate สำหรับ Web/Admin services แยก ไม่ใช่ข้อกำหนดที่เลือกแล้ว

## 2. จุดอ้างอิง Git และข้อเท็จจริงปัจจุบัน

ตรวจ checkout และ remote วันที่ 7 ต.ค. 2026 ก่อนงานเอกสารนี้: working tree สะอาด; `main`, `prototype`, tag `prototype-2026-10-07` (peeled commit) และจุดเริ่ม `refactor/v1-api-ready` ตรงกับ `fa491b46aebe6beaa408ba30ab92b28fd478d8fd` การ commit แผนจะทำให้ refactor branch เดินต่อ ส่วน main/prototype/tag คงจุดอ้างอิงเดิม

จุดอ้างอิงนี้รักษา source เดิม ไม่ใช่หลักฐานว่า prototype ผ่าน Final 1.6 หรือ backend พร้อม ยังไม่ได้รัน baseline typecheck/build/browser flows สำหรับเริ่มย้ายจริงในรอบเอกสารนี้

| ส่วนปัจจุบัน | หลักฐาน/ปัญหาที่ต้องแยก |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Entry/providers/CSS order กับ route และ role/ownership conditions ของทุกพื้นที่อยู่ในแอปเดียว |
| `src/components/Shell.tsx` | Navigation ของหลายบทบาทอยู่ร่วมกัน |
| `src/store.tsx`, `src/data.ts`, `src/types/index.ts` | ข้อมูล/action/persistence จำลองหลาย feature อยู่ก้อนเดียว อย่าใช้เป็น API schema โดยอัตโนมัติ |
| `src/pages/admin/AdminPages.tsx` | หลาย page อยู่ไฟล์เดียว และ Admin เปิด editor/curriculum ผ่าน `/teach/...` |
| `src/pages/instructor/CoursePages.tsx`, `CurriculumWorkspace.tsx`, `ChapterWorkspace.tsx`, `src/components/chapter/` | Authoring ที่ต้องตรวจ import จริงและแยกส่วนร่วม |
| `src/pages/learner/CommercePages.tsx`, `src/api/payments.ts` | Checkout มี client เรียก Payment API แล้ว แต่ repository ไม่มี backend/webhook จริง; ต้องย้ายและรักษา error/pending behavior ไม่อ้างว่าเริ่มจากไม่มี API เลย |
| `src/pages/learner/LearnerAiPage.tsx`, `src/api/ai-practice-mock.ts` | AI/ชุดฝึกยังมี mock ไม่ใช่การเชื่อม AI/database จริง |
| `src/theme.ts`, `src/shadcn.css`, `src/styles.css`, `src/system-theme.css`, `src/workspace-responsive.css` | Tokens/providers/overrides หลายแหล่ง ต้องรวม owner และตรวจ cascade |
| `src/config/features.ts`, `docs/FEATURE_RELEASE_MATRIX.md`, `tests/` | Feature/runtime/route inventory ต้องปรับพร้อม source/test ของชุดนั้น ไม่เปิด released จากการย้ายไฟล์ |

ตารางนี้เป็นจุดเริ่มสำรวจ ไม่ใช่รายการทุกไฟล์ ก่อนลงมือแต่ละชุดต้องตรวจ source/branch/dirty work อีกครั้ง

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

โครงสร้างนี้เป็นส่วนที่ freeze แล้วสำหรับ Frontend เป้าหมาย ไม่ใช่คำสั่ง rename repository/checkout เป็น `melearn-tutor` โฟลเดอร์และ build ยังไม่ได้สร้าง

`packages/course-authoring` อยู่นอกโครงสร้างบังคับ: R0 บันทึกส่วน Instructor/Admin ที่ใช้ร่วมและ dependencies; R6 ยืนยัน interface แล้ว extract เมื่อมีหลักฐานจริง หากจำเป็นต้องแชร์ตั้งแต่ R2 ให้ตัดสินเฉพาะส่วนขั้นต่ำจาก R0 ห้าม import source ข้าม apps, copy editor ทั้งก้อน หรือซ่อน business editor ใน `packages/ui` เพื่อหลบ boundary ส่วนร่วมต้องไม่ผูกกับ shell, store หรือ route เฉพาะแอป

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
| `assessment` | ทำ Quiz/ผล/คะแนนสูงสุด; ผู้สอนดูและตรวจคำตอบในขอบเขตคอร์ส | สิทธิ์จัดการ/ตรวจของ Admin ตาม scope; การทำแบบฝึกหัดกับการนิยาม Quiz เป็นคนละหน้าที่ |
| `certificate` | ดู/ดาวน์โหลดใบรับรองของตน | หน้าดูแลตามสิทธิ์ใน scope ไม่เพิ่ม flow revoke/reissue เอง |
| `payment` | Stripe ซื้อรายคอร์สและหน้าผล/รอ/error | ดูข้อมูล Payment ผิดปกติขั้นต่ำ ไม่มี Finance/Refund dashboard |
| `redeem` | ใช้โค้ดรับสิทธิ์ | Admin ออกโค้ด ดูผู้ใช้ ยกเลิกเฉพาะ Unused; แยกจาก discount code |
| `ai` | Chat/history/search/rename/delete/AIPractice | ตั้ง `ai_enabled` และ Transcript ต่อ Video; ไม่มีหน้าอ่านแชตบัญชีอื่น |
| `instructor` | Workspace overview/navigation และรายชื่อผู้เรียนของคอร์สตน | ไม่เป็นก้อนรวม editor/learning/payment ซ้ำ; Admin เพิ่มบทบาทผ่านงาน `users` |
| `users`, `course-review`, `codes` | ไม่มีหน้าปฏิบัติการ Admin ใน Web | Admin สร้างบัญชี/เพิ่มผู้สอน, ตรวจอนุมัติ/ส่งกลับ/เผยแพร่, จัดการโค้ด |

ชื่อ feature/ไฟล์ย่อยปรับให้พอดีกับ implementation ได้ แต่ ownership ของ `courses` กับ `course-authoring` และขอบเขตสิทธิ์เป็นข้อที่ตกลงแล้ว

งานที่เก็บไว้ครบตามบท 1 ของ scope รวม Resend Verification Link/Reset, Stripe และ AI สร้างแบบฝึกหัดในเดือนแรก การทำงานจริงต้องตรวจจาก server ไม่ใช่ปุ่มที่คลิกได้

รายการที่จะถอดใน R1 ก่อนย้ายโครงสร้าง: Cart/Order history เต็ม, Inbox/ถามผู้สอน, Finance/ส่วนแบ่ง/จ่ายเงิน/Refund flow, Business Analytics/Big Data, Referral, ขอเป็นผู้สอน/คำเชิญ, ผู้สอนร่วม, Archive, Assignment แยก, LINE login, AI Knowledge Dashboard/ถอดเสียงอัตโนมัติ/หน้า Admin ดูคำถามคนอื่น และ Release Dashboard ตามบท 8 การยังไม่ทำไม่ใช่การตั้งนโยบายธุรกิจใหม่

R1 ถอนตามความสามารถและ import/action dependencies ไม่ลบไฟล์จากชื่อ analytics/commerce อย่างเดียว ตัวอย่าง `src/pages/instructor/QuizPages.tsx` และ `src/pages/instructor/LearnerReviewQueuePage.tsx` ยังใช้ `getReviewQueue` จาก `src/api/analytics.ts` ซึ่งเป็นส่วนตรวจคำตอบที่ต้องรักษาไว้ เช่นเดียวกับ Payment API และ Redeem ที่อยู่ใกล้ Commerce เดิม ต้องแยก retained helpers ออกก่อนถอนเจ้าของที่ไม่ใช้

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

ทุกชุดในตารางยังไม่เริ่ม implementation ชุด R0 เริ่มสำรวจ/ตรวจ baseline เมื่อได้รับคำสั่ง ชุด functional changes ต้องระบุ flow ที่จะเปลี่ยนก่อนเริ่ม ไม่ถือว่าแผนนี้อนุญาตตัดเพิ่มฟีเจอร์ทันที

| ชุด | งาน / ข้อพึ่งพา | เกณฑ์รับ |
| --- | --- | --- |
| R0 — Inventory/baseline | ทำ route→page→component→CSS→store action map, keep/adapt/remove, dependencies และ API gaps; บันทึก authoring reuse candidates และตรวจ Git/tests ตั้งต้น | ระบุ retained dependencies ของฟีเจอร์ที่จะถอน; typecheck/build/critical flow baseline พร้อมผลจริงและข้อจำกัด; ไม่อ้าง shared package หรือ backend readiness ก่อนมีหลักฐาน |
| R1 — Scope cleanup | หลัง R0 ถอดฟีเจอร์นอก scope ตามบท 8 ก่อน refactor; ถอน routes/navigation/actions/side effects/styles/dependencies/tests ที่ไม่ใช้ และแยก retained helpers ที่จำเป็น | ฟีเจอร์ที่ถอนไม่มีทางเข้าหรือ side effect; grading/learner list/Payment/Redeem ยังทำงาน; matrix/config/tests สอดคล้อง; ไม่ reset browser data, prototype/tag คงเดิม |
| R2 — Workspace Web/Admin + basic CI | หลัง R1 จัด workspace/build/TypeScript aliases/scripts สำหรับสอง apps และ packages; ถ้าต้องแชร์ authoring ทันทีใช้ผล R0 กำหนดส่วนขั้นต่ำ; เริ่ม CI typecheck/test/build แยก | สอง entry/build เปิดได้; Web ไม่โหลด Admin pages; ไม่มี cross-app imports หรือ copy ทั้งแอป; CI รัน checks ที่มีจริงพร้อมรายงานผล ไม่ deploy |
| R3 — Shared UI/tokens + router | หลัง R2 รวม token source/theme adapters และ shared variants/Tailwind ทีละส่วน; แยก route modules/layouts/guards ให้ App เล็ก | primary/hover/focus/disabled ทั้งสองแอปอ้างต้นทางเดียว; contrast/keyboard/responsive กับ deep link/refresh/back/no-access ผ่าน; Instructor เข้า learner flows ตามสิทธิ์; คง demo session boundary ชั่วคราวได้ |
| R4a — API Contract ต่อ flow | ใช้ scope และผล R0 ตกลงกับ backend: DTO/enums/request/response/errors, credentials/permissions, states, pagination และ idempotency ตาม flow ที่เกี่ยวข้อง; อนุมัติ contract ก่อน hooks ของ flow นั้น | มีตัวอย่าง success/error และผู้รับผิดชอบสัญญาร่วม; prototype schema ไม่กลายเป็น contract โดยอัตโนมัติ; ระบุ version/change policy และสิ่งที่ยังไม่ตัดสิน; ไม่รอ freeze ทุก endpoint พร้อมกัน |
| R4b — API client/Query foundation | หลัง R2 และ contract ของ slice ผ่าน R4a จัด HTTP/error infrastructure, query keys/mutations/invalidation/account cache และ mock adapter; เลือก session transport ก่อน auth จริง | Payload validation/loading/error/cancel ทำงานตาม contract; mock/real แยกชัด; เปลี่ยนบัญชีไม่รั่ว cache; reuse Payment validation เดิม; hooks ไม่กำหนด contract ย้อนกลับ |
| R5 — Public/auth/account/blog | หลัง R3/R4b และ R4a ของแต่ละ flow ย้าย Catalog/public content, Auth/Profile, Blog read/Admin write เป็นชุดย่อย | หน้าที่เก็บไว้ยังครบ public/member ต่างบริบท; Blog Published/Admin write แยก; API ยังไม่พร้อมไม่ใช้ fake success; ไม่ย้ายฟีเจอร์ที่ถอนใน R1 กลับมา |
| R6 — Course authoring/review | หลัง R3/R4b และ contracts ที่เกี่ยวข้อง แยก pages/editor/curriculum/chapter/content/Quiz definition กับ Admin review; ตัดสิน shared extraction ตาม evidence R0 และ dependency จริง | มีบันทึก extract/ไม่ extract พร้อมเหตุผล; ไม่มี cross-app imports/copy editor ทั้งก้อน; owner/Admin manage, draft/save/preview/ordering ไม่เสีย; YouTube/รูป/rich text ใช้ได้; Preview ไม่สร้างผลเรียน |
| R7 — Learning/assessment/certificate | หลัง R4b และ contracts auth/course/assessment ย้าย Enroll→Learn→Attempt→Grade→Complete→Certificate โดยไม่ต้องรอ editor ทั้งหมดถ้า contract พร้อม | ความสัมพันธ์/snapshots/คะแนนสูงสุด >70%/รอตรวจ/Progress/ใบเดิมตรงบท 2 และ 9; Instructor เรียนคอร์สอื่นได้; server evidence แยกจาก mock |
| R8 — Payment/redeem | หลัง R4b และ contracts auth/course/enrollment/payment/redeem ย้าย client/หน้าผล/โค้ด แยกสอง features | Success page อ่านสถานะ ไม่ fulfill; pending/error/already-enrolled ถูกต้อง; Redeem แยกส่วนลด; concurrency/idempotency ตรวจ server เมื่อพร้อม |
| R9 — AI/Transcript/AIPractice | หลัง R4b และ contracts auth/enrollment/AI ย้าย UI/history/API boundary กับ Admin Transcript controls | บริบทตามสิทธิ์; history/rename/delete/draft ไม่เสีย; AIPractice ไม่เปลี่ยน Progress; 20 Prompt สำเร็จ/วันไทยต้องมี server evidence |
| R10 — Integration ของ flows | หลัง migrations ของ flow ที่เกี่ยวข้อง ตรวจสองแอปกับ API จริงตามบท 9 และตามเก็บ dead code ของ retained slices ที่ถูกแทนแล้ว | Persistence ข้าม session/device, server permissions/ownership/enrollment, Stripe webhook และ AI จริงมีหลักฐาน; ไม่มี mock fallback ใน flow ที่ประกาศพร้อม; ไม่แทนงานนี้ด้วย build image |
| R11 — Containerization | หลัง R2 เมื่อ build/runtime configuration ของ apps ชัด ทำ Dockerfiles แยก ใช้ monorepo-root context และ production static serving; หลัง R10 เพิ่ม smoke กับ API ที่พร้อม | Images build แยก reproducibly, health/assets/SPA deep links ผ่าน; ไม่ใช้ Vite dev/preview server เป็น production server; public API config ถูกต้อง ไม่มี secrets ฝัง bundle |
| R12 — CI/CD เตรียมส่งมอบ | ต่อจาก basic CI ใน R2 และ images R11 เพิ่ม dependency-aware path filtering, artifact/image promotion, environment configuration และ rollback; เลือก hosting ก่อนจัด CD เฉพาะบริการ | app-only เปลี่ยนตรวจ app นั้น; shared packages/root lockfile/config เปลี่ยนตรวจ dependents; pipeline/สิทธิ์ deploy แยก Web/Admin; Cloud Run services แยกเฉพาะเมื่อเลือกและอนุญาตเปิดจริง |
| R13 — Final acceptance/เตรียม main | หลัง R10 และตรวจ packaging/pipeline ที่เปลี่ยนใน R11/R12 ตรวจ artifact ของทั้งสองแอปตาม scope พร้อมข้อจำกัด ก่อนรวม main | Typecheck/build/regressions ที่จำเป็นกับ browser/API flows และ runtime artifact ผ่าน; หลักฐานชี้ revision เดียวกัน; main เป็น Final 1.6 ไม่อ้าง Production พร้อมจาก CI/health อย่างเดียว |

ลำดับคือข้อพึ่งพา ไม่ใช่กำหนดวันส่ง R3 ต้องแตกชุด tokens/UI/router ที่ตรวจแยกได้ และ R5–R9 แตกเป็น commit ตาม flow; R4a ของ flow ถัดไปเตรียมได้ระหว่าง migrate flow ที่ตกลงแล้ว R11/R12 เตรียม build/CI ได้หลัง split โดยไม่ต้องรอ backend ทั้งหมด แต่ final acceptance ของ API ต้องรอหลักฐานจริง ไม่มีการมอบหมาย agent/เขียนโค้ดพร้อมกันในรอบเอกสารนี้

### 6.1 Contract freeze และ authoring extraction

- R4a ส่งมอบ DTO/enums, request/response success/error, field visibility, permission/state และตัวอย่างให้ mock/test ใช้ร่วมกัน ยืนยันต่อ flow กับ backend ก่อน R4b/hooks ของ flow นั้น หาก backend ยังไม่รับให้ระบุเป็น draft แทนคำว่า frozen
- Contract เปลี่ยนต้องอัปเดต version/consumers/fixtures/validation/tests ของ slice พร้อมกัน ไม่แก้ server response เพื่อเอาใจ hook โดยไม่มี review; frontend ขึ้นรูป UX ด้วย draft adapter ได้ แต่ไม่อ้างว่า integrate แล้ว
- R0/R6 บันทึก authoring components ที่ทั้งสองแอปใช้, dependencies, props/callbacks และ draft ownership ก่อนตัดสิน extraction แยก feature ownership ไว้เสมอ ไม่ยก permission/API/navigation ของสองแอปมารวมเพราะหน้าตาเหมือนกัน

### 6.2 Containerization และ CI/CD future work

- เป้าหมายไฟล์คือ `apps/web/Dockerfile` และ `apps/admin/Dockerfile` โดย build context จาก monorepo root เพื่อรวม lockfile/shared packages ได้ สร้าง image สำหรับ app ที่เลือก ไม่ bundle อีก app ติดไปด้วย; paths นี้เป็นแผน ยังไม่มีไฟล์
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

รอบนี้ส่งมอบการตัดสินใจ Frontend ใน CODE_SPEC, กติกา shared tokens/Tailwind ใน UI_SPEC, แผนฉบับนี้ และลิงก์เริ่มงานใน AGENTS/README/feature matrix ไม่เปลี่ยน scope ธุรกิจ Final 1.6 และไม่แก้ source/config/lockfile

งานถัดไปตามแผนคือ R0: inventory ราย route/feature, retained dependencies, authoring reuse candidates และ baseline verification เพื่อกำหนดไฟล์ R1 scope cleanup ก่อน R2 split apps ต้องมีคำสั่งลงมือจากผู้ใช้ก่อน implementation
