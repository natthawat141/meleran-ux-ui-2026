# รายงาน R3b — CSS และ Tailwind semantic tokens

วันที่ 7 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## เป้าหมายและขอบเขต

สร้างแหล่ง token กลางใน `packages/ui` ให้ Web/Admin ใช้ร่วมกันผ่าน CSS variables, Tailwind theme, Mantine และ Ant Design โดยรักษาค่าสีและรูปแบบเดิม รวมถึงแยก Landing brand profile ไว้เฉพาะหน้าเดิม งานนี้ไม่เปลี่ยน route, feature, business rule, backend contract หรือ layout ที่ตั้งใจไว้

## สิ่งที่เปลี่ยน

- เพิ่ม [`design-tokens.json`](../packages/ui/src/design-tokens.json) เป็น source of truth สำหรับ legacy light/dark palette, semantic colors, Mantine/Ant adapters, font/radius และ Landing brand profile ค่าที่ใช้ร่วมกันอ้าง token ด้วย `$path` เพื่อลดค่าหลักซ้ำ
- เพิ่ม `design-tokens.ts` เพื่อ resolve token references ให้ TypeScript adapters ใช้ และปรับ `theme.ts`, `MelearnUiProvider.tsx` กับ Landing `ConfigProvider` ให้อ่าน object ชุดเดียวกัน
- เพิ่ม `scripts/generate-ui-tokens.mjs` สร้าง `packages/ui/src/tokens.css` และ `tailwind.css` แบบ deterministic; `npm.cmd run tokens:check` ตรวจ generated files ว่าตรงกับ source และ root build scripts เรียก check ก่อน build
- ย้าย Tailwind theme mapping/shadcn light-dark variables เข้า shared stylesheet โดยคงข้อห้าม Tailwind Preflight ไว้; เพิ่ม semantic utilities เช่น `bg-canvas`, `bg-surface`, `text-ink`, `border-line`, `bg-primary-soft` และ status colors
- ให้แต่ละ `apps/*/src/app.css` import shared Tailwind stylesheet และ register source ของแอปตัวเอง, `packages/ui/src` และ legacy `src` ใน compilation เดียวกัน; คงข้อห้าม Tailwind Preflight ไว้ ส่วน `src/shadcn.css`/`src/styles.css` ยังเป็น compatibility imports ของ legacy
- เปลี่ยนค่าสี semantic ซ้ำใน `system-theme.css` และ Landing CSS ให้ชี้ token โดยเก็บค่าเดิมไว้; สี Landing ใหม่ยังทำงานภายใต้ selector `.home-v3:has(.home-hero)` เท่านั้น

## ผลตรวจ

- `npm.cmd run tokens:check` ผ่าน
- `npm.cmd run typecheck` ผ่าน Web, Admin และ legacy source
- `npm.cmd run build` ผ่าน production build ของ Web และ Admin; build เรียก token check ก่อน
- ตรวจ CSS production outputs ของทั้งสองแอปแล้วพบ `.h-8`, `.bg-primary` และ `.text-primary` จาก shared UI; ย้าย `@source` ไปไว้ใน app stylesheet ที่ import utilities โดยตรง หลัง review พบว่า source declarations ใน stylesheet แยกไม่ถูกรวมกับ compiler ของ Tailwind
- Browser smoke: เปิด `http://127.0.0.1:5173/` และ `http://127.0.0.1:5174/admin` ได้ ทั้งสองหน้ามี title และเนื้อหาหลักใน accessibility tree; ไม่ได้ทำ mutation
- Vite ยังรายงาน dependency `"use client"` directives ที่ถูก ignore และ bundle chunks ใหญ่กว่า 500 kB; build exit code 0
- ไม่ได้รัน test suite และยังไม่ได้ตรวจ computed styles, screenshot/pixel equivalence, contrast, keyboard navigation หรือ responsive breakpoints จึงยังไม่ยืนยัน visual acceptance

## วิธีแก้ token ต่อไป

แก้ค่าที่ [`design-tokens.json`](../packages/ui/src/design-tokens.json) แล้วรัน `npm.cmd run tokens:generate`; ก่อน build/commit ให้รัน `npm.cmd run tokens:check` อย่าแก้ `tokens.css` หรือ `tailwind.css` โดยตรง เพราะ generator จะสร้างทับ ตรวจ light/dark aliases และ foreground/hover/focus/disabled รวมทั้ง color scope ของ Landing หลังเปลี่ยน token

## งานถัดไป

R3b code gate ผ่าน แต่ visual QA ยังเปิดตามเกณฑ์ใน [แผน refactor](FRONTEND_REFACTOR_PLAN_TH.md) งานถัดไปคือ R3c แยก route modules/layouts/guards ตาม route ledger โดยรักษา URL/redirect/no-access behavior; การตรวจ visual ของ R2b/R3a/R3b ต้องบันทึกแยกตามหน้าที่เปิดจริง

งานนี้เตรียมโครงสร้าง frontend ไม่ได้เชื่อม API จริงและไม่ใช่หลักฐานว่า Web/Admin พร้อม Production
