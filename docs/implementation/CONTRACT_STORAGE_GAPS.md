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

## COURSE-02 / REVIEW-01 — authoring read/write prerequisites

ตรวจ source บน `a588dd2f40de7b0ac55dbf93cd989681d5504030`; schema ยังมี 27 models / 9 migration batches. ตารางนี้เป็น storage facts และ proposed next actions ไม่เพิ่ม business rules.

| Contract / source | Confirmed storage fact | Next action / existing decision |
| --- | --- | --- |
| `AuthoringCourseDto.published_by` required-nullable | Course มี `publishedAt` แต่ไม่มี publisher field | เสนอ nullable actor FK ผ่าน Schema Owner; unknown legacy actor ต้องคง unknown ห้ามใช้ creator/current Instructor/reviewer แทนผู้เผยแพร่. การบันทึก publish action อยู่ TX-COURSE/D04; ยังไม่สร้าง migration หรือ writer |
| `AuthoringCourseDto.created_by` required string | ninth batch มี immutable nullable `createdBy`; legacy creator ไม่ทราบจริง | fresh create ต้องบันทึก actor; legacy read ยังคืน required string ไม่ได้อย่างซื่อสัตย์. ต้องปิด compatibility handling/contract change สำหรับ legacy ก่อนเปิด full authoring read; ห้าม empty string/เดา owner/backfill |
| `AuthoringCourseDto` / `AuthoringPreview.revision` integer >=1 | Course revision default0; reviewed physical schema ยังยอมรับ0 | writer/read convention ต้อง review ใน D04; ห้ามแอบบวก1 หรือ rewrite stored historical revisions จาก reader |
| `AuthoringItemWrite.body`, `description`, `duration`, `reading_minutes`; `AuthoringChapterWrite.description` | CourseItem เก็บ title/type/position/contentDoc/videoUrl/revision; CourseChapter เก็บ title/position แต่ไม่มี plain/optional metadata เหล่านี้ | เสนอ independent nullable columns ตาม provided write fields; ปิด omitted/null/replace และ plain-vs-rich rule ใน D04/D05 ก่อน authoring. ห้ามทิ้ง supplied fields หรือสร้าง body/reading time จาก JSON ด้วยสูตรที่ไม่ได้ตกลง |
| `ReviewDetail.course`, Scope §4.6/§5.2, C07 | CourseReview เก็บ submittedRevision/actor/time/decision/reason แต่ไม่มี submitted-content payload | Confirmed: ตรวจ same revision, รักษาประวัติ และไม่อนุมัติฉบับใหม่เงียบ ๆ. **Proposed**: bounded submitted payload สำหรับ review หรือ version-aware current read พร้อม stale handling; D04 ต้องระบุว่า detail ของ review เก่าจะแสดงอะไร. Scope §4.6 ไม่บังคับ full course-version system จึงไม่ถือ full snapshot เป็น requirement ที่อนุมัติแล้ว |

Affected operations: `get_courses_id_authoring`, `patch_courses_id`, `get_courses_id_authoring-preview`, `post_courses_id_submit-review`, `get_admin_course-reviews_id` และ create/publish callers ของ `AuthoringCourseDto`. Preview ไม่ต้องส่ง creator/publisher แต่ยังต้องมี truthful revision/content/history projection; ห้ามใช้ปัญหา full DTO เป็นเหตุให้เดาฟิลด์ของ Preview.

Next execution order: ปิด D04/D05 conventions ที่เกี่ยวข้อง → Lead review additive physical delta + isolated Test PostgreSQL upgrade/rollback → implement current authoring/preview readers and aggregate writer → submit/review revision races → full G-COURSE. Course/Auth prerequisites และ D09 image protocol ยังแยกเปิดอยู่. ไม่มี endpoint/schema/contract change ใน audit นี้ และไม่เพิ่มจำนวน verified operations หรือ acceptance.
