import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseClientConfig } from "@localos/config-schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = path.resolve(__dirname, "../../../clients/gym-demo/config.json");
const configPath = process.env.CLIENT_CONFIG_PATH ?? defaultConfigPath;

const raw = JSON.parse(readFileSync(configPath, "utf-8"));

// Parsed once at boot; malformed config crashes the process instead of
// serving broken data.
export const clientConfig = parseClientConfig(raw);
