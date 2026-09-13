import { GymConfigSchema, type GymConfig } from "./gym.js";

export * from "./base.js";
export * from "./gym.js";

// Only one vertical exists today, so the client config *is* the gym config.
// When a second vertical is added, swap this for a discriminated union on
// e.g. `business.vertical`.
export const ClientConfigSchema = GymConfigSchema;
export type ClientConfig = GymConfig;

export function parseClientConfig(data: unknown): ClientConfig {
  const result = ClientConfigSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid client config:\n${issues}`);
  }
  return result.data;
}
