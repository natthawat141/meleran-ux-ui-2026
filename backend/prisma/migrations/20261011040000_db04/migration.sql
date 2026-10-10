BEGIN;
-- CreateTable
CREATE TABLE "redeem_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unused',
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedBy" TEXT,
    "usedAt" TIMESTAMPTZ(3),
    "enrollmentId" TEXT,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "redeem_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "checkoutSessionId" TEXT,
    "paymentIntentId" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending',
    "enrollmentId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paymentId" TEXT,
    "checkoutSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "eventSnapshot" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "errorCode" TEXT,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "redeem_codes_code_key" ON "redeem_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "redeem_codes_enrollmentId_key" ON "redeem_codes"("enrollmentId");

-- CreateIndex
CREATE INDEX "redeem_codes_status_issuedAt_id_idx" ON "redeem_codes"("status", "issuedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "redeem_codes_enrollmentId_usedBy_courseId_key" ON "redeem_codes"("enrollmentId", "usedBy", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_checkoutSessionId_key" ON "payments"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentIntentId_key" ON "payments"("paymentIntentId");

-- CreateIndex
CREATE INDEX "payments_fulfillmentStatus_paidAt_idx" ON "payments"("fulfillmentStatus", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_accountId_requestId_key" ON "payments"("accountId", "requestId");

-- CreateIndex
CREATE INDEX "payment_events_status_receivedAt_idx" ON "payment_events"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_id_accountId_courseId_key" ON "enrollments"("id", "accountId", "courseId");

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_issuedBy_fkey" FOREIGN KEY ("issuedBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_usedBy_fkey" FOREIGN KEY ("usedBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_enrollmentId_usedBy_courseId_fkey" FOREIGN KEY ("enrollmentId", "usedBy", "courseId") REFERENCES "enrollments"("id", "accountId", "courseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollmentId_accountId_courseId_fkey" FOREIGN KEY ("enrollmentId", "accountId", "courseId") REFERENCES "enrollments"("id", "accountId", "courseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



ALTER TABLE redeem_codes ADD CONSTRAINT redeem_state_check CHECK (
  (status='unused' AND "usedBy" IS NULL AND "usedAt" IS NULL AND "enrollmentId" IS NULL AND "revokedBy" IS NULL AND "revokedAt" IS NULL) OR
  (status='used' AND "usedBy" IS NOT NULL AND "usedAt" IS NOT NULL AND "enrollmentId" IS NOT NULL AND "revokedBy" IS NULL AND "revokedAt" IS NULL) OR
  (status='revoked' AND "usedBy" IS NULL AND "usedAt" IS NULL AND "enrollmentId" IS NULL AND "revokedBy" IS NOT NULL AND "revokedAt" IS NOT NULL));
ALTER TABLE payments ADD CONSTRAINT payment_money_check CHECK ("amountMinor">0 AND currency='THB');
ALTER TABLE payments ADD CONSTRAINT payment_status_check CHECK (status IN ('pending','processing','succeeded','failed','cancelled','expired'));
ALTER TABLE payments ADD CONSTRAINT payment_paid_check CHECK ((status='succeeded')=("paidAt" IS NOT NULL));
ALTER TABLE payments ADD CONSTRAINT payment_fulfillment_check CHECK (
  ("fulfillmentStatus"='granted' AND "enrollmentId" IS NOT NULL AND status='succeeded') OR
  ("fulfillmentStatus" IN ('pending','failed') AND "enrollmentId" IS NULL));
ALTER TABLE payment_events ADD CONSTRAINT payment_event_state_check CHECK (status IN ('received','processed','failed'));

CREATE FUNCTION preserve_grant_identity() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."accountId" IS DISTINCT FROM OLD."accountId" OR NEW."courseId" IS DISTINCT FROM OLD."courseId" OR
     NEW.source IS DISTINCT FROM OLD.source OR NEW."grantedAt" IS DISTINCT FROM OLD."grantedAt" THEN
    RAISE EXCEPTION 'Original enrollment grant is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_grant_identity BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION preserve_grant_identity();

CREATE FUNCTION preserve_redeem_history() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code OR NEW."courseId" IS DISTINCT FROM OLD."courseId" OR
     NEW."issuedBy" IS DISTINCT FROM OLD."issuedBy" OR NEW."issuedAt" IS DISTINCT FROM OLD."issuedAt" OR
     (OLD.status<>'unused' AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Code identity and final redemption state are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_redeem_history BEFORE UPDATE ON redeem_codes FOR EACH ROW EXECUTE FUNCTION preserve_redeem_history();

CREATE FUNCTION preserve_payment_identity() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW."accountId" IS DISTINCT FROM OLD."accountId" OR NEW."courseId" IS DISTINCT FROM OLD."courseId" OR
     NEW."requestId" IS DISTINCT FROM OLD."requestId" OR NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash" OR
     NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor" OR NEW.currency IS DISTINCT FROM OLD.currency OR
     (OLD.status='succeeded' AND (NEW.status<>'succeeded' OR NEW."paidAt" IS DISTINCT FROM OLD."paidAt")) OR
     (OLD."checkoutSessionId" IS NOT NULL AND NEW."checkoutSessionId" IS DISTINCT FROM OLD."checkoutSessionId") OR
     (OLD."paymentIntentId" IS NOT NULL AND NEW."paymentIntentId" IS DISTINCT FROM OLD."paymentIntentId") THEN
    RAISE EXCEPTION 'Payment money and provider identity are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$body$;
CREATE TRIGGER preserve_payment_identity BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION preserve_payment_identity();
COMMIT;
