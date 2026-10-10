# Melearn Tutor — Frontend + Backend

Branch `backend/v1-foundation` ใน repo [natthawat141/meleran-tutor](https://github.com/natthawat141/meleran-tutor/tree/backend/v1-foundation) มี code ทั้งสองฝั่งวางคู่กันตามคำยืนยันผู้ใช้วันที่ 10 ต.ค. 2026:

```text
frontend/   React monorepo: apps/web + apps/admin + packages
backend/    ASP.NET Core: Melearn.slnx + src + tests
docs/       Business scope Final 1.6 + canonical API Contract
.github/    CI สำหรับสองฝั่งจาก repository root
```

Frontend นำจาก `main` commit `1de138f`; Backend จาก `431c999`; เอกสารกลางจาก `5de625e`. ประวัติทั้งสามชุดอยู่ใน merge parents. Branch `main` ยังคงมี Frontend รูปแบบเดิม; ไม่ merge โครงสร้าง fullstack ทับ `main` ในงานนี้.

## เริ่มพัฒนา

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev:web
# อีก terminal: npm.cmd run dev:admin

cd ../backend
dotnet restore Melearn.slnx --locked-mode
# ดู README ของ Backend สำหรับ DB/env ก่อนเรียก scripts/dev.ps1
```

- [Frontend commands / deploy](frontend/README.md)
- [Backend commands / status](backend/README.md)
- [Final 1.6](docs/MELEARN_V1_SCOPE.md)
- [Canonical API Contract](docs/api-contract/README.md)
- [Backend execution plan](docs/BACKEND_DELIVERY_PLAN_TH.md)

ไฟล์ `.env`, keys, node_modules, bin/obj และงานค้างใน checkouts เดิมไม่ได้รวมมา. Frontend ยังใช้ HTTP mock ใน dev; Backend มี 13 operations บางส่วนและยังไม่ตรวจ live integration. งานนี้ย้ายโครง Git/CI เท่านั้น ไม่เพิ่ม API หรือ deploy.
