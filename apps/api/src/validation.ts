import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const DateQuerySchema = z.object({
  date: isoDate.optional(),
});

export const CreateCustomerSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
  })
  .refine((c) => c.email !== undefined || c.phone !== undefined, {
    message: "at least one of email or phone is required",
  });

export const CreateBookingSchema = z
  .object({
    customerId: z.number().int().positive(),
    serviceId: z.string().min(1),
    staffId: z.string().min(1).optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((b) => b.endTime > b.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const CreateClassBookingSchema = z.object({
  customerId: z.number().int().positive(),
  classId: z.string().min(1),
  occurrenceDate: isoDate,
});

// Public (unauthenticated) booking routes: email is required here even
// though the DB/CreateCustomerSchema allow phone-only — find-or-create
// dedup for the public flow keys off email specifically (see
// bookingRules.ts), so it can't be optional on this path.
const PublicCustomerFields = {
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(1).optional(),
};

export const PublicCreateBookingSchema = z
  .object({
    ...PublicCustomerFields,
    serviceId: z.string().min(1),
    staffId: z.string().min(1).optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((b) => b.endTime > b.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const PublicCreateClassBookingSchema = z.object({
  ...PublicCustomerFields,
  classId: z.string().min(1),
  occurrenceDate: isoDate,
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  staffId: z.string().min(1).optional(),
});

// .strict() so an unrecognized key (e.g. email or role — deliberately not
// supported this round, see routes/users.ts) fails validation instead of
// being silently dropped. staffId is nullable (explicit unlink) as well
// as optional (absent = leave unchanged) — see the route handler for how
// those two are told apart.
export const UpdateUserSchema = z
  .object({
    status: z.enum(["active", "deactivated"]).optional(),
    staffId: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((data) => data.status !== undefined || data.staffId !== undefined, {
    message: "at least one of status or staffId must be provided",
  });

export const CreateStaffSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  bio: z.string().min(1).optional(),
});

// .strict() so an unrecognized key fails validation instead of being
// silently dropped — same reasoning as UpdateUserSchema above. Unlike
// UpdateUserSchema, no field here is nullable: there's no "clear this
// value" case requested this round, only "change it" or "leave it alone".
export const UpdateStaffSchema = z
  .object({
    name: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    bio: z.string().min(1).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "at least one field must be provided" });

export const CreateTrainerProfileSchema = z.object({
  specialties: z.array(z.string().min(1)),
  certifications: z.array(z.string().min(1)),
  bio: z.string().min(1).optional(),
  photoUrl: z.string().url().optional(),
});

export const UpdateTrainerProfileSchema = z
  .object({
    specialties: z.array(z.string().min(1)).optional(),
    certifications: z.array(z.string().min(1)).optional(),
    bio: z.string().min(1).optional(),
    photoUrl: z.string().url().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "at least one field must be provided" });

export const CreateMembershipSchema = z.object({
  customerId: z.number().int().positive(),
  planId: z.string().min(1),
  startDate: isoDate,
  renewalDate: isoDate.optional(),
  creditsRemaining: z.number().int().nonnegative().optional(),
});
