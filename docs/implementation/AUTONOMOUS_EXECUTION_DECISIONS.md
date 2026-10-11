# Execution decisions under renewed authorization — 2026-10-11

ผู้ใช้อนุญาตให้เดิน Wave 1–17 ต่อ เลือกรายละเอียดที่ยังค้างและบันทึกให้แก้ภายหลังได้ ไม่รอคำตอบเฉย ๆ การอนุญาตนี้แทนเงื่อนไขรอผู้ใช้เลือกข้อเสนอในเอกสาร planning เดิมเฉพาะงานที่อยู่ใน Scope ไม่มี STG/deploy/new instance/live migration/force push และไม่เปลี่ยนกติกาที่ Scope ยืนยันแล้ว

## Confirmed instructions

- ทำคนเดียวต่อจาก fullstack checkout; schema/migration owner คือ Lead
- เลือก protocol/implementation details ได้พร้อมเหตุผล; external capability ที่ยังไม่มีให้ PENDING เฉพาะจุด
- HTTP paths/shapes ปัจจุบันคงเดิม; การเพิ่ม provider protocol ใช้ contract delta ที่ติดตามแยก
- Technical/component evidence ไม่ใช่การตรวจรับ 113 cases ทั้งหมด

## Management history / D16 and PAY-02 execution choices

MGMT-03/04: canonical roster has one Enrollment/course per row; current curriculum completion percentage rounds for display; historical certificates/Attempt snapshots remain immutable. Fresh scoped Instructor/Admin authority, RepeatableRead and existing signed keysets apply. Assessments exposes a trusted scoped ManagedAttemptReader, retaining existing single owner detail semantics.

PAY-02 prior protocol wait is overridden by renewed user permission to decide: retain Draft.2 string shape, missing checkout session is empty string meaning unallocated; receipt outcome is persisted processing state, never invented fulfilled/refund success. Both choices are reversible through a coordinated future contract revision. No Stripe read/retry/grant. Details, constraints and evidence: [MANAGEMENT_HISTORY_COMPONENT.md](MANAGEMENT_HISTORY_COMPONENT.md).

## Agent decisions: D16 read flows

เลือกข้อเสนอ Catalog ใน CATALOG_QUERY_REVIEW.md: title contains แบบไม่สนตัวพิมพ์, trim q, exact category/level, free คือ null/0, paid >0; Published และ published_at เท่านั้น; sort published_at DESC,id ASC. Instructor courses ใช้ขอบเขต Instructor ที่มี normalized role และ Published เท่านั้น

ใช้ opaque versioned keyset cursor signed ด้วย HMAC-SHA256 และ key แยก CURSOR_SIGNING_SECRET; bind route/filter/limit/current owner. ไม่มี time expiry; key rotation ทำให้ cursor เดิม invalid. Public fields ตาม canonical เท่านั้น ไม่มี snapshot guarantee ข้ามหน้า. Reject unknown/repeated query, malformed limit, invalid/tampered/mismatched cursor ด้วย 422; limit default20/1–50. Configuration secret ไม่ commit; test-only key ใช้ใน CI. Shared utility ใช้ร่วมเพราะหลาย feature ต้องรักษา wire pagination เดียวกัน

Own enrollments เรียง granted_at DESC,id ASC; นับ completed_items จาก current item Progress แทน compatibility counter. ส่งเฉพาะ Published courses เพื่อรักษา CourseSummary ที่ต้องมี published_at และ public visibility; historical certificates ยังอ่านได้เมื่อคอร์สเปลี่ยนสถานะ

Certificates เรียง issued_at DESC,id ASC; issue-time snapshots เท่านั้น. Redeem list เรียง issued_at DESC,id ASC; Admin เท่านั้น; code_masked แสดง prefix MLN- และท้าย4ตัว ไม่มี full secret (full code คืนเฉพาะ issuance)

## Agent decisions: MGMT-05

Counts คำนวณใน coherent read transaction: course_count ทุกคอร์สใน management scope; enrollment_count ทุก Enrollment ในขอบเขต; learner_count distinct accountId ของ Enrollment ในขอบเขต; pending_grading_count จำนวน attempts ที่ pending_review และยังมี written answer ที่ score เป็น null. Admin user_count ทุก Account และ pending_course_count คอร์ส pending_review; Instructor scope เฉพาะ instructorId ตนเองและไม่ส่ง Admin counters. ไม่เพิ่มผลเรียนหรือใช้ mock counters

## Agent decisions: resume optional input

PUT /learn/items/{id}/resume: omitted position_seconds รักษาค่าตำแหน่งเดิม (ไม่มีเดิมเป็น null), explicit null ล้างตำแหน่ง, 0 เป็นตำแหน่งจริง. Article/Quiz ส่งตำแหน่งตัวเลขไม่ได้; null/omitted ใช้ระบุรายการเรียนต่อล่าสุดได้. ทุกคำสั่งบันทึก server timestamp/order ใหม่ แต่ไม่ complete/grade/grant. Fresh Web learning eligibility + Published + own Enrollment; owner Instructor ใช้ Preview ไม่สร้างผลเรียน

## Agent decisions: AI-02 / AI-05 (D11/D16 subset)

History อยู่ใน scope เจ้าของแม้ Admin; search ชื่อหรือข้อความแบบ contains insensitive; sort activity DESC,id ASC. Messages เรียง position ASC และ cursor ผูก conversation/owner/limit; เอกสาร metadata ภายใน `contextSnapshot._wire` version1 ระบุ request_id/kind/status/completed_at/error_code โดยไม่ส่ง context/knowledge/private provider fields. ข้อมูลเก่าที่ไม่มี metadata ไม่เดา request/status และ fail closed; sender ใน AI-03 ต้องเขียน format นี้

Create ค่า title ที่ไม่ส่งใช้ “แชตใหม่”; course_id optional เป็น context ไม่ใช่ grant. หากระบุคอร์สต้องมีสิทธิ์อ่านและเปิด AI; Instructor owner/Admin ใช้ขอบเขตจัดการ ผู้เรียนต้องมี Published Enrollment และบัญชีพร้อมเรียน. General conversation ไม่สร้าง Prompt/usage

Delete เป็น owner-scoped tombstone แบบ repeat-safe 204; เก็บ quota และ finalized request dedupe ตาม FK ไม่ hard-delete/คืนโควตา; ไม่มี retention timer ที่คิดขึ้นเอง. Pending finalizer ใช้ lock Conversation เดียวกันและต้องไม่ทำให้ deleted chat กลับมาแสดง. Practice history คืนโจทย์เดิม; เฉลย/คำอธิบายเฉพาะข้อที่ตอบแล้ว; topic_id ใช้ persisted Practice id ไม่เรียก provider ใหม่

## Agent decisions: MGMT-01 / MGMT-02 remaining operations

Admin user list ค้น display_name/username/email เท่านั้น (Admin permission), เรียง created_at DESC,id ASC; Instructor directory เรียง created_at DESC,id ASC แต่ส่งแค่ InstructorSummary. normalized UserRole เป็นสิทธิ์จริง ไม่ใช้ CSV role string. Create ตั้ง origin admin_created, Learner grant, email_verified=false, immutable created_by/created_at; Username hash ใช้ Auth owner/kernel เดิม. Optional email เป็น metadata สำหรับเพิ่ม/ยืนยันภายหลัง ไม่สร้าง Firebase credential หรือถือว่ายืนยันอัตโนมัติ. Display name stringไม่ว่าง, ไม่ normalize/ตัดข้อความ; email null/omitted→null, ที่ส่งต้องรูปแบบอีเมลไม่เกิน254และไม่มี whitespace; normalizedEmail uppercase สำหรับ unique lookup เดิม. Duplicate username/email→409. ไม่มี creation retry/idempotency key ที่ contract ไม่กำหนด

## Evidence

เพิ่มหลักฐานเฉพาะเมื่อ tests ผ่านจริงใน EXECUTION_STATUS และ task components; เอกสารนี้เป็น decision record ไม่ใช่คำอ้างว่าการ implement หรือ feature acceptance เสร็จแล้ว

## Agent decisions: D06 / COMPLETION-01

เปรียบเทียบผลที่ตรวจครบด้วยอัตรา earned/max (คำนวณ cross multiplication ด้วย Decimal ไม่ปัดเปอร์เซ็นต์) เมื่อคะแนนเต็มเปลี่ยนข้ามฉบับ; tieเลือก attempt numberที่น้อยกว่า/idตามลำดับเพื่อคงผลเดิม. ใช้เฉพาะ submitted + fully graded + ทุกคำตอบครบ; >70% เท่านั้น. ผลต่ำกว่า/รอตรวจภายหลังไม่ล้าง Progressที่เคยผ่าน. completion coordinatorล็อก Course SHARE → Enrollment UPDATE → Attempts SHARE; authoring/assessmentต้องใช้ลำดับเดียวกัน. snapshot version1เก็บ current item IDs/types/completed_at และ quiz attempt/result exact decimals ณ first completion. Certificateชื่อผู้เรียน/คอร์สและเวลาใช้ค่าจริง ณ transaction เดียว, unique Enrollment; รหัส opaque random, ไม่มี public issuance endpoint. ไม่สร้าง PDF/provider networkภายใน transaction. Historical completed Enrollmentรักษา snapshot/Certificateแม้เพิ่มหรือแก้เนื้อหา.

## Agent decisions: D04 authoring storage and create protocol

Lead append-only migration 20261011050000_course_authoring: nullable first publishedBy FK (immutable once known), Chapter.description, Item.body/description/duration/readingMinutes and nullable submitted Review JSON snapshot. ไม่มี backfill creator/publisher/เนื้อหาจาก mock; legacy NULL/revision0 ไม่ถูกแปลงเป็น authoring DTOที่โกหก. Fresh createใช้ revision1, actual actor/time, single normalized Instructor, Draft, ai_enabled=false, immutable UUID-derived slug; omitted metadata category/levelใช้ empty stringตาม Draft shape (ต้องครบพร้อมเรียนก่อน Publish), nullable fieldsnull/outcomes[]. Createไม่มี replay keyใน canonical จึงแต่ละคำสั่งที่สำเร็จสร้างคอร์สใหม่ ไม่ automatic retry. Signed management cursorsผูก actor/namespace/status; sortcreated_atDESC/idASC; management summariesไม่ส่ง answer keys/PII/Transcript content.

Schema checksum 5204bffa343645c2d14d589829d51d54e9fae2487f430ef6a6fc75f96134ec8b; apply/test เฉพาะ melearn_test, ยังไม่มีหลักฐาน featureAPIหรือProductionmigrationจากการเพิ่มstorage.

## Authoring/Preview read and storage conflict

Authoringอ่านเฉลยเฉพาะ owner/Admin ผ่าน queryแยกที่ scopeด้วย course_id; Previewไม่ selectcorrectKey และไม่ใช้required creatorที่ไม่มีในPreviewshape. ไม่ส่งTranscript/คำตอบผู้เรียน/โปรไฟล์ส่วนตัว. Own Progress historical metadataใช้RepeatableReadและkeysetgranted_atDESC/idASC; ทุกaudienceอ่านเฉพาะตน รวม archived, ไม่ grant content.

Money canonicalยังไม่มี max แต่ physical priceMinorเป็นInt; create rejectเกิน2147483647ด้วย422เพื่อไม่overflow. นี่คือagent-selected technical safeguardภายใต้สิทธิ์ล่าสุด มีcontract/storage gapที่ต้องแก้ด้วยtypeหรือcanonicaldeltaภายหลัง ไม่ใช่businessmaximumที่Scopeยืนยัน. reading_minutesต้องfinite/nonnegative.
# Local Login HTTP cutover — D01/D03 implementation safety

Agent-selected continuation under latest authorization: existing Username Login uses the tested LocalAuthenticationService/SessionWriter. Remove active prototype PBKDF2-1000/plain comparison and CSV-role issuance. Unsupported prototype hashes fail normally; no automatic credential conversion. Preserve canonical LoginRequest/Response, independent Web/Admin cookies, absolute12h lifetime, fresh normalized roles and hashed random server sessions. Cookie Secure is enabled in production; retain HttpOnly/SameSite Strict/path. Email identifiers return explicit503 provider_unavailable until Firebase credential branch is implemented; never verify Email locally or link by matching Email. This is a Username subset, not AUTH-01 completion or live Firebase evidence. No new route, dependency or migration.
# Blog continuation — D05/D11/D16 agent choices

Blog keeps canonical9 operations and Admin-only commands. Row UPDATE lock plus required positive expected_revision on PATCH/publish/unpublish/DELETE JSON; stale409 with no partial mutation. Every accepted mutation advances revision once, including same-state lifecycle requests with current revision; replay with old revision409. Store actual author vs last editor separately. First published_at and slug remain immutable after first publish, including after unpublish. Published save is immediate. DELETE is a retained tombstone with immutable deleted_by/at and reserved slug; all reads subsequently404/hide; no retention duration or purge worker is invented. No academic write.

Canonical omitted create category defaults empty string, optional cover/excerpt null, content_doc JSON null. Plain content and safe rich document are stored separately without generating one from the other. reading_minutes is display metadata derived deterministically as max(1,ceil(Unicode plain-content length/1000)); this approximate technical convention is not a new business rule. Non-null rich document uses existing Tiptap doc-root semantics (explicit stricter interpretation of canonical JsonValue), bounded2MiB serialized UTF8/depth30/20,000 values; reject prototype keys and unsafe href/src schemes, preserve valid structure. URL fields accept HTTP(S), safe single-slash local asset paths, and supported image data URLs. Blog create/PATCH get12MiB raw JSON envelope; other routes retain existing limits. Publish requires nonblank title and actual plain/rich text or image content; Draft can be incomplete. No dependency added.

Public list: first published_at descending/id ascending, title/excerpt/content text search and exact category. Admin list: updated_at descending/id ascending, same bounded search and optional draft/published status; signed cursor bound to route/principal/filter/limit. Public summary excludes content/audit; detail includes canonical saved content only. Nullable append-only schema additions preserve legacy unknown metadata/audit; malformed incomplete legacy projections fail closed rather than inventing a creator/editor. Migration applies only to isolated test database.
