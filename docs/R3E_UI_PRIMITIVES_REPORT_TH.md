# R3e — ย้าย form primitives เข้า shared UI package

วันที่ 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## ขอบเขต

ย้าย UI primitives ที่หน้า Auth ใช้จาก `src/components/ui/` เข้า `packages/ui/src/primitives/` ได้แก่ Alert, Button, Field, Input, Label และ Separator พร้อม public exports จาก `@melearn/ui` และประกาศ peer dependencies ที่ package ใช้ (`@base-ui/react`, `class-variance-authority`, `cn`, React และ theme libraries ที่มีอยู่เดิม) ใน manifest ของ package และ lockfile

`src/pages/AuthPages.tsx` เปลี่ยนเฉพาะ imports ของ primitives ให้ใช้ `@melearn/ui`. การค้นหา import ก่อนย้ายพบ consumers เฉพาะใน AuthPages จึงย้ายทั้งหกไฟล์และไม่เหลือ legacy shim ที่ไม่มีผู้ใช้

## สิ่งที่คงเดิม

- JSX และ implementation ของ primitives ย้ายโดยไม่แก้ behavior หรือ class definitions; Tailwind source scan ของ Web/Admin มี `packages/ui/src` อยู่แล้ว.
- AuthPages ยังเป็น legacy host และยังใช้ `useLms`, browser-local demo accounts, verification mock และ Google mock ตามเดิม; ไม่ย้าย Auth business logic เข้า shared package.
- ไม่มี endpoint, DTO, credential/session policy, Query hook หรือ API fallback ถูกสร้างเพิ่ม; Auth และ R5 functional acceptance ยังรอ R4a contract.
- ไม่เปลี่ยน route, copy, theme tokens, CSS import order หรือหน้าตาโดยตั้งใจ.

## ตรวจสอบ

- `npm.cmd run typecheck` — Web, Admin และ legacy ผ่าน.
- `npm.cmd test` — 93/93 ผ่าน.
- `npm.cmd run check:boundaries` และ `npm.cmd run tokens:check` — ผ่าน.
- `npm.cmd run build` — Web และ Admin production builds ผ่าน (`BUILD_EXIT=0`); มีคำเตือน `use client` จาก dependencies และ chunk ใหญ่เหมือนเดิม.
- `git diff --check` — ผ่าน.
- Browser: Admin `/login` แสดง form และข้อความชัดเจนว่ายังเป็น prototype/local demo; ไม่ส่งฟอร์ม. Web preview ที่ `127.0.0.1:5173` ถูก browser block (`ERR_BLOCKED_BY_CLIENT`) จึงไม่มี Web browser-render evidence ใน slice นี้; Web typecheck/build ผ่าน.
- ไม่รัน Docker ตามคำสั่งผู้ใช้.

## ผลต่อแผน

ปิดเฉพาะ R3e shared-UI ownership/import boundary ใน local checks. ไม่ได้ย้าย Auth pages/routes/store และไม่ปิด R5, API acceptance หรือ R13. ขั้นถัดไปยังต้องเลือก R5 structural slices ที่ไม่เปลี่ยน behaviorได้ ส่วน Auth ที่ต่อ server ต้องรอ contract ของ Backend.
