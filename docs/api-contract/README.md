# API Contract — แหล่งหลักร่วมของ Frontend และ Backend

วันที่ 10 ตุลาคม 2026 · Draft ยังไม่ freeze · 86 defined + 5 deferred operations

- [OpenAPI 3.1](openapi.json) — canonical schema
- [14 feature groups และ JSON handbook](API_CONTRACT_FEATURES_TH.md) — generated projection
- [Decision register](API_CONTRACT_R4A_DRAFT_TH.md)
- [Auth/Catalog details](API_CONTRACT_R4A_FLOW_AB_DRAFT_TH.md)

แก้ schema ที่ `openapi.json` ในโฟลเดอร์นี้เท่านั้น. Frontend `packages/contracts/openapi/openapi.json` เป็น tracked snapshot เพื่อให้ clone/build/CI ได้โดยไม่ต้องมี sibling repo; ห้ามแก้ snapshot โดยตรง. Backend ใช้เอกสารกลางนี้เป็น Draft handoff ยังไม่มี generated business DTOs.

จาก Frontend:

```powershell
npm.cmd run contracts:sync
npm.cmd run contracts:generate
npm.cmd run contracts:check
node ../docs/api-contract/generate-handbook.mjs
node ../docs/api-contract/generate-handbook.mjs --check
```

`contracts:sync -- --check` ตรวจ snapshot ตรงกับ canonical. `contracts:check` ตรวจ canonical drift เพิ่มเมื่อพบเอกสารกลาง และยังทำงานจาก snapshot ได้ใน standalone CI. รัน tests หลังเปลี่ยน schema/examples. Contract version/distribution และ remote/pinning ของ docs ยังต้องจัดก่อนใช้งานหลายเครื่อง; ไม่อ้างว่าสามารถ clone shared docs จาก GitHub ได้แล้ว.

Auth provider ยืนยัน Firebase Email/Google + .NET Username ไม่มี email แล้ว; [Auth integration Draft](../../backend/docs/AUTH_DECISION_TH.md). OpenAPI/mock ยังเป็น flow เดิมจนเปลี่ยน exchange/link/session พร้อม SDK/implementation/tests. ไม่ถือว่าการย้ายไฟล์เปลี่ยน protocol หรือทำ API จริงเสร็จ.
