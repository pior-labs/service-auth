import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: "../.env.local" });
config({ path: "../.env" });
config();

const intEnv = (name: string, fallback: number) => {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be an integer number of seconds`);
  }

  return parsed;
};

const requiredEnv = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const requiredEnvOrFile = (name: string, fallback?: string) => {
  const value = process.env[name];
  if (value) return value;

  const filePath = process.env[`${name}_FILE`];
  if (!filePath) return requiredEnv(name, fallback);

  let fileValue: string;
  try {
    fileValue = readFileSync(filePath, "utf8").trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${name}_FILE could not be read from ${filePath}: ${message}`);
  }

  if (!fileValue) throw new Error(`${name}_FILE is empty: ${filePath}`);
  return fileValue;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: intEnv("API_PORT", 3000),
  databaseUrl: requiredEnvOrFile(
    "DATABASE_URL",
    "postgresql://postgres:postgres@postgres:5432/auth",
  ),
  betterAuthSecret: requiredEnv("BETTER_AUTH_SECRET"),
  betterAuthUrl: requiredEnv("BETTER_AUTH_URL", "http://localhost:3000"),
  webOrigin: requiredEnv("WEB_ORIGIN", "http://localhost:5173"),
  sessionExpiresIn: intEnv("AUTH_SESSION_EXPIRES_IN_SECONDS", 60 * 60 * 24 * 45),
  sessionUpdateAge: intEnv("AUTH_SESSION_UPDATE_AGE_SECONDS", 60 * 60 * 24),
  accessTokenExpiresIn: intEnv("OAUTH_ACCESS_TOKEN_EXPIRES_IN_SECONDS", 60 * 60),
  idTokenExpiresIn: intEnv("OAUTH_ID_TOKEN_EXPIRES_IN_SECONDS", 60 * 60),
  refreshTokenExpiresIn: intEnv("OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS", 60 * 60 * 24 * 90),
  finlensClientSecret: requiredEnv("FINLENS_CLIENT_SECRET", "change-me-finlens"),
};
