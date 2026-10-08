# R5c — ย้ายหน้า Web/Admin เข้า app ownership

อัปเดต 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

สถานะ: **ผ่าน code gate และ development preview เฉพาะ route ที่ระบุ; R5 ยังไม่เสร็จ** งานชุดนี้ย้ายหน้า retained slices ออกจาก root `src/pages` ให้แอปเจ้าของ โดยรักษา URL, markup, CSS และ demo behavior เดิม ยกเว้นลิงก์กลับจาก Admin article preview ที่ชี้ไปยังรายการบทความของ Admin เพื่อให้ไม่หลุดไป route ที่ไม่มีในแอปนั้น

## สิ่งที่ย้าย

| เจ้าของ | หน้า/route | ตำแหน่งปัจจุบัน |
| --- | --- | --- |
| Web | `/`, `/about` และชุด landing/About พร้อม CSS เฉพาะหน้า | `apps/web/src/features/landing/pages/` |
| Web | `/courses`, `/courses/:slug` | `apps/web/src/features/courses/pages/public/` |
| Web | `/instructors/:id` | `apps/web/src/features/instructors/pages/InstructorProfilePage.tsx` |
| Web | `/articles`, `/articles/:id` (Published เท่านั้น) | `apps/web/src/features/blog/pages/BlogPages.tsx` |
| Web | `/account/certificates`, `/account/certificates/:certificateId` | `apps/web/src/features/certificate/pages/AccountPages.tsx` |
| Web | `/account/profile` page wrapper | `apps/web/src/features/account/pages/ProfilePage.tsx` |
| Admin | `/admin/articles`, `/admin/articles/new`, `/admin/articles/:id/edit`, `/articles/:id` preview | `apps/admin/src/features/blog/pages/BlogAdminPages.tsx` และ `BlogArticlePreviewPage.tsx` พร้อม `blog-editor.css` |
| Admin | `/account/profile` page wrapper | `apps/admin/src/features/account/pages/ProfilePage.tsx` |

Web/Admin route declarations ชี้เข้าไฟล์ของ app เจ้าของแล้ว ลบ root `index.html`, `src/main.tsx` และ `src/App.tsx` เพราะ root package ใช้ Web workspace เป็น `dev` entry อยู่แล้วและไม่ควรมี runnable app ที่สาม โค้ดใต้ root `src/` ที่ยังถูกใช้เป็น compatibility bridge ยังคงอยู่

## Compatibility bridge ที่ยังเปิด

- หน้าใหม่ยังใช้ `@legacy/store`, `@legacy/data`, `@legacy/types` และ shared widgets บางตัว เป็น demo adapter ชั่วคราว ไม่ใช่ server state หรือ API contract
- Web Blog และ Admin article preview ย้ายเข้า app แล้ว แต่ยังใช้ `@legacy/store`, `@legacy/data`, `@legacy/types`, `blog.css`, `LandingChrome` และ `landing.css` เป็น compatibility bridge; Admin preview แสดง Published ได้ และมี branch สำหรับ draft ของ Admin
- `LandingChrome` และ base `landing.css` ยังอยู่ใต้ `src/pages/landing/` เพราะ legacy `Shell` และ Admin article preview ใช้ร่วมอยู่; `blog.css` ยังอยู่ใต้ `src/pages/blog/` การย้าย/ทำสำเนาตอนนี้จะสร้าง cross-app import หรือ duplicate styles
- `AuthPages` ยังถูกใช้ทั้ง Web และ Admin; profile page wrappers แยก app แล้ว แต่ `ProfileSettings` form ยังเป็น legacy consumer ของทั้งสอง app
- ดังนั้น root `src` ไม่ใช่ app runtime แล้ว แต่ยังเป็น module bridge ที่ต้องทยอยถอน การผ่าน boundary checker ไม่ได้แปลว่า bridge เหล่านี้หายไป

ยังไม่ได้ต่อ API, เพิ่ม Query hooks, เปลี่ยน feature status หรือเปลี่ยนพฤติกรรมการเข้าสู่ระบบ/โปรไฟล์/บทความ ข้อมูล localStorage ยังคงแยกตาม origin ของแต่ละ app

## หลักฐานตรวจ

- `npm.cmd run typecheck` — ผ่าน Web, Admin และ legacy TypeScript projects
- `npm.cmd test` — 93/93 ผ่าน; route checks อ่าน inventory ของ Web/Admin modules และเก็บ R3 baseline พร้อม allowlist การเปลี่ยน Admin Blog preview
- `npm.cmd run check:boundaries` — ผ่าน dependency direction และ route ownership checks ที่มีอยู่
- `npm.cmd run build` — token check และ production build ของ Web/Admin ผ่าน; มีคำเตือนเดิมจาก dependency `"use client"` และ chunk ขนาดใหญ่
- Development preview แบบ read-only: `/` แสดง Landing, `/about` แสดงหน้าและ founder content, `/courses` แสดงคอร์ส Published 3 รายการ, `/courses/clear-writing` แสดงรายละเอียดคอร์ส, Web `/articles/post-better-writing` และ Admin `/articles/post-better-writing` แสดงบทความ Published
- Draft preview branch คง role check ใน source แต่ไม่มี draft seed data จึงยังไม่ได้ยืนยันผล draft ด้วย browser; ลิงก์ย้อนกลับจาก Admin preview ชี้ `/admin/articles`
- Production preview ที่ `/` แสดง Not Found เพราะ `prototype` feature status ถูกปิดใน `production` environment ตาม `src/config/features.ts`; ไม่ใช่การตรวจว่า route หาย และไม่ถือเป็น production acceptance
- ไม่ได้ submit login, แก้โปรไฟล์, แก้บทความ, หรือเปลี่ยน browser data; ไม่รัน Docker และยังไม่รัน full R13 acceptance

## งาน R5 ที่ยังค้าง

- ย้าย Auth pages ให้ Web/Admin มี host boundary โดยไม่ import app ข้ามกันหรือใช้ prototype account state เป็น auth contract
- ถอน `@legacy` adapters, `LandingChrome`, `landing.css` และ `blog.css` จาก Blog slices หลังมี owner/interfaces ที่ยืนยันแล้ว; ตรวจ navigation ของ Admin preview ให้ครบใน visual acceptance
- ย้าย `ProfileSettings` form และ legacy store/data adapters ตามลำดับเมื่อมี owner/interface ที่ยืนยันได้
- ตรวจ route ที่ย้ายครบขึ้นใน responsive/visual acceptance รอบ R13 และตรวจบน revision เดียวกับผล CI

R6 Course Authoring/Review ยังไม่เริ่มตามคำสั่งผู้ใช้ให้หยุดคุยก่อน เอกสารฉบับนี้ไม่ได้ตัดสิน extraction ของ `packages/course-authoring` แทนผู้ใช้
