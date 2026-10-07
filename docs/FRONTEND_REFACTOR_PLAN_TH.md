# แผน Frontend Refactor — Melearn Final 1.6

วันที่ 7 ตุลาคม 2026 · branch งาน `refactor/v1-api-ready`

สถานะ: ผู้ใช้ยืนยันทิศทาง Frontend และให้ปรับเอกสาร/เตรียมแผนแล้ว **ยังไม่เริ่ม implementation ไม่ตัดหรือเพิ่มฟีเจอร์ในรอบนี้** เมื่อมีคำสั่งลงมือจึงเริ่มชุดที่ระบุ ขอบเขตธุรกิจยึด [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md) Final 1.6; architecture/code ยึด [CODE_SPEC.md](CODE_SPEC.md) ข้อ 1.1; แบรนด์/shared UI ยึด [UI_SPEC.md](UI_SPEC.md) ไม่สร้างสเปกสีอีกชุด

## 1. ผลลัพธ์ที่ต้องการและสิ่งที่ยังไม่สรุป

- Tutor รวม Guest/Learner/Instructor; Admin เป็น React อีกแอปใน repository เดียว มี router/layout/provider/build/config แยก
- Feature-first + route boundary + server state แยกจาก UI state; `App.tsx` มีหน้าที่ประกอบ providers/router
- `courses` ดู Catalog/รายละเอียด; `course-authoring` สร้างและแก้คอร์ส รวม Curriculum/Quiz Editor; Tutor/Admin ใช้ authoring ส่วนร่วมโดยไม่ import หน้าอีกแอป
- TanStack Query ดูแลข้อมูลจาก API; Tailwind ดูแล layout/spacing/responsive; shared UI และ library providers อ่าน theme tokens ชุดเดียว
- API contract และข้อผิดพลาดเป็นข้อตกลงร่วมกับ backend ไม่เอา mock schema หรือ localStorage เป็นข้อกำหนด server
- รักษาหน้าตา/flow ที่ยังอยู่ใน scope ระหว่างย้ายโครงสร้าง แล้วทำการปรับขอบเขต Final 1.6 เป็นชุดแยก ตรวจและย้อนแต่ละชุดได้

Backend language/framework, database, วิธี session/credentials, hosting/domains, CI/CD และ media provider นอก YouTube ยังไม่สรุป การยืนยันสอง frontend ไม่กำหนดสิ่งเหล่านี้ และไม่อนุญาต deploy/ย้ายข้อมูลจริง

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
  tutor/
    src/
      app/                 # router, providers, App
      layouts/             # Public, Auth, Learner, Instructor
      features/            # domain ที่ Tutor ใช้
      shared/              # ของทั่วไปที่ใช้เฉพาะ Tutor
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
  course-authoring/        # authoring components/model ที่ใช้ร่วมจริง
```

ภายใน feature มี `api/`, `hooks/`, `pages/`, `components/` และ types เท่าที่มีงานใช้จริง ไม่แยกไฟล์เล็กทุกฟังก์ชันเป็นข้อบังคับ เป้าหมายคือตาม bug/flow ได้ในเจ้าของ feature เดียว

Apps import packages ได้; packages ไม่ import apps; ไม่ให้ Tutor import `apps/admin/src` หรือกลับกัน; แยก shell/pages ออกจาก reusable authoring และป้องกันวงจร dependency ส่วน API เฉพาะ feature อยู่ใน app ที่ใช้ ไม่ย้าย business API ทั้งหมดเข้า client กลาง

## 4. Feature ownership และขอบเขต Final 1.6

| Feature/ส่วน | Tutor | Admin / shared |
| --- | --- | --- |
| `auth`, `account` | สมัคร/Login/Google/Verify/Reset/Profile ตามบัญชี | Admin auth/session boundary ของตัวเอง; บัญชีเดียวกันต้องยึดตัวตน server ไม่สร้าง user store อีกชุด |
| `public`, `courses` | Landing/About และ Catalog/รายละเอียด Published; เก็บบริบท guest/member ต่างกัน | Admin course directory เป็นหน้าจัดการคนละแบบ ไม่ใช้ Catalog เปิด Draft |
| `blog` | อ่านบทความ Published | Admin สร้าง/แก้/เผยแพร่ Blog; rich-content renderer ใช้ร่วมได้ |
| `learning` | My courses, Enroll ฟรี, Lesson, Progress, Resume; Instructor เรียนคอร์สคนอื่นได้ | Preview เพื่อจัดการไม่สร้าง Enrollment/Progress จริง |
| `course-authoring` | Pages ของผู้สอนสำหรับคอร์สตนเอง | Pages ของ Admin สร้าง/แก้แทน ระบุ Instructor หนึ่งคน; editor/curriculum/quiz definition ใช้ package ร่วม |
| `assessment` | ทำ Quiz/ผล/คะแนนสูงสุด; ผู้สอนดูและตรวจคำตอบในขอบเขตคอร์ส | สิทธิ์จัดการ/ตรวจของ Admin ตาม scope; การทำแบบฝึกหัดกับการนิยาม Quiz เป็นคนละหน้าที่ |
| `certificate` | ดู/ดาวน์โหลดใบรับรองของตน | หน้าดูแลตามสิทธิ์ใน scope ไม่เพิ่ม flow revoke/reissue เอง |
| `payment` | Stripe ซื้อรายคอร์สและหน้าผล/รอ/error | ดูข้อมูล Payment ผิดปกติขั้นต่ำ ไม่มี Finance/Refund dashboard |
| `redeem` | ใช้โค้ดรับสิทธิ์ | Admin ออกโค้ด ดูผู้ใช้ ยกเลิกเฉพาะ Unused; แยกจาก discount code |
| `ai` | Chat/history/search/rename/delete/AIPractice | ตั้ง `ai_enabled` และ Transcript ต่อ Video; ไม่มีหน้าอ่านแชตบัญชีอื่น |
| `instructor` | Workspace overview/navigation และรายชื่อผู้เรียนของคอร์สตน | ไม่เป็นก้อนรวม editor/learning/payment ซ้ำ; Admin เพิ่มบทบาทผ่านงาน `users` |
| `users`, `course-review`, `codes` | ไม่มีหน้าปฏิบัติการ Admin ใน Tutor | Admin สร้างบัญชี/เพิ่มผู้สอน, ตรวจอนุมัติ/ส่งกลับ/เผยแพร่, จัดการโค้ด |

ชื่อ feature/ไฟล์ย่อยปรับให้พอดีกับ implementation ได้ แต่ ownership ของ `courses` กับ `course-authoring` และขอบเขตสิทธิ์เป็นข้อที่ตกลงแล้ว

งานที่เก็บไว้ครบตามบท 1 ของ scope รวม Resend Verification Link/Reset, Stripe และ AI สร้างแบบฝึกหัดในเดือนแรก การทำงานจริงต้องตรวจจาก server ไม่ใช่ปุ่มที่คลิกได้

รายการที่จะถอดจากแอปส่งมอบในชุดปรับ scope: Cart/Order history เต็ม, Inbox/ถามผู้สอน, Finance/ส่วนแบ่ง/จ่ายเงิน/Refund flow, Business Analytics/Big Data, Referral, ขอเป็นผู้สอน/คำเชิญ, ผู้สอนร่วม, Archive, Assignment แยก, LINE login, AI Knowledge Dashboard/ถอดเสียงอัตโนมัติ/หน้า Admin ดูคำถามคนอื่น และ Release Dashboard ตามบท 8 การยังไม่ทำไม่ใช่การตั้งนโยบายธุรกิจใหม่

Upload Video/Mux/Bunny ยังไม่เปิด ใช้ YouTube Link; UI upload อาจอยู่ได้แต่ต้องแสดงยังไม่พร้อมและไม่เก็บไฟล์จริง ภาพปก/ภาพคำตอบเป็นอีกขอบเขต ไม่ถอดรวมไปด้วย

## 5. Route และ state boundary

- Tutor แยก Public/Auth/Learner/Instructor route modules พร้อม nested layouts; Admin แยก auth/management routes ของตัวเอง มี loading/error/no-access/not-found และเปิดตรง/refresh ได้
- URL ปัจจุบันเช่น `/articles`, `/account/profile`, `/explore/courses` ต้องทำ route mapping ก่อนเปลี่ยน ไม่เปลี่ยนเป็น `/blog` หรือ `/account` ตามตัวอย่าง architecture โดยอัตโนมัติ จัด redirects/deep links/back paths เมื่อมีแผนย้าย URL ที่รับแล้ว
- Admin ปัจจุบันไป `/teach/...` ให้ map เป็นหน้า Admin ของตัวเอง ไม่พาผู้ใช้ข้ามแอปเพื่อแก้คอร์ส ส่วน authoring package รับ callbacks/links จาก caller
- Guards ดู session/capabilities เพื่อ UX ไม่ใช้ enum role เดียวบล็อก Instructor จาก learner flows Backend เป็นผู้บังคับสิทธิ์และข้อมูลที่คืน
- Query keys ต้องมี resource/context/account scope ที่เหมาะสม; logout/เปลี่ยนบัญชีไม่เห็น cache ของคนก่อน Mutation สำเร็จต้อง invalidate/update queries ที่สัมพันธ์กันภายในแอป; ข้ามแอป refetch ตามนโยบาย ไม่แชร์ memory cache
- Form/editor/คำตอบที่กำลังกรอกเป็น UI draft แม้มีข้อมูลขนาดใหญ่ Draft ต้องไม่หายจาก refetch และไม่กลายเป็นผลเรียนก่อนบันทึก
- เลือก data owner ต่อ slice ให้ชัดก่อนย้าย ไม่เก็บ courses/payments/progress ซ้ำทั้ง Query และ Context/Zustand; UI แสดงผลจาก server แต่ไม่คำนวณสิทธิ์/คะแนนเป็นหลักฐานจริง
- ช่วงยังไม่มี API ใช้ mock adapter/fixtures หลัง boundary ที่ระบุชัด เมื่อทดสอบ Tutor/Admin แก้ข้อมูลร่วมกันต้องมีแหล่งทดสอบที่สอดคล้องกัน localStorage ของสอง origin ไม่ใช่ shared backend ให้เลือกวิธีทดสอบนี้ก่อนชุดที่เกี่ยวข้อง

## 6. แบ่งงานและเกณฑ์ตรวจรับ

ทุกชุดในตารางยังไม่เริ่ม implementation ชุด R0 เริ่มสำรวจ/ตรวจ baseline เมื่อได้รับคำสั่ง ชุด functional changes ต้องระบุ flow ที่จะเปลี่ยนก่อนเริ่ม ไม่ถือว่าแผนนี้อนุญาตตัดเพิ่มฟีเจอร์ทันที

| ชุด | งาน / ข้อพึ่งพา | เกณฑ์รับ |
| --- | --- | --- |
| R0 — Inventory/baseline | ทำ route→page→component→CSS→store action map, feature keep/adapt/remove, dependencies, API gaps; ตรวจจุดอ้างอิง Git และ tests ปัจจุบัน | ระบุไฟล์จริง/owner ของทุก route ที่จะย้าย; typecheck/build/critical flow baseline พร้อมผลจริงและข้อจำกัด ไม่อ้างว่าผ่านล่วงหน้า |
| R1 — Workspace สองแอป | หลัง R0 จัด workspace/build/TypeScript aliases/config/scripts ให้ Tutor/Admin และ packages; สร้าง boundary ส่วนร่วมขั้นต่ำสำหรับ flow ที่ทั้งสองแอปใช้ก่อนแยกเต็มใน R6; ย้ายอย่างเป็นชุดที่ยังเปิดได้ | สอง entry/build แยกทำงานได้ scripts/docs ตรง; Tutor ไม่โหลด Admin routes/pages; ไม่ copy source ทั้งแอปเป็นสองชุด; runtime gates ยังปลอดภัย |
| R2 — Tokens/shared UI | หลัง R1 รวม token source/theme adapters, ใช้ shared variants และ Tailwind ทีละ component; ตรวจ CSS cascade และ asset paths | ตัวอย่าง primary/hover/focus/disabled กับ layout ทั้งสองแอปอ่านต้นทางเดียว; contrast/keyboard/responsive ของส่วนที่ย้ายผ่าน ไม่มี redesign โดยไม่ระบุ |
| R3 — Router/layout/session boundary | หลัง R1 และ UI ที่จำเป็นจาก R2 แยก route modules/layouts/guards; `App.tsx` เล็ก; คง demo session ผ่าน boundary ชั่วคราวจน API พร้อม | Deep link/refresh/back/no-access ทำงาน; Instructor เข้า learner flow ที่มีสิทธิ์; Admin ไม่มี editor dependency ไป Tutor; ยังไม่กล่าวว่ามี auth จริง |
| R4 — API/query foundation | หลัง R1 กำหนด HTTP/error/contract/query conventions และ migration adapter; เลือก session transport กับ backend ก่อนเชื่อม auth จริง | Loading/error/cancel/validation มีผลทดสอบ; mock/real แยกชัด; เปลี่ยนบัญชีไม่รั่ว cache; reuse Payment client validation ที่มีอยู่; ไม่ติดตั้ง backend เพื่อให้ดูพร้อม |
| R5 — Public/auth/account/blog | หลัง R2–R4 ย้ายทีละ feature: Catalog/public content, Auth/Profile, Blog read/Admin authoring | หน้า/route เดิมยังครบ มี public/member distinction; Blog Published/Admin write แยก; API ที่ยังไม่พร้อมแสดงสถานะตรง ไม่ใช้ fake success |
| R6 — Course authoring/review | หลัง R2–R4 แยก course/editor/curriculum/chapter/content/Quiz Editor เป็น package และ pages ในสองแอป; แยก Admin review | Instructor owner/Admin manage ผ่าน flow; draft/save/preview/ordering ไม่เสีย; YouTube/รูป/rich text ใช้ได้; Preview ไม่สร้างผลเรียน; approval/state ตรง scope เมื่อเชื่อมจริง |
| R7 — Learning/assessment/certificate | หลัง R4 และ contracts ของ R6 ย้ายเป็น slice ต่อเนื่อง Enroll→Learn→Attempt→Grade→Complete→Certificate | ความสัมพันธ์และ snapshot ไม่เสีย; คะแนนสูงสุด >70%/รอตรวจ/Progress/ใบเดิมตามบท 2 และ 9; Instructor เรียนคอร์สอื่นได้; server evidence แยกจาก mock |
| R8 — Payment/redeem | หลัง R4 และ auth/course/enrollment contracts ย้าย client/หน้าผล/โค้ด แยก commerce เดิมเป็นสอง feature | Success page อ่านสถานะอย่างเดียว ไม่ให้สิทธิ์เอง; pending/error/already-enrolled ถูกต้อง; Redeem แยกส่วนลด; concurrency/idempotency ตรวจ server เมื่อพร้อม |
| R9 — AI/Transcript/AIPractice | หลัง R4 และ auth/enrollment/authoring contracts ย้าย UI/history และ API boundary; Transcript/Admin controls แยก owner | บริบทตามสิทธิ์; history/rename/delete/draft ไม่เสีย; AIPractice ไม่เปลี่ยน Progress; 20 Prompt สำเร็จ/วันไทยต้องมี server evidence ก่อนพร้อมใช้จริง |
| R10 — ปรับ scope และถอน legacy | เมื่อ feature ทดแทนพร้อม และได้รับคำสั่งปรับ scope เป็นชุด ถอด routes/navigation/actions/styles/dependencies/tests ที่ไม่มีใช้ ไม่ถอดแค่เมนู | ไม่มีทางเข้าหรือ side effects ของฟีเจอร์ที่ถอดในแอปส่งมอบ; อย่าลบ learner list/grading เพราะอยู่ไฟล์ analytics เดิม; matrix/config/tests ตรง Final 1.6; prototype/tag คงเดิม |
| R11 — Integration/เตรียม main | หลังทุกชุดที่จำเป็น ตรวจทั้งสองแอปกับ API จริงและบท 9 ของ scope; ทำรายการข้อจำกัดและทบทวนก่อนรวม main | Typecheck/build/regressions/critical browser flows ของทั้งสองแอปผ่าน; persisted data ข้าม session/device และ server permissions ผ่าน; ไม่มี mock fallback ใน flow ที่ประกาศพร้อม |

ลำดับคือข้อพึ่งพา ไม่ใช่กำหนดวันส่ง ทั้ง R5–R9 ต้องแตกเป็น commit ย่อยตาม flow ไม่ย้ายทั้ง feature ใหญ่ในครั้งเดียว R2–R4 มีงานที่เตรียมแยกกันได้ แต่ไม่มีการมอบหมาย agent หรือเขียนพร้อมกันในรอบเอกสารนี้

## 7. แยก refactor ออกจาก functional changes

Structural batch ย้าย ownership/import/router/state boundary โดยรักษาผลที่ผู้ใช้เห็น; functional batch เปลี่ยนให้ตรง Final 1.6 เช่น approval/สิทธิ์เรียน/ถอด Cart ต้องระบุ before/after กับกรณีตรวจรับต่างหาก หากโครงสร้างเก่าทำให้แยกไม่ได้ให้ชี้ความต่างก่อนลงมือ ไม่ใช้คำว่า refactor กลบการเปลี่ยนพฤติกรรม

เกณฑ์ที่ห้ามเปลี่ยนเอง: Webhook ที่ backend ตรวจเป็นทางให้สิทธิ์ Stripe; account read status ไม่ fulfill; Redeem แยกส่วนลด; Progress/คะแนน/Certificate server-controlled; AIPractice แยก Quiz; 20 Prompt สำเร็จต่อบัญชีต่อวัน Asia/Bangkok; Transcript/AI enable เป็น Admin ตาม scope

การใช้งานกับ API จริงต้องตกลง request/response/errors/credentials และมี backend ให้ตรวจ สิ่งที่ frontend ทำเสร็จก่อนคือ boundary/types/UX/error handling ไม่ประกาศว่า production-ready จาก typecheck/build หรือ mock tests

## 8. ตรวจงานและ checkpoint

- ใช้ [GIT_CHECKPOINT_POLICY_TH.md](GIT_CHECKPOINT_POLICY_TH.md): ตรวจ dirty/staged work ก่อนทุกชุด รักษางานผู้อื่น stage เฉพาะ path ที่มอบหมาย commit/push หลังตรวจผ่าน รายงาน SHA/branch/ผล push
- เอกสารอย่างเดียวตรวจลิงก์/path/ความสอดคล้อง/whitespace ไม่ต้อง build; source ปัจจุบันใช้ `npm.cmd run typecheck` และ `npm.cmd run build` พร้อม regression/flow ที่สัมพันธ์ หลัง R1 ต้องกำหนด scripts ตรวจทั้งสองแอปจริง ไม่ใส่คำสั่งที่ยังไม่มีว่าเคยผ่าน
- ไม่เปลี่ยน feature เป็น `released` เพราะย้ายไฟล์แล้ว Feature matrix แยก business scope, runtime readiness และหลักฐาน API; ทดสอบ feature gates เดิมเมื่อแตะ registry/routes
- เก็บโครงสร้างเดิมเฉพาะช่วงมีผู้ใช้จริง เมื่อ slice ใหม่แทนแล้วถอน dead code/dead CSS ของ slice นั้นในชุดที่ตรวจได้ ไม่ทิ้ง store สองแหล่งถาวร และไม่ reset browser data เพื่อให้ตรวจผ่าน
- ย้อนชุดที่เผยแพร่ด้วย revert ตาม policy; code rollback ไม่ใช่การคืนข้อมูล browser/database ตรวจ baseline อีกครั้งก่อน rename จำนวนมาก
- `main` เป็นเป้าหมาย Final 1.6 เมื่อผ่านเกณฑ์ของงานที่พร้อมรวมแล้ว รอบเอกสารนี้ไม่ merge/เปลี่ยน default branch/deploy และไม่แตะ `prototype` หรือ tag

## 9. สิ่งส่งมอบของรอบนี้และงานถัดไป

รอบนี้ส่งมอบการตัดสินใจ Frontend ใน CODE_SPEC, กติกา shared tokens/Tailwind ใน UI_SPEC, แผนฉบับนี้ และลิงก์เริ่มงานใน AGENTS/README/feature matrix ไม่เปลี่ยน scope ธุรกิจ Final 1.6 และไม่แก้ source/config/lockfile

งานถัดไปตามแผนคือ R0: inventory ราย route/feature และ baseline verification เพื่อกำหนดไฟล์ของชุด R1 ให้ชัดก่อนเริ่มย้ายจริง ต้องมีคำสั่งลงมือจากผู้ใช้ก่อน implementation
