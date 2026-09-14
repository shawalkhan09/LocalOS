import { z } from "zod";
import { StaffMemberSchema } from "./base.js";
import { GymConfigObjectSchema, GymConfigSchema, TrainerSchema, type GymConfig } from "./gym.js";

export * from "./base.js";
export * from "./gym.js";

// GymConfig (above) is what actually lives in config.json and gets parsed
// at boot — see parseClientConfig below. ClientConfig is a distinct, wider
// shape: it's the contract for GET /catalog's response, which merges that
// deploy-time config with staff and trainer profiles read from the
// database (see apps/api/src/routes/catalog.ts). They used to be the same
// type, back when staff/trainers lived in config.json too; keeping the
// name `ClientConfig` for the catalog shape (rather than the parsed-config
// shape) is what lets apps/web keep consuming it with zero changes.
//
// Only one vertical exists today, so this is still just "the gym config
// plus staff/trainers." When a second vertical is added, swap this for a
// discriminated union on e.g. `business.vertical`.
export const ClientConfigSchema = GymConfigObjectSchema.extend({
  staff: z.array(StaffMemberSchema),
  trainers: z.array(TrainerSchema),
});
export type ClientConfig = z.infer<typeof ClientConfigSchema>;

export function parseClientConfig(data: unknown): GymConfig {
  const result = GymConfigSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid client config:\n${issues}`);
  }
  return result.data;
}
