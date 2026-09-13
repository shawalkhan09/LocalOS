CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'annual', 'week', 'day');--> statement-breakpoint
CREATE TYPE "public"."weekday" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TABLE "class_schedule_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"class_id" text NOT NULL,
	"day" "weekday" NOT NULL,
	"start_time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"legal_name" text,
	"timezone" text NOT NULL,
	"currency" text NOT NULL,
	"description" text,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_website" text,
	"address_street" text NOT NULL,
	"address_city" text NOT NULL,
	"address_state" text NOT NULL,
	"address_zip" text NOT NULL,
	"address_country" text NOT NULL,
	"advance_booking_days" integer NOT NULL,
	"cancellation_window_hours" integer NOT NULL,
	"slot_interval_minutes" integer NOT NULL,
	"require_deposit" boolean DEFAULT false NOT NULL,
	"deposit_amount" numeric,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_classes" (
	"client_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"trainer_id" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"capacity" integer NOT NULL,
	"category" text,
	CONSTRAINT "gym_classes_client_id_id_pk" PRIMARY KEY("client_id","id")
);
--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"client_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric NOT NULL,
	"billing_interval" "billing_interval" NOT NULL,
	"description" text,
	"perks" text[],
	CONSTRAINT "membership_plans_client_id_id_pk" PRIMARY KEY("client_id","id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"client_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"price" numeric NOT NULL,
	"category" text,
	CONSTRAINT "services_client_id_id_pk" PRIMARY KEY("client_id","id")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"client_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"phone" text,
	"bio" text,
	CONSTRAINT "staff_client_id_id_pk" PRIMARY KEY("client_id","id")
);
--> statement-breakpoint
CREATE TABLE "trainers" (
	"client_id" text NOT NULL,
	"id" text NOT NULL,
	"staff_id" text NOT NULL,
	"bio" text,
	"specialties" text[],
	"certifications" text[],
	"photo_url" text,
	CONSTRAINT "trainers_client_id_id_pk" PRIMARY KEY("client_id","id")
);
--> statement-breakpoint
ALTER TABLE "class_schedule_slots" ADD CONSTRAINT "class_schedule_slots_client_id_class_id_gym_classes_client_id_id_fk" FOREIGN KEY ("client_id","class_id") REFERENCES "public"."gym_classes"("client_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_classes" ADD CONSTRAINT "gym_classes_client_id_trainer_id_trainers_client_id_id_fk" FOREIGN KEY ("client_id","trainer_id") REFERENCES "public"."trainers"("client_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_client_id_staff_id_staff_client_id_id_fk" FOREIGN KEY ("client_id","staff_id") REFERENCES "public"."staff"("client_id","id") ON DELETE no action ON UPDATE no action;