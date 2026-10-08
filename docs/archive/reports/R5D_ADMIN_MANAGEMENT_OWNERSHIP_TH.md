# R5d — ย้ายหน้า Admin management เข้า app ownership

อัปเดต 8 ตุลาคม 2026 · branch `refactor/v1-api-ready` · code checkpoint `bf0516a`

ย้ายหน้า dashboard, users, user detail, instructors, courses และ course detail ของ Admin พร้อม CSS เฉพาะหน้า จาก root `src/pages/admin/` ไป `apps/admin/src/features/management/pages/` แล้ว route `/admin` และ `/admin/users*`, `/admin/instructors`, `/admin/courses*` ชี้เข้า Admin app โดยตรง URL, route guards, markup, CSS และ demo behavior เดิมคงไว้

## ขอบเขตและ compatibility bridge

- `AdminPages.tsx`, `admin-courses.css` และ `admin-users.css` อยู่ใต้ Admin app แล้ว; เพิ่ม architecture test กัน route กลับไป import page module จาก `@legacy`.
- หน้าและ route ที่มาจาก `CourseReviewPage`, `AccessCodesPage`, `AuthPages`, profile form, store/data/types และ shared legacy widgets ยังเป็น bridge ตามเดิม; `@legacy/store`, data helpers, types และ shared components ที่หน้า management ใช้อยู่ยังไม่ถูกแทนด้วย API.
- ไม่มีการเปลี่ยน permission, route, feature status, form behavior หรือ API contract; ไม่แตะ Course Authoring/Review ใน R6 ซึ่งยังรอคุยตามคำสั่งผู้ใช้.

## หลักฐานตรวจ

- `npm.cmd run typecheck` — ผ่าน Web, Admin และ legacy TypeScript projects.
- `npm.cmd test -- --test-reporter=dot` — ผ่าน 94 tests รวม architecture test ของ Admin page ownership.
- `npm.cmd run check:boundaries` — ผ่าน dependency direction และ route ownership checks.
- `npm.cmd run build --workspace @melearn/admin` — ผ่าน (Vite 54.85 วินาที); ยังคงมีคำเตือน `use client` จาก dependencies และ Admin bundle ที่เกิน 500 kB.
- `git diff --cached --check` — ผ่านก่อน commit.
- [GitHub CI run 37755754842](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37755754842) — ผ่านทุก job สำหรับ code checkpoint นี้ รวม shared checks และ Web/Admin typecheck/build.
- ไม่ได้ทำ browser visual/responsive pass ในชุดย้ายไฟล์นี้ จึงไม่นับเป็น R13 acceptance.

Commit `bf0516a14ecb1a7a90bb9041249560515b9ad585` ถูก push ไป `origin/refactor/v1-api-ready`; ไม่รวม `docs/MELEARN_V1_SCOPE.pdf` ซึ่งเป็นไฟล์ untracked เดิมของ workspace.
