# Melearn Tutor — เอกสารกลาง

อัปเดต 10 ตุลาคม 2026. โฟลเดอร์นี้เป็น Git repository สำหรับเอกสารที่ Frontend/Backend ใช้ร่วมกัน; ยังไม่มี remote.

- [Business scope Final 1.6](MELEARN_V1_SCOPE.md)
- [API Contract index](api-contract/README.md)
- [Frontend UI/code/plan](../melearn-tutor-frontend/docs/README.md)
- [Backend architecture](../melearn-tutor-api/docs/BACKEND_ARCHITECTURE.md)
- [Auth decision](../melearn-tutor-api/docs/AUTH_DECISION_TH.md)

Frontend และ API ใช้ repositories เดิม มีชื่อโฟลเดอร์ใหม่. เอกสารเฉพาะแอปอยู่ใน repository ของแอปนั้น. Links ไปอีก repo ต้อง checkout sibling ตามโครง workspace นี้; hosted links จะกำหนดเมื่อมี remote ของเอกสาร/API. ไม่ถือว่า local Git commit คือ backup นอกเครื่อง.

ร่าง LMS/PRODUCT ที่เลิกใช้ถูกลบจากระดับ workspace เพราะมีต้นฉบับย้อนหลังใน `../artifacts/document-reconciliation-20261006/`. รายงาน acceptance และ archive ของ Frontend ยังเก็บไว้ เพราะอ้าง revision/ผลตรวจที่ต่างกันและยังมีลิงก์ใช้งาน.

## ผลตรวจการย้าย 10 ต.ค. 2026

Frontend typecheck/build ทั้ง Web/Admin, tests 172 ข้อ, contract generation/check และ boundary checks ผ่าน. Backend locked restore/Release build (0 warnings/errors) และ tests 15 ข้อผ่าน. Shared docs/workspace current Markdown links ผ่าน; canonical OpenAPI กับ Frontend snapshot ตรงกัน. Linked Git worktrees ถูก repair ให้ชี้ตำแหน่งใหม่แล้ว. ไม่ใช่ browser/mobile/provider acceptance และไม่ได้รัน Docker.

Build มี warnings ของ dependencies/chunk size และภาพ brand-pattern ใน Landing ที่ยังมี relative URL เดิมผิด; ไม่มีการแก้ UI ในชุดย้ายนี้. npm ci รายงาน dependency advisories 8 high; ไม่ใช้ audit fix/อัปเกรดที่อาจเปลี่ยนพฤติกรรมในงานนี้.

รักษางานค้าง Frontend `.codex/README.md`, `.env.example` และ Backend appsettings ทั้งสองไฟล์ไว้ ไม่รวมใน commits ของการย้าย. `.env`/`.env.local` ยังอยู่ใน repo ของแอปเดิมและถูก ignore. Workspace guidance ก่อนแก้และ obsolete stubs กู้ได้จาก `../.recovery/workspace-rename-20261010/`; workspace root ไม่ใช่ Git repository.
