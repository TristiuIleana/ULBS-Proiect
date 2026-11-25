BEGIN;

ALTER TABLE "users" ADD COLUMN "specialist_category" "ServiceCategory";

UPDATE "users" AS staff
SET "specialist_category" = categories.category
FROM (VALUES
    ('ioana@beautystudio.local', 'BROWS'::"ServiceCategory"),
    ('ana@beautystudio.local', 'MAKEUP'::"ServiceCategory")
) AS categories(email, category)
WHERE staff."email" = categories.email
    AND staff."role" IN ('ADMIN', 'SPECIALIST');

COMMIT;
