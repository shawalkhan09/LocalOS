import { z } from "zod";
import { BaseConfigSchema, BaseFeaturesSchema, WeekdaySchema } from "./base.js";

export const GymFeaturesSchema = BaseFeaturesSchema.extend({
  classSchedule: z.boolean().default(true),
  membershipTiers: z.boolean().default(true),
  trainerBooking: z.boolean().default(false),
  dropInBooking: z.boolean().default(false),
  waiverRequired: z.boolean().default(false),
});

// Membership plans no longer live in config.json (see packages/db's
// `membership_plans` table), but this shape is still the contract for it:
// apps/api reads plan rows through it when assembling GET /catalog's
// response, and it's what ClientConfigSchema (index.ts) extends the
// deploy-time config with to describe that response's full shape — same
// role ServiceSchema/GymClassSchema play for services/classes.
export const MembershipPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  billingInterval: z.enum(["monthly", "annual", "week", "day"]),
  description: z.string().optional(),
  perks: z.array(z.string()).optional(),
});

// Trainer profiles no longer live in config.json (see packages/db's
// `trainer_profiles` table) — same reasoning as StaffMemberSchema in
// base.ts, and the same role: the contract apps/api reads DB rows through
// and ClientConfigSchema extends the deploy-time config with.
export const TrainerSchema = z.object({
  id: z.string().min(1),
  staffId: z.string().min(1),
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  photoUrl: z.string().url().optional(),
});

export const ClassScheduleSlotSchema = z.object({
  day: WeekdaySchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM"),
});

export const GymClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  trainerId: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  capacity: z.number().int().positive(),
  schedule: z.array(ClassScheduleSlotSchema).min(1),
  category: z.string().optional(),
});

// classes[].trainerId still references a trainer (now a trainer_profiles
// row instead of a config array), but that reference can no longer be
// checked here: trainer_profiles lives in the database, and zod's parse
// has no DB access. apps/api validates it at the one place a class is
// actually read (GET /catalog, see routes/catalog.ts) instead — the same
// "runtime check, not a config-time one" move made for service.staffIds
// (see apps/api/src/bookingRules.ts's assertStaffQualified).

// Named separately from GymConfigSchema below so index.ts's .extend() call
// (to describe GET /catalog's full response shape with staff/trainers/etc.
// added) has a clear name to extend, even though the two are now the same
// object — see GymConfigSchema's comment for why.
export const GymConfigObjectSchema = BaseConfigSchema.extend({
  features: GymFeaturesSchema,
});

// No superRefine/assertUniqueIds left here: services, classes,
// businessHours, and now membershipPlans have all moved out of config.json
// into their own DB tables (see packages/db's schema), whose primary keys
// already enforce uniqueness at the DB level — same reasoning staff/
// trainers went through first. GymConfigSchema is just an alias of
// GymConfigObjectSchema now that there's nothing left to refine.
export const GymConfigSchema = GymConfigObjectSchema;

export type GymFeatures = z.infer<typeof GymFeaturesSchema>;
export type MembershipPlan = z.infer<typeof MembershipPlanSchema>;
export type Trainer = z.infer<typeof TrainerSchema>;
export type ClassScheduleSlot = z.infer<typeof ClassScheduleSlotSchema>;
export type GymClass = z.infer<typeof GymClassSchema>;
export type GymConfig = z.infer<typeof GymConfigSchema>;
