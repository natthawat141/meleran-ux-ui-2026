BEGIN;

-- Scope Final 1.6 section 2.2: creator is distinct from current Instructor.
-- Historical creator identity is unknown; do not infer/backfill from ownership.
ALTER TABLE "courses" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "courses" ADD CONSTRAINT "courses_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "courses_createdBy_idx" ON "courses"("createdBy");

-- New authoring writers record the authenticated actor on INSERT. Ownership
-- changes must retain original creation audit, including truthful legacy NULL.
CREATE FUNCTION guard_course_creator_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."createdBy" IS DISTINCT FROM OLD."createdBy" THEN
    RAISE EXCEPTION 'course creator audit is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER courses_creator_audit_immutable BEFORE UPDATE ON "courses"
  FOR EACH ROW EXECUTE FUNCTION guard_course_creator_audit();

COMMIT;
