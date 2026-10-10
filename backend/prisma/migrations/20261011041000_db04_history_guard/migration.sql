BEGIN;
-- Additive hardening: applied DB-04 bytes are unchanged.
CREATE OR REPLACE FUNCTION preserve_payment_identity() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."accountId" IS DISTINCT FROM OLD."accountId" OR NEW."courseId" IS DISTINCT FROM OLD."courseId" OR
     NEW."requestId" IS DISTINCT FROM OLD."requestId" OR NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash" OR
     NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor" OR NEW.currency IS DISTINCT FROM OLD.currency OR
     (OLD."fulfillmentStatus"='granted' AND (NEW."fulfillmentStatus"<>'granted' OR NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId")) OR
     (OLD.status='succeeded' AND (NEW.status<>'succeeded' OR NEW."paidAt" IS DISTINCT FROM OLD."paidAt")) OR
     (OLD."checkoutSessionId" IS NOT NULL AND NEW."checkoutSessionId" IS DISTINCT FROM OLD."checkoutSessionId") OR
     (OLD."paymentIntentId" IS NOT NULL AND NEW."paymentIntentId" IS DISTINCT FROM OLD."paymentIntentId") THEN
    RAISE EXCEPTION 'Payment money and provider identity are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;

CREATE FUNCTION preserve_verified_event_identity() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."eventId" IS DISTINCT FROM OLD."eventId" OR NEW.type IS DISTINCT FROM OLD.type OR
     NEW."eventSnapshot" IS DISTINCT FROM OLD."eventSnapshot" OR NEW."receivedAt" IS DISTINCT FROM OLD."receivedAt" OR
     NEW."checkoutSessionId" IS DISTINCT FROM OLD."checkoutSessionId" OR
     (OLD."paymentId" IS NOT NULL AND NEW."paymentId" IS DISTINCT FROM OLD."paymentId") THEN
    RAISE EXCEPTION 'Verified event identity is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_verified_event_identity BEFORE UPDATE ON payment_events
FOR EACH ROW EXECUTE FUNCTION preserve_verified_event_identity();
COMMIT;
