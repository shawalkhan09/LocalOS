import type { ClientConfig } from "@localos/config-schema";
import { db, staff, trainerProfiles } from "@localos/db";
import { Router } from "express";
import { clientConfig } from "../config.js";
import { ApiError } from "../errors.js";

export const catalogRouter = Router();

// Explicit column order/selection, matching exactly what these objects
// looked like in config.json before this round: DB columns that are unset
// come back as `null` (see stripNulls below), whereas the old config.json
// shape simply omitted an absent optional field entirely. Selecting (and
// ordering) columns here — rather than a bare select() — is what keeps
// GET /catalog's response byte-for-byte identical to before, which
// apps/web depends on without any changes of its own.
const STAFF_COLUMNS = {
  id: staff.id,
  name: staff.name,
  role: staff.role,
  email: staff.email,
  phone: staff.phone,
  bio: staff.bio,
};

const TRAINER_COLUMNS = {
  id: trainerProfiles.id,
  staffId: trainerProfiles.staffId,
  bio: trainerProfiles.bio,
  specialties: trainerProfiles.specialties,
  certifications: trainerProfiles.certifications,
  photoUrl: trainerProfiles.photoUrl,
};

function stripNulls<T extends Record<string, unknown>>(row: T): { [K in keyof T]: Exclude<T[K], null> } {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as {
    [K in keyof T]: Exclude<T[K], null>;
  };
}

catalogRouter.get("/catalog", async (_req, res) => {
  const [staffRows, trainerRows] = await Promise.all([
    db.select(STAFF_COLUMNS).from(staff),
    db.select(TRAINER_COLUMNS).from(trainerProfiles),
  ]);

  // classes are still config-driven (see @localos/config-schema), but
  // trainerId now points at a trainer_profiles row instead of a config
  // array — this is the one place classes are actually read for output,
  // so it's the one place a stale trainerId (config.json and the database
  // drifting out of sync) gets caught, the same way a malformed
  // config.json is caught at boot (see config.ts) rather than served.
  const trainerIds = new Set(trainerRows.map((t) => t.id));
  for (const gymClass of clientConfig.classes) {
    if (!trainerIds.has(gymClass.trainerId)) {
      throw new ApiError(400, `unknown trainerId "${gymClass.trainerId}" for class "${gymClass.id}"`);
    }
  }

  const catalog: ClientConfig = {
    ...clientConfig,
    staff: staffRows.map(stripNulls),
    trainers: trainerRows.map(stripNulls),
  };
  res.json(catalog);
});
