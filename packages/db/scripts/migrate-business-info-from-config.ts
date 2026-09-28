// One-time data migration — real data for the actual demo business, same
// pattern as migrate-business-hours-from-config.ts. Business branding and
// contact info used to live in clients/gym-demo/config.json; this is the
// cutover that copies them into the `business_info` table (see
// src/schema.ts) so config.json can drop those keys for good.
//
// The row below is a frozen snapshot of what config.json held at the time
// of the cutover, not a live read of it — config.json no longer carries
// these fields after this migration runs, so reading it here would
// silently no-op on any run after the first.
//
// Idempotent via onConflictDoNothing on id — safe to run twice. Run
// manually, from packages/db:
//
//   DATABASE_URL=... npm run migrate:business-info
import { db, businessInfo } from "../src/index.js";

const BUSINESS_INFO: typeof businessInfo.$inferInsert = {
  id: "default",
  name: "Ironclad Fitness",
  legalName: "Ironclad Fitness LLC",
  description: "Neighborhood strength and conditioning gym in Denver, CO.",
  primaryColor: "#E63946",
  contactEmail: "hello@ironcladfitness.com",
  contactPhone: "+1-303-555-0142",
  contactWebsite: "https://ironcladfitness.com",
  address: {
    street: "1420 Larimer St",
    city: "Denver",
    state: "CO",
    zip: "80202",
    country: "US",
  },
};

async function main() {
  console.log("Migrating business info out of config.json...");

  await db.insert(businessInfo).values(BUSINESS_INFO).onConflictDoNothing({ target: businessInfo.id });

  console.log("Migrated business info row.");
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
