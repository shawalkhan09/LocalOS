CREATE TABLE "business_info" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"description" text,
	"primary_color" text NOT NULL,
	"logo_url" text,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_website" text,
	"address" jsonb NOT NULL
);
