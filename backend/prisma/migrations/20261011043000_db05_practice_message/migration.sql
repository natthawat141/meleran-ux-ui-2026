BEGIN;
-- Final 1.6 general chat has no course; a linked course still uses the same FK.
ALTER TABLE ai_conversations ALTER COLUMN "courseId" DROP NOT NULL;
-- No ambiguous data backfill: legacy practices remain unlinked/read-quarantined.
ALTER TABLE ai_practice ADD COLUMN "messageId" TEXT;
CREATE UNIQUE INDEX "ai_messages_id_conversationId_accountId_key" ON ai_messages(id,"conversationId","accountId");
CREATE UNIQUE INDEX "ai_practice_messageId_key" ON ai_practice("messageId");
CREATE UNIQUE INDEX "ai_practice_messageId_conversationId_accountId_key" ON ai_practice("messageId","conversationId","accountId");
ALTER TABLE ai_practice ADD CONSTRAINT "ai_practice_messageId_conversationId_accountId_fkey"
  FOREIGN KEY ("messageId","conversationId","accountId") REFERENCES ai_messages(id,"conversationId","accountId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION validate_ai_practice_message() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."messageId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM ai_messages WHERE id=NEW."messageId" AND "conversationId"=NEW."conversationId"
      AND "accountId"=NEW."accountId" AND role='assistant') THEN
    RAISE EXCEPTION 'Practice requires its own assistant message' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER validate_ai_practice_message BEFORE INSERT OR UPDATE ON ai_practice
FOR EACH ROW EXECUTE FUNCTION validate_ai_practice_message();

CREATE OR REPLACE FUNCTION preserve_ai_practice_payload() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."accountId" IS DISTINCT FROM OLD."accountId" OR NEW."conversationId" IS DISTINCT FROM OLD."conversationId" OR
     NEW."payloadSnapshot" IS DISTINCT FROM OLD."payloadSnapshot" OR NEW."messageId" IS DISTINCT FROM OLD."messageId" THEN
    RAISE EXCEPTION 'AI practice snapshot and message identity are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;

CREATE FUNCTION preserve_ai_practice_message_identity() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF EXISTS (SELECT 1 FROM ai_practice WHERE "messageId"=OLD.id) AND
     (NEW.id IS DISTINCT FROM OLD.id OR NEW."accountId" IS DISTINCT FROM OLD."accountId" OR
      NEW."conversationId" IS DISTINCT FROM OLD."conversationId" OR NEW.role<>'assistant') THEN
    RAISE EXCEPTION 'Linked practice message identity is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_ai_practice_message_identity BEFORE UPDATE ON ai_messages
FOR EACH ROW EXECUTE FUNCTION preserve_ai_practice_message_identity();
COMMIT;
