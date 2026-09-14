import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseClientConfig } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, "../../../clients/gym-demo/config.json");
const raw = JSON.parse(readFileSync(configPath, "utf-8"));

// No staff/trainer cross-reference assertions here anymore (service
// staffIds referencing a real staff id, trainers referencing real staff,
// classes referencing real trainers) — those all moved to apps/api,
// checked against the database at runtime now that staff/trainers live
// there instead of in this file. See apps/api/src/bookingRules.ts
// (assertStaffQualified) and apps/api/src/routes/catalog.ts.
const config = parseClientConfig(raw);
assert(config.business.name.length > 0, "expected a business name");
assert(config.businessHours.length > 0, "expected at least one business hours slot");
assert(
  config.businessHours.every((slot) => slot.closeTime > slot.openTime),
  "every business hours slot must close after it opens",
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

const badPrimaryColor = structuredClone(raw);
badPrimaryColor.business.primaryColor = "not-a-hex-color";
assert.throws(() => parseClientConfig(badPrimaryColor), "malformed primaryColor should be rejected");
console.log("OK: a malformed primaryColor is rejected");
