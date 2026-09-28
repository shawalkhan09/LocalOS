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
//
// business.name/primaryColor assertions moved to apps/api/src/check.ts:
// those fields no longer exist on the parsed deploy-time config (business
// name/branding moved to the database this round — see packages/db's
// `business_info` table), only timezone/currency remain here.
parseClientConfig(raw);
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
