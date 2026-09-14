// DEMO DATA ONLY — never run this against a real client's database.
//
// It exists purely so a live demo of no-show risk scoring (see
// apps/api/src/bookingRules.ts) has real historical bookings to compute
// from, instead of every new booking hitting the first-time-customer
// fallback path. This is demo plumbing, not part of the product: it is
// not wired into bootstrap or any app startup path, and nothing in
// apps/api or apps/web imports it. Run manually, from packages/db:
//
//   DATABASE_URL=... npm run seed:demo
import { bookings, customers, db } from "../src/index.js";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Seeding demo no-show history (DEMO DATA ONLY)...");

  const [reliable] = await db
    .insert(customers)
    .values({ name: "Dana Reliable", email: "dana.reliable@demo.local", phone: "555-0101" })
    .returning();
  const [flaky] = await db
    .insert(customers)
    .values({ name: "Pat Flaky", email: "pat.flaky@demo.local", phone: "555-0102" })
    .returning();

  const historicalBookings: { customerId: number; day: number; status: "completed" | "no_show" }[] = [
    // Dana: 4 resolved bookings, all completed -> 0/4 = 0.0 historical
    // no-show rate (Low bucket on the dashboard).
    { customerId: reliable.id, day: 40, status: "completed" },
    { customerId: reliable.id, day: 33, status: "completed" },
    { customerId: reliable.id, day: 26, status: "completed" },
    { customerId: reliable.id, day: 19, status: "completed" },
    // Pat: 4 resolved bookings, 3 no-shows -> 3/4 = 0.75 historical
    // no-show rate — comfortably above the dashboard's 0.67 High
    // threshold, not sitting right on the boundary the way 2/3 ≈ 0.667
    // would (that rounds to Medium, not High).
    { customerId: flaky.id, day: 42, status: "no_show" },
    { customerId: flaky.id, day: 35, status: "no_show" },
    { customerId: flaky.id, day: 28, status: "completed" },
    { customerId: flaky.id, day: 14, status: "no_show" },
  ];

  // No staffId on any of these: sidesteps the staff-overlap EXCLUDE
  // constraint entirely (it only applies when staffId IS NOT NULL — see
  // src/schema.ts) rather than having to hand-stagger times to avoid it.
  for (const b of historicalBookings) {
    const startTime = daysAgo(b.day);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    await db.insert(bookings).values({
      customerId: b.customerId,
      serviceId: "svc-fitness-assessment",
      startTime,
      endTime,
      status: b.status,
    });
  }

  console.log(
    `Seeded ${historicalBookings.length} historical bookings for ${reliable.email} (reliable) and ${flaky.email} (flaky).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
