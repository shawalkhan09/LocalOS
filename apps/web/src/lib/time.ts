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
  // Noon UTC again, for the same reason as formatDateInTimezone: avoids any
  // possibility of the day-add landing on the wrong calendar day.
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateInTimezone(date: string, timezone: string): string {
  // Noon UTC, not local time: with any real UTC offset (-12..+14) this can
  // never format back to a different calendar day than `date` itself.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
