# R6d — แยก ownership ของ Course Authoring ใน Web/Admin

วันที่ 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## ผลที่ทำ

ย้าย page implementation ของ Course Overview, Curriculum, Chapter, video/article Content Editor, Quiz Manager และ Quiz Editor ออกจาก route imports ของ root `src/` ให้ Web และ Admin เป็นเจ้าของภายใต้ `features/course-authoring/` ของแต่ละแอป พร้อมย้าย editor controls และ CSS ที่ใช้กับ Chapter workspace ไปไว้ใน app owner ด้วย

คง URL, feature key, guard และลำดับ route เดิมไว้: Instructor ใช้ `/teach/...`; Admin ใช้ canonical `/admin/...`. ลิงก์จาก Admin authoring กลับ Admin overview/curriculum/preview/list จึงไม่ออกไป Web route. `CourseOverviewPage` ฝั่ง Admin ใช้ `/admin/courses/:courseId/overview` ตาม route ที่มีอยู่

Admin Quiz Manager แสดงการสร้าง/แก้ไขแบบทดสอบโดยไม่มีลิงก์เปิดคำตอบหรือให้คะแนน; route ตรวจงานเป็น Instructor assessment ใน Web ตาม permission boundary เดิม. ไม่มีการเปลี่ยน quiz scoring, attempts, progress, approval flow หรือ API behavior.

## Route ownership

| งาน | Web | Admin |
| --- | --- | --- |
| ภาพรวมคอร์ส | `/teach/courses/:courseId` | `/admin/courses/:courseId/overview` |
| Curriculum | `/teach/courses/:courseId/curriculum` | `/admin/courses/:courseId/curriculum` |
| Chapter editor | `/teach/courses/:courseId/chapters/:chapterId` | `/admin/courses/:courseId/chapters/:chapterId` |
| Video/article editor | `/teach/courses/:courseId/{videos|articles}/:itemId` | `/admin/courses/:courseId/{videos|articles}/:itemId` |
| Quiz Manager | `/teach/courses/:courseId/quizzes`, `/teach/quizzes` | `/admin/courses/:courseId/quizzes`, `/admin/quizzes` |
| Quiz Editor | `/teach/quizzes/:quizId` | `/admin/quizzes/:quizId` |
| Quiz attempts/grading | Instructor-owned Web routes | ไม่มี Admin route ตาม permission matrix |

## Ownership และ state boundary

Page code, navigation และ editor CSS ของ Web/Admin อยู่ใน app ของตัวเอง; ทั้งสอง app ไม่ import source ข้ามกัน. `packages/course-authoring` ยังคง export controlled `CourseMetadataEditor` เท่านั้น. `QuizPages.tsx` ใน legacy เหลือ Instructor attempts/grading; `CurriculumPages.tsx`, `CurriculumWorkspace.tsx`, `ChapterWorkspace.tsx` และ `QuizEditorPage.tsx` เดิมถูกถอนออกจาก root source. `RichTextEditor` ใน root ยังใช้โดย legacy Blog; Course Authoring แต่ละแอปมี component ของตัวเอง.

ข้อมูลคอร์ส, mutation, prototype types, transcript persistence และ quiz draft ยังเดินผ่าน `@legacy/store`, `@legacy/data`/types หรือ browser-local storage บางส่วน. นี่เป็น code ownership migration เท่านั้น ไม่ได้ทำให้ store กลายเป็น API contract, ไม่ยืนยัน server authorization และไม่ใช่ API persistence.

## Validation

- `npm.cmd run typecheck` ผ่าน Web, Admin และ legacy
- `npm.cmd test` ผ่าน 98/98
- `npm.cmd run check:boundaries` ผ่าน
- `npm.cmd run build:web` และ `npm.cmd run build:admin` ผ่าน
- เปิด Web dev deep link `/teach/courses/course-1/curriculum` แล้วถูก guard ส่งไป Login พร้อมรักษา `next`; ยังไม่ได้ authenticate Instructor ใน browser
- เปิด Admin dev ด้วย demo course `course-writing` ตรวจ Course Overview, Curriculum, Chapter/Transcript, video Content Editor, Quiz Manager และ Quiz Editor แล้ว rendered content ได้
- Production preview เสิร์ฟ deep link แต่ route แสดง Not Found ตาม feature gate ของ preview mode; ไม่ถือเป็น authenticated route acceptance
- Build ยังแสดง warning เดิมจาก dependency `use client` และ chunk ขนาดเกิน 500 kB; ไม่ได้รัน Docker

## ข้อจำกัดและความเสี่ยง

ทั้ง Web/Admin ยังผูกกับ prototype store และ data shapes; ห้ามอ้างว่า API-ready. Course authoring page implementations ที่ย้ายไปสอง app มีพฤติกรรมใกล้กันและมีโค้ดซ้ำ จึงมีความเสี่ยง drift เมื่อแก้ UI ในอนาคต. R6d ยังไม่ขยาย shared package เพราะต้องพิสูจน์ controlled editor boundary จาก callback/state ownership ก่อน; บันทึกเป็น technical follow-up ไม่เปลี่ยน API contract หรือดึงทั้ง editor เข้า package.

R4a contract, R4b hooks, server permission, persistence/conflict handling, authenticated Web visual acceptance, R11 container runtime และ R13 full responsive/accessibility review ยังคงเป็นงานแยกที่เปิดอยู่. รอบนี้ไม่ได้ deploy หรือ merge `main`.
