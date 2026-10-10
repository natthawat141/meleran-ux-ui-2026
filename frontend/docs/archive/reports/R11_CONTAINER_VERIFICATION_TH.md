# R11 Containerization verification

วันที่ 8 ตุลาคม 2026 · branch `refactor/v1-api-ready` · source revision `cf79b85`

## ผลตรวจ

R11 ผ่าน local build/runtime smoke สำหรับ Web และ Admin แยก image จาก monorepo root แล้ว โดย build เป็น production Vite bundle และใช้ unprivileged NGINX ใน final image. ไม่มี container ทดสอบค้างหลังจบ smoke; เก็บ images ไว้ใน Docker local สำหรับลองรันซ้ำ.

| App | Local image | Image ID | ขนาด |
| --- | --- | --- | ---: |
| Web | `melearn-web:r11` | `sha256:3e9c507dff1da57af6d6c02dd1c9602948f41b4c050251ddc1836a3add225def` | 82,418,339 bytes (78.6 MiB) |
| Admin | `melearn-admin:r11` | `sha256:53b23bd2fcd608380a531a0bbc59f5f28365bbef7c76f11a0115a2cd281d8c83` | 80,056,585 bytes (76.3 MiB) |

Docker Desktop Linux Engine `29.1.2`. Fresh Web build ติดตั้ง dependency 508 packages ด้วย `npm ci` ประมาณ 4 นาที; Admin build ใช้ dependency layer ที่ Docker cache ไว้.

## คำสั่งที่ผ่าน

```powershell
docker build --file apps/web/Dockerfile --tag melearn-web:r11 .
node containers/verify-container.mjs --app web --image melearn-web:r11 --port 8080

docker build --file apps/admin/Dockerfile --tag melearn-admin:r11 .
node containers/verify-container.mjs --app admin --image melearn-admin:r11 --port 8181
```

ทั้งสอง container smoke จบด้วย exit code 0. Runner เลือก host port แบบสุ่มบน `127.0.0.1` แล้วส่ง `PORT` เข้า container เพื่อทดสอบ NGINX บน 8080 สำหรับ Web และ 8181 สำหรับ Admin.

## สิ่งที่ smoke ยืนยัน

- Container ใช้ user ที่ไม่ใช่ root; การทดสอบรันด้วย `--cap-drop=ALL` และ `no-new-privileges`.
- Image มี Docker `HEALTHCHECK` ที่ตรวจ `/healthz`; endpoint ตอบ `ok`, คำสั่งตรวจภายใน container ผ่าน และ `nginx -t` ผ่าน.
- `/` และ deep link ของแต่ละ app ส่ง `index.html` ของ app นั้นพร้อม `Cache-Control: no-store`; refresh ที่ `/learn/courses/container-smoke` ของ Web และ `/admin/courses/container-smoke` ของ Admin ได้ HTTP 200.
- assets ที่ HTML อ้างถึงโหลดได้, ส่ง cache header แบบ immutable และไม่ถูกแทนด้วย HTML.
- path ของไฟล์ที่ไม่มี, `/api/container-smoke` และ `/.env` ตอบ 404 ไม่ fallback ไป SPA shell.
- Smoke runner ลบ container ทดสอบใน `finally`; ตรวจหลังทดสอบแล้วไม่มี container ค้าง.

Final image ของแต่ละ app copy เฉพาะ `dist/web` หรือ `dist/admin` ตาม Dockerfile; source ของอีก app ไม่ได้ถูก bundle เข้า runtime image. Build context ยังมาจาก monorepo root เพื่อใช้ root lockfile และ shared packages; `.dockerignore` ตัด `.env*`, `.npmrc`, `node_modules`, `dist`, docs และ Git metadata.

## ข้อจำกัด

- นี่เป็น local container verification ไม่ได้ push image เข้า registry, deploy, เลือก hosting หรือเปิด service จริง.
- Image เสิร์ฟ static SPA เท่านั้น. `/healthz` ยืนยัน NGINX/runtime ไม่ได้ตรวจ API/backend; `/api/*` ตั้งใจตอบ 404 จนกว่าจะมี API origin/proxy ที่ตกลงกัน.
- ไม่มี Backend/OpenAPI จึงยังไม่มี API origin/session CORS/CSRF หรือ secrets ให้ใส่ใน image. ห้ามใช้ผล R11 แทน R10/R13 API acceptance.
- Vite ยังเตือน vendor `use client` directives และ bundle JavaScript เกิน 500 kB; warnings เหล่านี้ไม่ทำให้ production build หรือ container smoke ล้ม.
- npm เตือนว่า `esbuild` install script ยังไม่อยู่ใน allow-list; ในการ build นี้ Vite compile ผ่านทั้งสอง app.
