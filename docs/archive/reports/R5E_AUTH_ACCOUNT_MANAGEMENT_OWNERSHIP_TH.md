# R5e — สรุปการย้าย Auth, Profile, Access Codes และ Blog เข้า App Ownership

อัปเดต 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

งานชุดนี้ปิดเฟส R5 (App & Page Ownership) อย่างสมบูรณ์ โดยย้ายหน้าจอและฟอร์มที่ยังตกค้างอยู่ใน root `src/pages` เข้าสู่ `apps/web` และ `apps/admin` ตามเจ้าของจริง รักษา URL, Route Guards, ฟังก์ชัน และ demo behavior เดิมไว้ทั้งหมด พร้อมทั้งปลด stylesheet และ Chrome bridge ของ Blog ออกจาก legacy root

## สิ่งที่ย้ายในรอบนี้

| เจ้าของ | หน้า/คอมโพเนนต์ | ตำแหน่งใหม่ | หมายเหตุ |
| --- | --- | --- | --- |
| Admin | `/admin/access-codes` | `apps/admin/src/features/management/pages/AccessCodesPage.tsx` | ย้ายพร้อม `access-codes.css` ถอนจาก `src/pages/admin/` |
| Web & Admin | `ProfileSettings` form (`/account/profile`) | `apps/web/src/features/account/components/ProfileSettings.tsx`<br>`apps/admin/src/features/account/components/ProfileSettings.tsx` | แยกคอมโพเนนต์ฟอร์มและ `profile-settings.css` ประจำแต่ละแอป ถอนจาก `src/pages/learner/` |
| Web | `/login`, `/register`, `/verify-email`, Demo Account | `apps/web/src/features/auth/pages/AuthPages.tsx` | รองรับทั้งผู้เรียนและผู้สอน ใช้ Shared UI primitives (`@melearn/ui`) |
| Admin | `/login` (audience admin), `/verify-email`, Demo Account | `apps/admin/src/features/auth/pages/AuthPages.tsx` | ตัด Register link คงเฉพาะการเข้าสู่ระบบสำหรับ Admin |
| Web & Admin | `blog.css` | `apps/web/src/features/blog/pages/blog.css`<br>`apps/admin/src/features/blog/pages/blog.css` | แยกสไตล์ Blog เข้าแต่ละแอป ลบ `src/pages/blog/blog.css` |
| Admin | `/articles/:id` (Article Preview) | `apps/admin/src/features/blog/pages/BlogArticlePreviewPage.tsx` | ปลด `LandingChrome` และ `landing.css` เปลี่ยนมาใช้ `WorkspaceShell` ของ Admin |

## ไฟล์ที่ถอนออกจาก root legacy

- `src/pages/AuthPages.tsx` (ลบแล้ว)
- `src/pages/admin/AccessCodesPage.tsx` และ `access-codes.css` (โฟลเดอร์ `src/pages/admin/` ว่างลงและถูกถอนหมด)
- `src/pages/learner/ProfileSettings.tsx` และ `profile-settings.css` (ลบแล้ว)
- `src/pages/blog/blog.css` (โฟลเดอร์ `src/pages/blog/` ถูกถอนหมด)

## Compatibility Bridge ที่ยังคงอยู่

- ยังคงใช้ `@legacy/store` (`useLms`), `@legacy/data`, `@legacy/types` เป็น in-memory demo state bridge จนกว่าจะเชื่อมต่อ API ในเฟส R4b
- เส้นทางและ guards ทั้งหมดยังคงสอดคล้องกับ `ROUTE_MIGRATION_LEDGER_TH.md`

## หลักฐานการตรวจ (Verification Evidence)

- `npm.cmd run typecheck` — ผ่านทุกโปรเจกต์ (`@melearn/web`, `@melearn/admin`, และ legacy)
- `npm.cmd run check:boundaries` — ผ่าน App/package dependency direction และ route ownership checks ทั้งหมด
- `node --test` — ผ่าน 100/100 tests (รวม router access behavior, route ownership checks และ architecture invariants)
- `npm.cmd run build:web` — ผ่าน (Vite 35.17 วินาที)
- `npm.cmd run build:admin` — ผ่าน (Vite 32.73 วินาที)
