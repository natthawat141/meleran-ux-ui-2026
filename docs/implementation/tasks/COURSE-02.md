# COURSE-02 — Authoring aggregate/preview/submit

Status: **NEEDS_DECISION** · Priority: P1 · Module: courses

ต้องปิด D04, D05, D09

Storage preflight 11 ต.ค.: [CONTRACT_STORAGE_GAPS](../CONTRACT_STORAGE_GAPS.md#course-02--review-01--authoring-readwrite-prerequisites) ระบุ publisher/legacy creator/revision0/optional plain metadata และ old-review projection gaps. ปิดเฉพาะ decisions ที่เกี่ยวข้องก่อนเลือก physical delta; ห้ามเดา creator/publisher, บวก revision ใน reader, ทิ้ง supplied fields หรือสร้าง full course-version requirement เอง. Preview ใช้ schema แยกจาก full authoring DTO.

## Read set และ traceability

อ่าน [Architecture](../ARCHITECTURE.md), ใบงานนี้ และ context subset เท่านั้นก่อนเริ่ม; เปิดต้นฉบับเฉพาะ section เมื่อพบ conflict.

- [Scope Final 1.6](../../MELEARN_V1_SCOPE.md): §2.3 (line 243); §3.4 (line 451); §4.5 (line 956); §5.2 (line 1008); §6.5 (line 1228)
- [Canonical OpenAPI](../../api-contract/openapi.json): 1.0.0-draft.1 / SHA-256 c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3
- [OpenAPI subset](../contracts/COURSE-02.openapi.json) — schema, parameters, required/null, enums, every declared status/error และ security ครบ
- [Flow AB decisions](../../api-contract/API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) และ [Decision Register](../DECISIONS.md) เฉพาะ IDs ที่ระบุ

## Exact HTTP contract

| Method | Path (prefix /api/v1) | operationId | Request schema | Success schema |
| --- | --- | --- | --- | --- |
| GET | /courses/{id}/authoring | get_courses_id_authoring | ไม่มี body | 200: #/components/schemas/AuthoringCourseDto |
| PATCH | /courses/{id} | patch_courses_id | #/components/schemas/CoursePatchRequest | 200: #/components/schemas/AuthoringCourseDto |
| GET | /courses/{id}/authoring-preview | get_courses_id_authoring-preview | ไม่มี body | 200: #/components/schemas/AuthoringPreview |
| POST | /courses/{id}/submit-review | post_courses_id_submit-review | #/components/schemas/CourseReviewRequest | 201: #/components/schemas/CourseReviewDto |

HTTP permission/security ยังเป็น Draft projection; server ต้องตรวจ Scope ownership เพิ่ม:

- PATCH /courses/{id} → course.update: owner Instructor or Admin; security [{"WebSession": []}, {"AdminSession": []}]
- GET /courses/{id}/authoring → course.update: owner Instructor or Admin; security [{"WebSession": []}, {"AdminSession": []}]
- GET /courses/{id}/authoring-preview → course.preview; security [{"WebSession": []}, {"AdminSession": []}]
- POST /courses/{id}/submit-review → course.submit_review: owner Instructor; security [{"WebSession": []}]

Errors: ใช้ statuses/schema/examples ใน subset ราย operation; ห้ามตีความ shared common errors ว่าทุก code ใช้ได้ทุกกรณี. ห้ามแปลง required-nullable เป็น omitted หรือคืน entity ตรง ๆ.

## บริบทและข้อกำหนด

- [CONFIRMED_SCOPE] ทุก Chapter/Item/Quiz/Question อยู่ใน Course เดียว; ownership ตรวจ server
- [CONFIRMED_SCOPE] แก้ Approved ก่อน publish → Draft; Published แก้มีผลทันที
- [CONFIRMED_SCOPE] Preview ไม่สร้างผลเรียน; submit ผูก revision; ไม่ทับ ai_enabled/transcript จาก normal editor
- [PROPOSED_TECHNICAL] วิดีโอ YouTube เท่านั้น; authoring aggregate บันทึกทั้งหมดหรือ rollback
- [HTTP_DRAFT] ตาม canonical PATCH ใช้ expected_revision และ retained server IDs/order/history; destructive nested changes เมื่อมี history ต้อง review ตาม D04 ไม่ใช้ delete-and-recreate ทั้ง aggregate โดยพลการ

## Data / transaction / dependencies

- Entities: Course, Chapter, ContentItem, Quiz, Question, CourseReview
- [Domain model](../DOMAIN_MODEL.md) §TX-COURSE — Course aggregate
- PROPOSED_TECHNICAL execution: Authorize actor and every nested ID, compare approved revision, replace/update aggregate as agreed D04, order changes and content revision+audit atomic. No overwrite of Transcript/AI settings; published edits immediate; approved edit invalidates prior approval.
- Dependencies: [COURSE-01](COURSE-01.md), [DB-03](DB-03.md)
- Schema Owner: Lead/DB maintainer ผู้เดียว; feature agent ส่ง schema delta ไป DB task ไม่สร้าง migration เอง

## Expected files / modules

- backend/src/features/courses/<use-case>.service.ts, controller, module, dto (reuse when present; otherwise planned files)
- feature-local *.spec.ts + test/courses/*.pg-spec.ts
- shared schema/migrations only through assigned DB task; no direct edits by feature worker

## Tests และ acceptance

- nested foreign-course ID and stale revisions
- reorder/add/remove rollback; transcript preserved
- snapshot old attempts/completions unchanged; YouTube renderer integration

Feature gate: **G-COURSE** ใน [Execution Plan](../EXECUTION_PLAN.md); ตรวจ UI + real API + persistence เมื่อ feature พร้อม ไม่รอ backend ครบทุก operation.

- Positive/negative/permission: ครอบคลุม rule และ ID tampering ของ task; technical-only task ใช้ config/startup/constraint equivalents
- Contract: ตรวจ actual serialized response และ request validation กับ subset รวม nested fields, enum, required/null และ errors
- Persistence เมื่อมี DB behavior: Test PostgreSQL แยก; read-back/restart ไม่ถือ SQLite หรือ mock เป็นหลักฐาน
- Concurrency/rollback: ตาม transaction ด้านบน; READ/NO_WRITE ตรวจ no-side-effect แทน

| Case | Action จาก Scope | Expected จาก Scope |
| --- | --- | --- |
| A05 | Instructor A แก้ Course/Chapter/Quiz ของ B | ปฏิเสธ แม้ A ลงเรียนคอร์ส B แล้ว |
| C01 | Instructor สร้างคอร์สและบทหลายรายการ | บันทึกจริง เปิดกลับมาเห็นข้อมูลและลำดับเดิม |
| C02 | Admin สร้าง/แก้คอร์สแทน | Course มี Instructor คนเดียว แยกผู้สร้าง Admin ได้ |
| C04 | ส่งตรวจ Admin ส่งกลับพร้อมเหตุผล แล้วส่งใหม่ | สถานะและเหตุผลถูกต้อง ประวัติเดิมยังอยู่ |
| C07 | ข้อมูลเปลี่ยนระหว่าง Admin เปิดตรวจ | แจ้งให้ตรวจข้อมูลล่าสุด ไม่อนุมัติผิดฉบับเงียบ ๆ |
| C08 | Instructor แก้เนื้อหา Published | ผู้เรียนเห็นข้อมูลที่แก้ได้ทันที ไม่รออนุมัติใหม่ |
| C09 | สาธารณะเปิด Catalog/API ของ Draft หรือเฉลย | ไม่ได้ข้อมูลจำกัดสิทธิ์ |
| C10 | ส่ง Item ของคอร์ส B มาแก้ผ่าน URL คอร์ส A | ปฏิเสธ แม้มีสิทธิ์แก้ A |
| C11 | แก้ข้อมูล/บท/Quiz ของ Approved ก่อน Publish | กลับ Draft ต้องตรวจฉบับใหม่ ใช้ Approval เก่าเผยแพร่ไม่ได้ |
| V01 | ใส่ YouTube Link ใน Video แล้วบันทึกและเปิดหน้าเรียน | ลิงก์และแหล่ง youtube อยู่ครบ เล่นได้ตามการตั้งค่าของ YouTube และตรวจสิทธิ์เข้าเรียน |
| V03 | ลิงก์ผิด วิดีโอถูกลบ หรือไม่อนุญาตให้ฝัง | แจ้งข้อผิดพลาด ไม่อ้างว่าเล่นได้และไม่เพิ่ม Progress เอง |
| E03 | Instructor Redeem คอร์สคนอื่น | ได้สิทธิ์เรียน แต่ไม่ได้ Editor/คิวตรวจงาน |
| Q08 | เริ่ม Attempt แล้วผู้สอนแก้โจทย์/คะแนนเต็ม | ครั้งเดิมใช้ชุดที่เก็บไว้ ครั้งใหม่ใช้ชุดปัจจุบัน |
| F03 | Admin/เจ้าของเปิดดูเนื้อหาครบ | ไม่สร้างผลเรียนหรือใบรับรองอัตโนมัติ |
| F04 | เพิ่มบทเรียนหลังผู้เรียนได้ใบรับรองแล้ว | สถานะจบและใบเดิมยังอยู่ เรียนเพิ่มเป็นทางเลือก |
| F05 | เพิ่มบทเรียนก่อนผู้เรียนจบ | ผู้เรียนยังต้องครบรายการปัจจุบัน |
| F08 | จบ 100% แล้วเพิ่มบท/แก้แบบฝึกหัด | completed_at และ completion_snapshot เดิมยังอยู่ ใช้อธิบายผลจบเดิมได้ |
| AI05 | ผู้เรียนเปิดหน้าเรียน Catalog Preview และ API เนื้อหา | ไม่เห็น Raw Transcript ทั้งหมดหรือช่องแก้ Transcript |
| AI09 | Save Transcript ขณะที่ Video/Quiz มีฉบับร่างยังไม่บันทึก | บันทึกเฉพาะ Transcript ฉบับร่างการเรียนไม่ถูกบันทึกหรือทิ้งโดยเงียบ ๆ |
| AI10 | Instructor แก้ Video fields เดิมหลัง Admin บันทึก Transcript | เนื้อหาการเรียนเปลี่ยนตามสิทธิ์ Transcript ที่เก็บไว้ยังอยู่ |

## Definition of Done

- Dependencies มี evidence ผ่าน และ decision IDs ปิดด้วยหลักฐานอนุมัติ; ตรวจ contract/source hash ยังตรง baseline
- Typecheck และ targeted unit/authorization/contract tests ผ่าน; integration/persistence บน isolated Test PostgreSQL ตามงาน
- Migration delta reviewed/tested โดย Schema Owner ถ้า schema เปลี่ยน; no schema change = no generate/apply ซ้ำ
- Component Done = targeted/contract/persistence tests ผ่าน; เมื่อ feature prerequisites ครบจึงตรวจ real Frontend gate ก่อน Feature Accepted และไม่อ้างว่า acceptance ผ่านจาก component อย่างเดียว
- บันทึก SHA/contract hash/environment/commands/results และ gaps; ส่ง review แล้ว merge/integrate ตาม authorized Git placement
- ปิด task ได้เมื่อแก้ครบทุก defined operation ใน task; partial subset ต้องรายงาน ไม่ลด scopeเงียบ

## Decisions / สิ่งที่ห้ามแก้

- D04 — Authoring aggregate/revision lifecycle: Canonical PATCH aggregate replacement vs partial and review return/publish revision enforcement are still pending. Scope confirms pending_review; archived is in Draft enum but excluded from V1. Resolution: Approve revision/aggregate semantics; use current reviewed content version for approval/publish; no extra archived API.
- D05 — Rich document and safe content limits: JSON document version, depth/size/node limits, safe URL schemes and YouTube validation are not frozen; normal editor cannot overwrite AI-only fields. Resolution: Agree technical security limits without inventing lesson/business restrictions; keep current wire shape unless approved.
- D09 — Image/R2 upload missing contract: Profile/cover/blog/essay image upload has no frozen operation in 86; video upload explicitly disabled. R2 choice already confirmed. Resolution: Approve image protocol/schema/permission/size/lifecycle; track gap without inventing endpoint. Block image-dependent acceptance only.

- ห้ามเปลี่ยน business policy, canonical path/schema/security semantics หรือเติม endpoint ให้ CRUD ครบ
- ห้ามแก้ schema/migrations ของคนอื่น; ห้าม runtime auto-seed/auto-migrate หรือใช้ live DB เป็น test
- ห้ามติดตั้ง/upgrade libraries, deploy, cloud changes, live migrations หรือ legacy deletion ในงาน planning นี้
- ถ้า contract/spec conflict ให้หยุดเฉพาะ behavior ที่เกี่ยวข้องและบันทึก decision; ไม่ fallback mock/เดา policy
