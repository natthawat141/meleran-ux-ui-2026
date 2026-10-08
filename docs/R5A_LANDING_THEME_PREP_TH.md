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

## R5 consumer decoupling

หลังย้าย config แล้ว `AboutPage` และ `BlogPages` เปลี่ยนมา import `landingTheme` จาก `@melearn/ui` โดยตรง ไม่ import `LandingPage` เพียงเพื่ออ่าน theme อีกต่อไป. `AboutPage` มี `landing.css` อยู่แล้ว; `BlogPages` เพิ่ม explicit `../landing/landing.css` ก่อน `blog.css` เพราะ Admin โหลด Blog article โดยไม่มี `LandingPage` ใน route graph และ `LandingChrome` ไม่มี stylesheet ของตัวเอง. ลำดับนี้คง base/reset/header/footer styles ก่อน blog-specific overrides.

ย้ายเฉพาะ ownership ของ theme reference และระบุ stylesheet dependency ให้ตรงกับ consumer. About/Blog pages, CSS rules, content, route, local mock/store behavior และ Auth/Admin business logic ยังอยู่ที่เดิม; ไม่มี API integration หรือ feature change. การแยกหน้าเข้า apps ยังรอการตัดสินใจเรื่อง legacy root และ consumers ที่ Web/Admin ใช้ร่วมกัน.

## ตรวจสอบ

- `npm.cmd run typecheck` — Web, Admin และ legacy ผ่าน.
- `npm.cmd test` — 93/93 ผ่าน.
- `npm.cmd run check:boundaries`, `npm.cmd run tokens:check`, `git diff --check` — ผ่าน.
- `npm.cmd run build` — Web และ Admin production builds ผ่าน (`BUILD_EXIT=0`); คำเตือน `use client` และ chunk size มาจาก dependencies/bundle เดิม.
- หลัง consumer decoupling: `npm.cmd run typecheck`, `npm.cmd test` (93/93), `npm.cmd run check:boundaries`, `npm.cmd run tokens:check`, Web/Admin production builds และ `git diff --check` ผ่าน.
- Push checkpoint `19264f3` ผ่าน GitHub CI ทุก job: [run 37746448045](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37746448045).
- Browser spot-check: Web `/about`, `/about#our-story`, `/articles`; Admin `/admin/articles` และ `/articles/post-better-writing` แสดงเนื้อหาหลัก. อ่านอย่างเดียว; ไม่แก้/ลบ/เผยแพร่บทความ.
- หลัง decoupling เปิด Admin `/articles/post-better-writing` โดยตรงและตรวจ header, article, related links, footer ที่ desktop; ที่ 390×844 ตรวจบทความกับ mobile menu/drawer และลิงก์เมนู. ไม่กด action ที่เปลี่ยนข้อมูล; viewport override และ temporary tab ถูกปิดหลังตรวจ.
- ไม่รัน Docker.

นี่เป็น **theme ownership/consumer preparation** เท่านั้น; R5 page/API migration และ responsive/accessibility acceptance เต็มรูปแบบยังไม่ปิด.
