CREATE TABLE "staff_sessions" (
  "token_hash" TEXT NOT NULL PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expires_at" TIMESTAMPTZ NOT NULL
);

CREATE INDEX "staff_sessions_user_id_idx" ON "staff_sessions"("user_id");

ALTER TABLE "appointments" DROP CONSTRAINT "appointments_client_or_guest";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_or_guest" CHECK (
  "client_id" IS NOT NULL OR (
    "guest_first_name" IS NOT NULL AND
    "guest_last_name" IS NOT NULL AND
    "guest_phone" IS NOT NULL AND
    ("guest_email" IS NOT NULL OR ("status" <> 'PENDING_CONFIRMATION' AND "confirmation_token" IS NULL))
  )
);
