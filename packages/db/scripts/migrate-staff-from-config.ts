// One-time data migration — real data for the actual demo business (not
// the "DEMO DATA ONLY" pattern seed-demo-data.ts uses). Staff and trainer
// profiles used to live in clients/gym-demo/config.json; this is the
// cutover that copies them into the `staff`/`trainer_profiles` tables
// (see src/schema.ts) so config.json can drop those keys for good.
//
// The rows below are a frozen snapshot of what config.json held at the
// time of the cutover, not a live read of it — config.json no longer
// carries staff/trainers after this migration runs, so reading it here
// would silently no-op on any run after the first. Every id is preserved
// exactly as it was in config.json: nothing that already references a
// staffId/trainerId elsewhere (bookings, users) needs to change.
//
// Idempotent via onConflictDoNothing — safe to run twice. Run manually,
// from packages/db:
//
//   DATABASE_URL=... npm run migrate:staff
import { db, staff, trainerProfiles } from "../src/index.js";

const STAFF = [
  {
    id: "staff-jordan",
    name: "Jordan Ramirez",
    role: "Front Desk / Studio Manager",
    email: "jordan@ironcladfitness.com",
    phone: "+1-303-555-0143",
  },
  {
    id: "staff-priya",
    name: "Priya Nair",
    role: "Head Trainer",
    email: "priya@ironcladfitness.com",
  },
  {
    id: "staff-marcus",
    name: "Marcus Webb",
    role: "Conditioning Coach",
    email: "marcus@ironcladfitness.com",
  },
];

const TRAINER_PROFILES = [
  {
    id: "trainer-priya",
    staffId: "staff-priya",
    bio: "10 years coaching strength and mobility; NASM-CPT certified.",
    specialties: ["strength training", "mobility"],
    certifications: ["NASM-CPT", "USAW Level 1"],
  },
  {
    id: "trainer-marcus",
    staffId: "staff-marcus",
    bio: "Former collegiate athlete specializing in high-intensity conditioning.",
    specialties: ["HIIT", "conditioning"],
    certifications: ["ACE-CPT"],
  },
];

async function main() {
  console.log("Migrating staff and trainer profiles out of config.json...");

  for (const row of STAFF) {
    await db.insert(staff).values(row).onConflictDoNothing({ target: staff.id });
  }
  for (const row of TRAINER_PROFILES) {
    await db.insert(trainerProfiles).values(row).onConflictDoNothing({ target: trainerProfiles.id });
  }

  console.log(`Migrated ${STAFF.length} staff and ${TRAINER_PROFILES.length} trainer profiles.`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
