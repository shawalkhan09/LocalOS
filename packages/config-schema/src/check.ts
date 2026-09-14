import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseClientConfig } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, "../../../clients/gym-demo/config.json");
const raw = JSON.parse(readFileSync(configPath, "utf-8"));

const config = parseClientConfig(raw);
assert(config.business.name.length > 0, "expected a business name");
assert(
  config.classes.every((c) => config.trainers.some((t) => t.id === c.trainerId)),
  "every class must reference a real trainer",
);
assert(
  config.trainers.every((t) => config.staff.some((s) => s.id === t.staffId)),
  "every trainer must reference a real staff id",
);
assert(config.businessHours.length > 0, "expected at least one business hours slot");
assert(
  config.businessHours.every((slot) => slot.closeTime > slot.openTime),
  "every business hours slot must close after it opens",
);
assert(
  config.services.every((s) => (s.staffIds ?? []).every((id) => config.staff.some((m) => m.id === id))),
  "every service staffId must reference a real staff id",
);
assert(/^#[0-9a-fA-F]{6}$/.test(config.business.primaryColor), "expected a 6-digit hex primaryColor");
console.log("OK: gym-demo config.json is valid");

assert.throws(() => parseClientConfig({ business: {} }), "malformed config should throw");
console.log("OK: malformed config is rejected");

const duplicateServiceId = structuredClone(raw);
duplicateServiceId.services[1].id = duplicateServiceId.services[0].id;
assert.throws(
  () => parseClientConfig(duplicateServiceId),
  "duplicate service id should be rejected",
);
console.log("OK: duplicate id within an array is rejected");

const closeTimeBeforeOpenTime = structuredClone(raw);
closeTimeBeforeOpenTime.businessHours[0].closeTime = "04:00"; // before that day's 05:00 openTime
assert.throws(
  () => parseClientConfig(closeTimeBeforeOpenTime),
  "closeTime at or before openTime should be rejected",
);
console.log("OK: business hours with closeTime <= openTime is rejected");

const unknownServiceStaffId = structuredClone(raw);
unknownServiceStaffId.services[0].staffIds = ["staff-does-not-exist"];
assert.throws(
  () => parseClientConfig(unknownServiceStaffId),
  "unknown service staffId should be rejected",
);
console.log("OK: service staffIds referencing an unknown staff id is rejected");

const badPrimaryColor = structuredClone(raw);
badPrimaryColor.business.primaryColor = "not-a-hex-color";
assert.throws(() => parseClientConfig(badPrimaryColor), "malformed primaryColor should be rejected");
console.log("OK: a malformed primaryColor is rejected");
