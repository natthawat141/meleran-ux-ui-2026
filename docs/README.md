# คู่มือ AI และสเปก Melearn UX/UI

อัปเดต 7 ตุลาคม 2026 ชุดนี้ใช้ให้ AI หรือผู้พัฒนาคนใหม่ต่อจากงานปัจจุบัน โดยรักษาหน้าตา flow และรูปแบบ code ที่ตกลงไว้

## อ่านอะไรเมื่อเริ่ม

| เอกสาร | หน้าที่ |
| --- | --- |
| [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md) | **ข้อมูลหลัก Final 1.6 จากฉบับ 1.5 ที่เจ้าของตรวจแล้วและคำยืนยันเพิ่ม Stripe/AI practice**: Domain, permission, flow, scope หนึ่งเดือน และกรณีตรวจรับ |
| [FEATURE_RELEASE_MATRIX.md](FEATURE_RELEASE_MATRIX.md) | ความพร้อมของต้นแบบ/API/release แยกจากการอนุมัติกติกาธุรกิจ |
| [`../AGENTS.md`](../AGENTS.md) | กติกาเริ่มงาน ขอบเขต และคำสั่งรัน |
| [`UI_SPEC.md`](UI_SPEC.md) | แบรนด์ สี ฟอนต์ ไอคอน layout และพฤติกรรมหน้าจอ |
| [`CODE_SPEC.md`](CODE_SPEC.md) | ที่อยู่ implementation, library, route, state, CSS และการตรวจงาน |
| [FRONTEND_REFACTOR_PLAN_TH.md](FRONTEND_REFACTOR_PLAN_TH.md) | แผน Web/Admin; R0–R3c code gates ผ่าน; เปิด R3b visual/accessibility QA และเตรียม R4a API Contract ต่อ flow |
| [R0_INVENTORY_ARCHITECTURE_REVIEW_TH.md](R0_INVENTORY_ARCHITECTURE_REVIEW_TH.md) | ผล R0/Lead review: inventory 89 routes, KEEP/ADAPT/REMOVE, state/packages/authoring boundaries, baseline 51 tests และ execution plan; R1 ผ่านแล้ว; inventory เดิมอ้าง source baseline |
| [ROUTE_MIGRATION_LEDGER_TH.md](ROUTE_MIGRATION_LEDGER_TH.md) | R2a metadata seam, R2b route compatibility และผล R3c modules/snapshot ของ Web 50 + Admin 35 routes |
| [R1_SCOPE_CLEANUP_REPORT_TH.md](R1_SCOPE_CLEANUP_REPORT_TH.md) | ผล scope cleanup, retained routes, legacy snapshot compatibility และหลักฐานการตรวจ |
| [R3_THEME_PROVIDER_REPORT_TH.md](R3_THEME_PROVIDER_REPORT_TH.md) | R3a: รวม Mantine/Ant themes กับ UI provider ใน `packages/ui`; typecheck/build ผ่าน; CSS/Tailwind tokens และ visual QA ยังแยกเป็นงานถัดไป |
| [R3_CSS_TOKENS_REPORT_TH.md](R3_CSS_TOKENS_REPORT_TH.md) | R3b: token source JSON เชื่อม Mantine/Ant, CSS variables และ Tailwind; checks/build ผ่าน; browser smoke โหลด Web Landing กับ Admin Dashboard ได้, visual/contrast/keyboard/responsive QA ยังไม่ครบ |
| [R3C_ROUTE_MODULES_REPORT_TH.md](R3C_ROUTE_MODULES_REPORT_TH.md) | ผล R3c: ย้าย Web/Admin route declarations และ guards เป็น modules, เทียบ 85 routes กับ snapshot R3b, 67 tests/typecheck/build/boundary checks ผ่าน และผล preview-mode smoke |
| [FRONTEND_V1_6_UI_AUDIT_TH.md](FRONTEND_V1_6_UI_AUDIT_TH.md) | ผล preview และ gap audit เทียบ Final 1.6; แยก UI ที่เห็นได้, prototype mismatches และสิ่งที่รอ API/backend โดยไม่เปลี่ยน business behavior |
| [R0 workflow ใน .codex](../.codex/workflows/r0-inventory.md) | วิธี Lead dispatch สี่ Luna xhigh inventory roles, common evidence format, read-only boundary, baseline/review/report และ approval ก่อน implementation |
| [BUSINESS_ANALYTICS_UI_SPEC.md](BUSINESS_ANALYTICS_UI_SPEC.md) | **เลิกใช้เป็นข้อกำหนดปัจจุบัน**; ทางเข้าประวัติต้นแบบ |
| [INSTRUCTOR_ANALYTICS_UI_SPEC.md](INSTRUCTOR_ANALYTICS_UI_SPEC.md) | **เลิกใช้เป็นข้อกำหนดปัจจุบัน**; ทางเข้าประวัติต้นแบบ |
| [BUSINESS_ANALYTICS_DATA_SPEC.md](BUSINESS_ANALYTICS_DATA_SPEC.md) | **เลิกใช้เป็นข้อกำหนดปัจจุบัน**; ทางเข้าประวัติต้นแบบ |
| [ADMIN_MANAGEMENT_GAP_AUDIT_TH.md](ADMIN_MANAGEMENT_GAP_AUDIT_TH.md) | **เลิกใช้เป็นข้อกำหนดปัจจุบัน**; ทางเข้าประวัติต้นแบบ |
| [`GIT_CHECKPOINT_POLICY_TH.md`](GIT_CHECKPOINT_POLICY_TH.md) | ผู้ใช้ยืนยันให้ commit และ push อัตโนมัติหลังงานผ่าน พร้อมการสำรอง แยก concurrent work และรายงานจุดย้อนกลับ |
| [`TYPESCRIPT_MIGRATION_INSTRUCTIONS_TH.md`](TYPESCRIPT_MIGRATION_INSTRUCTIONS_TH.md) | ขอบเขต ข้อห้าม และเกณฑ์ย้าย TypeScript โดยรักษา UI/พฤติกรรมเดิม; source และ tooling ย้ายแล้ว |
| [`WORKSPACE_INTEGRATION_20261004.md`](WORKSPACE_INTEGRATION_20261004.md) | ผลรวมงาน Git/TypeScript เส้นทางการเงิน หลักฐานการตรวจ และข้อจำกัดของ AI demo |
| [INBOX_PERMISSION_SPEC.md](INBOX_PERMISSION_SPEC.md) | **เลิกใช้เป็นข้อกำหนดปัจจุบัน**; ทางเข้าประวัติต้นแบบ |

อ่านฉบับหลักก่อน UI/CODE spec ซึ่งใช้รักษาแบรนด์และวิธีทำต้นแบบ การอนุมัติธุรกิจไม่เท่ากับ backend พร้อมหรือเลือกสแตกแล้ว

ผู้ใช้ยืนยัน architecture ของ React Frontend สำหรับ refactor 7 ต.ค. 2026 ตาม CODE_SPEC และแผนด้านบนแล้ว Backend stack, database, session transport และ deployment ยังต้องออกแบบแยก R0 สำรวจและตรวจ baseline แล้ว ผู้ใช้อนุมัติให้ทำต่อแล้ว R1/R2a/R2b, R3a, R3b และ R3c code gates ผ่าน; CSS variables/Tailwind กับ theme adapters อ่าน token source ใน `packages/ui` และ router declarations อยู่ใน `apps/*/src/app/router/` แล้ว มี authenticated UI spot-check ผ่าน demo accounts ในรอบต่อมา แต่ visual/accessibility/responsive QA เต็มรูปแบบยังเปิด ส่วน R4a API Contract เป็นงานถัดไป

ใช้ชื่อเป้าหมาย `apps/web` และ `apps/admin` รองรับ build/deploy แยกกัน มี basic CI หลัง split apps และชุด Containerization/CI-CD ช่วงเตรียมส่งมอบ Cloud Run ยังเป็น candidate โครงสร้างตัวอย่างไม่ใช่คำสั่งเปลี่ยนชื่อ checkout หรือ repository

Stripe Checkout ซื้อคอร์สแล้วได้สิทธิ์และ AI สร้างชุดฝึกในแชตอยู่ในรอบแรกแล้ว ส่วน Inbox, Finance, Orders/Cart แบบเต็ม และ analytics แบบใหญ่ยังไม่ทำ เอกสารเก็บประวัติไม่ใช่งานที่ต้องทำให้ครบ

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

> อ่าน AGENTS.md, docs/MELEARN_V1_SCOPE.md, docs/UI_SPEC.md และ docs/CODE_SPEC.md ก่อน ดู source ของ route `/teach/courses/course-writing/curriculum` แล้วแก้ปัญหา [ระบุปัญหา] โดยรักษาแบรนด์และ flow ที่มีอยู่ ใช้ component ที่ติดตั้งแล้ว แก้เฉพาะขอบเขตนี้ เปิด preview และรายงานผลตรวจที่ทำจริง

## การอัปเดตสเปก

### AI Course Support ใน UX prototype

แอดมินเปิดหรือปิด Melearn AI ที่หน้าตั้งค่าคอร์ส และบันทึกข้อความ AI Transcript จากหน้าแก้วิดีโอโดยแยกจาก draft บทเรียน ข้อมูลจำลองเก็บใน `localStorage` ผ่าน `aiEnabled` และ `VideoItem.transcript` (ตรงกับชื่อ `ai_enabled` และ `VideoTranscript` ในเอกสาร scope) ผู้เรียนที่ลงทะเบียนและเปิด AI แล้ว รวมถึงแอดมินหรือเจ้าของคอร์สที่เปิด AI ใช้เลือกบริบทคอร์สได้ ส่วนบัญชีสมัครด้วยอีเมลที่ยังไม่ยืนยันไม่มีสิทธิ์บริบทการเรียน; บัญชีที่ Admin สร้างเริ่มเรียนได้ทันทีตามฉบับหลัก การตอบแชตยังเป็น mock; ไม่มี model, retrieval backend, API หรือ network integration

ตรวจ helper ด้วย `node --test tests/ai-course-support.test.mjs` ร่วมกับ `npm.cmd run typecheck` และ `npm.cmd run build`

- เมื่อผู้ใช้เปลี่ยนทิศทางหรือยืนยัน pattern ใหม่ อัปเดต section ที่เกี่ยวข้องใน UI/CODE spec พร้อมวันที่และเหตุผลสั้น ๆ
- แยกสิ่งที่ผู้ใช้ยืนยันออกจากสิ่งที่ AI เสนอหรือเพิ่ง implement อย่าเขียนว่าอนุมัติแล้วเพียงเพราะ build ผ่าน
- เปลี่ยนรายละเอียดสี/พฤติกรรมในสเปกกลาง ไม่ทำสำเนารายละเอียดทั้งหมดใน GEMINI หรือ Cursor rule
- ข้อกำหนดสั้นใน AGENTS/rule ต้องสอดคล้องกับสเปก ถ้าทิศทางหลักเปลี่ยน ให้แก้ข้อความย่อเหล่านั้นในงานเดียวกัน
- เอกสารร่างใน workspace ชั้นนอกเป็นข้อมูลประกอบ หากขัดกับ feedback ล่าสุด ให้ยึด feedback ล่าสุดและบันทึกความต่าง

## การปรับเอกสารเดิม

ดู [รายการที่แก้และข้อจำกัดโค้ด](DOCUMENT_RECONCILIATION_20261006.md) เอกสารประวัติใน `archive/` มีไว้ตรวจที่มา ห้ามนำมาแทนฉบับหลัก
