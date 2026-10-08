# R3d — แยก RichDocument เป็น shared UI primitive

วันที่ 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## ผลที่ทำ

ย้าย renderer `RichDocument`, `RichTextNode` และ `textDocument` จาก `src/components/chapter/RichTextEditor.tsx` ไป `packages/ui/src/RichDocument.tsx` แล้ว export ผ่าน public entry ของ `@melearn/ui`. Consumer ที่อ่านเนื้อหาอย่างเดียวเปลี่ยนมา import จาก shared UI โดยตรง จึงไม่ต้องโหลดโมดูล editor ที่นำ Tiptap, image upload และ FileReader เข้ามาด้วย

ตัว editor ยังอยู่กับ app/legacy เดิม ไม่ได้ย้าย editor, course-authoring workflow หรือ business data ไป package. Consumer ที่มีทั้ง preview และ editor แยก import renderer กับ editor คนละ entry ตามหน้าที่เดิม

## ขอบเขตและสิ่งที่รักษาไว้

- คง tag ที่รองรับ, `chapter-rich-document`, `rich-figure-*`, `text-highlight`, plain-text fallback และ image alignment เดิม
- คง allowlist URL ของ link/image และไม่ใช้ `dangerouslySetInnerHTML`
- ไม่เปลี่ยน DTO, content schema, API, permission, editor/save behavior หรือ route
- shared renderer import เพียง React; ไม่ import app/store, Tiptap, upload component หรือ file reader

## หลักฐานตรวจ

- Focused renderer/security tests: 7/7 ผ่าน; ทดสอบ plain text/empty line, block nodes, mark order, URL ที่อนุญาต และ URL scheme ที่ต้องปฏิเสธ
- `npm.cmd test`: 93/93 ผ่าน
- `npm.cmd run typecheck`: Web, Admin และ legacy ผ่าน
- `npm.cmd run check:boundaries`: ผ่าน
- `npm.cmd run build`: Web และ Admin ผ่าน
- `git diff --check`: ผ่าน
- เปรียบเทียบ implementation ที่ย้ายกับ baseline `HEAD` แล้ว function body/type/helper ตรงกัน

คำเตือน build เรื่อง `use client` และ chunk เกิน 500 kB เป็นคำเตือนเดิม ไม่ใช่ failure. ชุดนี้เป็น structural/shared UI gate เท่านั้น ไม่ได้ปิด visual/accessibility acceptance หรือ R5–R13
