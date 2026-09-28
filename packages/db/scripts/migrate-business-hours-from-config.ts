// One-time data migration — real data for the actual demo business (not
// the "DEMO DATA ONLY" pattern seed-demo-data.ts uses). Business hours
// used to live in clients/gym-demo/config.json; this is the cutover that
// copies them into the `business_hours` table (see src/schema.ts) so
// config.json can drop the key for good.
//
// The rows below are a frozen snapshot of what config.json held at the
// time of the cutover, not a live read of it — config.json no longer
// carries business hours after this migration runs, so reading it here
// would silently no-op on any run after the first. A day with no row is
// closed, same contract as before (config.json never had a Sunday entry).
//
// Idempotent via onConflictDoNothing — safe to run twice. Run manually,
// from packages/db:
//
//   DATABASE_URL=... npm run migrate:business-hours
import { db, businessHours } from "../src/index.js";

const BUSINESS_HOURS: (typeof businessHours.$inferInsert)[] = [
  { day: "monday", openTime: "05:00", closeTime: "21:00" },
  { day: "tuesday", openTime: "05:00", closeTime: "21:00" },
  { day: "wednesday", openTime: "05:00", closeTime: "21:00" },
  { day: "thursday", openTime: "05:00", closeTime: "21:00" },
  { day: "friday", openTime: "05:00", closeTime: "20:00" },
  { day: "saturday", openTime: "07:00", closeTime: "16:00" },
];

async function main() {
  console.log("Migrating business hours out of config.json...");

  for (const row of BUSINESS_HOURS) {
    await db.insert(businessHours).values(row).onConflictDoNothing({ target: businessHours.day });
  }

  console.log(`Migrated ${BUSINESS_HOURS.length} business hours rows.`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
