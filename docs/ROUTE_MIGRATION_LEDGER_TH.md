# Route Migration Ledger — Melearn Final 1.6

วันที่ 7 ตุลาคม 2026 · ใช้กับ branch `refactor/v1-api-ready`

เอกสารนี้กำหนดวิธีรักษา URL ระหว่างแยก runtime `apps/web` (Guest/Learner/Instructor) กับ `apps/admin` (Admin) และบันทึกการเริ่มใช้ route migration ใน R2b ไม่ใช่ domain/backend contract; หลักฐานเก่าผูกกับ commit R1 `2917a1b0d2a92b8600b4781a00ea23be34ff00db`, สถานะปัจจุบันอยู่ในหัวข้อ R2b ด้านล่าง

## กติกา migration

- Web canonical URL ของ Guest/Learner/Instructor คงเดิม; route Admin อยู่บน Admin app และใช้ `/admin/...` สำหรับหน้า Admin-owned ที่ยังต้องเปิดจาก URL เก่าซึ่งใช้ `/teach/...`
- มี migration shim เฉพาะเส้นทาง Admin เก่าที่ทราบแน่: ตรวจ session ฝั่ง host แล้ว map allowlist path/role/params/query/hash ไป Admin target เท่านั้น; ห้ามรับ `next`/`returnTo` ไป external origin และห้ามให้ shim ตัดสิน permission แทน backend
- คง params ที่ระบุไว้ตามหน้าที่เดิม, preserve query/hash ที่ flow ใช้อยู่, id/slug ไม่เปลี่ยน; mapping ที่ต้องปรับ query ให้ลง field เดิมต้องมี unit/route test ระบุ old → new ก่อนเปิด redirect
- Admin การจัดการคอร์สไม่เปิด `/teach` ใน Web app หลัง cutover; Instructor URL `/teach/...` ยังอยู่ Web และไม่ถูกย้าย
- เส้นทางที่ R1 ถอดไม่มี alias ไปความสามารถที่เหลือ; ผลเป็น not found/retired ไม่มีข้อมูลเก่ารั่ว

## Route ownership ledger

| Route ปัจจุบัน / role | Owner หลังแยก | Canonical target | ค่า URL ที่ต้องคง | compatibility/หลักฐานก่อน cutover |
| --- | --- | --- | --- | --- |
| `/`, `/about`, `/courses`, `/courses/:slug`, `/articles`, `/articles/:id` · Guest | Web | เดิม | `slug`, `id`, query/hash | guest deep link + refresh; member `/courses*` ยังเข้าจุดเดิม `/explore/courses*` ตาม redirect เดิม |
| `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` · ทุก role/auth | Web | เดิม | `next`, verification/reset token เมื่อ flow รับค่า | allowlist internal `next`, ไม่เปลี่ยน auth/session transport ใน split โดยไม่มี contract |
| `/learn`, `/learn/courses`, `/learn/redeem`, `/learn/ai`, `/learn/courses/:courseId`, `/learn/courses/:courseId/{videos|articles}/:itemId`, `/learn/courses/:courseId/quizzes/:itemId`, `/learn/quizzes/:quizId`, `/learn/attempts/:attemptId[/result]` · Learner/Instructor | Web | เดิม | `courseId`, `itemId`, `quizId`, `attemptId`, `courseId` AI context, query/hash | require correct role/enrollment; direct lesson, refresh, quiz redirect/result, AI return path ผ่าน browser/API checks |
| `/checkout/:courseId`, `/checkout/:orderId/result` · Learner/Instructor | Web | URL shape เดิมระหว่าง migration | `courseId`, legacy `orderId`, `channel=redeem` | result adapter legacy ใช้ existing enrollment; tests ครอบ redeemed vs Stripe result และ query preservation ก่อนแยก host |
| `/account/certificates[/:certificateId]`, `/account/profile` · ทุก role | Web | เดิม | `certificateId`, self ownership | account user เห็นเฉพาะของตน; Admin read ไม่กลายเป็น global browse |
| `/teach*` Instructor dashboard/review/courses/quizzes/grade/learners/preview · Instructor | Web | เดิม `/teach/...` | `courseId`, `chapterId`, `itemId`, `quizId`, `attemptId`; queue `course`/`courseId`, `mode`, `q`, `returnTo`; chapter `item`, `add`, `view`; query/hash | preserve Instructor deep link/owner-scoped grading + preview, query/hash และ role guard |
| `/admin`, `/admin/articles*`, `/admin/users*`, `/admin/instructors`, `/admin/courses*`, `/admin/courses/reviews`, `/admin/access-codes` · Admin | Admin | เดิม `/admin/...` | article/user/course ids, list filters/page, back target | independent build refresh/404/login guard; Admin operations/API permissions checked server-side |
| Admin เข้า Course Editor ผ่าน `/teach/courses/new` และ `/teach/courses/:courseId/settings` จาก `/admin/courses` · Admin | Admin | R2b: `/admin/courses/new`, `/admin/courses/:courseId/settings` | `courseId`; form query/hash only when observed and used | canonical targets และ allowlisted `/teach` compatibility shim อยู่ Admin app; Instructor URL เดิมอยู่ Web |
| Admin เข้า Curriculum/Chapter/Content/Quiz ผ่าน `/teach/courses/:courseId/curriculum`, `/teach/courses/:courseId/chapters/:chapterId`, `/teach/courses/:courseId/{videos|articles}/:itemId`, `/teach/courses/:courseId/quizzes`, `/teach/quizzes[/:quizId]` · Admin | Admin | R2b: `/admin/courses/:courseId/{curriculum,chapters/:chapterId,videos/:itemId,articles/:itemId,quizzes}` และ `/admin/quizzes[/:quizId]` | `courseId`, `chapterId`, `itemId`, `quizId`; chapter `item`, `add`, `view`, query/hash | redirect allowlist รักษา path ids/query/hash; Transcript unsaved guard ยังอยู่ prototype host; extraction ของ editor ยังไม่ผ่าน |
| Admin Preview/learner results ที่เข้าจาก `/teach/courses/:courseId/{preview,learners}` หรือ `/teach/learners` · Admin | Admin | R2b: `/admin/courses/:courseId/{preview,learners}` และ `/admin/learners` | `courseId`, search/page/course filters/back state | routes อยู่ Admin build; read-only preview behavior ต้องยืนยันใน visual/browser acceptance; ไม่เพิ่ม grading/progress mutation |
| `/teach/reviews`, `/teach/attempts/:attemptId/grade`, `/teach/quizzes/:quizId/attempts` · Admin | ไม่มี target Admin หลัง R1 | ไม่เปิดใน Admin | `attemptId`, `quizId` ไม่สร้าง alias | Admin grading denied; only Instructor-owned grading is on Web |
| Admin own AI/account · Admin | Admin | เสนอ `/admin/ai`, `/admin/account/profile` | conversation id, `courseId`, `attemptId`, `questionId`, tab/hash as current UX consumes | Admin own AI only; no access to other users' chats; separate Admin transcript/AI settings from learner learning draft |
| Removed R1 capabilities | ไม่มี | ไม่มี | ไม่มีการรับ legacy filters/payloads | no route/menu/link/alias; return not found without exposing restricted legacy data |

## R2a — หลักฐาน Course Authoring boundary

แยกเฉพาะ Course metadata form ที่ใช้ร่วมในหน้า create/edit โดยย้าย JSX เดิมเข้า `src/features/course-authoring/CourseMetadataEditor.tsx`; host ยังเป็นเจ้าของ `useLms`, role, course lookup, form instance/draft, save result/toast, review/publish, Admin AI mutation และ React Router navigation ส่วน editor รับ narrow props, `FormInstance`, callback, injected upload/status UI และ preview node ไม่อ่าน store/data/seed/types/router โดยตรง การทดสอบ architecture gate 2 รายการยืนยัน dependency boundary และ host ownership

นี่คือ seam ที่ใช้งานได้และรักษา UI metadata editor ปัจจุบัน ยังไม่ใช่ package สาธารณะหรือ proof ว่า Chapter/Curriculum/Quiz editors แยก dependency แล้ว: `ChapterWorkspace` ยังคุม local draft/Transcript/localStorage/router และ `CurriculumWorkspace`/Quiz editors ยังใช้ store โดยตรง แม้ R2b เปิด Admin routes แล้ว ต้องแยก host/state boundary ต่อใน R6; ห้ามถือว่าคัดลอก host page ได้รับการพิสูจน์ reuse ทั้ง authoring suite

## R2a decisions and open gates

- Existing evidence: Admin course table uses `/teach/courses/...` links and the `instructor` route gate admits Admin to the same `CourseEditorPage`, `CurriculumPage`, and `ChapterEditorPage`; Instructor is the only user whose public `/teach` URLs need remain canonical. See `src/pages/admin/AdminPages.tsx`, `src/App.tsx`, `src/pages/instructor/CoursePages.tsx`, `CurriculumWorkspace.tsx`, and `ChapterWorkspace.tsx`.
- npm is the package/lockfile/script owner (`package-lock.json`, root `package.json`); R2b implements npm workspaces without adding Nx/Turborepo until task graph evidence requires it.
- Course metadata editor is the smallest useful interface gate: host keeps role/record loading, draft controller, persistence/results, navigation and Admin AI settings; editor core receives form instance/values/instructor options and action callbacks. Core must not import store/data/router/seed, `ImageUploadField`, or host layouts. Transcript remains Admin host-owned with its own dirty/save guard; curriculum/chapter/quiz extraction is still unproven and stays R6 unless R2b gives a concrete dependency reason.
- `course-authoring` remains a candidate. R2a seam pass alone does not authorize publishing a package; package extraction requires a second consumer (`apps/admin`) plus type-dependency/public-export tests after workspace setup.
- Workspace tool: npm workspaces because the repo already uses npm and has one lockfile; R2b verifies separate Web/Admin builds without a build-graph dependency.

## R2b — Split routes and compatibility status

- `apps/web/src/App.tsx` owns Guest/Learner/Instructor routes. It retains the existing public URLs and Instructor `/teach/...` URLs; Admin pages/routes are not imported into the Web app.
- `apps/admin/src/App.tsx` owns Admin routes and Admin authoring/preview targets under `/admin/...`. Buttons in Admin course and review pages now use those canonical targets. A tested `/teach/*` allowlist maps old Admin authoring links to the matching `/admin/...` route while preserving query/hash and encoding path ids; Instructor grading/review paths and malformed ids return not-found instead of an alias.
- Admin route data uses the existing prototype store independently in its origin. Web and Admin localStorage are separate; cross-origin state consistency is not provided or claimed. Permission enforcement remains a backend responsibility.
- `@legacy/*` is the temporary import alias from both app workspaces to existing `src/` implementation. No workspace may import the other app's source. Pages/store/types/CSS still migrate by feature in later phases; this bridge is not an API package and must shrink as slices move.
- R2b creates `@melearn/ui` exports for the `PageTitle` and `StatusTag` controls used by Admin and Instructor screens. `@melearn/contracts` and `@melearn/api-client` have explicit public entrypoints but export no API model/client until R4a/R4b. `course-authoring` remains an extraction candidate.
- CI (`.github/workflows/frontend-ci.yml`) runs typecheck, native tests, boundary checks and separate Web/Admin builds. It validates code only and does not publish/deploy.
- Validation evidence: native tests cover route migration (allowlist, context preservation and denied legacy actions), root route/package boundary checker runs on both source trees, and HTTP smoke requests reach each dev server entrypoint plus an Admin deep link. Visual browser review was not completed because the Codex in-app browser blocked loopback URLs; do not describe the smoke as rendered UI acceptance.

## R3c — Route-module extraction

- Web declarations now compose from `apps/web/src/app/router/{public,auth,learner,instructor,system}-routes.tsx`; `access.tsx` owns the existing Public/role/email/ownership wrappers. Admin declarations compose from `apps/admin/src/app/router/{entry,management,authoring,system}-routes.tsx`, with its existing Admin guard in `access.tsx`. Each `App.tsx` is a thin composition entry; global providers and app ownership stay in their existing app entrypoints.
- `tests/fixtures/r3c-routes.json` is the fixed R3b checkpoint (`afa2d6f25e6aa5555499ea9f506bc1701abe2e50`), not a generated expectation from current source. `tests/workspace-route-ownership.test.mjs` follows the actually composed imports and compares Web 50/Admin 35 declarations by URL, feature key, JSX element string, and order. `tests/router-access-behavior.test.mjs` exercises login return path, role denial, Instructor learner access, verification gate, ownership contexts, Admin guard, and standalone AI wrapper.
- The extraction does not relocate page/store/theme implementation out of `@legacy/*`, create dedicated `layouts/` yet, alter business rules, feature registry, URL ownership, compatibility allowlist, or API contracts. Dedicated layout and feature ownership remain migration work; route guards are UX boundaries, not server authorization.
- Lead verification: `npm.cmd run typecheck` passed Web/Admin/legacy; `npm.cmd test` passed 67/67; `npm.cmd run check:boundaries` passed; `npm.cmd run build` passed Web/Admin; `git diff --check` passed. Production and preview builds emit existing third-party `use client` directive and >500 kB chunk warnings.
- Built `--mode preview` browser smoke verified Web Landing, Catalog, Course detail, Blog index/article, instructor profile, About, Login/Register, unauthenticated `/learn` and `/teach/courses` redirects, and Admin `/admin` login redirect preserving `next`. Public Course detail → browser Back returned to Catalog. A later read-only demo-session spot-check of representative authenticated Learner, Instructor and Admin pages is recorded in [UI audit](FRONTEND_V1_6_UI_AUDIT_TH.md); neither pass is full route-by-route visual, responsive/accessibility, or API/business-rule acceptance.

## Rollback and verification ledger

Before retiring the R2b compatibility shim, verify Admin route roles, ids/query/hash, unauthenticated destination and bookmarks in browser tests against a shared test API or agreed fixture strategy. Keep the adapter until old deep links and canonical routes are both covered. Rollback is a code revert preserving old route owners; do not rewrite browser localStorage or server records.
