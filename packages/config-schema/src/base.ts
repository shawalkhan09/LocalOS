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
});

export const StaffMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
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
  features: BaseFeaturesSchema,
});

export type Weekday = z.infer<typeof WeekdaySchema>;
export type Address = z.infer<typeof AddressSchema>;
export type Business = z.infer<typeof BusinessSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type StaffMember = z.infer<typeof StaffMemberSchema>;
export type BookingSettings = z.infer<typeof BookingSettingsSchema>;
export type BaseFeatures = z.infer<typeof BaseFeaturesSchema>;
export type BaseConfig = z.infer<typeof BaseConfigSchema>;
