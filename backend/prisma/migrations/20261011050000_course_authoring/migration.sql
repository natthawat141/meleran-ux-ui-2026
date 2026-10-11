BEGIN;
-- Append-only storage for canonical authoring fields. Legacy unknown audits stay NULL.
ALTER TABLE courses ADD COLUMN "publishedBy" TEXT;
ALTER TABLE courses ADD CONSTRAINT "courses_publishedBy_fkey" FOREIGN KEY ("publishedBy")
  REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "courses_publishedBy_idx" ON courses("publishedBy");
ALTER TABLE course_chapters ADD COLUMN description TEXT;
ALTER TABLE course_items ADD COLUMN description TEXT, ADD COLUMN body TEXT,
  ADD COLUMN duration TEXT, ADD COLUMN "readingMinutes" DOUBLE PRECISION;
ALTER TABLE course_items ADD CONSTRAINT course_reading_minutes_check
  CHECK ("readingMinutes" IS NULL OR ("readingMinutes">=0 AND "readingMinutes"<'Infinity'::double precision));
ALTER TABLE course_reviews ADD COLUMN "submittedSnapshot" JSONB;
ALTER TABLE course_reviews ADD CONSTRAINT review_submitted_snapshot_object_check
  CHECK ("submittedSnapshot" IS NULL OR jsonb_typeof("submittedSnapshot")='object');
CREATE FUNCTION preserve_known_first_publisher() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF OLD."publishedBy" IS NOT NULL AND (NEW."publishedBy" IS DISTINCT FROM OLD."publishedBy" OR
      NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt") THEN
    RAISE EXCEPTION 'First publication audit is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW."publishedBy" IS NOT NULL AND NEW."publishedAt" IS NULL THEN
    RAISE EXCEPTION 'Publisher requires first publication timestamp' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_known_first_publisher BEFORE INSERT OR UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION preserve_known_first_publisher();
COMMIT;
