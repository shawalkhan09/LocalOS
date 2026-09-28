// One-time data migration — real data for the actual demo business (not
// the "DEMO DATA ONLY" pattern seed-demo-data.ts uses). Classes used to
// live in clients/gym-demo/config.json; this is the cutover that copies
// them into the `classes` table (see src/schema.ts) so config.json can
// drop the key for good.
//
// The rows below are a frozen snapshot of what config.json held at the
// time of the cutover, not a live read of it — config.json no longer
// carries classes after this migration runs, so reading it here would
// silently no-op on any run after the first. Every id is preserved
// exactly as it was in config.json: nothing that already references a
// classId elsewhere (class_bookings) needs to change.
//
// Idempotent via onConflictDoNothing — safe to run twice. Run manually,
// from packages/db, before the FK-adding half of the classes migration is
// applied (class_bookings.class_id already has rows referencing these ids):
//
//   DATABASE_URL=... npm run migrate:classes
import { db, classes } from "../src/index.js";

const CLASSES: (typeof classes.$inferInsert)[] = [
  {
    id: "class-strength-101",
    name: "Strength Fundamentals",
    trainerId: "trainer-priya",
    durationMinutes: 45,
    capacity: 12,
    category: "strength",
    schedule: [
      { day: "monday", startTime: "06:00" },
      { day: "wednesday", startTime: "06:00" },
      { day: "friday", startTime: "06:00" },
    ],
  },
  {
    id: "class-hiit-blast",
    name: "HIIT Blast",
    trainerId: "trainer-marcus",
    durationMinutes: 30,
    capacity: 16,
    category: "conditioning",
    schedule: [
      { day: "tuesday", startTime: "17:30" },
      { day: "thursday", startTime: "17:30" },
    ],
  },
  {
    id: "class-mobility-flow",
    name: "Mobility Flow",
    trainerId: "trainer-priya",
    durationMinutes: 45,
    capacity: 10,
    category: "recovery",
    schedule: [{ day: "saturday", startTime: "09:00" }],
  },
];

async function main() {
  console.log("Migrating classes out of config.json...");

  for (const row of CLASSES) {
    await db.insert(classes).values(row).onConflictDoNothing({ target: classes.id });
  }

  console.log(`Migrated ${CLASSES.length} classes.`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
