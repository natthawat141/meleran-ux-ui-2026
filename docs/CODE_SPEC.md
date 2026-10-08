# Melearn Code Spec

**ข้อมูลหลักที่เจ้าของยืนยัน 6 ต.ค. 2026:** [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md) ฉบับ Final 1.6 กำหนดกติกาธุรกิจ สิทธิ์ และขอบเขตหนึ่งเดือนแรก เอกสารนี้อธิบายวิธีทำต้นแบบ หากข้อความหรือพฤติกรรมเดิมขัดกัน ให้ใช้ฉบับหลัก และระบุส่วนที่โค้ดยังไม่ตรง ห้ามถือว่าต้นแบบพร้อม Production


อัปเดต 8 ตุลาคม 2026 ครอบคลุมข้อเท็จจริงของ UX prototype และทิศทาง Frontend refactor ที่ผู้ใช้ยืนยัน อ่าน [`UI_SPEC.md`](UI_SPEC.md) ควบคู่ก่อนแก้หน้าจอ

## สถานะ implementation ล่าสุด — 9 ตุลาคม 2026

- Pages อยู่ใน `apps/web/src/features` และ `apps/admin/src/features`; root `src/`, `@legacy`, `packages/store`, `LmsProvider` และ `PrototypeDataBoundary` ถอนแล้ว
- ทุก business flow ที่ยังอยู่ใน scope รวม Authoring/Instructor/Admin management/Blog ใช้ app-owned HTTP adapters และ Query. Backend/mock เป็น source of truth; ห้ามเพิ่ม browser persistence สำหรับ Course/User/Progress/Attempt/Payment
- Unsaved editor draft เก็บใน controlled state หรือ sessionStorage ที่แยกบัญชีได้. Shared course-authoring มีเฉพาะ reusable editor/form conversion ไม่ถือ HTTP/session/permission หรือ state กลาง
- `packages/contracts` แยก Draft wire DTO (`management-http.ts`, `blog.ts`, `http-responses.ts`) จาก UI models. DTO compiler checks และ HTTP tests ไม่เท่ากับ full runtime JSON Schema validation; resources ใหม่ตรวจ nested fields/enum/nullability/finite numbers/IDs/timestamps/rich JSON และ safe error fields ผ่าน canonical management-decoders. Backend ยังไม่ freeze
- `apps/*/src/shared/api/client.ts` เป็น transport instance ต่อ app. `VITE_API_MODE=mock|remote`, `VITE_API_BASE_URL`, `VITE_API_CREDENTIALS` กำหนดตอน build; default dev=mock, build=remote. Remote ล้มเหลวต้องแสดง error ไม่ fallback localStorage. ยังต้องตกลง CORS/cookie/CSRF กับ Backend
- `packages/api-client` ไม่ถือ origin/session/business endpoints; UI ไม่เรียก fetch กระจายเอง
- Docker build context อยู่ monorepo root, COPY workspace manifests ครบและไม่อ้าง root `src/`. Runtime มีเฉพาะ `dist/web` หรือ `dist/admin`; default Nginx ไม่ proxy API จนมี Backend และจะตอบ 404 API paths แทน SPA HTML

ข้อความ migration/paths เก่าในส่วนด้านล่างใช้เป็นบริบทของต้นแบบ; สถานะ runtime ปัจจุบันให้ยึดบล็อกนี้และ [progress](R7_API_MOCK_PROGRESS_TH.md).

## 1. ข้อเท็จจริงและขอบเขต

- ใช้ React, Vite, TypeScript/TSX, React Router และ TanStack Query สำหรับ server state เวอร์ชันติดตั้งตรวจจาก `package.json` / lockfile
- ผู้ใช้ยืนยันทิศทาง React Frontend refactor ตามข้อ 1.1 แล้ว แต่ repository นี้ยังไม่มี backend Production ไม่อนุมาน backend stack, database, auth gateway หรือ deployment configuration จากชื่อ workspace
- repository ใช้ npm workspaces แยก `apps/web`, `apps/admin` และ `packages/ui`, `packages/api-client`, `packages/contracts`, `packages/course-authoring`; root scripts ตรวจแต่ละ app และ packages และ regression tests ใช้ native Node อย่าอ้างว่าคำสั่งเหล่านั้นผ่านถ้าไม่มีการรันจริง
- อนาคต MCP/CLI/skill ต้องมีงานที่ระบุ scope และ permission model ของตัวเอง ไม่วาง mock tool เป็นบริการจริง
- Mux Data environment key ใช้ชื่อ `VITE_MUX_ENV_KEY` ใน `.env.local` (มีชื่อเปล่าใน `.env.example`) เป็นค่า client-side สำหรับ analytics ไม่ใช่ Mux API token; ตอนนี้ยังไม่มี Mux SDK/player wiring จึงยังไม่มี tracking

### 1.1 ทิศทาง Frontend ที่ยืนยัน 7 ตุลาคม 2026

การยืนยันนี้เป็น architecture ของ Frontend และแผนงาน ไม่ใช่หลักฐานว่า API พร้อม ดูลำดับงานและเกณฑ์รับที่ [FRONTEND_REFACTOR_PLAN_TH.md](FRONTEND_REFACTOR_PLAN_TH.md)

- ใช้สอง React apps ใน repository เดียว: `apps/web` รวม Guest/Learner/Instructor; `apps/admin` เป็นงานดูแลระบบ แต่ละแอปมี entry, router, providers, layouts, build และ config ของตัวเอง รองรับ deployment แยก R2b สร้าง workspace/entry/build และ route owners แล้ว; R5c ย้าย Web public/account slices กับ Admin Blog list/editor ชุดแรกเข้า app; root `src/` และ alias `@legacy` ถอดแล้ว; packages/store ถอนแล้ว; business state อ่าน HTTP/API
- ภายในแต่ละแอปใช้ `app/`, `layouts/`, `features/`, `shared/`; feature เก็บ `api/`, `hooks/`, `components/`, `pages/` และ types ใกล้กันตามที่ใช้จริง ไม่สร้างโฟลเดอร์ว่างทุกชนิดเป็นข้อบังคับ
- `courses` รับผิดชอบ Catalog/รายละเอียดคอร์สและ presentation ที่เกี่ยวข้อง; `course-authoring` รับผิดชอบ Course Editor, Curriculum, Chapter/Content Editor และ Quiz Editor; การทำข้อสอบ/ผล/ตรวจคะแนนเป็น `assessment` ไม่ใส่ใน editor
- เป้าหมายคือแต่ละแอปเป็นเจ้าของ page/route orchestration ของตนเอง. R6b extract controlled Course Metadata Editor UI เป็น `@melearn/course-authoring`; R6c แยก CourseEditor hosts; R6d ย้าย Course Overview, Curriculum, Chapter, Content และ Quiz authoring pages ไป `apps/web`/`apps/admin` พร้อม chapter editor components/styles ในแต่ละ app. Admin Quiz Manager เป็น authoring-only; attempt review/grading คงเป็น Instructor assessment ใน Web. หน้า app-owned เหล่านี้ต่อ app-owned HTTP adapters/Query; unsaved draft เป็น UI state. การย้ายหน้า/ผ่าน mock ไม่ยืนยัน real Backend permissions. Shared package ปัจจุบันมี reusable controlled editor UI และ pure HTTP/form conversion; อย่าขยาย package หรือคัดลอก editor ทั้งก้อนข้าม apps โดยไม่มี interface/reuse evidence ที่ตรวจได้
- `packages/ui` เป็น shared UI/theme adapters (R2b export `PageTitle`/`StatusTag`; R3a เพิ่ม `MelearnUiProvider`; R3b ใช้ `design-tokens.json` เป็น source เดียวที่ TypeScript adapters อ่านและ generator แปลงเป็น `tokens.css`/`tailwind.css`); Web/Admin เป็นเจ้าของ Router/AuthSessionProvider/Query ของตน และแต่ละ app stylesheet import shared Tailwind พร้อมลงทะเบียน source scope ของแอป; root legacy CSS ถอนแล้ว; shared styles อยู่ packages/ui และ app-scoped feature styles; `packages/api-client` export generic HTTP/error transport จาก R4b-prep โดยไม่กำหนด API origin, auth/session policy, envelope หรือ business DTO; `packages/contracts` มี Draft HTTP DTO ที่ตรงกับ clients/mock; ยังรอ Backend ยืนยันเพื่อ freeze. ห้ามคัดลอก `LmsData` หรือ seed model ทั้งก้อนเป็น server contract
- Dependency ไหลจาก apps ไป packages; packages ห้าม import apps; ห้าม app หนึ่ง import source ภายในอีก app และห้ามวงจรระหว่าง packages API เฉพาะ feature อยู่ใน feature ของแต่ละแอป alias `@legacy` ถอนแล้ว ห้ามเพิ่ม app-to-app import หรือ root-source bridge กลับมา
- `App.tsx` ประกอบ providers/router เท่านั้น; R3c แยก route declarations และ UX access wrappers ไป `apps/web/src/app/router/` (Public/Auth/Learner/Instructor/System) กับ `apps/admin/src/app/router/` (Entry/Management/Authoring/System) โดย snapshot/test คง path, feature key, element และลำดับเดิม ปัจจุบัน wrappers เรียก app-owned pages และ shared UI; ไม่มี `@legacy` runtime
- Page ดูแล route params/query และประกอบหน้าจอ; feature component ดูแล behavior ของ feature; shared UI ดูแล presentation/interaction ทั่วไป ไม่เรียก API เฉพาะธุรกิจเอง
- Course, Enrollment, Progress, Payment, AI Conversation และ Certificate เป็น server state ผ่าน TanStack Query; form/editor draft, modal/sidebar และสถานะ UI อยู่ local/client state ตามเจ้าของ ไม่สร้าง global store ข้อมูล backend ซ้ำ
- AuthProvider ดูแล lifecycle ของ session ไม่รวม users/courses ทั้งระบบ; query cache ต้องแยกหรือเคลียร์เมื่อเปลี่ยนบัญชี ทั้งสองแอปมี cache ของตัวเอง ไม่แชร์ React store ข้ามแอป
- Component/page ไม่เรียก `fetch` กระจาย ใช้ feature API ผ่าน client กลางที่รับผิดชอบ base URL, วิธีส่ง credentials, timeout/cancellation และ error normalization; payload จาก network ต้องตรวจตาม contract ไม่เชื่อเพียง TypeScript generic
- ตกลง API Contract ต่อ flow ก่อนทำ query hooks ของ flow นั้น: DTO, enums, request/response, error codes, credentials/permissions และสถานะที่คืนร่วมกับ backend ไม่ให้ contract เปลี่ยนตาม hook ที่เขียนล่วงหน้า ไม่ต้องรอ freeze ทุก endpoint ทั้งระบบพร้อมกัน
- Web/Admin ใช้กติกา API และ backend เดียวกันได้โดยยังไม่เลือก implementation backend การแยกสอง frontend ไม่บังคับให้แยก backend/ฐานข้อมูลหรือให้ frontend เชื่อม database โดยตรง
- Tailwind เป็นหลักสำหรับ layout/spacing/responsive; UI ที่ใช้ซ้ำมี shared component/variants อ้าง semantic theme tokens ชุดเดียวกับ CSS และ library providers ตาม [UI_SPEC.md](UI_SPEC.md) ไม่บังคับเขียนทุกอย่างใหม่เป็น Tailwind
- Instructor เข้า learner flows ของคอร์สคนอื่นได้ตาม Final 1.6; route guards มีไว้สำหรับ UX/navigation เท่านั้น Backend ต้องตรวจ identity, permission, ownership, enrollment และสถานะอีกครั้ง
- รักษา URL/หน้าตา/พฤติกรรมที่ยังอยู่ใน scope ระหว่างย้ายโครงสร้าง การตัดเพิ่มฟีเจอร์และเปลี่ยน URL เป็นชุดงานแยกที่ต้องได้รับคำสั่งลงมือก่อน; ตัวอย่าง `/blog` หรือ `/account/payments` ไม่ใช่การอนุมัติ route ใหม่หรือ Order history เต็มรูปแบบ
- ลำดับแผนใหม่คือ R0 inventory → R1 scope cleanup → R2 split apps/basic CI → R3 shared UI/router → R4a contract → R4b API/Query → migrate features; cleanup ถอดตามความสามารถ/dependency ไม่ลบตามชื่อโฟลเดอร์ analytics จน grading/learner list หาย
- แผนมี Containerization และ CI/CD เป็นงานอนาคตพร้อมเกณฑ์ตรวจแยกจาก integration ใช้ build context ที่ monorepo root; shared packages/root lockfile/config เปลี่ยนต้องตรวจ apps ที่ได้รับผล Cloud Run เป็น hosting candidate ยังไม่เลือกปลายทางหรืออนุญาต deploy ดู R11–R13 ในแผน

## 2. แผนที่ code ปัจจุบัน

| งาน | จุดเริ่มต้น |
| --- | --- |
| App entries/providers/routes | `apps/web/src`, `apps/admin/src`; ResourceBoundary + AuthSessionProvider แยก app |
| Shared shell/avatar/title/status/image upload | `packages/ui/src/components` และ exports ใน `packages/ui/src/index.ts` |
| Theme/tokens/styles | `packages/ui/src/design-tokens.json`, `design-tokens.ts`, `theme.ts`, `tokens.css`, `tailwind.css`, `styles/` |
| Public landing/About | `apps/web/src/features/landing` |
| Auth/account/profile | `apps/*/src/features/auth`, `features/account` |
| Catalog/learning/assessment/certificates | `apps/web/src/features/courses`, `features/learning` |
| Instructor dashboard/roster/attempts/grading | `apps/web/src/features/instructors` + owned HTTP resource adapters |
| Authoring pages/controlled editors | `apps/*/src/features/course-authoring`; reusable form/editor exports + pure mapping ใน `packages/course-authoring` |
| Admin management/review | `apps/admin/src/features/management`, `features/course-approval` |
| Blog read/write | `apps/web/src/features/blog`, `apps/admin/src/features/blog`; public renderer `packages/ui` |
| Payment/Redeem/AI | app-owned feature folders; server state ผ่าน API/Query |
| HTTP transport/config | `apps/*/src/shared/api`; transport utilities `packages/api-client` |
| Wire DTO / UI models | `packages/contracts`; wire names management-http/http-responses/blog แยกจาก presentation types |
| Development mock/fixtures | `tools/provisional-api`; ไม่ import เข้า app runtime หรือ shared package |
| Artwork | `packages/ui/src/assets`; root public assets ตาม UI consumer |

Root `src`, `@legacy`, `packages/store` ถอนแล้ว. ห้ามเพิ่ม bridge/persistence สำหรับ business state กลับมา. กติกา architecture ในข้อ 1.1 และ status ด้านบนเป็นปัจจุบัน; ตัวอย่าง prototype paths ที่ยังปรากฏในคำอธิบายเก่าไม่ใช่ตำแหน่ง executable source.

ตรวจ route declaration ใน `apps/web/src/app/router/instructor-routes.tsx` และ `apps/admin/src/app/router/authoring-routes.tsx`; owner ปัจจุบันคือหน้าใต้ `features/course-authoring` ของแต่ละแอป. `apps/web/src/features/instructors/pages/QuizPages.tsx` ดูแล attempt review/grading ไม่ใช่ Quiz Manager/Editor. Root legacy store/data ถอนแล้ว; editor view models ไม่ใช่ server contract

## 3. โครงสร้างและรูปแบบการเขียน

- R1 ถอน Assignment/Inbox/Cart/Orders/Finance/comparison dashboards/request/invite จาก active source ตาม Final 1.6 แล้ว ดู [ผล R1](archive/reports/R1_SCOPE_CLEANUP_REPORT_TH.md) และ R0 baseline สำหรับ historical implementation; learning-history guards และ learner roster/owner grading ยังอยู่

- คอร์ส public อยู่ `src/pages/public/` และคอร์สสำหรับผู้ล็อกอินอยู่ `src/pages/member/` ผ่าน routes `/courses[/:slug]` และ `/explore/courses[/:slug]` ตามลำดับ ห้ามนำ page เดียวมาใช้สองบริบท รายการโครงสร้างบทที่เป็น presentation ใช้ `CourseOutline` ร่วมได้
- `PublicCourseEntry` ส่งสมาชิกที่เปิด URL public ไปยัง URL สมาชิกของคอร์สเดียวกัน รายการ/รายละเอียดทั้งสองแบบแสดงเฉพาะคอร์ส published; ไม่ใช้ catalog เปิด draft แทนหน้าจัดการ/preview
- ใบรับรองหน้าบัญชีผู้เรียนกรองเจ้าของเสมอ รวมถึงเมื่อผู้ใช้เป็น Admin ไม่มี global Admin certificate browser/download-all ใน V1; Admin ดู completion/results เพื่อจัดการตาม scope ไม่เพิ่ม certificate.read_admin
- `DirectorySearch` เก็บคำค้นและตัวกรองใน URL ใช้รายการ field ที่ระบุอย่างชัดเจนในการค้น ไม่ค้นจากการ serialize user ทั้งก้อนหรือข้อมูลรหัสผ่าน การเปลี่ยนคำค้น/ตัวกรองเริ่ม pagination ใหม่ และ returnTo ของรายละเอียดจำกัดให้เป็น path รายการภายในที่ตรงกัน

- โครงสร้าง Feature ภายใน `apps/web` และ `apps/admin`: จัดเป็นสัดส่วนตามมาตรฐาน `features/<feature-name>/` ประกอบด้วย `pages/` (สำหรับ route entrypoints), `components/` (สำหรับ UI ย่อย), `styles/` (สำหรับ stylesheets ประจำ feature), และ `api/`/`hooks/` (สำหรับ query/mutations)
- **กฎของโฟลเดอร์ `pages/` และสไตล์:** โฟลเดอร์ `pages/` มีหน้าที่เป็น Route Directory เท่านั้น ต้องมีเฉพาะไฟล์หน้าจอ `.tsx` ล้วนๆ ห้ามวางไฟล์ `.css` ปนในโฟลเดอร์ `pages/` สไตล์ทั้งหมดของ feature ต้องเก็บไว้ในโฟลเดอร์ `styles/` ใต้ feature นั้นๆ (เช่น `features/course-authoring/styles/`) เพื่อให้โครงสร้างสะอาด มองเห็น route ทั้งหมดได้ชัดเจนในแวบเดียว และสะดวกต่อการตรวจสอบ/สกัดสไตล์เป็น Tailwind ในอนาคต
- Component ของ feature เดียวเก็บใน `components/` ย้ายเป็น shared component เมื่อมีการใช้ร่วมกันจริงข้าม feature/app
- ไม่รวมทั้งระบบเป็น JSX file เดียวหรือยัด HTML string ที่สร้างหน้าจอเอง ไม่ตั้ง abstractions ขนาดใหญ่เพื่อแก้จุดเล็ก
- ใช้ functional React components, named exports ตามรอบข้าง แยก JSX ที่เพิ่มใหม่ให้อ่านง่าย ไม่ต่อ component ยาวทั้งหน้าบรรทัดเดียว
- ตั้งชื่อให้บอกหน้าที่ ใช้ stable ID จาก helper เดิม ไม่ใช้ index เป็น key ของรายการที่เพิ่ม/ลบ/เรียงลำดับ
- รักษาลำดับ hooks; condition สำหรับ not-found ให้ไม่ทำให้ hooks เปลี่ยนจำนวนเมื่อ state/params เปลี่ยน แยก wrapper กับ editor ถ้าเหมาะสม
- Effect ที่เพิ่ม listener/object URL ต้อง cleanup; effect ไม่ทำให้ draft ของผู้ใช้หายเมื่อ rerender
- ใช้ Link/navigate สำหรับ route ภายใน และ semantic button/link ตามหน้าที่จริง ไม่ซ้อนปุ่มกับ anchor ที่เป็น interactive ทั้งคู่
- ไม่ย้ายทั้งโปรเจกต์เป็น TypeScript เปลี่ยน router หรือจัดรูปแบบไฟล์ทั้งหมดในงาน UI ย่อย

## 4. ใช้ library ที่มีอยู่ก่อน

- Mantine ดูแล `WorkspaceShell` / navigation; Ant Design ดูแล form/table/modal/CRUD; auth ใช้ shadcn/Base UI ที่ติดตั้งแล้ว ไม่เปลี่ยนทุกพื้นที่ไป library เดียวระหว่างแก้งานย่อย
- Sidebar desktop ของ `WorkspaceShell` เปลี่ยนความกว้าง 258/72px ผ่าน AppShell navbar offsets โดยไม่ซ่อน navbar ทั้งหมด ปุ่มพับอยู่ในแถว “เมนูหลัก” ของ navbar ใช้ `useMediaQuery` แยกโหมดไอคอนจากเมนูเต็มของมือถือ มีชื่อ accessible/tooltip และ logo action ขยายผ่าน click/keyboard; ไม่เปลี่ยน permission หรือรายชื่อเมนูตามการพับ
- Reuse `ImageUploadField`, rich editor, video/assessment editor, shared titles และ existing controls ก่อนสร้างใหม่
- shadcn configuration อยู่ที่ `components.json` (`base-nova`, TSX, Base UI) และยังมี scaffolding alias `@/components/ui`; implementation ที่ Auth ใช้อยู่ย้ายไป `packages/ui/src/primitives/` และ export ผ่าน `@melearn/ui` แล้ว อย่า generate component ใหม่จนกว่าจะ align alias นี้โดยตั้งใจ เพื่อไม่สร้าง implementation ซ้ำใน legacy path
- ผู้ใช้ยืนยันให้ใช้ Tailwind มากขึ้นสำหรับ layout/spacing/responsive และ styling ของ shared UI ตาม tokens กลาง ไม่สร้าง design system อีกชุดจาก utility class และไม่ hard-code สี/ขนาด control ซ้ำทั่ว page; ในช่วงย้ายให้รักษา Ant Design/Mantine/Base UI ที่ยังใช้และเชื่อม theme ผ่าน adapter
- สำหรับ animation ใช้ `motion/react` ที่มีอยู่ ไม่ติดตั้ง Framer Motion เพิ่มซ้ำเพื่อ feature เดียวกัน
- ถ้าจำเป็นต้องเพิ่ม component/library ให้ตรวจของที่มี ก่อนใช้ source/CLI จากผู้พัฒนาอย่างเป็นทางการ ตรวจ compatibility/license และบันทึกเหตุผลกับไฟล์ lock ที่เปลี่ยน ห้าม copy paid block หรือ dependency โดยไม่ตรวจที่มา
- เลือก icon family เดิมในบริบทนั้น ไม่เพิ่ม package เพื่อไอคอนหนึ่งตัวที่ชุดปัจจุบันมีแล้ว

## 5. Theme และ CSS

- `packages/ui/src/design-tokens.json` เป็น source ของ palette, semantic CSS variables, light/dark foundation, Mantine/Ant adapter และ Landing profile; `design-tokens.ts` แก้ token references ก่อนใช้, ส่วน `tokens.css`/`tailwind.css` เป็น generated files ห้ามแก้เอง ให้ใช้ `npm.cmd run tokens:generate` และตรวจ `npm.cmd run tokens:check` แทน
- `apps/web/src/app.css` และ `apps/admin/src/app.css` import shared Tailwind stylesheet และวาง `@source` ของ app, `packages/ui/src` และ legacy `src` ใน compiler chain เดียวกัน; shared Tailwind stylesheet ไม่ import Preflight เพื่อไม่ reset prototype CSS ค่า semantic utilities เช่น `bg-primary`, `bg-surface`, `text-ink`, `border-line` ต้องอ้าง variables เดียวกับ library adapters
- Ant/Mantine provider อยู่ใน `packages/ui`; Landing มี ConfigProvider ซ้อนเพื่อคง profile ของ route และ palette แบรนด์อยู่ใน token source แต่ apply ผ่าน selector/theme เฉพาะ Landing อย่าย้าย scope ไปหน้าอื่นโดยไม่สั่ง
- `npm.cmd run build`, `build:web` และ `build:admin` ตรวจ generated token files ก่อน build; เมื่อเปลี่ยน token ให้ตรวจ cascade/import order และหน้า shared ที่ใช้ provider ด้วย
- ใช้ token/CSS variable ปัจจุบันก่อนเพิ่ม literal ใหม่ CSS เฉพาะ page อยู่ข้าง page และมี class namespace เช่น `home-`, `blog-`, `chapter-`
- ไม่ override global `.ant-btn`, `input`, `h2` เพื่อแก้หน้าเดียว ไม่เพิ่ม `!important` ต่อท้ายไฟล์เรื่อย ๆ ถ้าปัญหาเกิดจาก specificity/import order ให้แก้ rule ที่เป็นต้นเหตุ
- อ่าน `styles.css` และ `system-theme.css` เมื่อ component ที่แก้ใช้ style กลาง หลาย selector เก่ามี override ภายหลัง ห้ามใช้ selector แรกที่เจอเป็นข้อสรุป
- ใช้ grid/flex, minmax, wrap, gutter และ aspect-ratio สำหรับ layout ไม่ใช้ absolute positioning เพื่อแก้ toolbar ชนกัน Absolute ใช้ได้กับ background/overlay ตามหน้าที่
- ค่าเริ่มต้น light; dark tokens มีอยู่แล้ว ยังไม่เปิด toggle ไม่อ้างว่าภาพ/editor/public ทั้งระบบรองรับ dark ครบ
- งานที่เปลี่ยน token กลางต้องเช็กหน้าที่ใช้ร่วมกันอย่างพอประมาณ โดยไม่ขยายเป็น redesign ทุกหน้า
- เป้าหมายหลัง refactor คือ design tokens ชุดเดียวใน `packages/ui` สำหรับ Web/Admin โดย Tailwind theme, CSS variables และ library providers อ้างต้นทางเดียวกัน; R3b สร้าง code gate นี้แล้ว แต่ visual/computed-style, contrast, keyboard และ responsive QA ยังต้องทำ ส่วน CSS เฉพาะ editor/animation ใช้ได้เมื่อมี owner ชัดและอ้าง tokens

## 6. State และการบันทึก

- ทุก slice ที่ยังใช้งานใช้ feature query/mutation และ API adapter. ห้ามกลับไปใช้ `useLms` หรือเพิ่ม business localStorage; UI draft ต้องไม่มีสิทธิ์ยืนยัน ownership/progress/score/payment
- ใช้ local component state สำหรับ draft, selected item, modal, filter และ view mode เท่าที่เหมาะสม การป้อนแต่ละตัวอักษรไม่ควรเปลี่ยนข้อมูลหลักก่อนผู้ใช้บันทึกเมื่อ pattern ของหน้าคือ draft
- หน้าตรวจงานเก็บเฉพาะ draft คะแนน/feedback ใน `sessionStorage` ตาม user/attempt เพื่อกลับมาต่อในแท็บเดิมได้; ใช้ `gradeAttempt` เดิมเมื่อบันทึกและล้าง draft จากแท็บเมื่อเสร็จ ไม่ใช้ draft เปลี่ยนผลคะแนนหรือ Analytics ล่วงหน้า
- คิวตรวจเก็บ course/courseId, mode และคำค้น `q` ใน URL; ส่ง `returnTo` ให้หน้าตรวจ และใช้บริบทเดียวกันสำหรับงานก่อนหน้า/ถัดไป โดยคง role scoping และลำดับ FIFO
- Notification/Inbox ของ prototype ถูกถอนจาก V1; ห้ามคืน state/action เดิมจาก store. หากเปิด scope ใหม่ต้องกำหนด API และ permission ก่อน
- Inbox ยังไม่ทำในรอบแรก เอกสาร [Inbox เดิม](archive/pre-final-20261006/INBOX_PERMISSION_SPEC.md) อยู่ใน archive ไม่ใช้เป็นกติกาใหม่
- รักษา `courseId`, `chapterId`, `itemId`, `quizId` และการเชื่อมกัน ตรวจว่าการเพิ่ม/ลบเนื้อหาไม่ทิ้ง reference ที่ใช้ไม่ได้
- การบันทึกบทและแบบฝึกหัดร่วมกันใช้ action เดิม เช่น `saveChapterWorkspace` ตรวจสิทธิ์/validation/result จาก action ไม่เขียน path แยกที่บันทึกเพียงครึ่งหนึ่ง
- ให้ `saved`/success feedback หลัง action สำเร็จ ไม่ใช้ timeout สุ่มเพื่อแกล้งบันทึกสำเร็จ หาก browser storage เต็ม ต้องแจ้งผู้ใช้ ไม่กล่าวว่าข้อมูลถูกเก็บแล้ว
- ไม่ reset seed/role/user session/localStorage เพื่อให้ preview สวยโดยไม่ได้รับคำขอ รักษาข้อมูลเดโมที่ผู้ใช้แก้และรองรับข้อมูลเก่าเท่าที่การเปลี่ยนแปลงต้องใช้
- Draft ออกหน้าต้องมี dirty-state behavior ตาม UX spec; preview ใช้ draft เดียวกับ editor ไม่แสดงข้อมูลที่บันทึกเก่าโดยไม่บอก

## 7. Permission และ route

- [Feature Release Matrix](FEATURE_RELEASE_MATRIX.md) และ `src/config/features.ts` แยกความพร้อมของ UI, กติกาธุรกิจ, Backend และการเปิด route ทุก feature ยังเป็น prototype; phase metadata ไม่มีผลเปิด route
- `FeatureRoute` ใน `src/components/FeatureRoute.tsx` ครอบทุก feature route ก่อนตรวจ role/ownership; `/403` และ `*` เป็น system fallback เพิ่มหรือเปลี่ยน route แล้วอัปเดต `FEATURES`, `ROUTE_FEATURES`, matrix และ tests ให้ตรงกัน
- Development/Preview เปิด `prototype`, `integration`, `released`; Staging เปิด `integration`, `released`; Production เปิด `released` เท่านั้น; `disabled` ปิดทุกที่ Default build ใช้ Production; สร้าง preview ด้วย `npm.cmd run build -- --mode preview` แล้ว `npm.cmd run preview`; `VITE_APP_ENV` ที่ไม่รู้จักปิด feature แบบ Production
- Route gate ไม่ใช่การตรวจสิทธิ์ฝั่ง API และไม่เอา source ออกจาก bundle; ต้องบังคับ role, ownership และสิทธิ์ข้อมูลใน Backend ก่อน release

- ศึกษา `RolePage`/`AdminPage` ที่ `apps/*/src/app/router/access.tsx` และ checks ใน prototype actions ปัจจุบัน อย่าเชื่อว่าซ่อนปุ่มแล้วผู้ใช้เข้าหน้านั้นไม่ได้; UI guard ใช้จัด navigation เท่านั้น
- ผู้สอนจัดการเฉพาะคอร์สตนเอง; admin จัดการคอร์สผู้อื่นได้ ปัจจุบัน prototype ใช้ `/teach/...` workspace ร่วมกัน แต่เป้าหมาย refactor ให้ Admin มี routes/pages ในแอป Admin ไม่พึ่งหน้า Web; การ extract authoring package ตัดสินจากหลักฐานตามข้อ 1.1
- Public blog อ่านได้โดยไม่ login แต่ create/edit/delete blog เป็น admin ในรุ่นนี้; blog กับบทอ่านในคอร์สเป็นข้อมูลคนละชนิด
- Routes ต้องรองรับเปิดตรง refresh, not-found, no-access และ back path ที่ถูก context อย่าผูกสิทธิ์กับการที่เข้ามาผ่านปุ่มเพียงทางเดียว
- คำขอแก้ UI ไม่อนุญาตขยายสิทธิ์ role เดิมหรือเปลี่ยน business rule เอง ถ้ามี requirement ใหม่ให้ระบุความต่างอย่างชัดเจน
- Prototype client checks ไม่ใช่ Production security; Google OAuth, email verification, server permissions และฐานข้อมูลยังต้องมี implementation จริง; Stripe Checkout อยู่ในขอบเขตรอบแรก ส่วน MCP ยังไม่ทำ

## 8. Rich content และ upload

- ใช้ Tiptap document/rendering ที่มีอยู่ สำหรับบทอ่าน/บทความใหม่ ไม่เก็บ rich text ทั้งหมดเป็น plain textarea ถ้ามี structured document ต้องรักษา formatting และภาพตอน preview/อ่าน
- ใช้ renderer เดียวกับ editor model เมื่อทำได้ ไม่ใช้ `dangerouslySetInnerHTML` กับข้อความหรือ HTML ที่ไม่ผ่านการจัดการที่เหมาะสม
- ใช้ helper `readImageFile`/upload UI เดิมเมื่อเกี่ยวข้อง ตรวจชนิด/ขนาดไฟล์ แสดงภาพ preview และจัดการ object URLs ไม่เพิ่มไฟล์จริงลง temp แล้วใช้ path เครื่องผู้พัฒนาเป็น URL
- ภาพที่แสดงบนเว็บต้องเป็น asset import, public URL หรือข้อมูล upload ที่ prototype รองรับ ไม่อ้างอิง `C:\Users\...` ใน code
- Base64 ใน browser storage มีข้อจำกัดด้านขนาด อย่าทำให้เดโมเก็บวิดีโอขนาดใหญ่โดยไม่จำกัดหรืออ้างว่าเป็น production media storage
- แบบฝึกหัดข้อเขียน/ภาพต้องรักษาสถานะรอตรวจ คะแนน และ feedback ไม่ทำให้ AI หรือ client ให้คะแนนผ่านอัตโนมัติเอง

## 9. Workflow การแก้และตรวจ

1. ระบุ route และอ่าน page/component/CSS/theme/action ที่เกี่ยวข้อง ตรวจ `git status` และ diff เพื่อรู้การแก้ค้าง
2. ตรวจ pattern ที่ดีอยู่แล้วใน source และ UI spec เลือก component ที่ติดตั้งก่อนเขียนใหม่
3. แก้ขอบเขตที่ขอพร้อม state/validation/error ที่เกี่ยวข้อง รักษาข้อมูลและ route เดิม
4. ถ้า source เปลี่ยน รัน `npm.cmd run typecheck` และ `npm.cmd run build` จาก root ของ repository ถ้ามี failure จาก code ของเราให้แก้ก่อนส่งงาน
5. ตรวจหน้าที่เปลี่ยนและ critical flow ที่สัมพันธ์กับความเสี่ยง เช่น เพิ่มหลายรายการ บันทึก/เปิดใหม่ ออกจาก draft หรือ role access ถ้าปรับจุดนั้น ไม่สร้าง tests ที่เพียงซ้ำ implementation
6. งานเอกสารอย่างเดียวตรวจชื่อ/path/link/rule frontmatter และความสอดคล้อง ไม่ต้อง build แอปซ้ำ
7. เปิด preview เมื่อผู้ใช้ขอ และบอกตามจริงว่าแสดงแล้ว queued หรือเปิดไม่ได้ อย่าใช้ผล build เป็นหลักฐานว่าหน้าตาสวยหรือผ่านมือถือแล้ว
8. สรุปสิ่งที่แก้และผลตรวจ แยก warning, สิ่งที่ยังไม่ได้ตรวจ และงานค้างที่เกี่ยวข้อง

คำสั่งปัจจุบันบน Windows:

```powershell
# จาก root ของ elearning-ux-v2
npm.cmd run dev -- --port 5174
npm.cmd run build
git diff --check
```

Preview ปกติ: `http://127.0.0.1:5174/` ตรวจ server ที่รันอยู่ก่อนเปิดใหม่ ไม่ install dependencies ซ้ำทุกครั้ง ถ้าพอร์ตมีงานอื่นใช้อยู่ให้รายงาน URL ที่ใช้จริง

## 10. Git และเอกสาร

- รักษาไฟล์ที่แก้ค้างก่อนหน้า อย่าใช้ `git reset --hard`, checkout ทับ หรือ blanket `git add .` เพื่อทำให้ status สะอาด
- Commit และ push อัตโนมัติหลังชุดงานที่ผู้ใช้สั่งผ่านการตรวจ ตาม [GIT_CHECKPOINT_POLICY_TH.md](GIT_CHECKPOINT_POLICY_TH.md) เลือกไฟล์ชัดเจน ตรวจ staged diff และรายงาน SHA/branch/ผล push กับงานค้างที่ไม่ได้รวม การ push ไม่เท่ากับ deploy
- ไม่ commit secrets, `.env`, `node_modules`, `dist`, ข้อมูลผู้เรียนจริง หรือ artifact ที่ใช้ได้เฉพาะเครื่องนี้
- อัปเดต docs เมื่อเปลี่ยน route/pattern/guideline ที่เอกสารกล่าวถึง โดยรักษาข้อเท็จจริง implementation แยกจากสิ่งที่ผู้ใช้อนุมัติ
- AGENTS/GEMINI/Cursor rules เป็นทางเข้ากติกาชุดเดียว รายละเอียด UX/code อยู่ใน UI/CODE spec ไม่เพิ่ม README อีกหลายชุดที่สั่งคนละอย่าง

## กติกาที่ใช้ต่อระบบจริง

- อ่าน [ฉบับหลัก](MELEARN_V1_SCOPE.md) ก่อนเปลี่ยน Domain/permission/API; โครงสร้าง browser-local store ไม่ใช่ database contract
- Redeem ในระบบจริงผูกหนึ่งโค้ดกับหนึ่งคอร์ส ใช้ครั้งเดียว ไม่มีวันหมดอายุ เก็บผู้ใช้และเวลาที่ใช้ Admin ยกเลิกได้เฉพาะโค้ดที่ยังไม่ใช้ ไม่ต้องสร้าง Order หรือ snapshot ส่วนแบ่งเพื่อแลกโค้ด
- ใช้ YouTube Link ก่อน Upload Video API ต้องตอบไม่พร้อมและไม่สร้าง upload record ส่วน Mux Data key ที่มีเป็นข้อมูลต้นแบบ ไม่ใช่การเลือกผู้ให้บริการวิดีโอ
- AI ตอบ mock และเก็บประวัติใน memory ของ HTTP mock server ส่วนระบบจริงต้องเก็บคำถาม/คำตอบใน Database บังคับสิทธิ์คอร์ส และนับโควตาที่ server ตามฉบับหลัก ค่า limit อยู่จุดกลางแก้ได้ ไม่ใช้ quota ที่ client เป็นหลักฐาน
- คอร์สใช้ draft → pending_review → approved → published; แก้ approved ก่อน publish ต้องตรวจใหม่ published แก้เนื้อหาได้ทันที การแก้เฉพาะ AI/Transcript ไม่เปลี่ยนสถานะอนุมัติ
- R1 ถอน Cart/ส่วนลด/Orders/Finance/Inbox/คำขอ Instructor และ analytics แบบใหญ่แล้ว; ชุดย้าย API 9 ต.ค. ถอน `packages/store` ทั้งหมด จึงไม่มี inert legacy snapshot ใน runtime

## ขอบเขต Stripe และ AIPractice ที่เพิ่ม

- Registry ใช้ `payments` สำหรับ Stripe และ `redeem` สำหรับโค้ดให้สิทธิ์; ไม่มี legacy commerce/analytics/finance/inbox/onboarding keys หลัง R1 ทุกสถานะยัง prototype การมี HTTP client/route checkout ไม่ใช่หลักฐานเชื่อม Stripe/backend จริง
- ระบบจริงใช้ Stripe Session/PaymentEvent ตรวจราคา บัญชี ลายเซ็น Webhook และผลจ่าย ณ server ก่อนสร้างหรือคืน Enrollment เดิม; การให้สิทธิ์ต้องเกิดจาก Webhook ที่ตรวจแล้วเท่านั้น GET สถานะและหน้าผลจ่ายต้องไม่ให้สิทธิ์ ไม่เพิ่ม Order/Cart Domain จากชื่อพารามิเตอร์เก่าใน prototype
- AIPractice แยกจาก Quiz/QuizAttempt จัดเก็บชุดคำถามและผลในแชต ตรวจ response schema ก่อนคิด Prompt สำเร็จ การตอบและอ่านผลไม่เรียก model หรือนับ Prompt เพิ่ม
