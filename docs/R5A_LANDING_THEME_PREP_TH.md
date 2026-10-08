# R5-prep — แยก Landing theme config ออกจาก page module

วันที่ 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## เหตุผลและขอบเขต

`AboutPage` และ `BlogPages` ใช้ `landingTheme` จาก `LandingPage.tsx`. การ import page module นี้พ่วง `useLms`, landing components และ CSS side effects หลายชุด ขณะที่ `BlogArticlePage` ยังถูกใช้ใน Admin app ด้วย การย้าย About page เดี่ยวจึงไม่ใช่ boundary ที่ปลอดภัย: `src/App.tsx` ยังใช้หน้าเดียวกัน และการแยก CSS โดยไม่ย้าย graph ที่เกี่ยวข้องอาจเปลี่ยน cascade ของหน้า Blog/Admin

ย้ายเฉพาะ `landingTheme: ThemeConfig` ที่ประกอบจาก design tokens ไป `packages/ui/src/landing-theme.ts` และ export ผ่าน `@melearn/ui`. `LandingPage.tsx` import theme จาก package และ re-export ชื่อเดิมไว้ให้ consumers เดิม. คง `homePageTheme`, About/Blog imports, Landing components และ CSS imports ทั้งหมดในตำแหน่งเดิม

## สิ่งที่คงเดิม

- Theme values อ้าง `designTokens` ชุดเดิม ไม่มีการเปลี่ยนสี, spacing, typography หรือ component behavior.
- ไม่ย้าย About/Blog pages, route, store, mock, API, auth หรือ session logic.
- ไม่เปลี่ยน stylesheet load order/side effects; Web และ Admin ยังใช้ consumer path เดิม.
- About page extraction รอการย้าย marketing/landing dependency graph เป็นชุดเดียว เพื่อลด duplicate page หรือ legacy-to-app reverse import.

## ตรวจสอบ

- `npm.cmd run typecheck` — Web, Admin และ legacy ผ่าน.
- `npm.cmd test` — 93/93 ผ่าน.
- `npm.cmd run check:boundaries`, `npm.cmd run tokens:check`, `git diff --check` — ผ่าน.
- `npm.cmd run build` — Web และ Admin production builds ผ่าน (`BUILD_EXIT=0`); คำเตือน `use client` และ chunk size มาจาก dependencies/bundle เดิม.
- Push checkpoint `19264f3` ผ่าน GitHub CI ทุก job: [run 37746448045](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37746448045).
- Browser spot-check: Web `/about`, `/about#our-story`, `/articles`; Admin `/admin/articles` และ `/articles/post-better-writing` แสดงเนื้อหาหลัก. อ่านอย่างเดียว; ไม่แก้/ลบ/เผยแพร่บทความ.
- ไม่รัน Docker.

นี่เป็น **theme ownership preparation** เท่านั้น; R5 feature migration/API acceptance ยังไม่ปิด.
