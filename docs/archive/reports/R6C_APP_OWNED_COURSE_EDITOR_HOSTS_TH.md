# R6c — ย้าย CourseEditor page host แยกตาม Web/Admin

อัปเดต 8 ตุลาคม 2026 · branch `refactor/v1-api-ready` · code checkpoint `9946c33`

แยก orchestration ของ Course Editor ตามเจ้าของแอป โดย `/teach/courses/new` และ `/teach/courses/:courseId/settings` ใช้ `InstructorCourseEditorPage` ใน Web; `/admin/courses/new` และ `/admin/courses/:courseId/settings` ใช้ `AdminCourseEditorPage` ใน Admin. URL, role guard และ feature registration คงเดิม; Admin ยังคงมี instructor assignment และ Melearn AI toggle, Instructor ยังคง flow ส่งตรวจ/เผยแพร่ตามสถานะ.

ทั้งสอง host ใช้ `CourseMetadataEditor` จาก `@melearn/course-authoring`; host แยกกันเป็นเจ้าของ load/save/review/publish/navigation และตอนนี้ยังใช้ `@legacy/store` กับ browser-local demo data อยู่. ลบ mixed-role `CourseEditorPage` เดิมจาก `src/pages/instructor/CoursePages.tsx`; app routes ไม่ import page editor จาก legacy แล้ว. หน้าภาพรวมคอร์ส, Curriculum, Chapter, Content และ Quiz ยังเป็น legacy bridge.

## ผลตรวจ

- `npm.cmd run typecheck` — ผ่าน Web, Admin และ legacy.
- `npm.cmd test` — ผ่าน 97/97 tests รวม route element ownership migration และ app host boundary tests.
- `npm.cmd run check:boundaries` — ผ่าน.
- `npm.cmd run build:web` — ผ่าน; 44.43 วินาที.
- `npm.cmd run build:admin` — ผ่าน; 37.93 วินาที.
- [GitHub CI run 37760324161](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37760324161) บน code commit `9946c33` — ผ่านทุก job รวม shared checks และ Web/Admin typecheck/build.
- Build ยังคงแสดง third-party `use client` และ chunk-size warnings; ไม่มี browser visual acceptance รอบนี้.
- ไม่ได้รัน Docker และไม่ได้เพิ่ม API contract/Query code; local persistence ไม่ถือเป็น server state.

R6 ยังไม่เสร็จ: ต้องย้าย/แยก Course Overview, Curriculum, Chapter, Content และ Quiz ownership ต่อ และต้องรอ Backend ยืนยัน contract ก่อนย้าย persistence, permissions และ API mutations.