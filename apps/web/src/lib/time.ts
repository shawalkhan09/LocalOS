// Native Intl formatting, not a date library: the only two things this app
// needs are "today's date in the business's timezone" and "format an
// instant as a local time," and Intl.DateTimeFormat covers both directly.

export function todayInTimezone(timezone: string): string {
  // en-CA formats as YYYY-MM-DD, which is exactly what the API expects.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export function formatTimeInTimezone(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

// Convert a YYYY-MM-DD date string to a Date object that lands on that exact
// calendar date when formatted in `timezone`, regardless of offset (-12..+14).
export function parseDateInTimezone(dateStr: string, timezone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  let date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
  const formatted = fmt.format(date);
  if (formatted > dateStr) {
    date = new Date(date.getTime() - 24 * 3600 * 1000);
  } else if (formatted < dateStr) {
    date = new Date(date.getTime() + 24 * 3600 * 1000);
  }
  return date;
}

// Lowercase weekday name matching @localos/config-schema's Weekday union
// ("monday".."sunday"), as observed in the business's own timezone.
export function localWeekday(date: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" })
    .format(parseDateInTimezone(date, timezone))
    .toLowerCase();
}

export function formatDateInTimezone(date: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(parseDateInTimezone(date, timezone));
}

export function dateStringInTimezone(iso: string, timezone: string): string {
  // Convert an ISO timestamp to a YYYY-MM-DD date string in the given timezone.
  // Uses en-CA locale which formats as YYYY-MM-DD by default.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
  }).format(new Date(iso));
}

export function nowTimeInTimezone(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

// Find the next date (in YYYY-MM-DD format) on which a class runs, or null if
// no occurrence exists within the window. On startDate (today), a slot counts
// only if its startTime is later than currentTime (HH:MM). On later days,
// any matching weekday counts. Stays within [startDate, maxDate] inclusive.
export function getNextClassOccurrenceDate(
  classSchedule: Array<{ day: string; startTime: string }>,
  startDate: string,
  maxDate: string,
  timezone: string,
  currentTime: string,
): string | null {
  let currentDate = startDate;
  while (currentDate <= maxDate) {
    const dayOfWeek = localWeekday(currentDate, timezone);
    for (const slot of classSchedule) {
      if (slot.day.toLowerCase() === dayOfWeek) {
        // On the first day (today), check if start time is in the future
        if (currentDate === startDate && slot.startTime <= currentTime) {
          continue;
        }
        return currentDate;
      }
    }
    currentDate = addDaysToDateString(currentDate, 1);
  }

  return null;
}
