# คำสั่งย้าย JavaScript → TypeScript โดยรักษา UI และพฤติกรรมเดิม

วันที่ 1 ตุลาคม 2026 · เป้าหมาย: `D:\code\elearn-prod\elearning-ux-v2`

**สถานะ 4 ตุลาคม 2026: application source และ Vite config ย้ายเป็น TypeScript แล้ว; ผลตรวจและข้อจำกัดอยู่ใน [WORKSPACE_INTEGRATION_20261004.md](WORKSPACE_INTEGRATION_20261004.md)**

เอกสารนี้เดิมเป็นคำสั่งสำหรับงานในอนาคต ต่อมาผู้ใช้สั่งดำเนิน migration และรวมงานค้างขึ้น Git แล้ว เอกสารกำหนดขอบเขตการย้ายภาษาเท่านั้น ไม่อนุมัติ backend, API contract, deployment หรือกติกาธุรกิจเพิ่มเติม

การเก็บ checkpoint ใช้ [GIT_CHECKPOINT_POLICY_TH.md](../../GIT_CHECKPOINT_POLICY_TH.md): ผู้ใช้ยืนยันภายหลังให้ commit และ push อัตโนมัติหลังแต่ละชุดผ่านการตรวจ กติกานี้แทนข้อความเดิมที่ต้องรอคำสั่ง commit/push แยก ห้ามรวมงานค้างผู้อื่นหรือเปลี่ยน checkout ของ agent ที่กำลังทำงาน

## 1. เป้าหมายและนิยามคำว่า “ทั้งหมด”

ย้าย application source ที่ทีมดูแลจาก `.js`/`.jsx` เป็น `.ts`/`.tsx` ให้มี types ที่สะท้อนข้อมูลจริง ตรวจชนิดข้อมูลได้ และรักษาหน้าตา ข้อความ ลิงก์ และพฤติกรรมปัจจุบัน

- ครอบคลุมทุกไฟล์ JavaScript/JSX ภายใต้ `src/` รวม pages, components, store, data, mocks แบบ JavaScript, selectors ใน `src/api/`, helpers และ theme
- ย้าย `vite.config.js` เป็น `vite.config.ts` และแทนที่ `jsconfig.json` ด้วย TypeScript configuration ที่รักษา alias เดิม
- สำรวจไฟล์ JavaScript ที่ทีมดูแลนอก `src/` ณ วันที่เริ่ม ถ้ามี scripts/tests/config อื่น ให้ระบุใน inventory และย้ายเมื่อเกี่ยวกับการ build/test แอปนี้ หากไฟล์ต้องรันตรงด้วย Node ให้รักษาคำสั่งรันที่ทำงานได้ ไม่เปลี่ยนนามสกุลโดยไม่จัดการ runtime
- JSON, CSS, HTML, รูปภาพ, ฟอนต์ และเนื้อหา Markdown ไม่ต้องแปลงเป็น TypeScript
- ไม่ครอบคลุม `node_modules/`, `dist/`, generated/vendor code หรือโปรเจกต์ข้างเคียง
- ระหว่างย้ายอนุญาตให้ JS และ TS อยู่ร่วมกันชั่วคราว เมื่อส่งมอบครบต้องไม่มี JS/JSX ของแอปที่ตกหล่นในขอบเขต หากมีข้อยกเว้นต้องแจ้งและให้ผู้ใช้ยืนยัน ไม่ประกาศว่าครบทั้งที่ยังเหลือ

ต้นแบบยังใช้ browser-local mock data หลังย้าย ไม่มี backend Production เกิดขึ้นจากงานนี้

## 2. อ่านก่อนลงมือและเก็บ baseline

1. ยืนยัน absolute path และอ่าน [AGENTS.md](../../../AGENTS.md), [UI_SPEC.md](../../UI_SPEC.md), [CODE_SPEC.md](../../CODE_SPEC.md) และเอกสารนี้
2. อ่าน [INBOX_PERMISSION_SPEC.md](../pre-final-20261006/INBOX_PERMISSION_SPEC.md) เพื่อเข้าใจความต่างระหว่างกติกาที่ตกลงกับ implementation ปัจจุบัน **ไม่ implement ความต่างนั้นในงานย้ายภาษา**
3. ตรวจ `git status --short` และ diff ปัจจุบัน รวมไฟล์ untracked ก่อนแก้ มีงานค้างเดิมอยู่มาก ห้ามถือว่า diff ทั้งหมดเป็นงาน migration
4. ทำ inventory source, import paths, scripts, package versions และ storage keys จาก source ล่าสุด อย่าใช้จำนวนไฟล์ในรายงานเก่าเป็นรายการตายตัว
5. เก็บรายการไฟล์ที่จะเปลี่ยน และ baseline ของ build, routes, UI desktop/mobile และ critical flows ก่อนเปลี่ยน ถ้ามีเครื่องมือไม่พร้อมให้บันทึกข้อจำกัดตามจริง
6. เก็บหลักฐาน baseline ในที่ปลอดภัย เช่น patch ของ tracked files พร้อมสำเนาไฟล์ untracked ที่กำลังจะเปลี่ยน โดยไม่คัดลอก secrets หรือข้อมูลผู้ใช้จริง ห้าม reset/clean checkout เพื่อทำ baseline

หาก baseline มีปัญหาอยู่ก่อน ให้บันทึกแยกจากปัญหาที่ migration ทำให้เกิด ไม่แก้บั๊กเดิมหรือปรับดีไซน์แถมในงานนี้

## 3. ขอบเขตไฟล์ที่อนุญาต

| พื้นที่ | อนุญาต | ข้อจำกัด |
| --- | --- | --- |
| Source JS/JSX ในขอบเขต | rename, types, type imports, generic parameters และการแก้ type errors ที่จำเป็น | รักษา runtime behavior และโครงสร้างหน้าจอ |
| `src/types/` หรือ type-only files ใกล้ feature | เพิ่ม domain types, props, store/action types | ไม่สร้างระบบข้อมูลใหม่หรือบังคับ business rules ใหม่ |
| TypeScript configs, `src/vite-env.d.ts` | เพิ่ม config/declarations สำหรับ app และ tooling | ต้องตรวจ source ครบ ไม่ exclude ไฟล์ที่ผิดเพื่อให้ผ่าน |
| `package.json`, `package-lock.json` | เพิ่ม TypeScript และ `@types/*` ที่จำเป็นใน devDependencies พร้อม script typecheck | ไม่อัปเกรด/เปลี่ยน runtime libraries หรือติดตั้ง tooling ชุดใหม่โดยไม่เกี่ยวข้อง |
| `index.html` | เปลี่ยน entry path `/src/main.jsx` → `/src/main.tsx` | ห้ามเปลี่ยน metadata, title, HTML หรือสี |
| CSS/JSON/assets | อ่านเพื่อเข้าใจ types | ห้ามแก้เนื้อหา ย้าย ลบ หรือปรับ formatting |
| เอกสารกลาง | แก้ชื่อไฟล์/คำสั่ง/สถานะจริงหลัง migration | ไม่เปลี่ยน UI spec หรือขยายข้อกำหนดผลิตภัณฑ์ |
| Tests | เพิ่ม/ปรับเฉพาะ regression ที่เกี่ยวกับความเสี่ยงและ tooling ที่จำเป็น | ไม่สร้าง tests ที่เพียงยืนยัน implementation เดิมซ้ำ |

ไฟล์ JS ที่มีค่า theme/style อนุญาตให้ย้ายภาษาและเพิ่ม types เท่านั้น ค่า runtime ต้องเหมือนเดิม

## 4. สิ่งที่ห้ามทำ

- ห้าม redesign: ไม่เปลี่ยนสี ฟอนต์ ไอคอน รูปภาพ layout spacing breakpoint ขนาด sidebar หรือ animation
- ห้ามเปลี่ยน JSX ที่แสดงผล: รักษา DOM structure, ลำดับ component, className, inline style, ข้อความไทย, props ที่ควบคุมพฤติกรรม และ accessibility attributes เดิม การเพิ่ม type arguments ที่ไม่เปลี่ยน runtime ทำได้
- ห้ามเปลี่ยน UI library, routing library, state management, editor หรือ package versions เพื่อหลบ type errors
- ห้ามเพิ่มปุ่ม alert/toast, loading spinner หรือเปลี่ยนข้อความสำเร็จ/ผิดพลาด เพียงเพราะย้าย TypeScript
- ห้ามเพิ่ม API client, endpoint, authentication provider, database หรือเปลี่ยน actions เป็น async ใน migration นี้
- ห้ามเปลี่ยนสูตรคะแนน เกณฑ์ผ่าน attempt selection, pending/graded, matched Pre/Post, progress, certificate หรือ notification semantics
- ห้ามเพิ่ม/ลดสิทธิ์บทบาท แก้ช่องว่าง permission หรือเปลี่ยน inbox เป็นระบบทีมดูแลระหว่างย้ายภาษา ให้บันทึกเป็นงานแยก
- ห้ามเปลี่ยน seed values, ID, JSON shape, storage key/version, date format หรือรูปแบบ serialized state ห้าม reset localStorage/sessionStorage หรือบทสนทนาของผู้ใช้
- ห้ามแก้ `.env*`, secrets, production/reference projects หรือไฟล์นอกขอบเขต
- ห้ามลบ feature, fallback, validation หรือ code path เพื่อทำให้ compiler ผ่าน
- ห้าม blanket formatting, cleanup, เปลี่ยนชื่อทุกอย่าง หรือ refactor architecture พร้อม migration
- ให้ commit/push หลังชุดงานผ่านตามกติกา checkpoint กลาง ห้าม deploy และห้าม `git reset --hard`, `git clean`, checkout ทับงานเดิม หรือ `git add .`

หากข้อผิดพลาดไม่สามารถแก้โดยรักษาพฤติกรรมเดิม ให้ระบุไฟล์ สาเหตุ และทางเลือก ถามผู้ใช้ก่อนแก้พฤติกรรมนั้น และทำส่วนอื่นที่ไม่ขึ้นกับการตัดสินใจต่อได้

## 5. มาตรฐาน types และการแก้ compiler errors

- ใช้ types จาก library ที่ติดตั้ง เช่น props, table columns, form values, editor JSON และ events ไม่สร้าง interface ที่เดา API ของ library เอง
- TypeScript อนุมานชนิดข้อมูลได้ ไม่จำเป็นต้องใส่ type ทุกตัวแปรหรือเพิ่ม `return` ให้ทุกฟังก์ชัน
- ใช้ type aliases/interfaces ให้สอดคล้องกัน Types กลางต้องมีแหล่งเดียว ไม่คัดลอก User/Course/Attempt คนละชุดทุกหน้า
- ตรวจ fields จาก producers, consumers, fixtures และการโหลดข้อมูลเก่า ไม่อนุมานจากตัวอย่างเพียงรายการเดียว
- แยก discriminated unions ตามสถานะ/ชนิดที่มีจริง เช่น choice/essay, video/article/quiz โดยรักษาชื่อสถานะเดิม ห้ามบังคับ fixtures ให้เปลี่ยนเพื่อเข้ากับ type ที่ออกแบบผิด
- รักษาความต่างระหว่าง `null`, `undefined`, empty string, zero และ field ที่ไม่มีจริง ไม่เติมค่า default ใหม่ทั่วระบบเพื่อให้ types ผ่าน
- ออกแบบ context/store types และ signatures ของ actions จากผลลัพธ์จริง บาง action คืน ID บาง action คืน `{ ok, ... }` บาง action ไม่มีผลลัพธ์ ห้าม normalize ผลลัพธ์หรือเพิ่ม `Promise` เองในงานนี้
- Boundary ที่ไม่ทราบชนิดใช้ `unknown` และตรวจข้อมูลเท่าที่จำเป็น อย่าอ้างว่า annotation หรือ `as` ตรวจ JSON ตอน runtime แล้ว
- ถ้าต้องเพิ่ม runtime guard หรือตีความข้อมูลเสียต่างจากเดิม ให้ชี้ผลกระทบก่อน ไม่เพิ่ม validation ที่ปฏิเสธข้อมูลเดิมโดยเงียบ ๆ
- ใช้ `import type` กับ types ให้เหมาะสม รักษาลำดับ runtime imports ที่มี side effects โดยเฉพาะ CSS/font/provider
- Typed empty state, DOM refs, event handlers และค่าจาก URL ต้องตรงการใช้งานจริง ไม่ใช้ generic กว้างจนหมดประโยชน์

**ห้ามใช้ทางลัดเพื่อปิดปัญหา:**

- ไม่เพิ่ม `any`, `as any`, `as unknown as T`, `@ts-ignore`, `@ts-nocheck` หรือปิด `strict` เพื่อทำให้ผ่าน
- ไม่เติม non-null assertion `!` หรือ cast `as T` ทั่วไปแทนการพิสูจน์ชนิดข้อมูล Cast เฉพาะจุดที่มีหลักฐานและเหตุผลในรายงาน; จุดที่เป็น type-only assertion ต้องไม่กล่าวว่าเป็น runtime validation
- หาก external library ไม่มี types และจำเป็นต้องมี exception ให้ระบุจุด ขอบเขต และเหตุผล ขอคำตัดสินเฉพาะ exception นั้น ห้ามเพิ่ม ambient declaration ที่คืน `any` ทั้งโมดูลเอง
- ถ้า config ใช้ `skipLibCheck` ให้จำกัดผลเฉพาะ declarations ของ dependencies และอธิบายเหตุผล มันไม่ใช่ใบอนุญาตข้าม application type errors

## 6. ขั้นตอนดำเนินงาน

### ชุด A — Tooling และ types พื้นฐาน

- เพิ่ม TypeScript และ types ที่จำเป็น โดยตรวจความเข้ากันได้กับ React/Vite/library versions ที่ติดตั้ง รักษา runtime dependencies เดิม
- ตั้ง `strict: true`, ตรวจ app และ Vite config, ไม่ emit output จาก typecheck และรักษา alias `@/*` → `src/*`
- ตั้ง JSX, module resolution, JSON imports และ asset declarations ตาม toolchain เดิม เช่น `react-jsx`, bundler resolution และ `resolveJsonModule`; ตรวจ options กับ TypeScript version ที่เลือก ไม่คัด config จากโปรเจกต์อื่นโดยไม่อ่าน
- เพิ่ม script `npm.cmd run typecheck` ที่ตรวจทั้ง app และ tooling config หากแยก tsconfig ต้องเรียกตรวจครบทั้งสอง ไม่ใช้ script ที่ตรวจไฟล์ว่าง
- ชั่วคราวใช้ `allowJs` เพื่อย้ายทีละชุดได้ แต่ TS ที่ย้ายแล้วต้องตรวจจริง เมื่อครบให้เลิกเปิดช่อง application JS และตรวจว่าไม่มี source หลงเหลือ
- กำหนด types จาก state/ข้อมูลจริงก่อน อย่าสร้าง API request/response ที่ยังไม่ได้ตกลง งานนี้ไม่ใช่งานออกแบบ API contract

### ชุด B — ข้อมูลและ logic

- ย้าย `src/data.js`, mocks แบบ JS, utils, analytics/inbox selectors และ `src/store.jsx` โดยรักษาโครงสร้างข้อมูลและ effects เดิม
- คง JSON fixtures เป็น JSON และตรวจความสอดคล้องด้วย types/การตรวจที่เหมาะสม ไม่ cast fixtures ทั้งก้อนให้ผ่าน
- ตรวจสูตรคะแนน การจับคู่ Pre/Post และลำดับการอัปเดต state ก่อน–หลัง ห้ามย้าย logic ไป backend ในขั้นตอนนี้

### ชุด C — Components และหน้าจอ

- ย้าย component ง่ายก่อน จากนั้น shared shell/editor แล้ว pages ทีละ feature
- ทุกชุดต้องมีรายการไฟล์ชัดเจน ย้าย imports ที่ชี้ชื่อ `.jsx`/`.js` เดิมให้ตรงไฟล์ใหม่ ตรวจ import alias และ re-exports
- รักษา markup, CSS imports, text และ behavior ตรวจ diff ก่อนขยายไปชุดถัดไป ไม่ย้ายทุกหน้าในคำสั่งอัตโนมัติเดียวโดยไม่ตรวจ

### ชุด D — Entry, config และส่งมอบ

- ย้าย `main`, `App`, theme และ Vite config ตาม dependencies ของงาน ไม่บังคับลำดับจน temporary imports ใช้งานไม่ได้
- แก้ entry ใน `index.html` และแทน jsconfig เมื่อ tsconfig พร้อม ไม่ให้ editor alias กับ Vite alias ขัดกัน
- ตรวจ source inventory อีกครั้ง รวมไฟล์เพิ่มระหว่าง migration ปิดช่อง JS ชั่วคราวและลบ config ที่เลิกใช้เฉพาะของงานนี้
- อัปเดตเอกสารกลางจากข้อเท็จจริงที่ทำสำเร็จแล้ว ไม่เขียนล่วงหน้าว่าเป็น TypeScript ทั้งหมด

แต่ละชุดต้อง typecheck/build ผ่านก่อนส่งต่อ ถ้า JS ที่ยังไม่ย้ายทำให้ inferred types ไม่ชัด ให้แก้ types ที่ boundary อย่างเจาะจง ไม่ใช้ช่องว่างช่วง migration เป็นเหตุให้ปิดตรวจ TS

## 7. การตรวจที่ต้องผ่าน

จาก root ของแอป หลังตั้ง tooling แล้ว:

```powershell
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Vite build อย่างเดียวไม่ยืนยันว่า types ผ่าน ต้องตรวจ typecheck แยก และรายงาน exit code จริง

ตรวจ regression ต่อไปนี้ด้วยข้อมูลเดโมใน browser context แยกจาก session ของผู้ใช้:

| ส่วน | สิ่งที่ต้องเหมือน baseline |
| --- | --- |
| Public | Landing/About, catalog, course detail, blog; ภาพ ฟอนต์ ลิงก์ และ desktop/mobile layout |
| Shell/บัญชี | login/สลับบทบาทเดโม, sidebar 258/72px, hover/focus logo, mobile hamburger, avatar และกระดิ่ง |
| ผู้เรียน | เรียน video/article, draft quiz, submit, pending/graded/result, progress และผลใบรับรองเดิม |
| ผู้สอน | สร้าง/แก้คอร์ส, curriculum/chapter preview, rich text/ภาพ, assignment, review queue/filter/returnTo, grade/draft |
| Analytics | รายคอร์ส/ผู้เรียน, matched Pre/Post, pending ไม่เป็นศูนย์, role scoping และ drill-down |
| Inbox | fixtures ไม่ทับ thread, ส่ง/ตอบ/อ่าน, context ของคอร์ส/บท, draft, unread และ route เปิดตรง |
| แอดมิน | `/admin/users`, user detail/role action และหน้าจัดการคอร์ส/งานมอบหมาย/คำขอ/คำสั่งซื้อ/ใบรับรอง/บทความที่มีจริง |
| Persistence/access | refresh แล้วข้อมูลเดิมอยู่, direct URL/no-access/not-found/query parameters และ draft กลับมาได้ตามเดิม |

- เปรียบเทียบ screenshot ก่อน–หลังด้วย viewport, route, role และข้อมูลเดียวกัน ทั้ง desktop/mobile ของหน้า representative และทุกหน้าที่พบ diff เสี่ยง
- ตรวจ browser console/runtime errors และ import/asset errors ไม่ถือว่า screenshot อย่างเดียวพิสูจน์ flow
- ไม่ reset storage ผู้ใช้ ไม่สร้าง browser tabs ซ้ำโดยไม่จำเป็น ไม่แก้ fixture เพื่อให้ screenshot ดูผ่าน
- หาก baseline bug เดิมยังอยู่ให้รายงานตามจริง ไม่อ้างว่าระบบ Production ปลอดภัยเพราะ migration ผ่าน
- ถ้าเครื่องมือ browser ใช้ไม่ได้ ให้ส่งรายงานส่วนที่ผ่านและส่วนที่ยังตรวจไม่ได้ ห้ามประกาศว่าการตรวจ UI/flow ครบแล้ว

## 8. เกณฑ์ส่งมอบและการย้อนกลับ

ถือว่า migration ครบเมื่อ source ทั้งหมดในขอบเขตย้ายแล้ว, strict typecheck/build ผ่าน, import paths ถูกต้อง, ไม่เปลี่ยน CSS/assets/JSON/markup/ธุรกิจ, และ regression ที่ระบุได้รับการตรวจพร้อมหลักฐาน

รายงานสุดท้ายต้องมี:

1. จำนวนไฟล์ที่ย้ายจริง พร้อมรายการ config/dependencies/type files ที่เพิ่ม
2. คำสั่งตรวจ ผลลัพธ์ และหลักฐาน UI/flow ที่เปิดตรวจจริง
3. จุด cast/exception พร้อมเหตุผล และรายการที่ยังค้าง ห้ามซ่อน `any` หรือ compiler errors
4. แยกปัญหา baseline, ปัญหา migration และข้อเสนออนาคต
5. รายการไฟล์ที่เปลี่ยนเฉพาะ migration แยกจากงานค้างเดิม พร้อมวิธีย้อนเฉพาะชุดนั้น

ถ้าต้องย้อนกลับ ให้ย้อนเฉพาะ patch/rename ของ migration โดยรักษา dirty work และข้อมูลผู้ใช้ การสำรองก่อนเริ่มต้องรวม untracked source ที่เกี่ยวข้อง ห้ามใช้ reset ทั้ง repository

## 9. Prompt สำหรับส่งให้ AI ทำงาน

คัดลอกข้อความนี้เมื่อผู้ใช้พร้อมเริ่ม migration:

> ทำงานเฉพาะ `D:\code\elearn-prod\elearning-ux-v2` อ่าน AGENTS.md, docs/UI_SPEC.md, docs/CODE_SPEC.md, docs/GIT_CHECKPOINT_POLICY_TH.md และ docs/archive/reports/TYPESCRIPT_MIGRATION_INSTRUCTIONS_TH.md ให้ครบก่อนลงมือ ย้าย JavaScript/JSX ทั้งหมดตามขอบเขตในเอกสารเป็น TypeScript แบบ strict โดยรักษา UI และ runtime behavior เดิม เริ่มจาก inventory, dirty-work baseline และแผนไฟล์แต่ละชุด แล้วดำเนินงานและตรวจทีละชุดตามเอกสาร ห้ามแก้ CSS/JSON/assets/markup/ข้อความ/สูตรคะแนน/permission ห้ามต่อ API หรือ refactor ระบบใหม่ ห้ามปิด types ด้วย any หรือ suppression ห้าม reset storage หรือทับงานเดิม รัน typecheck/build และตรวจ regression พร้อมหลักฐานก่อนสรุป หากแก้ type error แล้วต้องเปลี่ยนพฤติกรรมหรือขอบเขต ให้แจ้งจุดนั้นและรอคำตัดสิน โดยทำส่วนอิสระอื่นต่อได้ Commit/push อัตโนมัติเมื่อแต่ละชุดผ่านการตรวจ โดยรักษางานผู้อื่นและรายงาน SHA/branch/ผล push ห้าม deploy

สำหรับโมเดลขนาดเล็ก ให้ส่งเฉพาะชุดไฟล์ที่มี types กลางและตัวอย่างที่ตรวจผ่านแล้ว พร้อมข้อจำกัดในเอกสาร อย่าให้ตีความ domain หรือเปลี่ยน store/permissions ทั้งระบบเอง ผู้ตรวจต้องดู diff และผลทดสอบ ไม่ตัดสินจากคำว่า “เสร็จแล้ว” ของโมเดล

## 10. อ้างอิงด้านภาษา

- [TypeScript: Migrating from JavaScript](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)
- [TypeScript: allowJs](https://www.typescriptlang.org/tsconfig/allowJs.html)
- [TypeScript: strict](https://www.typescriptlang.org/tsconfig/strict.html)
- [Vite: TypeScript support](https://vite.dev/guide/features.html#typescript)

เอกสารอ้างอิงอธิบาย tooling ไม่เปลี่ยนขอบเขตที่ผู้ใช้กำหนดสำหรับโปรเจกต์นี้
