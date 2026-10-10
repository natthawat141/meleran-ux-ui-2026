BEGIN;
-- AlterTable
ALTER TABLE "course_items" ADD COLUMN     "contentDoc" JSONB,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'quiz',
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" JSONB,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "correctKey" JSONB NOT NULL,
    "maxScore" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "definitionSnapshot" JSONB NOT NULL,
    "maxScore" DECIMAL(65,30) NOT NULL,
    "earnedScore" DECIMAL(65,30),
    "passed" BOOLEAN,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMPTZ(3),
    "gradedAt" TIMESTAMPTZ(3),

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_questions" (
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payloadSnapshot" JSONB NOT NULL,
    "maxScore" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "attempt_questions_pkey" PRIMARY KEY ("attemptId","questionId")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" JSONB,
    "score" DECIMAL(65,30),
    "comment" TEXT,
    "gradedBy" TEXT,
    "gradedAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_itemId_key" ON "quizzes"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_itemId_courseId_itemType_key" ON "quizzes"("itemId", "courseId", "itemType");
CREATE UNIQUE INDEX "course_items_id_courseId_type_key" ON "course_items"("id", "courseId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_id_courseId_key" ON "quizzes"("id", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "questions_quizId_position_key" ON "questions"("quizId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_enrollmentId_quizId_number_key" ON "quiz_attempts"("enrollmentId", "quizId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attemptId_position_key" ON "attempt_questions"("attemptId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "answers_attemptId_questionId_key" ON "answers"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_itemId_courseId_itemType_fkey" FOREIGN KEY ("itemId", "courseId", "itemType") REFERENCES "course_items"("id", "courseId", "type") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_enrollmentId_courseId_fkey" FOREIGN KEY ("enrollmentId", "courseId") REFERENCES "enrollments"("id", "courseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_courseId_fkey" FOREIGN KEY ("quizId", "courseId") REFERENCES "quizzes"("id", "courseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "quiz_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_attemptId_questionId_fkey" FOREIGN KEY ("attemptId", "questionId") REFERENCES "attempt_questions"("attemptId", "questionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_gradedBy_fkey" FOREIGN KEY ("gradedBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



ALTER TABLE quizzes ADD CONSTRAINT quiz_item_kind_check CHECK ("itemType"='quiz');
ALTER TABLE course_items ADD CONSTRAINT item_revision_check CHECK (revision>=0);
ALTER TABLE questions ADD CONSTRAINT question_type_check CHECK (type IN ('single_choice','multiple_choice','essay','image'));
ALTER TABLE questions ADD CONSTRAINT question_position_check CHECK (position>=0);
ALTER TABLE questions ADD CONSTRAINT question_score_check CHECK ("maxScore">=0 AND "maxScore"<>'NaN'::numeric);
ALTER TABLE attempt_questions ADD CONSTRAINT snapshot_type_check CHECK (type IN ('single_choice','multiple_choice','essay','image'));
ALTER TABLE attempt_questions ADD CONSTRAINT snapshot_score_check CHECK (position>=0 AND "maxScore">=0 AND "maxScore"<>'NaN'::numeric);
ALTER TABLE quiz_attempts ADD CONSTRAINT attempt_number_revision_check CHECK (number>=1 AND revision>=0);
ALTER TABLE quiz_attempts ADD CONSTRAINT attempt_status_check CHECK (status IN ('in_progress','submitted','pending_review','graded'));
ALTER TABLE quiz_attempts ADD CONSTRAINT attempt_score_check CHECK ("maxScore">=0 AND "maxScore"<>'NaN'::numeric AND ("earnedScore" IS NULL OR ("earnedScore">=0 AND "earnedScore"<="maxScore")));
ALTER TABLE quiz_attempts ADD CONSTRAINT attempt_pass_check CHECK (
  (status='graded' AND "earnedScore" IS NOT NULL AND "gradedAt" IS NOT NULL AND passed IS NOT NULL AND passed=("maxScore">0 AND "earnedScore"*10>"maxScore"*7)) OR
  (status<>'graded' AND passed IS NULL AND "gradedAt" IS NULL));
ALTER TABLE answers ADD CONSTRAINT answer_revision_check CHECK (revision>=0);

CREATE FUNCTION preserve_attempt_snapshot() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId" OR NEW."quizId" IS DISTINCT FROM OLD."quizId" OR
     NEW."courseId" IS DISTINCT FROM OLD."courseId" OR NEW."definitionSnapshot" IS DISTINCT FROM OLD."definitionSnapshot" OR
     NEW."maxScore" IS DISTINCT FROM OLD."maxScore" OR NEW.number IS DISTINCT FROM OLD.number THEN
    RAISE EXCEPTION 'Attempt snapshot is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_attempt_snapshot BEFORE UPDATE ON quiz_attempts FOR EACH ROW EXECUTE FUNCTION preserve_attempt_snapshot();
CREATE FUNCTION preserve_question_snapshot() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Attempt question snapshot is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_question_snapshot BEFORE UPDATE ON attempt_questions FOR EACH ROW EXECUTE FUNCTION preserve_question_snapshot();
CREATE FUNCTION validate_answer_score() RETURNS trigger LANGUAGE plpgsql AS $body$
DECLARE maximum numeric;
BEGIN
  SELECT "maxScore" INTO maximum FROM attempt_questions WHERE "attemptId"=NEW."attemptId" AND "questionId"=NEW."questionId";
  IF NEW.score IS NOT NULL AND (NEW.score='NaN'::numeric OR NEW.score<0 OR NEW.score>maximum) THEN
    RAISE EXCEPTION 'Answer exceeds its immutable maximum' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER validate_answer_score BEFORE INSERT OR UPDATE ON answers FOR EACH ROW EXECUTE FUNCTION validate_answer_score();
COMMIT;
