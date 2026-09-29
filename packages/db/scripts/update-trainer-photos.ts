// One-off data update — not a config.json cutover like the migrate-*
// scripts (photoUrl never lived in config.json), just the simplest way to
// set a column on existing rows without building dashboard UI for it (see
// chunk 17's scope boundary: no upload UI, no new storage integration).
//
// trainer_profiles.id values below are real ids read from the live
// database (trainer-priya/trainer-marcus predate this chunk, from
// migrate-staff-from-config.ts; trainer-dana-torres was added later
// through the dashboard's Staff page, so it has no frozen snapshot
// anywhere else in this repo) — not guessed or reconstructed.
//
// photoUrl must be a full absolute URL (ClientConfigSchema's
// TrainerSchema.photoUrl is z.string().url(), same on the API's
// UpdateTrainerProfileSchema) — these point at the production Vercel
// origin, confirmed live at the time of writing via the Vercel API
// (localos-gym-demo.vercel.app). They only resolve once this chunk's PR
// is merged and deployed — see the PR/commit for the required order.
//
// A plain UPDATE ... WHERE id = ... is naturally idempotent (setting the
// same value twice is a no-op the second time), so this needs no
// onConflictDoNothing the way the insert-based migrate-* scripts do. Run
// manually, from packages/db:
//
//   DATABASE_URL=... npx tsx scripts/update-trainer-photos.ts
import { eq } from "drizzle-orm";
import { db, trainerProfiles } from "../src/index.js";

const PHOTO_URLS: Record<string, string> = {
  "trainer-priya": "https://localos-gym-demo.vercel.app/trainers/priya.jpg",
  "trainer-marcus": "https://localos-gym-demo.vercel.app/trainers/marcus.jpg",
  "trainer-dana-torres": "https://localos-gym-demo.vercel.app/trainers/dana.jpg",
};

async function main() {
  console.log("Updating trainer profile photos...");

  for (const [id, photoUrl] of Object.entries(PHOTO_URLS)) {
    const [updated] = await db
      .update(trainerProfiles)
      .set({ photoUrl })
      .where(eq(trainerProfiles.id, id))
      .returning({ id: trainerProfiles.id });
    if (!updated) {
      console.warn(`No trainer_profiles row for id "${id}" — skipped.`);
    }
  }

  console.log(`Updated ${Object.keys(PHOTO_URLS).length} trainer photo(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
