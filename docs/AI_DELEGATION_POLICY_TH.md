# กติกาคุยแบบและมอบหมายงานโค้ด

ผู้ใช้ยืนยัน 3 ตุลาคม 2026 · ใช้กับงานใน `elearning-ux-v2`

## R0 Inventory ที่ยืนยัน 7 ตุลาคม 2026

ใช้ [workflow ใน .codex](../.codex/workflows/r0-inventory.md) สำหรับงาน R0 โดยมี `melearn_routes`, `melearn_state`, `melearn_scope`, `melearn_ui_authoring` เป็น GPT-6 Luna (`gpt-6-luna`) reasoning `xhigh` เก็บหลักฐาน read-only ทำพร้อมกันไม่เกินสาม subagents หรือขีดจำกัด runtime ที่ต่ำกว่า หัวข้อที่สี่จัดคิวหรือใช้ agent ที่ idle ต่อ

Subagents ห้ามแก้ไฟล์/ติดตั้ง/build/Git mutation และห้ามตัดสิน architecture แทน Lead รายงาน findings พร้อม path/line/symbol และ actual consumers ผ่าน final response Lead เป็นผู้ review สรุป ownership/package boundaries เขียน report ตรวจ baseline และปรับ execution plan ก่อนให้ผู้ใช้ approve implementation ไม่ใช้ inventory role ทำงานเขียนโค้ดภายหลังโดยเงียบ ๆ

การติดตั้ง workflow/custom roles ไม่ได้ dispatch R0 อัตโนมัติ ต้องมีคำสั่งเริ่ม R0; การอนุมัติสำรวจไม่ใช่การอนุมัติ R1 Scope cleanup หรือ source implementation

## กติกางานทั่วไป

- เมื่อผู้ใช้บอกให้คุยกันก่อน ให้วิเคราะห์ตัวอย่าง ตกลงหน้าตา เนื้อหา และ flow ก่อน ยังไม่แก้ UI หรือส่ง agent ไป implementation จนกว่าผู้ใช้จะสั่งให้ลงมือ
- งานเขียนโค้ดง่าย ๆ หรือการแก้ UI/component ในขอบเขตเล็ก ให้ agent หลักจัดทำสเปกและมอบหมาย implementation ให้ **subagent โมเดล GPT-6 Luna (`gpt-6-luna`)** แทนการเขียนเองเป็นค่าเริ่มต้น
- Agent หลักรับผิดชอบทำความเข้าใจคำขอ ระบุไฟล์และขอบเขต เกณฑ์รับงาน รวมถึงตรวจ source, diff, integration, build/typecheck และหน้าที่เกี่ยวข้องก่อนส่งมอบ ไม่ถือว่างานเสร็จเพียงเพราะ subagent รายงานว่าเสร็จ
- ส่งให้ Luna เฉพาะงานที่ผู้ใช้อนุญาตแล้ว พร้อมกติกา `AGENTS.md`, `UI_SPEC.md`, `CODE_SPEC.md` และ checkpoint ที่ใช้กับงานนั้น รักษา staged/dirty work ของงานอื่น ใช้ checkout/worktree แยกเมื่อมีการเขียนพร้อมกัน
- การคุย UX การวิเคราะห์ การตรวจงาน และการแก้เอกสารกติกา ทำโดย agent หลักได้ กติกานี้ไม่บังคับให้สร้าง subagent สำหรับการสนทนาหรือเอกสารทุกครั้ง
- หากโมเดล Luna หรือเครื่องมือ subagent ใช้งานไม่ได้ ให้รายงานข้อจำกัดและคงงานไว้ในขั้นสเปก ไม่เปลี่ยนโมเดลหรือเริ่มเขียนเองเงียบ ๆ คำสั่งเฉพาะล่าสุดของผู้ใช้มีน้ำหนักเหนือกติกานี้
