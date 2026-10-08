# R5-prep — แยก Profile page ออกจาก Account pages

วันที่ 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## เหตุผลและขอบเขต

`AccountPages.tsx` รวมหน้า Certificates, Certificate detail และ Profile ไว้ด้วยกัน ขณะที่ Web, Admin และ legacy root มี route ที่ใช้ `ProfilePage` จากไฟล์เดียวกัน การแยก component เป็นไฟล์ของตัวเองช่วยให้เห็น feature boundary ก่อนย้าย ownership ใน R5 โดยไม่เปลี่ยน URL, route owner, mock state หรือ flow ของผู้ใช้

## สิ่งที่เปลี่ยน

- ย้าย implementation ของ `ProfilePage` ไป `src/pages/learner/ProfilePage.tsx`.
- `AccountPages.tsx` re-export `ProfilePage` ชื่อเดิม; route imports ใน Web/Admin/legacy จึงไม่เปลี่ยน.
- ย้ายเฉพาะ imports ที่หน้า Profile ใช้ (`useLms`, `ProfileSettings`, Ant Design controls) ไปอยู่ใกล้ component.
- คง guard เมื่อไม่มี `currentUser`, props ของ `ProfileSettings`, `resetDemo()` และ success message ตามเดิม; ไม่ย้าย `ProfileSettings`, CSS, store, certificate pages หรือ route.

นี่เป็น **legacy ownership preparation** เท่านั้น: `ProfilePage` ยังพึ่ง `useLms`/local prototype state และยังไม่ใช่ implementation ใน `apps/web` หรือ `apps/admin`, ไม่ได้เชื่อม API และไม่ถือเป็น API contract.

## ตรวจสอบ

- Component body เทียบกับ HEAD แล้วตรงกันหลัง normalize newline.
- `npm.cmd run typecheck` — Web, Admin และ legacy ผ่าน.
- `npm.cmd test` — 93/93 ผ่าน.
- `npm.cmd run check:boundaries`, `npm.cmd run tokens:check` และ `git diff --check` — ผ่าน.
- `npm.cmd run build` — Web และ Admin ผ่าน; มี dependency `use client` และ chunk-size warnings เดิม.
- Push checkpoint `e81acc2` ผ่าน GitHub CI ทุก job: [run 37748971907](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37748971907).
- ไม่ได้ login, submit form, กด reset demo หรือทำ browser mutation; ไม่รัน Docker.

R5 page migration ยังเปิดอยู่ โดยเฉพาะ Auth/Profile/Blog ที่ Web และ Admin ใช้ legacy consumers ร่วมกัน ต้องตัดสิน ownership/compatibility และ API contract ต่อ flow ก่อนย้ายออกจาก legacy.
