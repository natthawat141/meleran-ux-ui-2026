# Container configuration และ CI draft — R11/R12

ไฟล์ชุดนี้เตรียม static frontend ของ `apps/web` และ `apps/admin` ให้ build แยกจาก monorepo root ใช้ NGINX แบบ non-root เสิร์ฟผล Vite build ไม่ใช่ dev/preview server และไม่เลือก hosting หรือเปิด deployment

**สถานะ 8 ต.ค. 2026: R11 configuration preparation เท่านั้น และ R12 CI-only.** ผู้ใช้สั่งไม่รัน Docker เนื่องจากใช้ RAM; image build/runtime smoke ยังไม่ผ่านและไม่มี smoke container. GitHub Actions [run 37743882854](https://github.com/natthawat141/meleran-ux-ui-2026/actions/runs/37743882854) สำหรับ commit `2fbe389` ผ่านครบทั้ง shared checks, Web/Admin typecheck/build/artifacts และ final status job; มีเพียง warning เรื่อง action รุ่นปัจจุบันถูกบังคับใช้ Node 24 กับ runner image ที่จะเปลี่ยนในอนาคต. Workflow ไม่มีคำสั่ง Docker เพื่อไม่ให้ push แล้วเริ่ม build/smoke อัตโนมัติ คำสั่ง manual ด้านล่างเป็นวิธีตรวจในรอบที่อนุญาตให้รัน ไม่ให้รัน Docker ระหว่างข้อจำกัดดังกล่าว

## Build และตรวจบนเครื่อง

ต้องมี Node 24 และ Docker Linux daemon ที่ใช้งานได้ รันจาก root ของ repository:

```powershell
docker build --file apps/web/Dockerfile --tag melearn-web:local .
docker build --file apps/admin/Dockerfile --tag melearn-admin:local .
node containers/verify-container.mjs --app web --image melearn-web:local
node containers/verify-container.mjs --app admin --image melearn-admin:local
node containers/verify-container.mjs --app web --image melearn-web:local --port 9090
node containers/verify-container.mjs --app admin --image melearn-admin:local --port 9090
```

`npm ci` ทำใน build stage โดยใช้ root lockfile และ workspace manifests ไม่ใช้ `node_modules` ของเครื่อง Base images pin ด้วย manifest digest; อัปเดต digest ของ Dockerfiles ทั้งคู่พร้อมผล build/smoke เมื่ออัปเดตรุ่น ผล runtime image มี static files ของแอปที่เลือกเท่านั้น ส่วน Node/dependencies/source อยู่ใน build stage

Smoke runner เปิด container ชั่วคราวบน random localhost port และลบเฉพาะ container ที่ตนสร้างหลังตรวจ non-root, NGINX syntax, `/healthz`, assets/cache headers, SPA shell ที่ deep link, missing assets/API/hidden-file 404 และค่า `PORT` ที่กำหนด Health/deep-link HTTP 200 ยืนยัน static runtime เท่านั้น ไม่ยืนยันสิทธิ์หรือ flow ของแอป

ตัวอย่างเปิดดูเองบน localhost:

```powershell
docker run --rm --publish 127.0.0.1:8080:8080 melearn-web:local
docker run --rm --publish 127.0.0.1:8081:8080 melearn-admin:local
```

ใช้ `Ctrl+C` ปิด process; `--rm` ลบ container ที่หยุดแล้ว ค่า `PORT` เป็น port ของ static server เท่านั้น ถ้าเปลี่ยนเป็น `9090` ต้อง map container port `9090` ด้วย แต่ละแอปเสิร์ฟที่ `/` ของ origin ตนเอง ไม่รองรับการติดใต้ path prefix ในชุดนี้

## Configuration ที่ยังรอการตัดสินใจ

`.dockerignore` ไม่ส่ง `.env*`, `.npmrc`, Git, `node_modules` หรือ `dist` เข้า build และ Dockerfile รับ public VITE_API_BASE_URL/VITE_API_MODE/VITE_APP_ENV เป็น build arguments; ไม่รับ session/secrets ชุดนี้ใช้ build defaults เดิม ซึ่ง feature gates ยังขึ้นกับ readiness ของ prototype ห้ามใช้ผล build เป็นการเปิดฟีเจอร์ `released`

Vite ค่าที่ browser เห็นเป็น build-time configuration; การส่ง environment variables ให้ `docker run` ไม่เปลี่ยน bundle ที่สร้างแล้ว นอกจาก `PORT` ซึ่งใช้กับ NGINX ต้องตกลง public API URL/config strategy และ session/credentials กับ backend ก่อนสร้าง environment images, image promotion หรือ CD ห้ามฝัง secrets ใน frontend ไม่มี API proxy/backend ใน container นี้ (`/api` และ `/api/*` คืน 404)

## CI สำหรับตรวจโดยไม่ใช้ local RAM

Frontend CI มี hosted container matrix Web/Admin (max-parallel1) หลัง shared checks ผ่าน; build images จาก root แล้วใช้ verify-container.mjs ตรวจ PORT8080 และ8181. Runner สร้าง/ลบเฉพาะ smoke containers ของตน ไม่มี registry push/deploy/credentials ใหม่. validate job รวมผล containers เพื่อให้ failure ไม่ถูกมองเป็น CI success. เปลี่ยน app ตรวจ appนั้น; เปลี่ยน packages/tools/root configs ตรวจทั้งคู่; docs-only skip code/container jobs.

ผล static runtime ไม่ยืนยันการ login/edit/review/payment หรือ Backend integration. ดู current run/SHA ใน docs/R7_API_MOCK_PROGRESS_TH.md. รอบนี้ไม่เปิด Docker daemon หรือรัน image บนเครื่องผู้ใช้.
