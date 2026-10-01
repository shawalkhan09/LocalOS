import type { ClientConfig } from "@localos/config-schema";
import {
  addDaysToDateString,
  localWeekday,
  nowTimeInTimezone,
  todayInTimezone,
} from "@/lib/time";

type Slot = { day: string; startTime: string };

export function formatHHMM(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(d);
}

const abbr = (day: string) => day.slice(0, 1).toUpperCase() + day.slice(1, 3);

export function isOpenNow(cfg: ClientConfig): boolean {
  const tz = cfg.business.timezone;
  const day = localWeekday(todayInTimezone(tz), tz);
  const now = nowTimeInTimezone(tz);
  return cfg.businessHours.some((h) => h.day === day && h.openTime <= now && now < h.closeTime);
}

// Next slot across all classes, scanning today (future times only) through the next 7 days.
export function nextClass(cfg: ClientConfig): { name: string; when: string } | null {
  const tz = cfg.business.timezone;
  const today = todayInTimezone(tz);
  const now = nowTimeInTimezone(tz);
  for (let i = 0; i <= 7; i++) {
    const date = addDaysToDateString(today, i);
    const day = localWeekday(date, tz);
    const times: { name: string; t: string }[] = [];
    for (const c of cfg.classes)
      for (const s of c.schedule)
        if (s.day === day && (i > 0 || s.startTime > now)) times.push({ name: c.name, t: s.startTime });
    if (times.length) {
      times.sort((a, b) => a.t.localeCompare(b.t));
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : abbr(day);
      return { name: times[0].name, when: `${label}, ${formatHHMM(times[0].t)}` };
    }
  }
  return null;
}

// Up to 4 distinct days, ordered starting from today in the business timezone.
export function classDays(schedule: Slot[], tz: string): string {
  const today = todayInTimezone(tz);
  const days = new Set(schedule.map((s) => s.day));
  const out: string[] = [];
  for (let i = 0; i < 7 && out.length < 4; i++) {
    const d = localWeekday(addDaysToDateString(today, i), tz);
    if (days.has(d)) out.push(abbr(d));
  }
  return out.join(", ");
}

export const PLAN_SUFFIX = { monthly: "/ month", annual: "/ year", week: "/ week", day: "/ day" } as const;

// Middle plan is highlighted only for an odd count of 3+.
export const popularPlanIndex = (n: number) => (n >= 3 && n % 2 === 1 ? (n - 1) / 2 : -1);

export function planPriceFormatter(currency: string) {
  return (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
}
