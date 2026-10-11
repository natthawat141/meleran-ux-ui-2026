BEGIN;
-- Nullable additions preserve unknown legacy data without fabricated audit.
ALTER TABLE blog_posts ADD COLUMN content TEXT, ADD COLUMN category TEXT,
 ADD COLUMN "readingMinutes" INTEGER, ADD COLUMN "editorId" TEXT,
 ADD COLUMN "deletedAt" TIMESTAMPTZ(3), ADD COLUMN "deletedBy" TEXT;
ALTER TABLE blog_posts ADD CONSTRAINT "blog_posts_editorId_fkey"
 FOREIGN KEY ("editorId") REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE blog_posts ADD CONSTRAINT "blog_posts_deletedBy_fkey"
 FOREIGN KEY ("deletedBy") REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE blog_posts ADD CONSTRAINT blog_reading_minutes_check CHECK ("readingMinutes" IS NULL OR "readingMinutes">=1),
 ADD CONSTRAINT blog_deleted_audit_check CHECK (("deletedAt" IS NULL)=("deletedBy" IS NULL));
CREATE INDEX "blog_posts_deletedAt_status_updatedAt_id_idx" ON blog_posts("deletedAt",status,"updatedAt",id);
CREATE FUNCTION preserve_blog_authoring_audit() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF (NEW.id,NEW."authorId",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."authorId",OLD."createdAt") THEN
  RAISE EXCEPTION 'blog creation audit is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD."publishedAt" IS NOT NULL AND (NEW.slug,NEW."publishedAt") IS DISTINCT FROM (OLD.slug,OLD."publishedAt") THEN
  RAISE EXCEPTION 'published blog identity is immutable' USING ERRCODE='23514';
 END IF;
 IF OLD."deletedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
  RAISE EXCEPTION 'deleted blog audit is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$body$;
CREATE TRIGGER blog_authoring_audit_guard BEFORE UPDATE ON blog_posts
 FOR EACH ROW EXECUTE FUNCTION preserve_blog_authoring_audit();
COMMIT;
