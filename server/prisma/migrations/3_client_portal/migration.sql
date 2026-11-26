CREATE TYPE "WaitlistWindow" AS ENUM ('ANY', 'MORNING', 'AFTERNOON');

ALTER TABLE "users"
    ADD COLUMN "email_verified_at" TIMESTAMPTZ,
    ADD COLUMN "verification_hash" TEXT,
    ADD COLUMN "verification_expires_at" TIMESTAMPTZ,
    ADD COLUMN "late_cancellation_count" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "users_verification_hash_key" ON "users"("verification_hash");

CREATE TABLE "client_sessions" (
    "token_hash" TEXT PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "expires_at" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "client_sessions_user_id_idx" ON "client_sessions"("user_id");

ALTER TABLE "appointments"
    ADD COLUMN "base_price_ron" DECIMAL(10, 2),
    ADD COLUMN "loyalty_discount_ron" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN "reminder_sent_at" TIMESTAMPTZ,
    ADD COLUMN "reminder_claimed_at" TIMESTAMPTZ,
    ADD COLUMN "late_cancellation" BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE "appointments" SET "base_price_ron" = "total_price_ron";
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_client_or_guest";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_or_guest" CHECK (
    ("client_id" IS NOT NULL AND "guest_first_name" IS NULL AND "guest_last_name" IS NULL AND "guest_phone" IS NULL AND "guest_email" IS NULL)
    OR ("guest_first_name" IS NOT NULL AND "guest_last_name" IS NOT NULL AND "guest_phone" IS NOT NULL AND "guest_email" IS NOT NULL)
);
CREATE INDEX "appointments_client_id_status_start_time_idx" ON "appointments"("client_id", "status", "start_time");
CREATE INDEX "appointments_status_reminder_sent_at_start_time_idx" ON "appointments"("status", "reminder_sent_at", "start_time");

ALTER TABLE "waitlist_entries"
    ALTER COLUMN "client_id" DROP NOT NULL,
    ADD COLUMN "guest_first_name" TEXT,
    ADD COLUMN "guest_last_name" TEXT,
    ADD COLUMN "guest_phone" TEXT,
    ADD COLUMN "guest_email" TEXT,
    ADD COLUMN "window" "WaitlistWindow" NOT NULL DEFAULT 'ANY',
    ADD COLUMN "offered_start_at" TIMESTAMPTZ,
    ADD COLUMN "email_claimed_at" TIMESTAMPTZ;
CREATE INDEX "waitlist_entries_specialist_id_desired_date_status_created_at_idx"
    ON "waitlist_entries"("specialist_id", "desired_date", "status", "created_at");
CREATE INDEX "waitlist_entries_status_expires_at_idx" ON "waitlist_entries"("status", "expires_at");

CREATE TABLE "waitlist_offer_stages" (
    "id" UUID PRIMARY KEY,
    "entry_id" UUID NOT NULL REFERENCES "waitlist_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "waitlist_offer_stages_entry_id_idx" ON "waitlist_offer_stages"("entry_id");
