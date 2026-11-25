ALTER TABLE "appointments"
    ALTER COLUMN "client_id" DROP NOT NULL,
    ADD COLUMN "guest_first_name" TEXT,
    ADD COLUMN "guest_last_name" TEXT,
    ADD COLUMN "guest_phone" TEXT,
    ADD COLUMN "guest_email" TEXT,
    ADD CONSTRAINT "appointments_client_or_guest" CHECK (
        ("client_id" IS NOT NULL AND num_nonnulls("guest_first_name", "guest_last_name", "guest_phone", "guest_email") = 0)
        OR
        ("client_id" IS NULL AND num_nonnulls("guest_first_name", "guest_last_name", "guest_phone", "guest_email") = 4)
    );
