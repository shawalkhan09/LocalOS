ALTER TABLE "bookings" DROP CONSTRAINT "bookings_staff_overlap_exclude";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_overlap_exclude" EXCLUDE USING gist (staff_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE (staff_id IS NOT NULL AND (status IS NULL OR status <> 'cancelled'));
