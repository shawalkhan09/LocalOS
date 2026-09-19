import { DateTime } from "luxon";
import { assertBookableClassOccurrence } from "./bookingWindow.js";
import { clientConfig } from "./config.js";

const sampleClass = clientConfig.classes[0]!;
const fixedClassNow = DateTime.fromISO("2026-09-21T10:00:00", { zone: clientConfig.business.timezone }); // Monday

console.log("=== Debug ===");
console.log("Fixed now:", fixedClassNow.toISO());
console.log("Fixed now weekday:", fixedClassNow.toFormat("cccc"));
console.log("Sample class:", sampleClass.name);
console.log("Sample class schedule:", sampleClass.schedule.map((s) => s.day));

// Find a past occurrence of a weekday the class runs on
const classWeekday = sampleClass.schedule[0]!.day;
console.log("\nLooking for past occurrence of:", classWeekday);

let pastDay = fixedClassNow.minus({ days: 1 });
let iterations = 0;
while (pastDay.toFormat("cccc").toLowerCase() !== classWeekday && iterations < 10) {
  console.log("  Checking:", pastDay.toISO(), "weekday:", pastDay.toFormat("cccc"));
  pastDay = pastDay.minus({ days: 1 });
  iterations++;
}

console.log("Found past day:", pastDay.toISO(), "weekday:", pastDay.toFormat("cccc"));
console.log("Today (start):", fixedClassNow.startOf("day").toISO());

console.log("\n=== Test past class date ===");
try {
  assertBookableClassOccurrence({
    gymClass: sampleClass,
    occurrenceDate: pastDay.toISODate()!,
    now: fixedClassNow,
  });
  console.log("ERROR: should have thrown!");
} catch (e) {
  console.log("Caught error:", e instanceof Error ? e.message : String(e));
}
