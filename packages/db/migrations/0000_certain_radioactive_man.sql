-- Hand-added: required by the EXCLUDE constraint at the bottom of this file.
-- drizzle-kit/drizzle-orm has no way to declare a Postgres extension or an
-- EXCLUDE constraint from schema.ts, so both are maintained by hand here —
-- see the comment on the `bookings` table in src/schema.ts.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."class_booking_status" AS ENUM('booked', 'attended', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"service_id" text NOT NULL,
	"staff_id" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed',
	"no_show_risk_score" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"class_id" text NOT NULL,
	"occurrence_date" date NOT NULL,
	"status" "class_booking_status" DEFAULT 'booked',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_bookings_customer_id_class_id_occurrence_date_unique" UNIQUE("customer_id","class_id","occurrence_date")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_or_phone_required" CHECK ("customers"."email" IS NOT NULL OR "customers"."phone" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"plan_id" text NOT NULL,
	"status" "membership_status" DEFAULT 'active',
	"start_date" date NOT NULL,
	"renewal_date" date,
	"credits_remaining" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_bookings" ADD CONSTRAINT "class_bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-added: prevents two overlapping bookings for the same staff member at
-- the DB level, regardless of what the API layer already checked (the real
-- guarantee under concurrent requests — see apps/api's pre-insert overlap
-- check, which is the friendly 409 but not itself race-safe). Uses
-- tstzrange, not tsrange, because start_time/end_time are timestamptz:
-- tsrange would force an implicit cast to timestamp using the session's
-- timezone, silently reintroducing the exact ambiguity timestamptz exists
-- to remove. Bookings with no staffId aren't scoped to a resource, so
-- they're exempt via the WHERE clause.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_overlap_exclude" EXCLUDE USING gist ("staff_id" WITH =, tstzrange("start_time", "end_time") WITH &&) WHERE ("staff_id" IS NOT NULL);