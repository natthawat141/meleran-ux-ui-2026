# Melearn project workflow and agents

ตั้งค่า 7 ตุลาคม 2026 สำหรับ R0 Inventory/Architecture Review อ่าน [workflow](workflows/r0-inventory.md) ก่อน dispatch

- [config.toml](config.toml) ลงทะเบียน R0 roles สี่ตัวและ `melearn_complex` พร้อมจำกัด spawned threads พร้อมกันสามตัว
- R0 roles ใน `agents/` ใช้ GPT-6 Luna (`gpt-6-luna`) reasoning `xhigh`, sandbox default `read-only` และเก็บข้อเท็จจริงเท่านั้น
- `melearn_complex` ใช้ GPT-6.1 Sol (`gpt-6.1-sol`) reasoning `xhigh` สำหรับ review งานยากหรือทำส่วนย่อยที่ได้รับมอบหมาย โดยใช้ sandbox แบบ `workspace-write`; agent หลักยังกำหนด architecture และตรวจ diff/ผลทดสอบ
- อ่าน [workflow escalation](workflows/complex-task-escalation.md) สำหรับเงื่อนไขเรียก Sol/Gemini และขอบเขตการใช้งาน `agy`
- Config นี้ไม่เปลี่ยน model ของ Lead และไม่สั่งเริ่ม inventory อัตโนมัติ ใช้เมื่อผู้ใช้มอบหมาย R0; execution plan ต้องผ่าน approval ก่อน implementation
- เมื่อเปิด workspace ชั้นนอก ใช้ `.codex/config.toml` ของ workspace ที่ชี้ config_file มาที่ canonical role files ชุดนี้ ไม่มี prompt สำเนาอีกชุด
- Project trust เป็นค่าเฉพาะเครื่อง เมื่อ clone ไปเครื่องใหม่ต้องตรวจ effective project config ใน trusted checkout ไม่คัดลอก user config หรือ credentials ไป Git

## หลักฐานตรวจ setup

ตรวจ TOML ของสอง project configs และ role files: parser ผ่าน และตรวจว่า `config_file` ทั้งสองตำแหน่ง resolve ไป role files ชุด canonical ใน repository นี้

ก่อนเพิ่ม `melearn_complex` เคยตรวจ app-server config ของ workspace และ repo ว่ามีสี่ R0 role declarations กับ concurrency limit=3 การเพิ่ม role นี้ต้องตรวจ effective config ใหม่เมื่อเริ่ม session ที่โหลดการเปลี่ยนแปลงแล้ว; ยังไม่อ้างว่า session ที่เปิดอยู่รับ role ใหม่หรือทดสอบ model availability แล้ว

เพิ่ม trust เฉพาะ checkout ของแอปใน user config และสำรอง user config เดิมไว้ในโฟลเดอร์ส่วนตัว การตรวจนี้ไม่มี model call, ไม่ได้ dispatch subagent/R0 และไม่พิสูจน์ model availability หรือ sandbox enforcement ของ chat ที่กำลังรัน เมื่อเริ่มงานจริงให้ตรวจ role/model/effort ของ spawned agents อีกครั้ง Runtime overrides ของ parent อาจมี precedence เหนือ sandbox default

ไฟล์ setup ที่เพิ่มระหว่าง session ไม่ยืนยันว่า session เดิม reload registry แล้ว ให้เริ่ม session ใหม่หรือใช้ explicit model/effort และ task instructions จาก role files ตามความสามารถของเครื่องมือ ก่อนอ้างว่าใช้ custom role จริง

รูปแบบอ้างอิง [Official OpenAI Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) และ [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)
