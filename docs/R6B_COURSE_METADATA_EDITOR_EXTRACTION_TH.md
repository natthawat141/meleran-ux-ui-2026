# R6b — Extract controlled Course Metadata Editor UI

อัปเดต 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

ย้าย controlled form UI `CourseMetadataEditor` จาก legacy source ไป `packages/course-authoring` และเปิด public entrypoint `@melearn/course-authoring` หลักฐาน R0/R2a แสดงว่า Web และ Admin ใช้ `CourseEditorPage` host เดียวกันผ่าน route ของแต่ละแอป และ editor UI รับ form/draft, capabilities, callbacks, image upload และ status tag จาก host อยู่แล้ว จึง extract เฉพาะ seam นี้ได้โดยไม่ย้าย business workflow ทั้งก้อน

`CourseEditorPage` ยังเป็น legacy host และเป็นเจ้าของ `useLms`, role/capabilities, record loading, save/persistence, submit-for-review/publish, Admin AI settings, result messages และ React Router navigation ทั้งสองแอปยังเข้าถึง host ผ่าน `@legacy`; การย้ายครั้งนี้ไม่ทำให้ R6 เสร็จ

## ขอบเขต package

- Public API: `CourseMetadataEditor`, `CourseMetadataEditorProps`, `CourseMetadataFormValues`.
- รับ `FormInstance`, initial values, สถานะ/สิทธิ์ที่ host คำนวณแล้ว และ callbacks; ไม่มี import store, router, API, legacy source หรือ app.
- Web/Admin เพิ่ม workspace dependency และ TypeScript paths/includes; package ใช้ React/Ant Design เป็น peer dependencies.
- เพิ่ม package boundary check เพื่อป้องกัน dependency กลับเข้า `@legacy`, `apps/web` หรือ `apps/admin`; regression test ยืนยัน host ยังคุม persistence/navigation/capability actions.
- `packages/course-authoring` มีเฉพาะ controlled metadata form core ใน checkpoint นี้; ห้ามนับ Curriculum, Chapter, Content, Quiz, Course Editor host หรือ Course Approval API ว่าย้ายแล้ว.

## ผลตรวจ

- `npm.cmd install --ignore-scripts --offline` — link workspace package สำเร็จโดยไม่ดึง dependency ใหม่.
- `npm.cmd run typecheck` — ผ่าน Web, Admin และ legacy.
- `npm.cmd test -- --test-reporter=dot` — ผ่าน 95 tests.
- `npm.cmd run check:boundaries` — ผ่าน.
- `npm.cmd run build:web` — ผ่าน; 37.41 วินาที.
- `npm.cmd run build:admin` — ผ่าน; 37.52 วินาที.
- ทั้งสอง build ยังแสดง third-party `use client` directive และ chunk-size warnings; มี asset reference warning เดิมฝั่ง Web. ไม่มี browser visual acceptance ในรอบนี้.

ขั้นถัดไปของ R6 คือย้าย app-specific host/orchestration และแยก dependency ของ Curriculum/Chapter/Content/Quiz โดยคง URL/พฤติกรรมเดิม; API mutations, server authorization และ conflict handling รอ Backend-confirmed contract.
