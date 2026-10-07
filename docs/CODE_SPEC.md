# Melearn Code Spec

**ข้อมูลหลักที่เจ้าของยืนยัน 6 ต.ค. 2026:** [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md) ฉบับ Final 1.6 กำหนดกติกาธุรกิจ สิทธิ์ และขอบเขตหนึ่งเดือนแรก เอกสารนี้อธิบายวิธีทำต้นแบบ หากข้อความหรือพฤติกรรมเดิมขัดกัน ให้ใช้ฉบับหลัก และระบุส่วนที่โค้ดยังไม่ตรง ห้ามถือว่าต้นแบบพร้อม Production


อัปเดต 6 ตุลาคม 2026 ข้อกำหนดสำหรับต่อ UX prototype ปัจจุบัน อ่าน [`UI_SPEC.md`](UI_SPEC.md) ควบคู่ก่อนแก้หน้าจอ

## 1. ข้อเท็จจริงและขอบเขต

- ใช้ React, Vite, TypeScript/TSX, React Router และ browser-local state เวอร์ชันติดตั้งตรวจจาก `package.json` / lockfile
- Repository นี้ไม่กำหนดว่าจะใช้สแตกนี้เป็น Production ไม่เพิ่ม backend, database, auth gateway หรือ deployment configuration จากชื่อ workspace
- ใช้ `package.json` ปัจจุบันเป็นฐาน มี `typecheck` และ `build`; regression tests ใช้ native Node ตามคำสั่งใน README ไม่มี lint/test npm script อย่าอ้างว่าคำสั่งเหล่านั้นผ่านถ้าไม่มีการรันจริง
- อนาคต MCP/CLI/skill ต้องมีงานที่ระบุ scope และ permission model ของตัวเอง ไม่วาง mock tool เป็นบริการจริง
- Mux Data environment key ใช้ชื่อ `VITE_MUX_ENV_KEY` ใน `.env.local` (มีชื่อเปล่าใน `.env.example`) เป็นค่า client-side สำหรับ analytics ไม่ใช่ Mux API token; ตอนนี้ยังไม่มี Mux SDK/player wiring จึงยังไม่มี tracking

## 2. แผนที่ code ที่ต้องหาให้ถูก

| งาน | จุดเริ่มต้น |
| --- | --- |
| Entry/providers/font/CSS order | `src/main.tsx` |
| Routes และ role gate ของ prototype | `src/App.tsx` |
| Shared shell/navigation/profile | `src/components/Shell.tsx` |
| Shared profile image/default avatar | `src/components/UserAvatar.tsx`, `user-avatar.css` |
| Workspace notification menu | `src/components/WorkspaceNotifications.tsx`, `workspace-notifications.css` |
| Inbox selectors / contact and participant scope | `src/api/inbox.ts` |
| Inbox and direct conversations | `src/pages/inbox/InboxPage.tsx`, `inbox.css` |
| Review queue / grading workspace | `src/pages/instructor/LearnerReviewQueuePage.tsx`, `QuizPages.tsx`, `review-queue.css`, `grading-workspace.css` |
| Shared title/status/control patterns | `src/components/common.tsx` |
| Tokens / light-dark foundation | `src/theme.ts` |
| CSS กลาง / style ที่ปรับธีม | `src/styles.css`, `src/system-theme.css` |
| Landing/public brand chrome | `src/pages/landing/LandingPage.tsx`, `LandingChrome.tsx`, `landing.css` |
| About / รายชื่อทีมร่วมกัน | `src/pages/landing/AboutPage.tsx`, `BrandStory.tsx`, `brand-story.css` |
| Auth / shadcn controls | `src/pages/AuthPages.tsx`, `src/components/ui/`, `src/shadcn.css` |
| Public blog / admin blog editor | `src/pages/blog/`, `src/pages/admin/BlogAdminPages.tsx` |
| Curriculum จริงที่ route ใช้อยู่ | `src/pages/instructor/CurriculumWorkspace.tsx`, `curriculum-workspace.css` |
| Chapter workspace จริง | `src/pages/instructor/ChapterWorkspace.tsx`, `chapter-workspace.css` |
| Video / article / assessment editors | `src/components/chapter/VideoEditor.tsx`, `RichTextEditor.tsx`, `AssessmentEditor.tsx`, `ChapterPreview.tsx` |
| Admin courses และ card/table toggle | `src/pages/admin/AdminPages.tsx`, `admin-courses.css` |
| State/actions/persistence | `src/store.tsx` |
| Demo seed/helpers/asset mapping | `src/data.ts` |
| Uploaded profile/cover UI | `src/components/ImageUploadField.tsx` |
| Written/image response UI | `src/components/WrittenAnswer.tsx` |
| Artwork และแบรนด์ | `src/assets/generated/`, `src/assets/melearn-ui/`, `public/images/founders/` |

ตรวจ import/re-export ใน `App.tsx` ก่อนเลือก implementation โดยเฉพาะ `CurriculumPages.tsx` ยังมี code เก่า แต่ `CurriculumPage` re-export จาก `CurriculumWorkspace.tsx` และ route แก้บทใช้ `ChapterWorkspace` ไม่ใช่ฟอร์มชื่อบทแบบเก่า

## 3. โครงสร้างและรูปแบบการเขียน

- `AdminAssignmentsPage` ใน `src/pages/admin/AssignmentPages.tsx` เป็นรายชื่อผู้สอนก่อนเข้า `AssignmentsPage` ด้วย `?instructor=` ตรวจ ID กับผู้สอนจริง กรองงานผ่าน `course.instructorId` ไม่ใช้ `createdBy` เป็นเจ้าของคอร์ส เก็บคำค้นรายชื่อใน `instructorQ` ระหว่างเปิดงาน และใช้ `q`/`course` ค้นงานในขอบเขตผู้สอนนั้น ฟอร์มตรวจ course/quiz ที่สัมพันธ์กันและรักษา `createdBy` เดิมเมื่อแก้ไข

- คอร์ส public อยู่ `src/pages/public/` และคอร์สสำหรับผู้ล็อกอินอยู่ `src/pages/member/` ผ่าน routes `/courses[/:slug]` และ `/explore/courses[/:slug]` ตามลำดับ ห้ามนำ page เดียวมาใช้สองบริบท รายการโครงสร้างบทที่เป็น presentation ใช้ `CourseOutline` ร่วมได้
- `PublicCourseEntry` ส่งสมาชิกที่เปิด URL public ไปยัง URL สมาชิกของคอร์สเดียวกัน รายการ/รายละเอียดทั้งสองแบบแสดงเฉพาะคอร์ส published; ไม่ใช้ catalog เปิด draft แทนหน้าจัดการ/preview
- ใบรับรองหน้าบัญชีผู้เรียนกรองเจ้าของเสมอ รวมถึงเมื่อผู้ใช้เป็น Admin รายการรวมของ Admin ใช้ route และ guard แยกตามฉบับหลัก
- `DirectorySearch` เก็บคำค้นและตัวกรองใน URL ใช้รายการ field ที่ระบุอย่างชัดเจนในการค้น ไม่ค้นจากการ serialize user ทั้งก้อนหรือข้อมูลรหัสผ่าน การเปลี่ยนคำค้น/ตัวกรองเริ่ม pagination ใหม่ และ returnTo ของรายละเอียดจำกัดให้เป็น path รายการภายในที่ตรงกัน

- Page รับ route/context และประกอบหน้าจอ; component ดูแล interaction/การแสดงผลที่เกี่ยวข้อง; action/state อยู่ใน store; style แยกตามบริบท
- Component ของ feature เดียวเก็บใกล้ page หรือใน `components/chapter/` ตามโครงสร้างเดิม ย้ายเป็น shared component เมื่อมีการใช้ร่วมกันจริง
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
- shadcn configuration อยู่ที่ `components.json` (`base-nova`, TSX, Base UI); code components อยู่ใน `src/components/ui/` อย่า scaffold ชุดใหม่ทับ component ที่ customize แล้ว
- Tailwind มีใช้กับ shadcn controls ได้ ไม่ได้อนุญาตให้สร้าง design system อีกชุดจาก utility class ตามใจ ห้าม hard-code สี/ขนาด control ซ้ำทั่ว page
- สำหรับ animation ใช้ `motion/react` ที่มีอยู่ ไม่ติดตั้ง Framer Motion เพิ่มซ้ำเพื่อ feature เดียวกัน
- ถ้าจำเป็นต้องเพิ่ม component/library ให้ตรวจของที่มี ก่อนใช้ source/CLI จากผู้พัฒนาอย่างเป็นทางการ ตรวจ compatibility/license และบันทึกเหตุผลกับไฟล์ lock ที่เปลี่ยน ห้าม copy paid block หรือ dependency โดยไม่ตรวจที่มา
- เลือก icon family เดิมในบริบทนั้น ไม่เพิ่ม package เพื่อไอคอนหนึ่งตัวที่ชุดปัจจุบันมีแล้ว

## 5. Theme และ CSS

- ค่า app tokens อยู่ใน `theme.ts`, Ant provider อยู่ใน `main.tsx`, Landing มี provider ของตนใน `LandingPage.tsx`; ตรวจทั้ง provider และ cascade ก่อนแก้สี/ขนาดที่ดูไม่ตรง
- ใช้ token/CSS variable ปัจจุบันก่อนเพิ่ม literal ใหม่ CSS เฉพาะ page อยู่ข้าง page และมี class namespace เช่น `home-`, `blog-`, `chapter-`
- ไม่ override global `.ant-btn`, `input`, `h2` เพื่อแก้หน้าเดียว ไม่เพิ่ม `!important` ต่อท้ายไฟล์เรื่อย ๆ ถ้าปัญหาเกิดจาก specificity/import order ให้แก้ rule ที่เป็นต้นเหตุ
- อ่าน `styles.css` และ `system-theme.css` เมื่อ component ที่แก้ใช้ style กลาง หลาย selector เก่ามี override ภายหลัง ห้ามใช้ selector แรกที่เจอเป็นข้อสรุป
- ใช้ grid/flex, minmax, wrap, gutter และ aspect-ratio สำหรับ layout ไม่ใช้ absolute positioning เพื่อแก้ toolbar ชนกัน Absolute ใช้ได้กับ background/overlay ตามหน้าที่
- ค่าเริ่มต้น light; dark tokens มีอยู่แล้ว ยังไม่เปิด toggle ไม่อ้างว่าภาพ/editor/public ทั้งระบบรองรับ dark ครบ
- งานที่เปลี่ยน token กลางต้องเช็กหน้าที่ใช้ร่วมกันอย่างพอประมาณ โดยไม่ขยายเป็น redesign ทุกหน้า

## 6. State และการบันทึก

- ใช้ `useLms()` และ actions ใน `store.tsx` เป็นแหล่ง state หลักของ prototype ไม่สร้าง localStorage/store ชุดสองสำหรับข้อมูลเดียวกัน
- ใช้ local component state สำหรับ draft, selected item, modal, filter และ view mode เท่าที่เหมาะสม การป้อนแต่ละตัวอักษรไม่ควรเปลี่ยนข้อมูลหลักก่อนผู้ใช้บันทึกเมื่อ pattern ของหน้าคือ draft
- หน้าตรวจงานเก็บเฉพาะ draft คะแนน/feedback ใน `sessionStorage` ตาม user/attempt เพื่อกลับมาต่อในแท็บเดิมได้; ใช้ `gradeAttempt` เดิมเมื่อบันทึกและล้าง draft จากแท็บเมื่อเสร็จ ไม่ใช้ draft เปลี่ยนผลคะแนนหรือ Analytics ล่วงหน้า
- คิวตรวจเก็บ course/courseId, mode และคำค้น `q` ใน URL; ส่ง `returnTo` ให้หน้าตรวจ และใช้บริบทเดียวกันสำหรับงานก่อนหน้า/ถัดไป โดยคง role scoping และลำดับ FIFO
- แจ้งเตือน prototype อยู่ใน `data.notifications` ของ store เดิม สร้างจาก `submitAttempt`, `gradeAttempt` และ `saveAssignment`; เมนูกรอง recipient ตามบัญชีปัจจุบัน และ `markNotificationRead` แก้เฉพาะรายการของบัญชีนั้น ไม่สร้างแจ้งเตือนซ้ำเมื่อส่ง/ตรวจ attempt เดิม
- Inbox ยังไม่ทำในรอบแรก เอกสาร INBOX_PERMISSION_SPEC เป็นทางเข้าประวัติ ไม่ใช้เป็นกติกาใหม่
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

- ศึกษา `RolePage` ใน `App.tsx` และ checks ใน actions ปัจจุบัน อย่าเชื่อว่าซ่อนปุ่มแล้วผู้ใช้เข้าหน้านั้นไม่ได้
- ผู้สอนจัดการเฉพาะคอร์สตนเอง; admin จัดการคอร์สผู้อื่นได้และใช้ `/teach/...` workspace ตาม route เดิมได้
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
- AI ของต้นแบบยังตอบ mock และเก็บประวัติใน browser ส่วนระบบจริงต้องเก็บคำถาม/คำตอบใน Database บังคับสิทธิ์คอร์ส และนับโควตาที่ server ตามฉบับหลัก ค่า limit อยู่จุดกลางแก้ได้ ไม่ใช้ quota ที่ client เป็นหลักฐาน
- คอร์สใช้ draft → pending_review → approved → published; แก้ approved ก่อน publish ต้องตรวจใหม่ published แก้เนื้อหาได้ทันที การแก้เฉพาะ AI/Transcript ไม่เปลี่ยนสถานะอนุมัติ
- Cart/ส่วนลด/Orders/Finance/Inbox/คำขอ Instructor และ analytics แบบใหญ่ใน source เป็นของต้นแบบเดิม ไม่เพิ่มงานเหล่านี้ในรอบหนึ่งเดือน

## ขอบเขต Stripe และ AIPractice ที่เพิ่ม

- Registry แยก `payments` (เดือนแรก) จาก `commerce` (Cart/Orders ที่ยังไม่ทำ) ทุกสถานะยัง prototype การมี route checkout ไม่ใช่หลักฐานเชื่อม Stripe จริง
- ระบบจริงใช้ Stripe Session/PaymentEvent ตรวจราคา บัญชี ลายเซ็น Webhook และผลจ่าย ณ server ก่อนสร้างหรือคืน Enrollment เดิม; การให้สิทธิ์ต้องเกิดจาก Webhook ที่ตรวจแล้วเท่านั้น GET สถานะและหน้าผลจ่ายต้องไม่ให้สิทธิ์ ไม่เพิ่ม Order/Cart Domain จากชื่อพารามิเตอร์เก่าใน prototype
- AIPractice แยกจาก Quiz/QuizAttempt จัดเก็บชุดคำถามและผลในแชต ตรวจ response schema ก่อนคิด Prompt สำเร็จ การตอบและอ่านผลไม่เรียก model หรือนับ Prompt เพิ่ม
