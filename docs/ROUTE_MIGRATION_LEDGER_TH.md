# Route Migration Ledger — Melearn Final 1.6

วันที่ 7 ตุลาคม 2026 · ใช้กับ branch `refactor/v1-api-ready`

เอกสารนี้กำหนดวิธีรักษา URL ระหว่างแยก runtime `apps/web` (Guest/Learner/Instructor) กับ `apps/admin` (Admin) ยังไม่เปลี่ยน URL ใน phase R2a และไม่ใช่ domain/backend contract เส้นทางปัจจุบันอ้างอิง `App.tsx` ณ commit R1 `2917a1b0d2a92b8600b4781a00ea23be34ff00db`; route ใหม่เป็นเป้าหมายเพื่อ R2b/R3 เท่านั้น

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
| Admin เข้า Course Editor ผ่าน `/teach/courses/new` และ `/teach/courses/:courseId/settings` จาก `/admin/courses` · Admin | Admin | เสนอ `/admin/courses/new`, `/admin/courses/:courseId/settings` | `courseId`; form query/hash only when observed and used | old `/teach` Admin entry shim → `/admin` target; คนที่ role Instructor อยู่ Web และ URL เดิมไม่เปลี่ยน |
| Admin เข้า Curriculum/Chapter/Content/Quiz ผ่าน `/teach/courses/:courseId/curriculum`, `/teach/courses/:courseId/chapters/:chapterId`, `/teach/courses/:courseId/{videos|articles}/:itemId`, `/teach/courses/:courseId/quizzes`, `/teach/quizzes[/:quizId]` · Admin | Admin | เสนอ `/admin/courses/:courseId/{curriculum,chapters/:chapterId,videos/:itemId,articles/:itemId,quizzes}` และ `/admin/quizzes[/:quizId]` | `courseId`, `chapterId`, `itemId`, `quizId`; chapter `item`, `add`, `view`, query/hash | retain item-add/editor selection and back path, Transcript unsaved guard belongs to Admin host; shim tests both course & chapter deep links |
| Admin Preview/learner results ที่เข้าจาก `/teach/courses/:courseId/{preview,learners}` หรือ `/teach/learners` · Admin | Admin | เสนอ `/admin/courses/:courseId/{preview,learners}` และ `/admin/learners` | `courseId`, search/page/course filters/back state | keep read-only preview/results behavior; never show learner grading action or mutate progress |
| `/teach/reviews`, `/teach/attempts/:attemptId/grade`, `/teach/quizzes/:quizId/attempts` · Admin | ไม่มี target Admin หลัง R1 | ไม่เปิดใน Admin | `attemptId`, `quizId` ไม่สร้าง alias | Admin grading denied; only Instructor-owned grading is on Web |
| Admin own AI/account · Admin | Admin | เสนอ `/admin/ai`, `/admin/account/profile` | conversation id, `courseId`, `attemptId`, `questionId`, tab/hash as current UX consumes | Admin own AI only; no access to other users' chats; separate Admin transcript/AI settings from learner learning draft |
| Removed R1 capabilities | ไม่มี | ไม่มี | ไม่มีการรับ legacy filters/payloads | no route/menu/link/alias; return not found without exposing restricted legacy data |

## R2a — หลักฐาน Course Authoring boundary

แยกเฉพาะ Course metadata form ที่ใช้ร่วมในหน้า create/edit โดยย้าย JSX เดิมเข้า `src/features/course-authoring/CourseMetadataEditor.tsx`; host ยังเป็นเจ้าของ `useLms`, role, course lookup, form instance/draft, save result/toast, review/publish, Admin AI mutation และ React Router navigation ส่วน editor รับ narrow props, `FormInstance`, callback, injected upload/status UI และ preview node ไม่อ่าน store/data/seed/types/router โดยตรง การทดสอบ architecture gate 2 รายการยืนยัน dependency boundary และ host ownership

นี่คือ seam ที่ใช้งานได้และรักษา UI metadata editor ปัจจุบัน ยังไม่ใช่ package สาธารณะหรือ proof ว่า Chapter/Curriculum/Quiz editors แยก dependency แล้ว: `ChapterWorkspace` ยังคุม local draft/Transcript/localStorage/router และ `CurriculumWorkspace`/Quiz editors ยังใช้ store โดยตรงตามหลักฐาน R0 จะต้องแยก role wrappers ใน R2b/R6 ก่อนเปิด Admin route ปลายทาง ห้ามถือว่าคัดลอก host page ได้รับการพิสูจน์ reuse ทั้ง authoring suite

## R2a decisions and open gates

- Existing evidence: Admin course table uses `/teach/courses/...` links and the `instructor` route gate admits Admin to the same `CourseEditorPage`, `CurriculumPage`, and `ChapterEditorPage`; Instructor is the only user whose public `/teach` URLs need remain canonical. See `src/pages/admin/AdminPages.tsx`, `src/App.tsx`, `src/pages/instructor/CoursePages.tsx`, `CurriculumWorkspace.tsx`, and `ChapterWorkspace.tsx`.
- npm is the current package/lockfile/script owner (`package-lock.json`, root `package.json`); propose npm workspaces in R2b without adding Nx/Turborepo until task graph evidence requires it. R2a does not change tooling.
- Course metadata editor is the smallest useful interface gate: host keeps role/record loading, draft controller, persistence/results, navigation and Admin AI settings; editor core receives form instance/values/instructor options and action callbacks. Core must not import store/data/router/seed, `ImageUploadField`, or host layouts. Transcript remains Admin host-owned with its own dirty/save guard; curriculum/chapter/quiz extraction is still unproven and stays R6 unless R2b gives a concrete dependency reason.
- `course-authoring` remains a candidate. R2a seam pass alone does not authorize publishing a package; package extraction requires a second consumer (`apps/admin`) plus type-dependency/public-export tests after workspace setup.
- Workspace tool proposal: npm workspaces because the repo already uses npm and has one lockfile. Implement only with R2b and verify separate Web/Admin builds; do not add build-graph dependency now.

## Rollback and verification ledger

Before R2b cutover, produce route-map tests for Admin shim allowlist, role resolution, ids/query/hash, unauthenticated destination and unsafe external targets. In split PRs, keep legacy URL adapter until Web/Admin can open mapped URLs with the same fixture/API and retire it only after both old deep links and bookmarks are covered. Rollback is a code revert preserving old route owners; do not rewrite browser localStorage or server records.
