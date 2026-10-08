# รายงาน R3c — แยก Route Modules ของ Web/Admin

วันที่ 7 ตุลาคม 2026 · Branch `refactor/v1-api-ready` · baseline ก่อนงาน `afa2d6f25e6aa5555499ea9f506bc1701abe2e50`

## ผลที่ทำ

แยก route declarations ออกจาก `App.tsx` ตามขอบเขตของแต่ละแอป โดยคง URL, feature wrapper, element, ลำดับ route, guard และการเป็นเจ้าของ route ตาม R3b:

- Web: `apps/web/src/app/router/` แยก Public, Auth, Learner, Instructor และ System routes; `access.tsx` รวม wrapper สำหรับ Public/role/email verification/ownership
- Admin: `apps/admin/src/app/router/` แยก Entry, Management, Authoring และ System routes; `access.tsx` คง Admin UX guard
- `apps/web/src/App.tsx` และ `apps/admin/src/App.tsx` เหลือเรียก router ของแอปตนเอง

นี่เป็นการจัด route boundary ไม่ใช่การย้ายหน้าและ business implementation ออกจาก compatibility layer: pages, shell, store และ types ส่วนใหญ่ยังมาจาก `@legacy/*`; โฟลเดอร์ `layouts/` และ `features/` จะเกิดเมื่อย้าย slice ที่เกี่ยวข้องตาม phase ต่อไป ไม่มีการแก้ UI, CSS, state, feature registry, API contract หรือ business behavior ใน R3c

## หลักฐาน route และ access

`tests/fixtures/r3c-routes.json` บันทึก route declarations จาก baseline R3b ไว้ตายตัว ไม่สร้าง expected snapshot จาก source ปัจจุบันระหว่าง test. Route inventory checker ใน `scripts/lib/app-route-inventory.mjs` เป็น static scanner ที่รองรับ named imports, JSX fragments และ composition functions รูปแบบปัจจุบัน; มันสกัด declarations จาก source แต่ไม่ได้ render React route tree จึงอาจไม่เห็นเงื่อนไข runtime ที่ซ่อน route ไว้ รอบ final review ของ R3c ได้ตรวจ runtime composition เทียบ baseline เพิ่มและไม่พบความต่าง; ก่อนใช้ checker เป็นหลักประกันในการเปลี่ยน composition รูปแบบอื่น ให้เพิ่ม runtime-composition regression test หรือให้ scanner fail-closed กับ syntax ที่ไม่รองรับ. การตรวจ snapshot ปัจจุบันครอบคลุม:

- Web 50 routes และ Admin 35 routes เทียบ URL, feature key, element declaration และลำดับ
- route ที่มี feature key ยังอยู่ใน feature release registry
- route ownership ของ `/teach/...` ฝั่ง Instructor ใน Web, route Admin `/admin/...`, และ Admin legacy `/teach/*` compatibility target
- login return path ที่เก็บ pathname/query/hash, role denial, Instructor เข้า learner flow, email-verification gates, ownership context, Admin guard และ standalone AI wrapper

Admin legacy compatibility resolver และ allowlist ไม่ได้เปลี่ยนในชุดนี้; unit tests เดิมยังตรวจ query/hash/ID encoding และปฏิเสธ Instructor grading/review paths ที่ไม่ใช่ของ Admin

## การตรวจที่รันจาก working tree

| คำสั่ง/การตรวจ | ผล |
| --- | --- |
| `npm.cmd run typecheck` | ผ่าน Web, Admin และ legacy root |
| `npm.cmd test` | ผ่าน 67/67 tests |
| `npm.cmd run check:boundaries` | ผ่าน app/package dependency direction และ route ownership |
| `npm.cmd run build` | ผ่าน Web และ Admin production builds พร้อม token check |
| Web/Admin build ด้วย `--mode preview` | ผ่านทั้งสองแอป |
| `git diff --check` | ผ่าน |

Build ยังรายงาน third-party module `use client` directives ที่ bundler เพิกเฉย และ bundle บางก้อนใหญ่กว่า 500 kB; build exit code เป็น 0 จึงเป็น warning ที่บันทึกไว้ ไม่ใช่ R3c failure

คำสั่งที่ใช้เปิด preview จาก monorepo root (รัน build สองคำสั่งก่อน แล้วเปิด preview สองคำสั่งในคนละ terminal):

```powershell
npm.cmd run build --workspace @melearn/web -- --mode preview
npm.cmd run build --workspace @melearn/admin -- --mode preview
npm.cmd run preview --workspace @melearn/web -- --outDir ../../dist/web --port 4173 --strictPort
npm.cmd run preview --workspace @melearn/admin -- --outDir ../../dist/admin --port 4174 --strictPort
```

## Preview ที่เห็นจริง

เปิด built preview ด้วย `--mode preview` และตรวจใน browser ที่ viewport ประมาณ 860 × 768:

Preview mode ใช้เปิด prototype/integration routes ตาม `FEATURE_RELEASE_MATRIX.md`; default Production build ยังคง fail-closed route gate สำหรับฟีเจอร์ที่ยังเป็น `prototype`. การเปิดหน้าใน preview จึงไม่ใช่การเปลี่ยนสถานะ release หรือหลักฐานว่า backend พร้อม

- Web Landing แสดง hero, CTA, course cards, Blog, FAQ และ footer; ภาพที่เห็นใช้แบรนด์/โทนสีที่กำหนดและไม่มี route error
- Catalog และ Course detail เปิด direct URL ได้ เนื้อหา/ผู้สอน/รายการบท/ราคาและทางเข้า login ปรากฏ; เปิด detail แล้วกดย้อนกลับกลับ Catalog ได้
- Blog index/article, Instructor public profile, About, Login และ Register render ข้อมูลในหน้าจอ
- `/learn` และ `/teach/courses` ที่ไม่มี session พาไป Login พร้อมเก็บ `next`; Admin `/admin` พาไป Admin login พร้อม `next=/admin`

การตรวจใน R3c รอบแรกไม่ได้เปลี่ยนหรือล้าง browser session/localStorage เพื่อจำลองบทบาท จึงยังไม่ได้เปิดหน้าหลัง login ของ Learner, Instructor หรือ Admin ในรอบนั้น; การ spot-check authenticated screens ด้วย demo account ที่ทำต่อภายหลัง พร้อมผลตรวจ responsive/accessibility ที่ยังค้างและ API limitations อยู่ใน [FRONTEND_V1_6_UI_AUDIT_TH.md](../../FRONTEND_V1_6_UI_AUDIT_TH.md)

## ขั้นถัดไป

R3c structural gate ผ่าน และ route modules เป็นจุดเริ่มสำหรับการย้าย owner ต่อไป; ยังไม่เริ่ม R4b hooks จนกว่า R4a จะตกลง contract ต่อ flow กับผู้รับผิดชอบ backend. Functional gaps ที่พบใน prototype อยู่ใน audit แยก ไม่ถูกรวมเข้ากับ route extraction หรือเปลี่ยนเงียบ ๆ ในชุดนี้
