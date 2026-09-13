import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

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

export const CreateMembershipSchema = z.object({
  customerId: z.number().int().positive(),
  planId: z.string().min(1),
  startDate: isoDate,
  renewalDate: isoDate.optional(),
  creditsRemaining: z.number().int().nonnegative().optional(),
});
