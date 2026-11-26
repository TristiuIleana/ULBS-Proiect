BEGIN;

ALTER TABLE "appointments"
  ADD COLUMN "confirmation_token" UUID,
  ALTER COLUMN "status" SET DEFAULT 'PENDING_CONFIRMATION';
CREATE UNIQUE INDEX "appointments_confirmation_token_key" ON "appointments"("confirmation_token");

ALTER TABLE "appointment_stages"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_CONFIRMATION',
  DROP CONSTRAINT "no_specialist_busy_overlap",
  ADD CONSTRAINT "no_specialist_busy_overlap" EXCLUDE USING gist (
    specialist_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (is_busy AND status IN ('PENDING_CONFIRMATION', 'CONFIRMED'));

COMMIT;
