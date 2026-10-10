# Shared Melearn documentation

เอกสารกลางของ Frontend/Backend; scope ใช้ MELEARN_V1_SCOPE.md Final 1.6. Canonical schema อยู่ api-contract/openapi.json. API Contract ยังเป็น Draft. ห้ามนำ mock/types หรือการ build ผ่านมาอ้างว่า API/security พร้อม.

หลังแก้ schema: sync snapshot ที่ ../frontend ด้วย contracts:sync; generate/check/tests ตาม frontend workflow; regenerate handbook ด้วย node api-contract/generate-handbook.mjs. ตรวจ local links และ git diff --check ก่อน commit. Handbook ห้ามแก้ tables/JSON มือ.

คง UI/CODE specs ใน Frontend และ architecture/identity implementations ใน Backend. ทำคนเดียวตามคำสั่งล่าสุด; ไม่ deploy/เพิ่ม billing/รัน local Docker. ใน fullstack branch นี้ docs อยู่ร่วมกับ frontend/backend ใน repo `natthawat141/meleran-tutor` branch `backend/v1-foundation`; canonical schema อยู่ที่นี่. ไม่ push โครงนี้ทับ `main` ของ Frontend.
