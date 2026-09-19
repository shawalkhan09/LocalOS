import { DateTime } from "luxon";
import { assertBookableSessionTime } from "./bookingWindow.js";
import { clientConfig } from "./config.js";

const service60min = clientConfig.services.find((s) => s.durationMinutes === 60)!;
const fixedNow = DateTime.fromISO("2026-09-21T10:00:00", { zone: clientConfig.business.timezone }); // Monday

console.log("=== Config ===");
console.log("Timezone:", clientConfig.business.timezone);
console.log("Advance booking days:", clientConfig.booking.advanceBookingDays);
console.log("Service 60min:", service60min.name, service60min.durationMinutes);

console.log("\n=== Fixed Now ===");
console.log("ISO:", fixedNow.toISO());
console.log("Weekday:", fixedNow.weekdayLong);

console.log("\n=== Business Hours ===");
clientConfig.businessHours.forEach((h) => {
  console.log(`${h.day}: ${h.openTime} - ${h.closeTime}`);
});

console.log("\n=== Test: Before Open ===");
const wednesday = fixedNow.plus({ days: 2 }); // Wednesday
console.log("Wednesday ISO:", wednesday.toISO());
console.log("Wednesday weekday:", wednesday.weekdayLong);

const beforeOpenStart = wednesday.set({ hour: 4, minute: 0 });
const beforeOpenEnd = wednesday.set({ hour: 5, minute: 0 });
console.log("Start ISO:", beforeOpenStart.toISO());
console.log("End ISO:", beforeOpenEnd.toISO());

try {
  assertBookableSessionTime({
    service: service60min,
    startTime: beforeOpenStart,
    endTime: beforeOpenEnd,
    now: fixedNow,
  });
  console.log("ERROR: should have thrown!");
} catch (e) {
  console.log("Caught error:", e instanceof Error ? e.message : String(e));
}
