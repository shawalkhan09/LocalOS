import { z } from "zod";

export const WeekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.string().min(1),
});

// Deploy-time only: timezone/currency are infrastructure settings read
// synchronously across every date/availability calculation, unlike the
// rest of BusinessSchema below (branding/contact), which moved into the
// database this round (see packages/db's `business_info` table) — those
// fields change on their own schedule (an owner editing their profile),
// not at deploy time.
export const BusinessSettingsSchema = z.object({
  timezone: z.string().min(1),
  currency: z.string().length(3),
});

// The full shape, not what's parsed from config.json anymore — this is the
// contract for GET /catalog's response (ClientConfigSchema in index.ts
// merges BusinessSettingsSchema's two deploy-time fields with a
// business_info DB row at the API layer), same role StaffMemberSchema
// plays for staff.
export const BusinessSchema = BusinessSettingsSchema.extend({
  name: z.string().min(1),
  legalName: z.string().optional(),
  description: z.string().optional(),
  // Base-level, not gym-specific: every vertical's public booking page
  // needs branding. logoUrl is optional — the public UI must render fine
  // without one.
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected a 6-digit hex color, e.g. #1A2B3C"),
  logoUrl: z.string().url().optional(),
});

export const ContactSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(1),
  website: z.string().url().optional(),
  address: AddressSchema,
});

export const ServiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  price: z.number().nonnegative(),
  category: z.string().optional(),
  // Absent/undefined: any staff member can perform this service. Present:
  // only these staff ids are qualified.
  staffIds: z.array(z.string().min(1)).optional(),
});

// Staff no longer lives in config.json (see packages/db's `staff` table),
// but this shape is still the contract for it: apps/api reads staff rows
// through it when assembling GET /catalog's response, and it's what
// ClientConfigSchema (index.ts) extends the deploy-time config with to
// describe that response's full shape.
export const StaffMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

// A day with no entry here means closed that day — no separate isClosed flag.
export const BusinessHoursSlotSchema = z.object({
  day: WeekdaySchema,
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM"),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM"),
});

export const BookingSettingsSchema = z.object({
  advanceBookingDays: z.number().int().nonnegative(),
  cancellationWindowHours: z.number().int().nonnegative(),
  slotIntervalMinutes: z.number().int().positive(),
  requireDeposit: z.boolean().default(false),
  depositAmount: z.number().nonnegative().optional(),
});

export const BaseFeaturesSchema = z.object({
  onlineBooking: z.boolean().default(true),
  smsReminders: z.boolean().default(false),
  emailReminders: z.boolean().default(true),
  waitlist: z.boolean().default(false),
});

export const BaseConfigSchema = z.object({
  business: BusinessSettingsSchema,
  booking: BookingSettingsSchema,
  features: BaseFeaturesSchema,
});

export type Weekday = z.infer<typeof WeekdaySchema>;
export type BusinessHoursSlot = z.infer<typeof BusinessHoursSlotSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type BusinessSettings = z.infer<typeof BusinessSettingsSchema>;
export type Business = z.infer<typeof BusinessSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type StaffMember = z.infer<typeof StaffMemberSchema>;
export type BookingSettings = z.infer<typeof BookingSettingsSchema>;
export type BaseFeatures = z.infer<typeof BaseFeaturesSchema>;
export type BaseConfig = z.infer<typeof BaseConfigSchema>;
