import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { env } from "./env.js";
import { hashPassword, verifyPassword } from "./password.js";
import { trustedClientIds } from "./oauth-clients.js";

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  disabledPaths: ["/token", "/forget-password", "/reset-password"],
  trustedOrigins: [env.webOrigin, env.betterAuthUrl],
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.AUTH_ALLOW_SEED_SIGNUP !== "true",
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  session: {
    expiresIn: env.sessionExpiresIn,
    updateAge: env.sessionUpdateAge,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  user: {
    deleteUser: {
      enabled: false,
    },
  },
  plugins: [
    jwt(),
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      scopes: ["openid", "profile", "email", "offline_access"],
      cachedTrustedClients: trustedClientIds,
      accessTokenExpiresIn: env.accessTokenExpiresIn,
      idTokenExpiresIn: env.idTokenExpiresIn,
      refreshTokenExpiresIn: env.refreshTokenExpiresIn,
      customIdTokenClaims: ({ user }) => ({
        email: user.email,
        name: user.name,
      }),
      customUserInfoClaims: ({ user }) => ({
        email: user.email,
        name: user.name,
      }),
    }),
  ],
});

export type Auth = typeof auth;
