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
