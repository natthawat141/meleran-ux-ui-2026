# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 100% of application JavaScript/JSX source in `d:\code\elearn-prod\elearning-ux-v2` to strict TypeScript (`.ts` / `.tsx`) without changing any UI, styling, Thai copy, business logic, storage keys, or backend architecture.

**Architecture:** Incrementally migrate 72 application source files across 7 bite-sized batches. First establish tooling, compiler configs, and comprehensive core domain types (`src/types/`). Next migrate data and state stores (`src/data.ts`, `src/store.tsx`, selectors). Then migrate components, shared shells, and feature pages in decoupled groups. Finally migrate root entry points (`App.tsx`, `main.tsx`), configs (`vite.config.ts`), remove `allowJs`, and verify full strict typechecking, bundling, and browser flows.

**Tech Stack:** React 19.1.0, TypeScript 5.7+, Vite 7.0.0, Ant Design 6.6.5, Mantine 9.6.2, Tabler Icons, Tiptap 3.31, TailwindCSS 4.3.3.

## Global Constraints

- Preserve all existing dirty files and user modifications in git status. Never discard, revert, or overwrite existing user work. Never run `git reset --hard` or `git clean`.
- Zero UI redesign: Keep exact colors, fonts, icons, layout, spacing, animations, text, and DOM structures.
- Zero business logic changes: Preserve exact scoring formulas, Pre/Post matching rules, pass rates, certificate logic, attempt selection, and review queue semantics.
- No `any`, `as any`, `@ts-ignore`, or `@ts-nocheck` suppression shortcuts. Use exact domain types, discriminated unions, and safe narrowing.
- Keep JSON fixtures as `.json`. Do not move to backend or change serialized storage schemas.
- Verification commands for every batch: `npm.cmd run typecheck`, `npm.cmd run build`, `git diff --check`.

---

## Complete Source Inventory (72 Files in `src/` + 3 Configs)

1. **Tooling & Configs:** `vite.config.js` -> `vite.config.ts`, `jsconfig.json` -> `tsconfig.json`, `index.html` (entry `main.tsx`), `src/vite-env.d.ts`
2. **Core Types & Data (7 files):** `src/types/index.ts` (new), `src/lib/utils.js`, `src/theme.js`, `src/mocks/inbox.js`, `src/data.js`, `src/api/analytics.js`, `src/api/inbox.js`, `src/store.jsx`
3. **Shared & Base Components (17 files):**
   - UI atoms: `src/components/ui/alert.jsx`, `button.jsx`, `field.jsx`, `input.jsx`, `label.jsx`, `separator.jsx`
   - Shared components: `src/components/common.jsx`, `UserAvatar.jsx`, `DirectorySearch.jsx`, `ImageUploadField.jsx`, `WrittenAnswer.jsx`, `AskInstructorButton.jsx`, `CourseOutline.jsx`, `WorkspaceNotifications.jsx`, `Shell.jsx`
   - Chapter editors: `src/components/chapter/AssessmentEditor.jsx`, `ChapterPreview.jsx`, `RichTextEditor.jsx`, `VideoEditor.jsx`
4. **Landing & Public Pages (16 files):**
   - `src/pages/landing/AboutPage.jsx`, `BrandStory.jsx`, `CourseCollection.jsx`, `LandingChrome.jsx`, `LandingHero.jsx`, `LandingMedia.jsx`, `LandingPage.jsx`, `LearningGuide.jsx`, `LearningInvitation.jsx`, `LearningSections.jsx`, `NewsletterBanner.jsx`, `PartnerPreview.jsx`, `ReadingCollection.jsx`
   - `src/pages/public/CatalogPage.jsx`, `CourseDetailPage.jsx`
   - `src/pages/PublicPages.jsx`, `AuthPages.jsx`, `SystemPages.jsx`, `blog/BlogPages.jsx`
5. **Learner & Member Pages (8 files):**
   - `src/pages/member/CatalogPage.jsx`, `CourseDetailPage.jsx`
   - `src/pages/learner/AccountPages.jsx`, `CommercePages.jsx`, `DashboardPages.jsx`, `LessonPages.jsx`, `QuizPages.jsx`
   - `src/pages/inbox/InboxPage.jsx`
6. **Instructor & Analytics Pages (11 files):**
   - `src/pages/instructor/ChapterWorkspace.jsx`, `CoursePages.jsx`, `CurriculumPages.jsx`, `CurriculumWorkspace.jsx`, `InsightPages.jsx`, `LearnerReviewQueuePage.jsx`, `QuizPages.jsx`
   - `src/pages/analytics/CourseAnalyticsPage.jsx`, `LearnerAnalyticsPage.jsx`, `PrePostComparisonPanel.jsx`
   - `src/pages/AnalyticsPage.jsx`, `AssignmentsPage.jsx`
7. **Admin & Root Entry (7 files):**
   - `src/pages/admin/AdminPages.jsx`, `AssignmentPages.jsx`, `BlogAdminPages.jsx`, `CertificatePages.jsx`, `OrderPages.jsx`
   - `src/App.jsx`, `src/main.jsx`

---

## Tasks

### Task 1: Setup Tooling, TypeScript Configurations, and Core Domain Types

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/vite-env.d.ts`
- Create: `src/types/index.ts`
- Modify: `package.json`

**Interfaces & Types:**
- Define `User`, `Role`, `Course`, `Chapter`, `CourseItem` (`VideoItem | ArticleItem | QuizItem`), `Question` (`ChoiceQuestion | EssayQuestion`), `Quiz`, `Attempt`, `Assignment`, `ComparisonSet`, `InboxConversation`, `InboxMessage`, `Certificate`, `Order`, `BlogPost`, `LmsData`, and `LmsContextType`.

- [ ] **Step 1: Install TypeScript devDependencies**
  Run: `npm install --save-dev typescript @types/react@^19.0.0 @types/react-dom@^19.0.0 @types/node@^22.0.0`
  Verify exit code 0.

- [ ] **Step 2: Add typecheck script to package.json**
  Add `"typecheck": "tsc --noEmit"` in `scripts`.

- [ ] **Step 3: Create tsconfig.json and tsconfig.node.json**
  Configure strict typechecking, bundler resolution, `react-jsx`, path alias `"@/*": ["./src/*"]`, and temporary `allowJs: true` for incremental migration.

- [ ] **Step 4: Create src/vite-env.d.ts**
  Add client types reference and declaration for static assets (`*.png`, `*.jpg`, `*.svg`, `*.mp4`, etc.).

- [ ] **Step 5: Create src/types/index.ts with comprehensive domain models**
  Implement exact types reflecting the mock datasets and store shapes.

- [ ] **Step 6: Run initial typecheck and build**
  Run: `npm.cmd run typecheck && npm.cmd run build`
  Verify both commands pass with code 0.

---

### Task 2: Migrate Core Logic, Utilities, Selectors, and State Store

**Files:**
- Rename & Migrate: `src/lib/utils.js` -> `src/lib/utils.ts`
- Rename & Migrate: `src/theme.js` -> `src/theme.ts`
- Rename & Migrate: `src/mocks/inbox.js` -> `src/mocks/inbox.ts`
- Rename & Migrate: `src/data.js` -> `src/data.ts`
- Rename & Migrate: `src/api/analytics.js` -> `src/api/analytics.ts`
- Rename & Migrate: `src/api/inbox.js` -> `src/api/inbox.ts`
- Rename & Migrate: `src/store.jsx` -> `src/store.tsx`

**Interfaces:**
- Consumes: `src/types/index.ts`
- Produces: Typed `useLms()`, typed `initialData`, typed selectors `getInstructorAnalytics`, `getCourseAnalytics`, `getLearnerCourseAnalytics`, `getPrePostComparison`, `getReviewQueue`, `getInboxConversations`, `getInboxThread`.

- [ ] **Step 1: Migrate utils.js and theme.js to TypeScript**
  Add Mantine/Theme typing and export `cn`.

- [ ] **Step 2: Migrate mocks/inbox.js to mocks/inbox.ts**
  Type fixture generation functions with `InboxConversation` and `InboxMessage`.

- [ ] **Step 3: Migrate data.js to data.ts**
  Ensure typed initial data, demo accounts, and helper functions (`createId`, `flattenItems`).

- [ ] **Step 4: Migrate api/analytics.js to api/analytics.ts**
  Type selectors with exact return shapes matching `LEARNER-ANALYTICS-UI-SPEC.md`.

- [ ] **Step 5: Migrate api/inbox.js to api/inbox.ts**
  Type inbox thread/conversation selectors and filters.

- [ ] **Step 6: Migrate store.jsx to store.tsx**
  Implement typed `LmsContextType` covering all 30+ domain actions with exact signatures.

- [ ] **Step 7: Run typecheck and build verification**
  Run: `npm.cmd run typecheck && npm.cmd run build`
  Verify code 0.

---

### Task 3: Migrate Base UI and Shared Components

**Files:**
- Rename & Migrate: `src/components/ui/alert.jsx` -> `.tsx`
- Rename & Migrate: `src/components/ui/button.jsx` -> `.tsx`
- Rename & Migrate: `src/components/ui/field.jsx` -> `.tsx`
- Rename & Migrate: `src/components/ui/input.jsx` -> `.tsx`
- Rename & Migrate: `src/components/ui/label.jsx` -> `.tsx`
- Rename & Migrate: `src/components/ui/separator.jsx` -> `.tsx`
- Rename & Migrate: `src/components/common.jsx` -> `.tsx`
- Rename & Migrate: `src/components/UserAvatar.jsx` -> `.tsx`
- Rename & Migrate: `src/components/DirectorySearch.jsx` -> `.tsx`
- Rename & Migrate: `src/components/ImageUploadField.jsx` -> `.tsx`
- Rename & Migrate: `src/components/WrittenAnswer.jsx` -> `.tsx`
- Rename & Migrate: `src/components/AskInstructorButton.jsx` -> `.tsx`
- Rename & Migrate: `src/components/CourseOutline.jsx` -> `.tsx`
- Rename & Migrate: `src/components/WorkspaceNotifications.jsx` -> `.tsx`
- Rename & Migrate: `src/components/chapter/AssessmentEditor.jsx` -> `.tsx`
- Rename & Migrate: `src/components/chapter/ChapterPreview.jsx` -> `.tsx`
- Rename & Migrate: `src/components/chapter/RichTextEditor.jsx` -> `.tsx`
- Rename & Migrate: `src/components/chapter/VideoEditor.jsx` -> `.tsx`
- Rename & Migrate: `src/components/Shell.jsx` -> `.tsx`

- [ ] **Step 1: Migrate UI atoms (`src/components/ui/`)**
  Type Radix/base-ui wrapper components with exact HTML attribute props.

- [ ] **Step 2: Migrate shared helper components**
  Type `common.tsx`, `UserAvatar.tsx`, `DirectorySearch.tsx`, `ImageUploadField.tsx`, `WrittenAnswer.tsx`.

- [ ] **Step 3: Migrate course widgets and notifications**
  Type `AskInstructorButton.tsx`, `CourseOutline.tsx`, `WorkspaceNotifications.tsx`.

- [ ] **Step 4: Migrate chapter workspace editors**
  Type `AssessmentEditor.tsx`, `ChapterPreview.tsx`, `VideoEditor.tsx`, and `RichTextEditor.tsx` (handling Tiptap editor typings).

- [ ] **Step 5: Migrate Shell.jsx to Shell.tsx**
  Type navigation menus, role switchers, and user dropdowns.

- [ ] **Step 6: Run typecheck and build verification**
  Run: `npm.cmd run typecheck && npm.cmd run build`
  Verify code 0.

---

### Task 4: Migrate Landing, Blog, and Public Pages

**Files:**
- Rename & Migrate: 13 files in `src/pages/landing/` (`AboutPage.jsx`, `BrandStory.jsx`, `CourseCollection.jsx`, `LandingChrome.jsx`, `LandingHero.jsx`, `LandingMedia.jsx`, `LandingPage.jsx`, `LearningGuide.jsx`, `LearningInvitation.jsx`, `LearningSections.jsx`, `NewsletterBanner.jsx`, `PartnerPreview.jsx`, `ReadingCollection.jsx`)
- Rename & Migrate: `src/pages/public/CatalogPage.jsx` -> `.tsx`, `CourseDetailPage.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/PublicPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/AuthPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/SystemPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/blog/BlogPages.jsx` -> `.tsx`

- [ ] **Step 1: Migrate landing modular components (`src/pages/landing/`)**
  Convert all 13 landing section components to TypeScript.

- [ ] **Step 2: Migrate public catalog and course detail (`src/pages/public/`)**
  Type route params, search queries, and catalog filters.

- [ ] **Step 3: Migrate PublicPages, AuthPages, and SystemPages**
  Type login, register, verify email, 403, and 404 pages.

- [ ] **Step 4: Migrate blog/BlogPages**
  Type article reader and category navigation.

- [ ] **Step 5: Run typecheck and build verification**
  Run: `npm.cmd run typecheck && npm.cmd run build`
  Verify code 0.

---

### Task 5: Migrate Learner, Member, and Inbox Pages

**Files:**
- Rename & Migrate: `src/pages/member/CatalogPage.jsx` -> `.tsx`, `CourseDetailPage.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/learner/AccountPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/learner/CommercePages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/learner/DashboardPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/learner/LessonPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/learner/QuizPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/inbox/InboxPage.jsx` -> `.tsx`

- [ ] **Step 1: Migrate member pages (`src/pages/member/`)**
  Type catalog and detail views for enrolled members.

- [ ] **Step 2: Migrate learner account, commerce, and dashboard**
  Type certificates, orders, profile, checkout, and learner dashboard.

- [ ] **Step 3: Migrate learner lessons and quizzes**
  Type video player, article reader, quiz attempts, and result view.

- [ ] **Step 4: Migrate inbox/InboxPage**
  Type thread selection, message list, course context pill, and reply form.

- [ ] **Step 5: Run typecheck and build verification**
  Run: `npm.cmd run typecheck && npm.cmd run build`
  Verify code 0.

---

### Task 6: Migrate Instructor and Analytics Pages

**Files:**
- Rename & Migrate: `src/pages/instructor/ChapterWorkspace.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/instructor/CoursePages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/instructor/CurriculumPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/instructor/CurriculumWorkspace.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/instructor/InsightPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/instructor/LearnerReviewQueuePage.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/instructor/QuizPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/analytics/CourseAnalyticsPage.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/analytics/LearnerAnalyticsPage.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/analytics/PrePostComparisonPanel.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/AnalyticsPage.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/AssignmentsPage.jsx` -> `.tsx`

- [ ] **Step 1: Migrate instructor course & curriculum management**
  Type course editor, chapter workspace, curriculum reordering, and previews.

- [ ] **Step 2: Migrate instructor quizzes and grading workspace**
  Type quiz builder, question list, attempt table, and essay grading panel.

- [ ] **Step 3: Migrate LearnerReviewQueuePage and AssignmentsPage**
  Type review queue table, filter params, and assignment creation modal.

- [ ] **Step 4: Migrate analytics pages**
  Type `AnalyticsPage`, `CourseAnalyticsPage`, `LearnerAnalyticsPage`, and `PrePostComparisonPanel`.

- [ ] **Step 5: Run typecheck and build verification**
  Run: `npm.cmd run typecheck && npm.cmd run build`
  Verify code 0.

---

### Task 7: Migrate Admin Pages, Root Entry, Configs & Strict Final Verification

**Files:**
- Rename & Migrate: `src/pages/admin/AdminPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/admin/AssignmentPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/admin/BlogAdminPages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/admin/CertificatePages.jsx` -> `.tsx`
- Rename & Migrate: `src/pages/admin/OrderPages.jsx` -> `.tsx`
- Rename & Migrate: `src/App.jsx` -> `src/App.tsx`
- Rename & Migrate: `src/main.jsx` -> `src/main.tsx`
- Rename & Migrate: `vite.config.js` -> `vite.config.ts`
- Modify: `index.html` (change script to `/src/main.tsx`)
- Delete: `jsconfig.json`
- Modify: `tsconfig.json` (remove `allowJs: true` to enforce 100% TypeScript)

- [ ] **Step 1: Migrate admin pages (`src/pages/admin/`)**
  Type user management, instructor requests, course administration, blog editor, and orders.

- [ ] **Step 2: Migrate App.jsx and main.jsx**
  Type AppRoutes, RolePage route guard, root render, and query param helpers.

- [ ] **Step 3: Migrate vite.config.js to vite.config.ts**
  Import `defineConfig` and Tailwind plugin with type definitions.

- [ ] **Step 4: Update index.html and remove jsconfig.json**
  Update `<script type="module" src="/src/main.tsx"></script>`. Remove `jsconfig.json`.

- [ ] **Step 5: Turn off allowJs in tsconfig.json**
  Set `"allowJs": false` and ensure 0 JavaScript/JSX files remain in `src/`.

- [ ] **Step 6: Run strict compiler, build, and git checks**
  Run:
  `npm.cmd run typecheck`
  `npm.cmd run build`
  `git diff --check`
  Verify all exit code 0.

- [ ] **Step 7: Browser Regression Smoke Test**
  Test key flows across roles (Learner, Instructor, Admin) in browser:
  - Landing page, Course Catalog, Course Detail
  - Login / Switch role
  - Learner: Video/article lesson, Quiz submit, Assignments inbox
  - Instructor: Course editor, Review queue grading, Analytics overview, Pre/Post panel
  - Admin: Admin users, Admin analytics, Blog editor
  - Verify console has 0 errors.
