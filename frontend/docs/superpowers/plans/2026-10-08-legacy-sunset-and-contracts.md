# Legacy Sunset & Contract-Driven Frontend Architecture Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all 159 `@legacy` imports, delete the root `src/` directory, populate `packages/contracts` with official JSON DTOs for all flows, extract shared UI widgets/assets into `packages/ui` and `apps/`, and unify routing so that both dev and production use the clean API-client + TanStack Query architecture.

**Architecture:** Contract-Driven Frontend. Frontend establishes the canonical API contract in `packages/contracts` (DTOs & Enums). All app features communicate exclusively through `@melearn/api-client` and TanStack Query hooks. Pure UI components and layout chrome reside in `packages/ui`. Assets reside in `apps/` and `packages/ui`. The legacy dual-track routing (`import.meta.env.DEV ? New : Legacy`) is completely dismantled, enabling the deletion of `src/` and the removal of the `@legacy` alias.

**Tech Stack:** TypeScript, React 19, Vite, TanStack Query, Tailwind CSS, Ant Design / Mantine theme adapters, Node.js test runner.

## Global Constraints

- Preserve all existing tests and business behavior (175/175 tests must pass throughout).
- Do not lose or discard uncommitted changes currently in the working tree (Payment flow F updates).
- Maintain app boundary isolation (`scripts/check-app-boundaries.mjs` must pass).
- No cross-app imports between `apps/web` and `apps/admin`.
- `pages/` must contain only `.tsx` files; all styles must live in `styles/` or `packages/ui`.
- Final state must have 0 occurrences of `@legacy` across the entire codebase.

---

### Task 1: Canonicalize Contracts in `packages/contracts`

Populate `packages/contracts` with the complete set of DTOs and JSON response/request types for all flows (Auth, Catalog, Learning, Assessment, Certificate, Payment, Redeem, AI, Course Authoring).

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/auth.ts`
- Create: `packages/contracts/src/courses.ts`
- Create: `packages/contracts/src/learning.ts`
- Create: `packages/contracts/src/assessment.ts`
- Create: `packages/contracts/src/certificate.ts`
- Create: `packages/contracts/src/payment.ts`
- Create: `packages/contracts/src/ai.ts`
- Create: `packages/contracts/src/authoring.ts`
- Create: `packages/contracts/src/common.ts`
- Test: `tests/contracts-integrity.test.mjs`

**Interfaces:**
- Produces: Official TypeScript DTOs and Enums exported from `@melearn/contracts` (e.g. `UserSession`, `CourseSummary`, `QuizSnapshot`, `PaymentIntent`, `CertificateDetail`, etc.).

- [ ] **Step 1: Create contracts integrity test**
  Write `tests/contracts-integrity.test.mjs` to verify that `@melearn/contracts` exports all required DTO interfaces and enums for Flows A through H.
- [ ] **Step 2: Define DTOs in `packages/contracts/src/`**
  Extract and formalize the data shapes currently defined across `tools/provisional-api/` and `apps/web/src/features/*/types` into modular files under `packages/contracts/src/`.
- [ ] **Step 3: Export all DTOs from `packages/contracts/src/index.ts`**
  Re-export all domain contracts as the public package interface.
- [ ] **Step 4: Run test and verify build**
  Run `node --test tests/contracts-integrity.test.mjs` and `npm run typecheck`.
- [ ] **Step 5: Commit Task 1 checkpoint**
  `git commit -m "feat(contracts): canonicalize DTOs and API specifications across all flows"`

---

### Task 2: Extract Legacy UI Components & Shared Helpers to `packages/ui`

Move pure UI components and utility functions out of `src/` and into `packages/ui`, eliminating their `@legacy` references.

**Files:**
- Create: `packages/ui/src/components/common/PageTitle.tsx`
- Create: `packages/ui/src/components/common/CourseCard.tsx`
- Create: `packages/ui/src/components/common/UserAvatar.tsx`
- Create: `packages/ui/src/components/common/CourseOutline.tsx`
- Create: `packages/ui/src/components/common/ImageUploadField.tsx`
- Create: `packages/ui/src/components/common/DirectorySearch.tsx`
- Create: `packages/ui/src/components/layout/Shell.tsx` (AuthFrame, WorkspaceShell)
- Create: `packages/ui/src/lib/formatters.ts` (`formatPrice`, `instructorFor`, `flattenItems`)
- Modify: `packages/ui/src/index.ts` (export new components and helpers)
- Test: `tests/ui-components.test.mjs`

**Interfaces:**
- Consumes: `@melearn/ui` theme tokens, Ant Design peer dependencies.
- Produces: Exported UI components (`PageTitle`, `CourseCard`, `UserAvatar`, `CourseOutline`, `ImageUploadField`, `AuthFrame`, `WorkspaceShell`) and formatting utilities.

- [ ] **Step 1: Copy component implementations into `packages/ui/src/components/`**
  Extract `PageTitle`, `CourseCard`, `UserAvatar`, `CourseOutline`, `ImageUploadField`, `DirectorySearch`, `Shell` without any `@legacy` imports.
- [ ] **Step 2: Add formatters in `packages/ui/src/lib/formatters.ts`**
  Implement currency formatting (`formatPrice`), instructor resolver (`instructorFor`), and tree flattening (`flattenItems`).
- [ ] **Step 3: Update `packages/ui/src/index.ts`**
  Export all new components and helpers cleanly.
- [ ] **Step 4: Update consumers in `apps/web` and `apps/admin`**
  Replace `@legacy/components/*` and `@legacy/data` formatters with `@melearn/ui`.
- [ ] **Step 5: Run tests and typecheck**
  Run `npm run typecheck` and `npm test`.
- [ ] **Step 6: Commit Task 2 checkpoint**
  `git commit -m "refactor(ui): extract common widgets, layout chrome and formatters into packages/ui"`

---

### Task 3: Migrate Assets & Global Styles into `apps/` and `packages/ui`

Migrate images, logos, and global stylesheets out of `src/` so that apps and packages no longer depend on `@legacy/assets` or `@legacy/*.css`.

**Files:**
- Copy: Images from `src/assets/` to `apps/web/src/assets/` and `packages/ui/src/assets/`
- Consolidate: `src/styles.css`, `src/system-theme.css`, `src/workspace-responsive.css` into `packages/ui/src/styles/`
- Modify: `apps/web/src/main.tsx` and `apps/admin/src/main.tsx` to import styles from `@melearn/ui/styles`
- Modify: `apps/web/src/features/landing/pages/LandingArtwork.ts` to import local assets
- Modify: `apps/web/src/features/course-authoring/pages/CourseEditorPage.tsx` to import local assets
- Modify: `apps/web/src/features/ai/pages/ProvisionalAiPage.tsx` to import local assets

**Interfaces:**
- Produces: CSS and asset imports resolved locally or via `@melearn/ui`.

- [ ] **Step 1: Relocate image assets**
  Copy `course-default-v2.png`, landing photos, brand pattern, student hero, and `logo.PNG` into `apps/web/src/assets/` and `packages/ui/src/assets/`.
- [ ] **Step 2: Update all asset import paths in `apps/`**
  Replace all `@legacy/assets/*` with local relative imports or `@melearn/ui/assets`.
- [ ] **Step 3: Relocate global CSS files**
  Move `styles.css`, `system-theme.css`, and `workspace-responsive.css` to `packages/ui/src/styles/` and re-export them.
- [ ] **Step 4: Update `main.tsx` in `apps/web` and `apps/admin`**
  Replace `@legacy/*.css` with `@melearn/ui/styles/*`.
- [ ] **Step 5: Run build & verify bundle**
  Run `npm run build` for both Web and Admin.
- [ ] **Step 6: Commit Task 3 checkpoint**
  `git commit -m "refactor(assets): relocate brand assets and global stylesheets out of legacy"`

---

### Task 4: Unify Routes & Eliminate Dual-Track (`DEV ? New : Legacy`)

Dismantle the conditional `import.meta.env.DEV` routing switches so that the new API-connected pages (`LearningPages`, `ProvisionalPaymentPages`, `ProvisionalAiPage`, `CatalogPage`) become the sole, permanent routes in both dev and production.

**Files:**
- Modify: `apps/web/src/app/router/learner-routes.tsx`
- Modify: `apps/web/src/app/router/public-routes.tsx`
- Modify: `apps/web/src/app/router/authoring-routes.tsx`
- Modify: `apps/web/src/app/router/instructor-routes.tsx`
- Modify: `apps/web/src/features/payment/pages/PaymentPages.tsx` (standardize name from ProvisionalPaymentPages)
- Modify: `apps/web/src/features/ai/pages/AiPage.tsx` (standardize name from ProvisionalAiPage)
- Modify: `apps/web/src/features/courses/pages/public/CatalogPage.tsx` (wire to Catalog API hook)
- Modify: `apps/web/src/features/courses/pages/public/CourseDetailPage.tsx` (wire to Catalog API hook)

**Interfaces:**
- Consumes: TanStack Query hooks, `@melearn/api-client`, `@melearn/contracts`.
- Produces: 100% unified routes with no legacy fallback.

- [ ] **Step 1: Standardize feature page names**
  Rename `ProvisionalPaymentPages.tsx` to `PaymentPages.tsx` and `ProvisionalAiPage.tsx` to `AiPage.tsx`.
- [ ] **Step 2: Clean `learner-routes.tsx`**
  Remove all imports from `@legacy/pages/learner/*` and `@legacy/pages/member/*`. Wire routes directly to `MyCoursesPage`, `LessonPage`, `QuizAttemptPage`, `QuizResultPage`, `PaymentPages`, and `AiPage`.
- [ ] **Step 3: Clean `public-routes.tsx`**
  Remove `@legacy/pages/landing/*` and wire Catalog/Detail routes to API-powered pages.
- [ ] **Step 4: Clean `authoring-routes.tsx` and `instructor-routes.tsx`**
  Replace any remaining `@legacy/pages/instructor/*` imports with the app-owned authoring pages.
- [ ] **Step 5: Remove `@legacy/store` usage across remaining feature pages**
  Ensure feature pages read and mutate state via TanStack Query hooks and `@melearn/contracts`.
- [ ] **Step 6: Verify with automated tests**
  Run `npm test` and ensure all 175 tests pass.
- [ ] **Step 7: Commit Task 4 checkpoint**
  `git commit -m "feat(routes): unify routing on API-connected pages and remove legacy fallbacks"`

---

### Task 5: Eliminate `@legacy` Alias & Delete `src/` Directory

Remove all remaining traces of `@legacy`, remove the aliases from TypeScript and Vite configs, and delete the legacy root `src/` directory.

**Files:**
- Modify: `apps/web/tsconfig.json` (remove `@legacy/*` path mapping)
- Modify: `apps/web/vite.config.ts` (remove `@legacy` resolve alias)
- Modify: `apps/admin/tsconfig.json` (remove `@legacy/*` path mapping)
- Modify: `apps/admin/vite.config.ts` (remove `@legacy` resolve alias)
- Modify: `tsconfig.json` (monorepo root)
- Delete: `elearning-ux-v2/src/` (entire legacy folder)

**Interfaces:**
- Produces: Zero occurrences of `@legacy` in the entire repository.

- [ ] **Step 1: Scan for any lingering `@legacy` imports**
  Run `git grep "@legacy"` to verify 0 code imports remain before deleting.
- [ ] **Step 2: Remove path mappings & aliases**
  Remove `@legacy` from `tsconfig.json` and `vite.config.ts` across `apps/web` and `apps/admin`.
- [ ] **Step 3: Delete root `src/` directory**
  Remove `elearning-ux-v2/src/`.
- [ ] **Step 4: Run typecheck and boundary checks**
  Run `npm run typecheck` and `npm run check:boundaries`.
- [ ] **Step 5: Commit Task 5 checkpoint**
  `git commit -m "chore(sunset): delete legacy src directory and remove @legacy alias"`

---

### Task 6: Full Verification & Acceptance Matrix Update

Run all verification suites and update project documentation to record the complete sunset of legacy and readiness for Real Backend integration.

**Files:**
- Modify: `docs/FRONTEND_REFACTOR_PLAN_TH.md`
- Modify: `docs/R7_API_MOCK_PROGRESS_TH.md`
- Modify: `docs/FRONTEND_API_ACCEPTANCE_MATRIX_TH.md`

- [ ] **Step 1: Run comprehensive verification**
  Run:
  - `npm run typecheck` (must pass 0 errors)
  - `npm run check:boundaries` (must pass 0 violations)
  - `npm test` (all 175+ tests must pass)
  - `npm run build` (both Web and Admin must build clean)
- [ ] **Step 2: Update documentation**
  Record `@legacy` = 0, `packages/contracts` populated, and Frontend ready for real API URL switch.
- [ ] **Step 3: Final commit & push**
  Commit checkpoint and push to `origin/refactor/v1-api-ready` following git checkpoint policy.
