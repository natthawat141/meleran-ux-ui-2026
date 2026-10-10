# Catalog query review — D16 เฉพาะ CATALOG-01

สถานะ: **PROPOSED — รอคำตอบผู้ใช้เฉพาะพฤติกรรมค้นหา/เรียงลำดับ**. 11 ตุลาคม 2026.

แหล่งอ้างอิง: Scope Final 1.6 §course.read_public, canonical OpenAPI `get_courses` / `get_courses_id` (ตรวจ operationId ใน subset ก่อนลงมือ), Flow AB §8.2–8.3 และ DECISIONS.md D16. Contract version `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3`.

## Confirmed / HTTP Draft ที่ต้องรักษา

- เปิดเฉพาะ Published; Guest อ่านได้. Summary/detail เปิดเฉพาะ canonical fields; ไม่มีเนื้อหาบทเรียน เฉลย หรือ private account fields.
- รายการตอบ `{items,next_cursor}`; detail ใช้ course ID; query เดิม `q,category,level,price_type,limit,cursor`.
- `limit` ค่าเริ่มต้น 20, ช่วง 1–50 ตาม canonical; free price เป็น null; Money เป็น THB amount_minor integer.

## ข้อเสนอที่ตรวจได้

1. `q`: ค้นหาชื่อคอร์สแบบมีข้อความนั้นอยู่ในชื่อ ไม่แยกตัวพิมพ์เล็ก/ใหญ่; ตัด whitespace ที่หัว/ท้าย. ไม่ค้นข้อมูลผู้ใช้/คำตอบ/บทเรียนส่วนตัว.
2. เรียง `published_at DESC, id ASC`; tie-breaker ทำให้ลำดับ deterministic. category/level จับค่าตรงกัน; price_type free/paid ตามชนิดราคาที่ server เก็บ.
3. Unknown/repeated query และ limit ที่ผิดรูป/เกินช่วง → 422 validation_failed. ไม่ clamp หรือแปลง invalid number เงียบ ๆ.
4. Cursor เป็น opaque string แบบ versioned keyset; ผูกกับ normalized filters/limit และ server signature. ไม่เปิด offset contract ให้ Frontend พึ่งพา.
5. **เสนอไม่มี time-based expiry สำหรับ public Catalog cursor ใน V1**; invalid signature/version/filter mismatch → 422. ไม่รับประกัน snapshot คงเดิมระหว่างหลายหน้าเมื่อมีคอร์สเผยแพร่/แก้ไขเพิ่ม.
6. Nonpublished/unknown course IDs → 404 แบบเดียวกัน. Outline มีเฉพาะ id/title/type และเรียงตาม position.

## Verification หลังได้รับคำตอบ

- Seed เฉพาะ Test PostgreSQL: published/draft/approved, วันที่เท่ากัน, free/paid, title/case/Thai fixtures.
- Contract checks serialized success/errors, nested fields และ private field leakage.
- Multi-page no duplicates, repeated/unknown query, malformed number, modified cursor/filter mismatch, hidden course ID.
- Restart/read-back; read endpoints ต้องไม่สร้าง Account/Enrollment/Progress.
- Frontend remote Catalog → local Nest → Test PostgreSQL; API failure ต้องแสดง error ไม่ fallback mock.

การเลือกนี้ปิดเฉพาะ D16 Catalog; Management/AI/Blog query และ PII review ยังเปิดอยู่. ไม่มี canonical change ในเอกสารนี้.
