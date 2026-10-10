BEGIN;
-- Role validation and the FK must observe the same immutable assistant message.
-- FOR SHARE also conflicts with non-key updates, unlike the FK key-share lock.
CREATE OR REPLACE FUNCTION validate_ai_practice_message() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."messageId" IS NOT NULL THEN
    PERFORM id FROM ai_messages WHERE id=NEW."messageId" AND "conversationId"=NEW."conversationId"
      AND "accountId"=NEW."accountId" AND role='assistant' FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Practice requires its own assistant message' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$body$;
COMMIT;
