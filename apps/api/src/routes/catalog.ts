import type { ClientConfig } from "@localos/config-schema";
import { businessHours, businessInfo, classes, db, membershipPlans, services, staff, trainerProfiles } from "@localos/db";
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

const SERVICE_COLUMNS = {
  id: services.id,
  name: services.name,
  description: services.description,
  durationMinutes: services.durationMinutes,
  price: services.price,
  category: services.category,
  staffIds: services.staffIds,
};

const CLASS_COLUMNS = {
  id: classes.id,
  name: classes.name,
  trainerId: classes.trainerId,
  durationMinutes: classes.durationMinutes,
  capacity: classes.capacity,
  category: classes.category,
  schedule: classes.schedule,
};

const BUSINESS_HOURS_COLUMNS = {
  day: businessHours.day,
  openTime: businessHours.openTime,
  closeTime: businessHours.closeTime,
};

// No .where() needed — business_info is a singleton, always exactly one
// row (id "default") once the cutover script has run. See packages/db's
// schema comment on `businessInfo`.
const BUSINESS_INFO_COLUMNS = {
  name: businessInfo.name,
  legalName: businessInfo.legalName,
  description: businessInfo.description,
  primaryColor: businessInfo.primaryColor,
  logoUrl: businessInfo.logoUrl,
  contactEmail: businessInfo.contactEmail,
  contactPhone: businessInfo.contactPhone,
  contactWebsite: businessInfo.contactWebsite,
  address: businessInfo.address,
};

const MEMBERSHIP_PLAN_COLUMNS = {
  id: membershipPlans.id,
  name: membershipPlans.name,
  price: membershipPlans.price,
  billingInterval: membershipPlans.billingInterval,
  description: membershipPlans.description,
  perks: membershipPlans.perks,
};

function stripNulls<T extends Record<string, unknown>>(row: T): { [K in keyof T]: Exclude<T[K], null> } {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as {
    [K in keyof T]: Exclude<T[K], null>;
  };
}

catalogRouter.get("/catalog", async (_req, res) => {
  const [staffRows, trainerRows, serviceRows, classRows, businessHoursRows, businessInfoRows, membershipPlanRows] =
    await Promise.all([
      db.select(STAFF_COLUMNS).from(staff),
      db.select(TRAINER_COLUMNS).from(trainerProfiles),
      db.select(SERVICE_COLUMNS).from(services),
      db.select(CLASS_COLUMNS).from(classes),
      db.select(BUSINESS_HOURS_COLUMNS).from(businessHours),
      db.select(BUSINESS_INFO_COLUMNS).from(businessInfo),
      db.select(MEMBERSHIP_PLAN_COLUMNS).from(membershipPlans),
    ]);

  const businessInfoRow = businessInfoRows[0];
  if (!businessInfoRow) {
    throw new ApiError(500, "business_info has no row — has the migrate:business-info cutover run?");
  }

  // classes moved out of config.json into the database this round too, but
  // trainerId still just points at a trainer_profiles row id — this is the
  // one place classes are actually read for output, so it's the one place
  // a stale trainerId (a trainer profile deleted out from under a class)
  // gets caught, the same way a malformed config.json is caught at boot
  // (see config.ts) rather than served.
  const trainerIds = new Set(trainerRows.map((t) => t.id));
  for (const gymClass of classRows) {
    if (!trainerIds.has(gymClass.trainerId)) {
      throw new ApiError(400, `unknown trainerId "${gymClass.trainerId}" for class "${gymClass.id}"`);
    }
  }

  const catalog: ClientConfig = {
    ...clientConfig,
    // business/contact: merge config.json's deploy-time timezone/currency
    // with the business_info DB row's branding/contact fields — same flat
    // shape GET /catalog already returned before those fields moved to the
    // database, so apps/web needs zero changes.
    business: {
      ...clientConfig.business,
      name: businessInfoRow.name,
      legalName: businessInfoRow.legalName ?? undefined,
      description: businessInfoRow.description ?? undefined,
      primaryColor: businessInfoRow.primaryColor,
      logoUrl: businessInfoRow.logoUrl ?? undefined,
    },
    contact: {
      email: businessInfoRow.contactEmail,
      phone: businessInfoRow.contactPhone,
      website: businessInfoRow.contactWebsite ?? undefined,
      address: businessInfoRow.address,
    },
    staff: staffRows.map(stripNulls),
    trainers: trainerRows.map(stripNulls),
    // price comes back from postgres `numeric` as a string — cast to
    // match ServiceSchema (and the old config.json shape, which held a
    // plain JSON number).
    services: serviceRows.map((row) => stripNulls({ ...row, price: Number(row.price) })),
    // schedule is jsonb and round-trips natively — no cast needed like price.
    classes: classRows.map(stripNulls),
    businessHours: businessHoursRows,
    // price comes back from postgres `numeric` as a string — same cast as
    // services above, back to match the old config.json shape's plain
    // JSON number.
    membershipPlans: membershipPlanRows.map((row) => stripNulls({ ...row, price: Number(row.price) })),
  };
  res.json(catalog);
});
