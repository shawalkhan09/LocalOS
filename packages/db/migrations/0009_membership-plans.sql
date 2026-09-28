CREATE TABLE "membership_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" numeric NOT NULL,
	"billing_interval" text NOT NULL,
	"description" text,
	"perks" jsonb
);
