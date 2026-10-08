# เอกสาร Melearn Frontend

เริ่มที่ไฟล์นี้ · อัปเดต 8 ตุลาคม 2026

## เอกสารหลักที่ใช้ทำงาน

| เรื่อง | อ่านไฟล์นี้ |
| --- | --- |
| ขอบเขตและกติกาธุรกิจ | [MELEARN_V1_SCOPE.md](MELEARN_V1_SCOPE.md) — Final 1.6 |
| หน้าตาและพฤติกรรม UI | [UI_SPEC.md](UI_SPEC.md) |
| โครงสร้างและแนวทางเขียน code | [CODE_SPEC.md](CODE_SPEC.md) |
| แผน refactor และสถานะ R | [FRONTEND_REFACTOR_PLAN_TH.md](FRONTEND_REFACTOR_PLAN_TH.md) |
| API ที่ Frontend ต้องใช้ | [API Contract Draft](API_CONTRACT_R4A_DRAFT_TH.md) และ [รายละเอียด Auth/Catalog](API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md) — ยังเป็น Draft |
| เกณฑ์ตรวจรับและสิ่งที่ยังขาด | [FRONTEND_API_ACCEPTANCE_MATRIX_TH.md](FRONTEND_API_ACCEPTANCE_MATRIX_TH.md) |

กติกาการทำงานอยู่ที่ [AGENTS.md](../AGENTS.md) และ [Git checkpoint policy](GIT_CHECKPOINT_POLICY_TH.md). เมื่อมีการแก้ข้อกำหนด ให้อัปเดตไฟล์หลักที่เกี่ยวข้อง ไม่สร้างสเปกหรือแผนอีกชุดที่ซ้ำกัน

## อ่านเมื่อเกี่ยวข้องกับงาน

| งาน | เอกสาร |
| --- | --- |
| รัน mock / ดูข้อจำกัดของ mock | [PROVISIONAL_API_MOCK_TH.md](PROVISIONAL_API_MOCK_TH.md), [mock server README](../tools/provisional-api/README.md) |
| ย้าย URL / ตรวจ route owners | [ROUTE_MIGRATION_LEDGER_TH.md](ROUTE_MIGRATION_LEDGER_TH.md) |
| ตรวจ feature gates / release readiness | [FEATURE_RELEASE_MATRIX.md](FEATURE_RELEASE_MATRIX.md) |
| ดูผลและช่องว่าง R7–R10 ที่ทำไว้ | [R7_API_MOCK_PROGRESS_TH.md](R7_API_MOCK_PROGRESS_TH.md) |
| ดู UI gaps เทียบ Final 1.6 | [FRONTEND_V1_6_UI_AUDIT_TH.md](FRONTEND_V1_6_UI_AUDIT_TH.md) |
| ดูเหตุผลการตัดสิน architecture | [R0 Inventory/Review](R0_INVENTORY_ARCHITECTURE_REVIEW_TH.md) |
| การมอบหมายงาน AI | [AI_DELEGATION_POLICY_TH.md](AI_DELEGATION_POLICY_TH.md) — ยึดคำสั่งล่าสุดของผู้ใช้ก่อน |

## สถานะปัจจุบัน

Frontend ยังไม่เสร็จตามเป้าหมายเลิกใช้ legacy: Web/Admin ยังพึ่ง `src/` กลาง หลาย API routes เปิดเฉพาะ dev และ contract ราย flow ยังไม่ครบ. Mock/tests และ Docker Web/Admin มีหลักฐานตรวจผ่านบางชุด แต่ไม่แทนการตรวจ Frontend ทุก flow หรือ Backend จริง. ใช้แผนและ acceptance matrix ด้านบนสำหรับงานที่เหลือ

## เอกสารย้อนหลัง

รายงานตรวจแต่ละ R, ผล Git/TypeScript รุ่นก่อน และแผนที่ทำไปแล้วอยู่ใน [archive](archive/README.md). ใช้ตรวจเหตุผลหรือผลทดสอบ ณ revision เก่า ไม่ต้องอ่านทั้งหมดก่อนเริ่มงาน และไม่ใช้แทนสเปกปัจจุบัน

อัปเดตสถานะในแผนและ progress ที่มีอยู่แล้ว เก็บรายละเอียดชุดตรวจย้อนหลังใน archive แทนการเพิ่มไฟล์รายงานที่ระดับหลักของ `docs/`
