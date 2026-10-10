# Melearn Tutor fullstack branch

คำยืนยันผู้ใช้ล่าสุด: branch `backend/v1-foundation` ใน repo `natthawat141/meleran-tutor` ต้องมี `frontend/` และ `backend/` วางคู่กัน. `main` ยังคงเป็น Frontend รุ่นเดิม. ไม่สร้าง repo แยกและไม่ push Backend ทับ `main`.

- Business rules: `docs/MELEARN_V1_SCOPE.md` Final 1.6; canonical API: `docs/api-contract/openapi.json`.
- Frontend: อ่าน `frontend/AGENTS.md`, `frontend/docs/UI_SPEC.md`, `frontend/docs/CODE_SPEC.md` และ checkpoint policy ก่อนแก้.
- Backend: อ่าน `backend/AGENTS.md` และ architecture document ก่อนแก้.
- ทำงานคนเดียวตามคำสั่งล่าสุด; พักการเขียน API จนกว่าผู้ใช้สั่งต่อ.
- ใช้ working directory `frontend/` สำหรับ npm/containers และ `backend/` สำหรับ dotnet.
- `.github/workflows/` ที่ root คือ CI ของ branch นี้; workflows ภายใน frontend/backend เป็น source snapshot เดิมและ GitHub ไม่เรียกจาก nested directories.
- รักษา dirty work/secrets ใน checkouts เดิม; stage เฉพาะงานที่ได้รับอนุญาต. ไม่ deploy, รัน local Docker หรือสร้าง cloud resources โดยอัตโนมัติ.
