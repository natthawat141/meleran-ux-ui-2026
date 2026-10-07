# Melearn project workflow and agents

ตั้งค่า 7 ตุลาคม 2026 สำหรับ R0 Inventory/Architecture Review อ่าน [workflow](workflows/r0-inventory.md) ก่อน dispatch

- [config.toml](config.toml) ลงทะเบียน `melearn_routes`, `melearn_state`, `melearn_scope`, `melearn_ui_authoring` และจำกัด spawned threads พร้อมกันสามตัว
- Role definitions ใน `agents/` ใช้ GPT-6 Luna (`gpt-6-luna`) reasoning `xhigh`, sandbox default `read-only` และ common protocol ที่ห้ามแก้ไฟล์/ตัดสิน architecture แทน Lead
- Config นี้ไม่เปลี่ยน model ของ Lead และไม่สั่งเริ่ม inventory อัตโนมัติ ใช้เมื่อผู้ใช้มอบหมาย R0; execution plan ต้องผ่าน approval ก่อน implementation
- เมื่อเปิด workspace ชั้นนอก ใช้ `.codex/config.toml` ของ workspace ที่ชี้ config_file มาที่ canonical role files ชุดนี้ ไม่มี prompt สำเนาอีกชุด
- Project trust เป็นค่าเฉพาะเครื่อง เมื่อ clone ไปเครื่องใหม่ต้องตรวจ effective project config ใน trusted checkout ไม่คัดลอก user config หรือ credentials ไป Git

## หลักฐานตรวจ setup

ตรวจ TOML ของสอง project configs และสี่ role files: parser ผ่าน ชื่อ/model/effort/read-only/defaults ตรง และ config_file ทั้งสองตำแหน่ง resolve ไป canonical role files เดียวกัน

ตรวจด้วย installed Codex app-server `--strict-config` และ `config/read`: effective config ของ `D:\code\elearn-prod` และ `D:\code\elearn-prod\elearning-ux-v2` โหลดสี่ role declarations และ concurrency limit=3 โดยไม่มี disabled project layer

เพิ่ม trust เฉพาะ checkout ของแอปใน user config และสำรอง user config เดิมไว้ในโฟลเดอร์ส่วนตัว การตรวจนี้ไม่มี model call, ไม่ได้ dispatch subagent/R0 และไม่พิสูจน์ model availability หรือ sandbox enforcement ของ chat ที่กำลังรัน เมื่อเริ่มงานจริงให้ตรวจ role/model/effort ของ spawned agents อีกครั้ง Runtime overrides ของ parent อาจมี precedence เหนือ sandbox default

ไฟล์ setup ที่เพิ่มระหว่าง session ไม่ยืนยันว่า session เดิม reload registry แล้ว ให้เริ่ม session ใหม่หรือใช้ explicit model/effort และ task instructions จาก role files ตามความสามารถของเครื่องมือ ก่อนอ้างว่าใช้ custom role จริง

รูปแบบอ้างอิง [Official OpenAI Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) และ [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)
