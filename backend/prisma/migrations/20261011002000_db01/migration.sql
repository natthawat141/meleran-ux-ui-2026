-- DB-01 reviewed batch; apply only to the explicitly selected Test PostgreSQL.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT,
    "normalizedUsername" TEXT,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'admin_created',
    "roles" TEXT NOT NULL DEFAULT 'learner',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "profileJson" TEXT NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "instructorAddedBy" TEXT,
    "instructorAddedAt" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_credentials" (
    "accountId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "local_credentials_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "app_sessions" (
    "tokenHash" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "external_identities" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'firebase',
    "project" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL DEFAULT 'password',

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "coverUrl" TEXT,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "priceMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "description" TEXT,
    "outcomesJson" TEXT NOT NULL DEFAULT '[]',
    "instructorId" TEXT NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_reviews" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "submittedRevision" INTEGER NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "result" TEXT,
    "reason" TEXT,

    CONSTRAINT "course_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_chapters" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "course_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_items" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'article',
    "position" INTEGER NOT NULL,

    CONSTRAINT "course_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'free',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_username_key" ON "accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_normalizedUsername_key" ON "accounts"("normalizedUsername");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_normalizedEmail_key" ON "accounts"("normalizedEmail");

-- CreateIndex
CREATE INDEX "app_sessions_accountId_audience_idx" ON "app_sessions"("accountId", "audience");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_provider_project_subject_key" ON "external_identities"("provider", "project", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_publishedAt_id_idx" ON "courses"("status", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "course_reviews_courseId_submittedRevision_submittedAt_idx" ON "course_reviews"("courseId", "submittedRevision", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "course_chapters_courseId_position_key" ON "course_chapters"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "course_items_chapterId_position_key" ON "course_items"("chapterId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_accountId_courseId_key" ON "enrollments"("accountId", "courseId");

-- AddForeignKey
ALTER TABLE "local_credentials" ADD CONSTRAINT "local_credentials_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_items" ADD CONSTRAINT "course_items_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "course_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Canonical integer money and ordering/revision storage invariants.
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_nonnegative" CHECK ("priceMinor" IS NULL OR "priceMinor" >= 0);
ALTER TABLE "courses" ADD CONSTRAINT "courses_currency_thb" CHECK ("currency" = 'THB');
ALTER TABLE "courses" ADD CONSTRAINT "courses_revision_nonnegative" CHECK ("revision" >= 0);
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "course_items" ADD CONSTRAINT "course_items_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "course_items" ADD CONSTRAINT "course_items_type_allowed" CHECK ("type" IN ('article', 'video', 'quiz'));
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_revision_nonnegative" CHECK ("submittedRevision" >= 0);

COMMIT;

