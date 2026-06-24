import { config } from "dotenv";

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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: intEnv("API_PORT", 3000),
  databaseUrl: requiredEnv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/auth"),
  betterAuthSecret: requiredEnv("BETTER_AUTH_SECRET"),
  betterAuthUrl: requiredEnv("BETTER_AUTH_URL", "http://localhost:3000"),
  webOrigin: requiredEnv("WEB_ORIGIN", "http://localhost:5173"),
  sessionExpiresIn: intEnv("AUTH_SESSION_EXPIRES_IN_SECONDS", 60 * 60 * 24 * 45),
  sessionUpdateAge: intEnv("AUTH_SESSION_UPDATE_AGE_SECONDS", 60 * 60 * 24),
  accessTokenExpiresIn: intEnv("OAUTH_ACCESS_TOKEN_EXPIRES_IN_SECONDS", 60 * 60),
  idTokenExpiresIn: intEnv("OAUTH_ID_TOKEN_EXPIRES_IN_SECONDS", 60 * 60),
  refreshTokenExpiresIn: intEnv("OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS", 60 * 60 * 24 * 90),
  finlensClientSecret: requiredEnv("FINLENS_CLIENT_SECRET", "change-me-finlens"),
  housebotClientSecret: requiredEnv("HOUSEBOT_CLIENT_SECRET", "change-me-housebot"),
  applybotClientSecret: requiredEnv("APPLYBOT_CLIENT_SECRET", "change-me-applybot"),
};
