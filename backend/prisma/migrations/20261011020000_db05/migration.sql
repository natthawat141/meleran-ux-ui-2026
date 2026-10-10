BEGIN;
-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "excerpt" TEXT,
    "contentDoc" JSONB NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_transcripts" (
    "itemId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'video',
    "text" TEXT NOT NULL,
    "editedBy" TEXT NOT NULL,
    "editedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "video_transcripts_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT,
    "contextSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contextSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_daily" (
    "accountId" TEXT NOT NULL,
    "usageDate" DATE NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("accountId","usageDate")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "usageDate" DATE NOT NULL,
    "conversationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_practice" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "payloadSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_practice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_publishedAt_id_idx" ON "blog_posts"("status", "publishedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "video_transcripts_itemId_itemType_key" ON "video_transcripts"("itemId", "itemType");

-- CreateIndex
CREATE INDEX "ai_conversations_accountId_updatedAt_id_idx" ON "ai_conversations"("accountId", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_conversations_id_accountId_key" ON "ai_conversations"("id", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_messages_conversationId_position_key" ON "ai_messages"("conversationId", "position");

-- CreateIndex
CREATE INDEX "ai_requests_status_createdAt_idx" ON "ai_requests"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_requests_accountId_requestId_key" ON "ai_requests"("accountId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "course_items_id_type_key" ON "course_items"("id", "type");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_transcripts" ADD CONSTRAINT "video_transcripts_itemId_itemType_fkey" FOREIGN KEY ("itemId", "itemType") REFERENCES "course_items"("id", "type") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_transcripts" ADD CONSTRAINT "video_transcripts_editedBy_fkey" FOREIGN KEY ("editedBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_accountId_fkey" FOREIGN KEY ("conversationId", "accountId") REFERENCES "ai_conversations"("id", "accountId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_accountId_usageDate_fkey" FOREIGN KEY ("accountId", "usageDate") REFERENCES "ai_usage_daily"("accountId", "usageDate") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_conversationId_accountId_fkey" FOREIGN KEY ("conversationId", "accountId") REFERENCES "ai_conversations"("id", "accountId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_practice" ADD CONSTRAINT "ai_practice_conversationId_accountId_fkey" FOREIGN KEY ("conversationId", "accountId") REFERENCES "ai_conversations"("id", "accountId") ON DELETE RESTRICT ON UPDATE CASCADE;



ALTER TABLE blog_posts ADD CONSTRAINT blog_status_check CHECK (status IN ('draft','published'));
ALTER TABLE blog_posts ADD CONSTRAINT blog_revision_check CHECK (revision>=0);
ALTER TABLE video_transcripts ADD CONSTRAINT transcript_video_check CHECK ("itemType"='video');
ALTER TABLE ai_messages ADD CONSTRAINT ai_message_role_check CHECK (role IN ('user','assistant'));
ALTER TABLE ai_messages ADD CONSTRAINT ai_message_position_check CHECK (position>=0);
ALTER TABLE ai_usage_daily ADD CONSTRAINT ai_quota_bounds_check
CHECK ("successCount">=0 AND "pendingCount">=0 AND "successCount"+"pendingCount"<=20);
ALTER TABLE ai_requests ADD CONSTRAINT ai_request_state_check CHECK (status IN ('pending','succeeded','failed'));
ALTER TABLE ai_requests ADD CONSTRAINT ai_request_finalized_check
CHECK ((status='pending') = ("finalizedAt" IS NULL));

CREATE FUNCTION preserve_ai_request_identity() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."accountId" IS DISTINCT FROM OLD."accountId" OR NEW."requestId" IS DISTINCT FROM OLD."requestId" OR
     NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash" OR NEW."usageDate" IS DISTINCT FROM OLD."usageDate" THEN
    RAISE EXCEPTION 'AI request identity and original quota day are immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.status<>'pending' AND (NEW.status IS DISTINCT FROM OLD.status OR
     NEW.result IS DISTINCT FROM OLD.result OR NEW."errorCode" IS DISTINCT FROM OLD."errorCode" OR
     NEW."finalizedAt" IS DISTINCT FROM OLD."finalizedAt") THEN
    RAISE EXCEPTION 'Finalized AI result is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_ai_request_identity BEFORE UPDATE ON ai_requests
FOR EACH ROW EXECUTE FUNCTION preserve_ai_request_identity();

CREATE FUNCTION preserve_ai_practice_payload() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."accountId" IS DISTINCT FROM OLD."accountId" OR NEW."conversationId" IS DISTINCT FROM OLD."conversationId" OR
     NEW."payloadSnapshot" IS DISTINCT FROM OLD."payloadSnapshot" THEN
    RAISE EXCEPTION 'AI practice snapshot is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_ai_practice_payload BEFORE UPDATE ON ai_practice
FOR EACH ROW EXECUTE FUNCTION preserve_ai_practice_payload();
COMMIT;
