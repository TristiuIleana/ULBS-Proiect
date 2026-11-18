-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SPECIALIST', 'CLIENT');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('BROWS', 'MAKEUP');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'NOTIFIED', 'CLAIMED', 'EXPIRED');

-- CreateTable users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "password_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable services
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "description" TEXT,
    "price_ron" DECIMAL(10,2) NOT NULL,
    "total_duration_minutes" INTEGER NOT NULL,
    "is_split" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_stages
CREATE TABLE "service_stages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "service_id" UUID NOT NULL,
    "stage_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "is_busy" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable specialist_schedules
CREATE TABLE "specialist_schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "specialist_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_working" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialist_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable schedule_overrides
CREATE TABLE "schedule_overrides" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "specialist_id" UUID NOT NULL,
    "date" TEXT NOT NULL,
    "is_working" BOOLEAN NOT NULL DEFAULT false,
    "start_time" TEXT,
    "end_time" TEXT,
    "reason" TEXT,
    "is_full_day_policy" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable appointments
CREATE TABLE "appointments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "client_id" UUID NOT NULL,
    "specialist_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "total_price_ron" DECIMAL(10,2) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "cancellation_reason" TEXT,
    "cancellation_token" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable appointment_stages
CREATE TABLE "appointment_stages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "appointment_id" UUID NOT NULL,
    "specialist_id" UUID NOT NULL,
    "stage_order" INTEGER NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "is_busy" BOOLEAN NOT NULL DEFAULT true,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable waitlist_entries
CREATE TABLE "waitlist_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "client_id" UUID NOT NULL,
    "specialist_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "desired_date" TEXT NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "priority_token" UUID,
    "notified_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- Indexes and Constraints
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "service_stages_service_id_stage_order_key" ON "service_stages"("service_id", "stage_order");

CREATE UNIQUE INDEX "specialist_schedules_specialist_id_day_of_week_key" ON "specialist_schedules"("specialist_id", "day_of_week");

CREATE UNIQUE INDEX "schedule_overrides_specialist_id_date_key" ON "schedule_overrides"("specialist_id", "date");

CREATE UNIQUE INDEX "appointments_cancellation_token_key" ON "appointments"("cancellation_token");
CREATE INDEX "appointments_specialist_id_start_time_end_time_idx" ON "appointments"("specialist_id", "start_time", "end_time");

CREATE INDEX "appointment_stages_specialist_id_is_busy_status_start_time_end_time_idx" ON "appointment_stages"("specialist_id", "is_busy", "status", "start_time", "end_time");

CREATE UNIQUE INDEX "waitlist_entries_priority_token_key" ON "waitlist_entries"("priority_token");

-- Foreign Keys
ALTER TABLE "service_stages" ADD CONSTRAINT "service_stages_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "specialist_schedules" ADD CONSTRAINT "specialist_schedules_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointment_stages" ADD CONSTRAINT "appointment_stages_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- EXCLUSION CONSTRAINT: Engine-level prevention of overlapping busy technician intervals
ALTER TABLE "appointment_stages"
ADD CONSTRAINT "no_specialist_busy_overlap"
EXCLUDE USING gist (
  specialist_id WITH =,
  tstzrange(start_time, end_time) WITH &&
)
WHERE (is_busy = true AND status = 'CONFIRMED');
