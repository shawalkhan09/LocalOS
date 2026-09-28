// One-time data migration — real data for the actual demo business (not
// the "DEMO DATA ONLY" pattern seed-demo-data.ts uses). Services used to
// live in clients/gym-demo/config.json; this is the cutover that copies
// them into the `services` table (see src/schema.ts) so config.json can
// drop the key for good.
//
// The rows below are a frozen snapshot of what config.json held at the
// time of the cutover, not a live read of it — config.json no longer
// carries services after this migration runs, so reading it here would
// silently no-op on any run after the first. Every id is preserved
// exactly as it was in config.json: nothing that already references a
// serviceId elsewhere (bookings) needs to change.
//
// Idempotent via onConflictDoNothing — safe to run twice. Run manually,
// from packages/db, before the FK-adding half of migrations/0005 is
// applied (bookings.service_id already has rows referencing these ids):
//
//   DATABASE_URL=... npm run migrate:services
import { db, services } from "../src/index.js";

const SERVICES = [
  {
    id: "svc-personal-training",
    name: "1-on-1 Personal Training",
    description: "60-minute personal training session with a certified trainer.",
    durationMinutes: 60,
    price: "85",
    category: "training",
    staffIds: ["staff-priya", "staff-marcus"],
  },
  {
    id: "svc-drop-in-class",
    name: "Drop-In Class",
    description: "Single-visit access to any scheduled group class.",
    durationMinutes: 45,
    price: "25",
    category: "class",
  },
  {
    id: "svc-fitness-assessment",
    name: "Fitness Assessment",
    description: "Baseline strength, mobility, and conditioning assessment.",
    durationMinutes: 30,
    price: "40",
    category: "assessment",
  },
  {
    id: "svc-nutrition-consult",
    name: "Nutrition Consult",
    description: "One-on-one nutrition planning session.",
    durationMinutes: 45,
    price: "60",
    category: "coaching",
  },
];

async function main() {
  console.log("Migrating services out of config.json...");

  for (const row of SERVICES) {
    await db.insert(services).values(row).onConflictDoNothing({ target: services.id });
  }

  console.log(`Migrated ${SERVICES.length} services.`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
