# ช่องว่างจากการเทียบ HTTP Draft กับ storage จริง

ตรวจ 11 ต.ค. 2026; canonical 1.0.0-draft.1 / SHA256
c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3.
ข้อเท็จจริงด้าน implementation ไม่เปลี่ยน Scope หรือ freeze Draft.

## BLOG-01 / BLOG-02 — ยังสร้าง detail ที่ตรง contract ไม่ได้

| Canonical field | Storage ที่พบ | สิ่งที่ต้องปิด |
| --- | --- | --- |
| `content` (string, required) | ไม่มี; มีเฉพาะ `contentDoc` JSONB | เก็บ plain content ตาม write contract; ตกลงความสัมพันธ์กับ rich document ใน D05 ห้ามแปลง JSON เป็นข้อความด้วยสูตรเดา |
| `category` (string, required ใน response) | ไม่มี | CreateRequest อนุญาต omitted category แต่ response บังคับ; ต้องตกลง default หรือปรับ Draft อย่างได้รับอนุมัติ |
| `reading_minutes` (number, required) | ไม่มี และ write request ไม่มีฟิลด์นี้ | ต้องตกลง server-derived algorithm/source; ห้ามตั้งค่าคงที่หรือเดาความเร็วอ่าน |
| `content_doc` (JsonValue รวม null) | Prisma `contentDoc Json` NOT NULL | ต้อง review JSON null/SQL null และ omitted-on-create policy ก่อน authoring; public projection ต้องรักษา wire null ตาม canonical |

DB-05 DONE หมายถึง physical batch ที่ตรวจแล้ว ไม่ใช่ storage design ทั้ง Blog
ผ่าน HTTP gate แล้ว. ยังไม่เปิด `GET /blog/{slug}` ที่คืนข้อมูลปลอมหรือไม่ครบ.
งานนี้ไม่เพิ่ม endpoint/library/schema/migration. เพิ่ม physical delta ผ่าน Lead
หลังปิด authoring/projection decisions ที่เกี่ยวข้องใน D05/D16 แล้วเท่านั้น.

## CATALOG-02 — normalized Instructor grant

`GET /instructors/{id}` ใช้ `UserRole` Instructor grant ที่ DB-02 เตรียมไว้
และคืนเฉพาะ id/display_name/avatar_url/bio. ไม่บังคับว่าต้องมีคอร์ส เพราะ Scope
ไม่ได้กำหนดเงื่อนไขนั้น. ไม่แปลง compatibility role string เป็น grant เงียบ ๆ.
Auth/Management writers ยังต้อง cut over ตาม AUTH-BASE-01/MGMT-02; fixtures
ใน component tests สร้าง normalized grants อย่างชัดเจน. Profile storage ยังคง
เป็น compatibility JSON; public scalar bio เท่านั้นที่ออก HTTP.
