# R5 Completion and Mock API Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปิดงานที่ค้างในเฟส R5 (ย้าย Access Codes, Profile form, Auth pages และ Blog chrome/styles เข้า app ownership ของ Web และ Admin) เพื่อให้โค้ดหน้าจอ R5 และ R6 เสร็จสมบูรณ์ 100% จากนั้นทำการรวม (Merge) กิ่ง `origin/feat/web-catalog-api-mock` (Provisional API Mock 76 routes) เข้ามาที่ `refactor/v1-api-ready` เพื่อเตรียมพร้อมสำหรับการต่อ API ในเฟส R4b

**Architecture:**
1. แยกกรรมสิทธิ์ของหน้าจอที่ยังอยู่ใน root `src/` (AccessCodes, ProfileSettings, AuthPages) เข้า `apps/admin/src/features/` และ `apps/web/src/features/` โดยคง URL, Route guard, UI layout และ demo store bridge ไว้
2. ปลดการ import ข้ามไปยัง legacy root จากหน้า Blog (`LandingChrome`, `landing.css`, `blog.css`)
3. รัน Regression tests (98 tests), Typecheck ทั้งสาม project, Boundary checks และ Production builds ของทั้ง Web และ Admin
4. รวม Git branch `origin/feat/web-catalog-api-mock` เข้ามา เพื่อให้โปรเจกต์มีทั้ง UI app structure ที่สมบูรณ์และ In-memory Mock 76 routes พร้อมเทสต์รวม 163+ tests

**Tech Stack:** React 19, TypeScript, React Router 7, Ant Design, Mantine, Tailwind CSS, Node native test runner (`node --test`), npm workspaces

## Global Constraints

- รักษา URL, Route Guard และ Navigation behavior ทั้งหมดตาม [ROUTE_MIGRATION_LEDGER_TH.md](../../ROUTE_MIGRATION_LEDGER_TH.md)
- ห้าม App นำเข้าโค้ดข้ามกัน (`apps/web` ห้าม import จาก `apps/admin` และในทางกลับกัน)
- ไม่แตะต้องหรือ staging ไฟล์ `.codex/README.md` ซึ่งมีงานอื่นแก้ไขค้างอยู่
- ยังคงใช้ `@legacy/store` เป็น demo bridge ชั่วคราวสำหรับการทำงานของหน้าจอจนกว่าจะต่อ API ใน R4b
- ก่อนและหลังทุก task ต้องรัน `npm.cmd run typecheck`, `npm.cmd test`, และ `npm.cmd run check:boundaries` ให้ผ่าน

---

### Task 1: ย้าย Admin Access Codes เข้า `apps/admin`

**Files:**
- Create: `apps/admin/src/features/management/pages/AccessCodesPage.tsx`
- Modify: `apps/admin/src/app/router/management-routes.tsx`
- Modify: `tests/workspace-route-ownership.test.mjs`

**Interfaces:**
- Consumes: `@legacy/store` (`useLms`), `@legacy/types` (`RedeemCode`), `antd` Table/Tag/Button
- Produces: `AccessCodesPage` component สำหรับ Admin management router

- [ ] **Step 1: เพิ่ม Route ownership test ดักจับ Admin AccessCodesPage**

เพิ่ม test case ใน `tests/workspace-route-ownership.test.mjs`:
```javascript
test('Admin access codes route renders its app-owned feature page', async () => {
  const routeModule = await readFile(path.join(root, 'apps/admin/src/app/router/management-routes.tsx'), 'utf8');
  assert.match(routeModule, /from ['"]\.\.\/\.\.\/features\/management\/pages\/AccessCodesPage['"]/);
  assert.doesNotMatch(routeModule, /@legacy\/pages\/admin\/AccessCodesPage/);
});
```

- [ ] **Step 2: ย้ายโค้ด `AccessCodesPage.tsx` เข้า `apps/admin/src/features/management/pages/`**

คัดลอกและปรับ import ของ `src/pages/admin/AccessCodesPage.tsx` ไปไว้ที่ `apps/admin/src/features/management/pages/AccessCodesPage.tsx` โดยใช้ import ที่ถูกต้องภายในแอป Admin และถอนไฟล์เดิมออกจาก `src/pages/admin/AccessCodesPage.tsx`

- [ ] **Step 3: ปรับ Router ของ Admin ให้ชี้ไปยังไฟล์ใหม่**

แก้ `apps/admin/src/app/router/management-routes.tsx`:
เปลี่ยนจากการ import `@legacy/pages/admin/AccessCodesPage` มาเป็น:
```typescript
import { AccessCodesPage } from '../../features/management/pages/AccessCodesPage';
```

- [ ] **Step 4: รัน Test และ Typecheck ตรวจสอบ**

Run: `npm.cmd run typecheck && npm.cmd test -- --test-reporter=dot && npm.cmd run check:boundaries`
Expected: PASS (99 tests ผ่าน)

---

### Task 2: ย้าย Profile Settings Form เข้า App Features

**Files:**
- Create: `apps/web/src/features/account/components/ProfileSettings.tsx`
- Create: `apps/admin/src/features/account/components/ProfileSettings.tsx`
- Modify: `apps/web/src/features/account/pages/ProfilePage.tsx`
- Modify: `apps/admin/src/features/account/pages/ProfilePage.tsx`

**Interfaces:**
- Consumes: `@legacy/store` (`useLms`), `@legacy/lib/profile-model`, `@legacy/components/ImageUploadField`
- Produces: `ProfileSettings` form component สำหรับหน้า Profile ของทั้งสองแอป

- [ ] **Step 1: ย้ายและสร้าง `ProfileSettings` ใน `apps/web` และ `apps/admin`**

นำโค้ดจาก `src/features/account/ProfileSettings.tsx` มาวางใน:
- `apps/web/src/features/account/components/ProfileSettings.tsx`
- `apps/admin/src/features/account/components/ProfileSettings.tsx`
และถอน `src/features/account/ProfileSettings.tsx` ออกจาก legacy

- [ ] **Step 2: ปรับ `ProfilePage.tsx` ของ Web และ Admin ให้ import ภายในแอปตัวเอง**

ใน `apps/web/src/features/account/pages/ProfilePage.tsx` และ `apps/admin/src/features/account/pages/ProfilePage.tsx`:
เปลี่ยนจาก:
```typescript
import { ProfileSettings } from '@legacy/features/account/ProfileSettings';
```
เป็น:
```typescript
import { ProfileSettings } from '../components/ProfileSettings';
```

- [ ] **Step 3: ตรวจสอบความถูกต้อง**

Run: `npm.cmd run typecheck && npm.cmd test -- --test-reporter=dot && npm.cmd run check:boundaries`
Expected: PASS

---

### Task 3: แยก Auth Pages ออกเป็นของ Web และ Admin

**Files:**
- Create: `apps/web/src/features/auth/pages/AuthPages.tsx` (หรือแยก `LoginPage.tsx`, `RegisterPage.tsx`, `VerifyEmailPage.tsx`, `DemoAccountPage.tsx`)
- Create: `apps/admin/src/features/auth/pages/AuthPages.tsx` (Admin-focused LoginPage, VerifyEmailPage, DemoAccountPage)
- Modify: `apps/web/src/app/router/auth-routes.tsx`
- Modify: `apps/web/src/app/router/access.tsx`
- Modify: `apps/admin/src/app/router/entry-routes.tsx`
- Modify: `tests/workspace-route-ownership.test.mjs`

**Interfaces:**
- Consumes: `@melearn/ui` primitives (Button, Input, Field, Alert, Label, Separator), `@legacy/store` (`useLms`)
- Produces: `LoginPage`, `RegisterPage`, `VerifyEmailPage`, `DemoAccountPage` สำหรับแต่ละ App

- [ ] **Step 1: เพิ่ม Route ownership test ดักจับ Auth pages ในทั้งสองแอป**

ใน `tests/workspace-route-ownership.test.mjs`:
```javascript
test('Web and Admin auth routes render app-owned auth pages', async () => {
  const webAuth = await readFile(path.join(root, 'apps/web/src/app/router/auth-routes.tsx'), 'utf8');
  const adminEntry = await readFile(path.join(root, 'apps/admin/src/app/router/entry-routes.tsx'), 'utf8');
  assert.match(webAuth, /from ['"]\.\.\/\.\.\/features\/auth\/pages\/AuthPages['"]/);
  assert.doesNotMatch(webAuth, /@legacy\/pages\/AuthPages/);
  assert.match(adminEntry, /from ['"]\.\.\/\.\.\/features\/auth\/pages\/AuthPages['"]/);
  assert.doesNotMatch(adminEntry, /@legacy\/pages\/AuthPages/);
});
```

- [ ] **Step 2: สร้าง Auth Pages ฝั่ง `apps/web`**

สร้าง `apps/web/src/features/auth/pages/AuthPages.tsx`:
- รองรับ Login ผู้เรียน/ผู้สอน, Register ผู้เรียน, Demo Account Switcher, และ VerifyEmail
- ใช้ shared form primitives จาก `@melearn/ui`
- ปรับ `apps/web/src/app/router/auth-routes.tsx` และ `access.tsx` ให้ import จาก feature นี้

- [ ] **Step 3: สร้าง Auth Pages ฝั่ง `apps/admin`**

สร้าง `apps/admin/src/features/auth/pages/AuthPages.tsx`:
- ปรับให้มี copy เฉพาะผู้ดูแลระบบ ซ่อนลิงก์สมัครเรียน (Register)
- ปรับ `apps/admin/src/app/router/entry-routes.tsx` ให้ import จาก feature นี้

- [ ] **Step 4: ถอน `src/pages/AuthPages.tsx` ออกจาก root legacy**

ถอนไฟล์เดิมออก และตรวจสอบว่าไม่มีการเรียกผ่าน `@legacy/pages/AuthPages` หลงเหลือ

- [ ] **Step 5: รัน Test และ Typecheck ตรวจสอบ**

Run: `npm.cmd run typecheck && npm.cmd test -- --test-reporter=dot && npm.cmd run check:boundaries`
Expected: PASS (100+ tests ผ่าน)

---

### Task 4: ปลด Blog & Landing CSS / Chrome Bridge

**Files:**
- Modify: `apps/web/src/features/blog/pages/BlogPages.tsx`
- Modify: `apps/admin/src/features/blog/pages/BlogAdminPages.tsx`
- Modify: `apps/admin/src/features/blog/pages/BlogArticlePreviewPage.tsx`
- Create/Move: สไตล์และ Chrome ที่จำเป็นให้อยู่ใน App feature หรือ shared UI

**Interfaces:**
- Consumes: `@melearn/ui` (`RichDocument`, design tokens), App layouts
- Produces: หน้า Blog ใน Web และ Admin ที่ไม่นำเข้า CSS หรือ Chrome จาก root `src/pages/landing` หรือ `src/pages/blog`

- [ ] **Step 1: ตรวจสอบการ import `LandingChrome`, `landing.css`, `blog.css` ใน Blog pages**

ตรวจสอบ dependencies ที่เหลืออยู่ใน `apps/web/src/features/blog/` และ `apps/admin/src/features/blog/`

- [ ] **Step 2: ย้าย `blog.css` เข้าแต่ละแอป หรือรวมเข้า Tailwind semantic utilities**

ย้าย `blog.css` ไปไว้ที่ `apps/web/src/features/blog/pages/blog.css` และ `apps/admin/src/features/blog/pages/blog.css`

- [ ] **Step 3: ปลด `LandingChrome` ออกจาก Admin Article Preview**

ใน `BlogArticlePreviewPage.tsx` ของ Admin ให้ใช้ Admin header/shell แทนการดึง `LandingChrome` จากหน้าเว็บ public

- [ ] **Step 4: ตรวจสอบความถูกต้องและ build**

Run: `npm.cmd run typecheck && npm.cmd test -- --test-reporter=dot && npm.cmd run check:boundaries && npm.cmd run build`
Expected: PASS ทั้ง Web และ Admin

---

### Task 5: บันทึกรายงาน R5e และ Commit Checkpoint

**Files:**
- Create: `docs/archive/reports/R5E_AUTH_ACCOUNT_MANAGEMENT_OWNERSHIP_TH.md`
- Modify: `docs/README.md`
- Modify: `docs/FRONTEND_REFACTOR_PLAN_TH.md`

- [ ] **Step 1: เขียนรายงานสรุปผล R5e**

บันทึกผลการย้าย AccessCodes, Profile, Auth, และ Blog decoupling ลงใน `docs/archive/reports/R5E_AUTH_ACCOUNT_MANAGEMENT_OWNERSHIP_TH.md`

- [ ] **Step 2: อัปเดตสถานะในแผน Refactor**

ทำเครื่องหมายว่า R5 (R5a–R5e) ผ่าน Code & Page Ownership Gates แล้วใน `FRONTEND_REFACTOR_PLAN_TH.md`

- [ ] **Step 3: Commit และ Push บน branch `refactor/v1-api-ready`**

```bash
git add apps/ tests/ docs/
git commit -m "refactor: complete R5 app ownership for auth, profile, and access codes"
git push origin refactor/v1-api-ready
```

---

### Task 6: Merge กิ่ง `origin/feat/web-catalog-api-mock` เข้ากับ `refactor/v1-api-ready`

**Files:**
- Merge: `origin/feat/web-catalog-api-mock` เข้า `refactor/v1-api-ready`

**Interfaces:**
- รวม `tools/provisional-api/` (76 routes) และ `tests/provisional-api-*.test.mjs` เข้าสู่โปรเจกต์หลัก

- [ ] **Step 1: ทำการ Fetch และ Merge**

Run: `git fetch origin`
Run: `git merge origin/feat/web-catalog-api-mock -m "merge: integrate provisional API mock (flows A-H) into refactor branch"`

- [ ] **Step 2: แก้ไขข้อขัดแย้ง (Merge Conflicts) หากมี**

ตรวจเช็ก `git status` หากมี conflict ใน docs หรือ package.json ให้ทำการ resolve โดยยึดทั้งโครงสร้าง Monorepo ล่าสุดและเครื่องมือ mock ใหม่

- [ ] **Step 3: ตรวจสอบผลลัพธ์ทั้งชุดหลัง Merge**

Run: `npm.cmd run typecheck`
Run: `node --test` (ต้องรันผ่านทั้งชุด tests เดิม 100+ tests และ provisional tests 65 tests รวม 165+ tests)
Run: `npm.cmd run check:boundaries`
Run: `npm.cmd run build:web && npm.cmd run build:admin`
Expected: PASS ทั้งหมด

- [ ] **Step 4: Push ผลการ Merge ขึ้น GitHub**

Run: `git push origin refactor/v1-api-ready`
ตรวจผล GitHub Actions CI เพื่อยืนยันว่าผ่านสมบูรณ์

---

## Execution Handoff

Plan complete and saved to `docs/archive/plans/2026-10-08-r5-completion-and-mock-merge.md`. Two execution options:

1. **Inline Execution (Recommended for this session):** ดำเนินการตาม Tasks 1 ถึง 6 ในเซสชันนี้ทีละ Task พร้อมรัน Verification และ Checkpoints
2. **Subagent-Driven:** เรียก subagent เข้ามาช่วยดำเนินการทีละ Task ตามลำดับ

พร้อมเริ่มดำเนินการตามแนวทางไหนดีครับ?
