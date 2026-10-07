# Melearn R0 Inventory and Architecture Review Workflow

ผู้ใช้ยืนยัน 7 ตุลาคม 2026 · ใช้เฉพาะ Melearn Frontend ใน repository นี้

เอกสารนี้กำหนดวิธีทำงานของ Lead และ subagents ไม่ใช่สเปกธุรกิจ/สีชุดใหม่ อ่าน [AGENTS.md](../../AGENTS.md), [Final 1.6](../../docs/MELEARN_V1_SCOPE.md), [UI_SPEC](../../docs/UI_SPEC.md), [CODE_SPEC](../../docs/CODE_SPEC.md), [แผน refactor ล่าสุด](../../docs/FRONTEND_REFACTOR_PLAN_TH.md) และ [checkpoint policy](../../docs/GIT_CHECKPOINT_POLICY_TH.md) ก่อนใช้

การติดตั้ง config/workflow ไม่ได้เริ่ม inventory โดยอัตโนมัติ เมื่อผู้ใช้สั่งเริ่ม R0 ให้ทำตามขั้นตอนด้านล่าง; R0 ไม่อนุญาตแก้ source/config runtime ของแอป ติดตั้ง dependency ตัดเพิ่มฟีเจอร์ ย้ายไฟล์ เปลี่ยน URL/reset data หรือ deploy การเขียนเอกสารผล R0 ทำโดย Lead เท่านั้น และต้องให้ผู้ใช้ approve execution plan ก่อน R1 implementation

## 1. Lead ตรวจบริบทก่อน dispatch

1. ตรวจ absolute repository root, branch, HEAD, upstream, dirty/staged work และจุดอ้างอิง prototype/tag; ห้ามแตะ reference repositories
2. อ่านเอกสารทั้งหมดข้างต้น แยก current implementation, confirmed scope/target และ unresolved technical decisions หากพบเอกสารขัดคำสั่งล่าสุดให้ระบุและยึดคำสั่งล่าสุด
3. ส่ง repo root/HEAD/รายการเอกสาร/ขอบเขตห้ามแก้/รูปแบบหลักฐานเดียวกันให้ทุก agent ถ้า source เปลี่ยนระหว่างสำรวจให้รายงานสถานะและ recheck affected findings ไม่อ้าง snapshot atomic
4. ใช้สี่บทบาทด้านล่าง GPT-6 Luna (`gpt-6-luna`) reasoning `xhigh` ห้ามเปลี่ยนโมเดลเงียบ ๆ ถ้าใช้ไม่ได้ให้รายงานข้อจำกัด

## 2. งานย่อยและการจัดช่องทำงาน

| Role | File | ขอบเขต |
| --- | --- | --- |
| `melearn_routes` | [role](../agents/melearn_routes.toml) | Route → Page → Component → Layout/guard/gate/import graph; Web/Admin และ URL migration dependencies |
| `melearn_state` | [role](../agents/melearn_state.toml) | store/data/types/persistence/mocks/network clients และ readers/writers/lifetime/side effects |
| `melearn_scope` | [role](../agents/melearn_scope.toml) | Feature capabilities ทั้งมี/ไม่มี route เทียบ Final 1.6 และ KEEP/ADAPT/REMOVE candidates |
| `melearn_ui_authoring` | [role](../agents/melearn_ui_authoring.toml) | Shared UI/CSS/theme/authoring actual consumers และ coupling; ไม่มี package decision |

- ทำพร้อมกันไม่เกินสาม subagents ตาม [project config](../config.toml) หรือขีดจำกัด runtime ที่ต่ำกว่า Lead เป็นผู้จัดคิวหัวข้อที่สี่เมื่อมีช่องว่าง
- ถ้า finished thread ยังใช้ช่อง runtime ให้ใช้ agent ที่ idle ทำหัวข้อที่สี่แทน หรือ close ผ่านเครื่องมือที่รองรับก่อน spawn ใหม่ ไม่เปิดเกินจำนวนเพียงเพราะ config มีค่าอื่น
- Custom role files เป็นค่าเริ่มต้นสำหรับ session ที่โหลด project config; ถ้าเครื่องมือปัจจุบันเลือก role name ไม่ได้ Lead ต้องอ่าน role file แล้วส่ง developer instructions เป็น task พร้อม explicit model/effort ตามเครื่องมือ หาก override model ต้องไม่ full-history fork เมื่อ API ห้าม
- Lead อ่านเอกสาร/ตรวจหลักฐานอิสระระหว่าง agents ทำงาน ห้ามให้ agent หนึ่งกำหนด architecture เพื่อให้ agent อื่นทำตาม

## 3. Common subagent protocol

- Read-only fact gathering: ห้ามแก้ไฟล์ทุกชนิด รวม report; ห้าม install/build/format/code generation, Git mutation, เปลี่ยน branch, browser data reset, deploy, external writes/messages หรือ spawn ลูกต่อ
- อ่าน source ได้ด้วย rg/targeted reads และใช้ Git read-only ตรวจบริบทได้ ไม่อ่าน/ส่ง secrets, tokens, credentials หรือข้อมูลจริงของ reference
- ตรวจ import/re-export และ actual consumers ก่อนสรุป ไม่ใช้ชื่อไฟล์หรือหน้าตาคล้ายกันเป็นหลักฐาน ownership/reuse
- บอกข้อมูลที่เกิดจากการคำนวณ/fixture/browser กับ network/backend evidence แยกกัน ชื่อไฟล์ `api` ไม่พิสูจน์ API จริง
- ส่งรายงานเป็นภาษาไทยให้ Lead ผ่าน final response ไม่เขียนไฟล์และไม่ commit/push ผลเอง
- ไม่ตัดสิน architecture แทน Lead การจัดประเภทหรือ ownership ที่ Lead ขอให้เสนอ ต้องติดป้าย candidate พร้อมหลักฐานและจุดที่ยังต้องตรวจ

รูปแบบ finding:

| Field | ต้องส่ง |
| --- | --- |
| ID / capability | รหัส finding และ flow/feature ที่เกี่ยวข้อง |
| Evidence | repository-relative path, verified one-based line, symbol; scope section เมื่อเทียบธุรกิจ |
| Current behavior | ข้อเท็จจริงจาก source ไม่ปะปน target/proposal |
| Consumers / effects | imports/readers/writers, navigation และ side effects ที่เกี่ยวข้อง |
| Confirmed target / candidate | สิ่งที่เอกสารยืนยัน หรือข้อเสนอที่ระบุ candidate ชัด |
| Verification gap | runtime/API ที่ยังไม่ได้ตรวจ, dynamic paths หรือหลักฐานไม่พอ |

## 4. Lead review และ baseline

1. รวมผลเป็น inventory/matrix เดียว แก้ findings ที่ขัดกันโดยตรวจ source เอง ตรวจ consumer chains สำคัญ เช่น grading ใน analytics, Payment/Redeem ใน commerce, Admin → /teach และ authoring save/preview
2. Lead เป็นผู้ตัดสิน route/state ownership, package boundaries, สิ่งที่ไม่ควร shared และลำดับ refactor พร้อมเหตุผลจากหลักฐาน ห้ามนำ candidate ของ subagent ไปเขียนว่า frozen โดยไม่ review
3. ตรวจ baseline ด้วย commands/tests ที่มีจริงตาม CODE_SPEC โดย Lead เท่านั้น แยก pre-existing failures/limitations ห้ามแก้ source เพื่อให้ผ่านระหว่าง R0 ถ้า build สร้าง dist/artifacts ให้ระบุว่าเป็น generated output ไม่ใช่ source implementation ห้าม commit artifacts
4. ตรวจ critical flows เท่าที่ทำได้โดยไม่ reset session/browser data อย่าอ้าง browser/mobile/server behavior ที่ไม่ได้ตรวจ Typecheck/build/mock tests ไม่ใช่ server readiness

## 5. ส่งมอบและ approval boundary

Lead เขียน `docs/R0_INVENTORY_ARCHITECTURE_REVIEW_TH.md` เมื่อได้ผลและตรวจแล้ว ชื่อนี้เป็นเป้าหมาย ยังไม่ถือว่ามี report จนสร้างจริง ปรับแผน Frontend Refactor ตาม findings โดยไม่เปลี่ยนธุรกิจ Final 1.6 เอง

รายงานต้องมี:

1. Current architecture problems พร้อมหลักฐาน
2. KEEP/ADAPT/REMOVE matrix รวม missing required capabilities และ retained dependencies
3. Target folder structure และ route ownership Web/Admin พร้อม URL migration notes
4. State ownership และ data authority: backend เป็น source of truth สำหรับ permission/progress/payment/score
5. Shared package boundary, สิ่งที่ไม่ควร shared และ authoring extraction decision ที่มีหลักฐาน
6. Safe refactor order, จุดแก้แผนเดิม และ proposed R0 → Rn execution plan
7. Acceptance criteria, rollback/checkpoints, risks/blockers และ unresolved decisions
8. Baseline commands/results และสิ่งที่ยังไม่ได้ตรวจ

คงทิศทาง apps/web + apps/admin, packages/ui + api-client + contracts, Feature-first, semantic tokens/Tailwind และ Query/UI state separation; course-authoring package เป็น candidate จนพิสูจน์ reuse; inventory ก่อนลบและ cleanup out-of-scope ก่อน deep refactor; ไม่ redesign UI/เปลี่ยน URL โดยไม่มี migration plan และไม่ใช้ mock types/localStorage เป็น API contract

ตรวจเอกสาร/ลิงก์/whitespace และ commit/push เฉพาะ report/plan ที่ได้รับมอบหมายตาม checkpoint policy รายงาน SHA/branch/ผล push รักษางานค้างผู้อื่น จากนั้นรอผู้ใช้ approve execution plan ก่อน implementation ไม่รวม main หรือ deploy อัตโนมัติ

## 6. โหลด config และข้อจำกัด runtime

- ไฟล์หลักอยู่ repository `.codex/`; workspace ชั้นนอกมี `.codex/config.toml` ชี้ role config_file มาที่ไฟล์เดียวกันเพื่อใช้เมื่อเปิด `D:\code\elearn-prod`
- Project config ต้องถูกโหลดใน trusted project การเขียนไฟล์ไม่พิสูจน์ว่า chat ที่กำลังรัน reload ค่าแล้ว ตรวจ effective config/role registry ใน session ใหม่ก่อนอ้างว่าใช้ custom roles จริง
- `sandbox_mode = "read-only"` เป็นค่า default ของ role แต่ runtime overrides/policy ของ parent อาจมี precedence; คำสั่ง read-only ใน protocol ใช้เสมอ และไม่อ้าง sandbox enforcement จาก TOML เพียงอย่างเดียว
- การตรวจ parser/config registry ไม่ใช่การตรวจ model availability หรือการเรียก Luna จริง บันทึกหลักฐานแต่ละระดับแยกกัน

รูปแบบ config อ้างอิง [Official OpenAI Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) และ [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)
