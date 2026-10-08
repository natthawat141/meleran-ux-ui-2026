# R6a — ย้ายหน้า Admin Course Approval เข้า Admin app

อัปเดต 8 ตุลาคม 2026 · branch `refactor/v1-api-ready` · code checkpoint `03097f5`

ย้าย `CourseReviewPage` สำหรับคิวอนุมัติคอร์สจาก `src/pages/admin/` ไป `apps/admin/src/features/course-approval/pages/` และเปลี่ยน `/admin/courses/reviews` ให้ import จาก feature ของ Admin โดยตรง URL, Admin guard, markup, form ส่งกลับพร้อมเหตุผล และ behavior ของต้นแบบคงเดิม

งานนี้เป็นการเริ่ม R6 เฉพาะ ownership ของ Admin Course Approval ยังไม่ใช่การย้าย Course Editor, Curriculum, Chapter, Content หรือ Quiz editor และยังไม่ปิด R6

หน้าใช้ `@legacy/store` และ `reviewCourse` แบบ local demo ต่อไป จึงยังไม่มี API, persistence หรือ server authorization จริง การเขียน API/Query hooks ต้องรอ Backend ยืนยัน contract ของ Course Authoring/Review; `packages/course-authoring` ยังคงเป็น candidate ตามหลักฐาน reuse

## หลักฐานตรวจ

- `npm.cmd run typecheck` — ผ่าน Web, Admin และ legacy projects.
- `npm.cmd test -- --test-reporter=dot` — ผ่าน 95 tests รวม route ownership test.
- `npm.cmd run check:boundaries` — ผ่าน.
- `npm.cmd run build --workspace @melearn/admin` — ผ่าน (Vite 41.09 วินาที); มี dependency `use client` และ chunk-size warnings เดิม.
- `git diff --cached --check` — ผ่านก่อน commit.
- [GitHub CI run 37757678264](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37757678264) — ผ่านทุก job รวม shared checks และ Web/Admin typecheck/build.
- ไม่ได้ทำ browser visual acceptance ในชุดนี้; route declaration และ app build ผ่าน แต่ยังไม่นับเป็น R13.

Commit `03097f5055748c294c856843852c8551dec01088` ถูก push ไป `origin/refactor/v1-api-ready`.
