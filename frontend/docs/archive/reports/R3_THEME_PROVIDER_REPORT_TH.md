# รายงาน R3a — รวม Theme และ UI Provider

วันที่ 7 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## เป้าหมาย

รวมการตั้งค่า Mantine/Ant Design ที่ซ้ำกันใน Web กับ Admin ให้เป็นจุดเดียวใน `packages/ui` โดยคง theme values, locale, light default, provider order, CSS import order, URLs และพฤติกรรมหน้าเดิม งานนี้เป็น structural migration; ไม่เปลี่ยน feature, route หรือ business rule

## สิ่งที่เปลี่ยน

- ย้าย Mantine `appTheme`, light/dark color mode tokens และ default mode จาก `src/theme.ts` ไป `packages/ui/src/theme.ts`; `src/theme.ts` คง compatibility re-export ระหว่างทยอยย้าย legacy source
- เพิ่ม `MelearnUiProvider` ใน `packages/ui` เพื่อรวม MantineProvider, Ant ConfigProvider พร้อม locale ไทย และ Ant App context
- ปรับ `apps/web/src/main.tsx`, `apps/admin/src/main.tsx` และ legacy `src/main.tsx` ให้ใช้ provider กลาง แอปยังเป็นเจ้าของ `BrowserRouter` และ `LmsProvider`
- ลงทะเบียน Ant Design เป็น peer dependency ของ `@melearn/ui` และ sync `package-lock.json`

GPT-6.1 Sol review แบบ read-only ก่อนเริ่ม แนะนำให้รวม provider และ TypeScript theme ก่อน แล้วแยก CSS/Tailwind token consolidation กับ route extraction เป็นชุดถัดไป เพื่อลดความเสี่ยงกับ CSS cascade และ URL behavior

## ผลตรวจ

- `npm.cmd run typecheck` ผ่าน Web, Admin และ legacy source
- `npm.cmd run build` ผ่านทั้ง Web และ Admin
- Build แสดง Vite warnings ว่า dependency บางตัวมี `"use client"` directives ที่ถูก ignore และมี bundle chunks ใหญ่กว่า 500 kB; build exit code 0
- ยังไม่ได้ตรวจ browser visual QA จึงไม่ยืนยัน pixel-level equivalence หรือ responsive appearance จาก build เพียงอย่างเดียว
- ไม่ได้รัน test suite ในชุดนี้

## ขอบเขตที่ยังค้างใน R3

- R3b: รวม CSS variables, Tailwind semantic tokens และ adapters ให้ใช้ token source กลาง โดยรักษา Landing profile ที่มี scope เฉพาะ
- R3c: แยก route modules/layouts/guards ตามพื้นที่ผู้ใช้ พร้อมคง URL, redirects, query/hash, no-access behavior และ admin compatibility จาก route ledger
- Browser visual QA ของ R2b ยังเป็นรายการค้าง; ต้องบันทึกหน้าที่เปิดและผลที่ตรวจจริงก่อนอ้างว่า UX ผ่าน

การเปลี่ยนครั้งนี้ไม่ได้เชื่อม API จริง และไม่ได้ประกาศว่า Web/Admin พร้อม Production
