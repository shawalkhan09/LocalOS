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

export const BusinessSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  timezone: z.string().min(1),
  currency: z.string().length(3),
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
  business: BusinessSchema,
  contact: ContactSchema,
  services: z.array(ServiceSchema).min(1),
  staff: z.array(StaffMemberSchema),
  booking: BookingSettingsSchema,
  businessHours: z.array(BusinessHoursSlotSchema),
  features: BaseFeaturesSchema,
});

// Vertical-agnostic: every business type needs its hours checked, not just
// gyms. BaseConfigSchema itself stays a plain ZodObject (so verticals can
// still .extend() it), so this is called from each vertical's own
// superRefine rather than attached here directly.
export function assertBusinessHoursValid(
  config: { businessHours: BusinessHoursSlot[] },
  ctx: z.RefinementCtx,
): void {
  config.businessHours.forEach((slot, index) => {
    if (slot.closeTime <= slot.openTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businessHours", index, "closeTime"],
        message: `closeTime "${slot.closeTime}" must be after openTime "${slot.openTime}"`,
      });
    }
  });
}

// Vertical-agnostic, same pattern as assertBusinessHoursValid above: every
// id in a service's staffIds must actually exist in the staff array.
export function assertServiceStaffIdsValid(
  config: { services: Service[]; staff: { id: string }[] },
  ctx: z.RefinementCtx,
): void {
  const staffIds = new Set(config.staff.map((member) => member.id));
  config.services.forEach((service, serviceIndex) => {
    service.staffIds?.forEach((staffId, staffIdIndex) => {
      if (!staffIds.has(staffId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["services", serviceIndex, "staffIds", staffIdIndex],
          message: `staffId "${staffId}" does not match any staff id`,
        });
      }
    });
  });
}

export type Weekday = z.infer<typeof WeekdaySchema>;
export type BusinessHoursSlot = z.infer<typeof BusinessHoursSlotSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type Business = z.infer<typeof BusinessSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type StaffMember = z.infer<typeof StaffMemberSchema>;
export type BookingSettings = z.infer<typeof BookingSettingsSchema>;
export type BaseFeatures = z.infer<typeof BaseFeaturesSchema>;
export type BaseConfig = z.infer<typeof BaseConfigSchema>;
