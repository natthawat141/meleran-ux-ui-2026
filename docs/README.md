# คู่มือ AI และสเปก Melearn UX/UI

อัปเดต 1 ตุลาคม 2026 ชุดนี้ใช้ให้ AI หรือผู้พัฒนาคนใหม่ต่อจากงานปัจจุบัน โดยรักษาหน้าตา flow และรูปแบบ code ที่ตกลงไว้

## อ่านอะไรเมื่อเริ่ม

| เอกสาร | หน้าที่ |
| --- | --- |
| [`../AGENTS.md`](../AGENTS.md) | กติกาเริ่มงาน ขอบเขต และคำสั่งรัน |
| [`UI_SPEC.md`](UI_SPEC.md) | แบรนด์ สี ฟอนต์ ไอคอน layout และพฤติกรรมหน้าจอ |
| [`CODE_SPEC.md`](CODE_SPEC.md) | ที่อยู่ implementation, library, route, state, CSS และการตรวจงาน |
| [`FEATURE_RELEASE_MATRIX.md`](FEATURE_RELEASE_MATRIX.md) | Inventory ทุก route, Phase ที่เสนอ, หลักฐาน UI/business/backend และสถานะเปิด feature ตาม environment |
| [`BUSINESS_ANALYTICS_UI_SPEC.md`](BUSINESS_ANALYTICS_UI_SPEC.md) | หน้าภาพรวมธุรกิจและรายงานการเงิน ตัวกรอง กราฟ ledger และ UX acceptance |
| [`INSTRUCTOR_ANALYTICS_UI_SPEC.md`](INSTRUCTOR_ANALYTICS_UI_SPEC.md) | Analytics ผู้สอนที่เห็นเฉพาะคอร์สตนเอง: UX ทั้ง 5 มุม กติกาแบบฝึกหัด/ก่อน–หลัง งาน Luna และ acceptance |
| [`BUSINESS_ANALYTICS_DATA_SPEC.md`](BUSINESS_ANALYTICS_DATA_SPEC.md) | นิยาม metric, raw events, financial records และ draft API/JSON สำหรับระบบจริง |
| [`ADMIN_MANAGEMENT_GAP_AUDIT_TH.md`](ADMIN_MANAGEMENT_GAP_AUDIT_TH.md) | source audit ของงานแอดมิน สิ่งที่ขาด รายการทำเร็ว และข้อพึ่งพา ยังไม่แบ่งเฟส |
| [`GIT_CHECKPOINT_POLICY_TH.md`](GIT_CHECKPOINT_POLICY_TH.md) | ผู้ใช้ยืนยันให้ commit และ push อัตโนมัติหลังงานผ่าน พร้อมการสำรอง แยก concurrent work และรายงานจุดย้อนกลับ |
| [`TYPESCRIPT_MIGRATION_INSTRUCTIONS_TH.md`](TYPESCRIPT_MIGRATION_INSTRUCTIONS_TH.md) | ขอบเขต ข้อห้าม และเกณฑ์ย้าย TypeScript โดยรักษา UI/พฤติกรรมเดิม; source และ tooling ย้ายแล้ว |
| [`WORKSPACE_INTEGRATION_20261004.md`](WORKSPACE_INTEGRATION_20261004.md) | ผลรวมงาน Git/TypeScript เส้นทางการเงิน หลักฐานการตรวจ และข้อจำกัดของ AI demo |
| [`INBOX_PERMISSION_SPEC.md`](INBOX_PERMISSION_SPEC.md) | กติกาอินบ็อกซ์ที่ยืนยัน 1 ต.ค. 2026: เส้นทางส่ง สิทธิ์เรียนหมด ทีมดูแล ความเป็นส่วนตัว และส่วนที่ยังไม่ implement |

UI spec บันทึกทิศทางที่เลือกกับพฤติกรรมของต้นแบบ Code spec บอกวิธีต่อ code ปัจจุบัน ทั้งสองไฟล์ไม่อนุมัติสถาปัตยกรรม Production หรือ business rules ที่ยังไม่ตกลง

งานเกี่ยวกับอินบ็อกซ์ให้อ่าน `INBOX_PERMISSION_SPEC.md` เพิ่มก่อนแก้ flow หรือสิทธิ์ กติกาที่ผู้ใช้ยืนยันในไฟล์นี้มีน้ำหนักเหนือพฤติกรรมต้นแบบเดิม ส่วนรายละเอียดที่ยังไม่ตัดสินต้องไม่เติมเป็น requirement ที่อนุมัติแล้ว

## ใช้กับ AI แต่ละตัว

| เครื่องมือ | เปิด workspace ใหญ่ | เปิด repository นี้โดยตรง |
| --- | --- | --- |
| Codex | `../AGENTS.md` ชี้มาที่แอปนี้ | `AGENTS.md` ที่ repository root ชี้ไปสเปก |
| Gemini CLI | `../GEMINI.md` import กติกา workspace | `GEMINI.md` import AGENTS, UI spec และ code spec |
| Cursor Agent | `../.cursor/rules/melearn-workspace.mdc` ชี้มาที่แอป | `.cursor/rules/melearn.mdc` ตั้ง `alwaysApply: true` และกำหนดให้อ่านสเปก |

เปิดโฟลเดอร์ `elearning-ux-v2` โดยตรงสะดวกที่สุดสำหรับแก้แอป ไฟล์กติกาภายใน repo ติดตามไปได้เมื่อ clone บนเครื่องอื่น ไม่ต้องแก้ global configuration ของ AI

หลังเพิ่มหรือแก้กติกา ให้เริ่ม session ใหม่ใน Codex; Gemini CLI ใช้ `/memory reload` แล้ว `/memory show` เพื่อตรวจ context; Cursor ดูว่า rule `melearn` อยู่ในรายการกติกาที่ใช้ของ Agent ถ้าใช้ Gemini ผ่านเครื่องมืออื่นที่ไม่ใช่ CLI ให้แนบ AGENTS และสเปกเองตามความสามารถของเครื่องมือนั้น

ไฟล์เหล่านี้ช่วยให้ agent มีบริบทเดียวกัน แต่ต้องตรวจผลลัพธ์และการโหลด context ของเครื่องมือจริงด้วย ยังไม่ได้เปิด session ของ Gemini/Cursor เพื่อตรวจการทำงานใน workspace นี้

รูปแบบไฟล์อ้างอิง [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md/), [Gemini CLI context/imports](https://geminicli.com/docs/cli/gemini-md/) และ [Cursor project rules](https://cursor.com/docs/rules)

## ตัวอย่างคำสั่งเริ่มงาน

> อ่าน AGENTS.md, docs/UI_SPEC.md และ docs/CODE_SPEC.md ก่อน ดู source ของ route `/teach/courses/course-writing/curriculum` แล้วแก้ปัญหา [ระบุปัญหา] โดยรักษาแบรนด์และ flow ที่มีอยู่ ใช้ component ที่ติดตั้งแล้ว แก้เฉพาะขอบเขตนี้ เปิด preview และรายงานผลตรวจที่ทำจริง

## การอัปเดตสเปก

- เมื่อผู้ใช้เปลี่ยนทิศทางหรือยืนยัน pattern ใหม่ อัปเดต section ที่เกี่ยวข้องใน UI/CODE spec พร้อมวันที่และเหตุผลสั้น ๆ
- แยกสิ่งที่ผู้ใช้ยืนยันออกจากสิ่งที่ AI เสนอหรือเพิ่ง implement อย่าเขียนว่าอนุมัติแล้วเพียงเพราะ build ผ่าน
- เปลี่ยนรายละเอียดสี/พฤติกรรมในสเปกกลาง ไม่ทำสำเนารายละเอียดทั้งหมดใน GEMINI หรือ Cursor rule
- ข้อกำหนดสั้นใน AGENTS/rule ต้องสอดคล้องกับสเปก ถ้าทิศทางหลักเปลี่ยน ให้แก้ข้อความย่อเหล่านั้นในงานเดียวกัน
- เอกสารร่างใน workspace ชั้นนอกเป็นข้อมูลประกอบ หากขัดกับ feedback ล่าสุด ให้ยึด feedback ล่าสุดและบันทึกความต่าง
