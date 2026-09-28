// One-time data migration — real data for the actual demo business, same
// pattern as migrate-services-from-config.ts/migrate-classes-from-config.ts.
// Membership plans used to live in clients/gym-demo/config.json; this is
// the cutover that copies them into the `membership_plans` table (see
// src/schema.ts) so config.json can drop the key for good.
//
// The rows below are a frozen snapshot of what config.json held at the
// time of the cutover, not a live read of it — config.json no longer
// carries membership plans after this migration runs, so reading it here
// would silently no-op on any run after the first.
//
// Idempotent via onConflictDoNothing on id — safe to run twice. Run
// manually, from packages/db:
//
//   DATABASE_URL=... npm run migrate:membership-plans
import { db, membershipPlans } from "../src/index.js";

const MEMBERSHIP_PLANS: (typeof membershipPlans.$inferInsert)[] = [
  {
    id: "plan-monthly-unlimited",
    name: "Unlimited Monthly",
    price: "129",
    billingInterval: "monthly",
    description: "Unlimited classes and open gym access, billed monthly.",
    perks: ["Unlimited classes", "Open gym access", "Guest pass 1x/month"],
  },
  {
    id: "plan-annual-unlimited",
    name: "Unlimited Annual",
    price: "1290",
    billingInterval: "annual",
    description: "Unlimited classes and open gym access, billed annually (2 months free).",
    perks: ["Unlimited classes", "Open gym access", "2 free personal training sessions"],
  },
];

async function main() {
  console.log("Migrating membership plans out of config.json...");

  for (const row of MEMBERSHIP_PLANS) {
    await db.insert(membershipPlans).values(row).onConflictDoNothing({ target: membershipPlans.id });
  }

  console.log(`Migrated ${MEMBERSHIP_PLANS.length} membership plan rows.`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
