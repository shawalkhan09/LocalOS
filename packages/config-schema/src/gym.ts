import { z } from "zod";
import { BaseConfigSchema, BaseFeaturesSchema } from "./base.js";

export const GymFeaturesSchema = BaseFeaturesSchema.extend({
  classSchedule: z.boolean().default(true),
  membershipTiers: z.boolean().default(true),
  trainerBooking: z.boolean().default(false),
  dropInBooking: z.boolean().default(false),
  waiverRequired: z.boolean().default(false),
});

export const MembershipPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  billingInterval: z.enum(["monthly", "annual", "week", "day"]),
  description: z.string().optional(),
  perks: z.array(z.string()).optional(),
});

export const TrainerSchema = z.object({
  id: z.string().min(1),
  staffId: z.string().min(1),
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  photoUrl: z.string().url().optional(),
});

const WeekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

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

function assertUniqueIds(
  items: { id: string }[],
  arrayName: string,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [arrayName, index, "id"],
        message: `duplicate id "${item.id}" in ${arrayName}`,
      });
    }
    seen.add(item.id);
  });
}

function assertClassesReferenceTrainers(
  config: { classes: GymClass[]; trainers: Trainer[] },
  ctx: z.RefinementCtx,
): void {
  const trainerIds = new Set(config.trainers.map((trainer) => trainer.id));
  config.classes.forEach((gymClass, index) => {
    if (!trainerIds.has(gymClass.trainerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["classes", index, "trainerId"],
        message: `trainerId "${gymClass.trainerId}" does not match any trainer id`,
      });
    }
  });
}

function assertTrainersReferenceStaff(
  config: { trainers: Trainer[]; staff: { id: string }[] },
  ctx: z.RefinementCtx,
): void {
  const staffIds = new Set(config.staff.map((member) => member.id));
  config.trainers.forEach((trainer, index) => {
    if (!staffIds.has(trainer.staffId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trainers", index, "staffId"],
        message: `staffId "${trainer.staffId}" does not match any staff id`,
      });
    }
  });
}

export const GymConfigSchema = BaseConfigSchema.extend({
  features: GymFeaturesSchema,
  membershipPlans: z.array(MembershipPlanSchema),
  classes: z.array(GymClassSchema),
  trainers: z.array(TrainerSchema),
}).superRefine((config, ctx) => {
  assertUniqueIds(config.services, "services", ctx);
  assertUniqueIds(config.staff, "staff", ctx);
  assertUniqueIds(config.trainers, "trainers", ctx);
  assertUniqueIds(config.classes, "classes", ctx);
  assertUniqueIds(config.membershipPlans, "membershipPlans", ctx);

  assertClassesReferenceTrainers(config, ctx);
  assertTrainersReferenceStaff(config, ctx);
});

export type GymFeatures = z.infer<typeof GymFeaturesSchema>;
export type MembershipPlan = z.infer<typeof MembershipPlanSchema>;
export type Trainer = z.infer<typeof TrainerSchema>;
export type ClassScheduleSlot = z.infer<typeof ClassScheduleSlotSchema>;
export type GymClass = z.infer<typeof GymClassSchema>;
export type GymConfig = z.infer<typeof GymConfigSchema>;
