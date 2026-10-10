BEGIN;
-- DropForeignKey
ALTER TABLE "course_items" DROP CONSTRAINT "course_items_chapterId_fkey";

-- AlterTable
ALTER TABLE "course_items" ADD COLUMN "courseId" TEXT;
UPDATE "course_items" AS item SET "courseId"=chapter."courseId"
FROM "course_chapters" AS chapter WHERE chapter.id=item."chapterId";
ALTER TABLE "course_items" ALTER COLUMN "courseId" SET NOT NULL;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "completionSnapshot" JSONB;

-- CreateTable
CREATE TABLE "user_roles" (
    "accountId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("accountId","role")
);

-- CreateTable
CREATE TABLE "progress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "resumeData" JSONB,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "progress_enrollmentId_updatedAt_idx" ON "progress"("enrollmentId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "progress_enrollmentId_itemId_key" ON "progress"("enrollmentId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_enrollmentId_key" ON "certificates"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "course_chapters_id_courseId_key" ON "course_chapters"("id", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "course_items_id_courseId_key" ON "course_items"("id", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_id_courseId_key" ON "enrollments"("id", "courseId");

-- AddForeignKey
ALTER TABLE "course_items" ADD CONSTRAINT "course_items_chapterId_courseId_fkey" FOREIGN KEY ("chapterId", "courseId") REFERENCES "course_chapters"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_enrollmentId_courseId_fkey" FOREIGN KEY ("enrollmentId", "courseId") REFERENCES "enrollments"("id", "courseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_itemId_courseId_fkey" FOREIGN KEY ("itemId", "courseId") REFERENCES "course_items"("id", "courseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Normalized grants initially reflect existing roles; Auth cutover is a later task.
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
CHECK (role IN ('learner','instructor','admin'));
INSERT INTO user_roles ("accountId",role)
SELECT id, trim(role) FROM accounts CROSS JOIN LATERAL unnest(string_to_array(roles,',')) AS role;
ALTER TABLE enrollments ADD CONSTRAINT enrollment_source_check CHECK (source IN ('free','redeem','stripe'));
ALTER TABLE enrollments ADD CONSTRAINT enrollment_completed_count_check CHECK ("completedItems" >= 0);
ALTER TABLE enrollments ADD CONSTRAINT enrollment_completion_pair_check
CHECK (("completedAt" IS NULL) = ("completionSnapshot" IS NULL));
ALTER TABLE enrollments ADD CONSTRAINT enrollment_snapshot_object_check
CHECK ("completionSnapshot" IS NULL OR jsonb_typeof("completionSnapshot")='object');

CREATE FUNCTION preserve_first_completion() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF OLD."completedAt" IS NOT NULL AND
    (NEW."completedAt" IS DISTINCT FROM OLD."completedAt" OR
     NEW."completionSnapshot" IS DISTINCT FROM OLD."completionSnapshot") THEN
    RAISE EXCEPTION 'First completion is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_first_completion BEFORE UPDATE ON enrollments
FOR EACH ROW EXECUTE FUNCTION preserve_first_completion();

CREATE FUNCTION validate_certificate_history() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.code IS DISTINCT FROM OLD.code OR
    NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId" OR NEW."recipientName" IS DISTINCT FROM OLD."recipientName" OR
    NEW."courseName" IS DISTINCT FROM OLD."courseName" OR NEW."issuedAt" IS DISTINCT FROM OLD."issuedAt") THEN
    RAISE EXCEPTION 'Certificate history is immutable' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM enrollments WHERE id=NEW."enrollmentId" AND "completedAt" IS NOT NULL AND "completionSnapshot" IS NOT NULL) THEN
    RAISE EXCEPTION 'Certificate requires completed enrollment' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER validate_certificate_history BEFORE INSERT OR UPDATE ON certificates
FOR EACH ROW EXECUTE FUNCTION validate_certificate_history();
COMMIT;
