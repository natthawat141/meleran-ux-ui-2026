# รายงาน R4b-prep — HTTP transport กลาง

วันที่ 8 ตุลาคม 2026 · branch `refactor/v1-api-ready`

## ผลที่ทำ

เพิ่ม transport กลางใน `packages/api-client` สำหรับเตรียมเชื่อม HTTP โดยให้แอป/feature เป็นผู้ส่งค่า `baseUrl`, `fetcher`, headers, credentials, timeout และ decoder ทุกครั้ง ไม่มีค่า API origin หรือ session policy เริ่มต้น ตัว client ไม่สร้าง auth header, envelope, content type หรือ body เอง และไม่แปลง mock เป็น fallback เมื่อ request ล้มเหลว

Success response อ่าน JSON เมื่อ content type ถูกต้อง แล้วคืนเฉพาะค่าที่ decoder ตรวจแล้ว; `204`/`205`/`HEAD` ส่ง `undefined` เข้า decoder ผู้เรียกกำหนดเอง ส่วน error แยก configuration, network, abort, timeout, HTTP status, non-JSON, malformed JSON และ payload ที่ decoder ปฏิเสธ โดยเก็บเฉพาะชนิดและ HTTP status ไม่เก็บ URL, response body หรือ error cause ที่อาจมีข้อมูลอ่อนไหว การ cancel/timeout ครอบคลุม fetch, response body และ async decoder แม้ adapter ที่ inject จะไม่ทำตาม AbortSignal

URL join รักษา base path ที่ตั้งไว้และปฏิเสธ absolute/protocol-relative path หรือ path traversal ที่หลุดขอบเขต API client ยังไม่มี business endpoint, DTO, TanStack Query hooks, cache keys, auth/session provider, retries หรือ mock adapter

## การตรวจ

- `node --test tests/http-client.test.mjs` — 16/16 ผ่าน
- `npm.cmd run typecheck` — Web, Admin และ legacy ผ่าน
- `npm.cmd run check:boundaries` — ผ่าน
- `npm.cmd run build` — Web และ Admin production build ผ่าน
- `git diff --check` — ผ่าน

ผลนี้ยืนยันเฉพาะ generic transport และ production bundles ที่สร้างได้ ไม่ยืนยัน API, auth/session, persistence, permissions หรือ flow ใดใน Final 1.6

## Gate ถัดไป

R4a ยังคงเป็น Draft เพราะยังไม่มี Backend owner/OpenAPI ผู้รับผิดชอบของแต่ละ flow ต้องยืนยัน request/response/error, credentials, DTO visibility และ permission behavior ก่อนเพิ่ม types ใน `packages/contracts` หรือ Query hooks ของ flow นั้น แยก evidence ของ backend integration ใน R10/R13 ออกจาก build และ transport tests
