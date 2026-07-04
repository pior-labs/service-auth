import { env } from "./env.js";

export const oauthClients = [
  {
    clientId: "finlens",
    clientSecret: env.finlensClientSecret,
    name: "FinLens",
    uri: "https://finlens.pior.ca",
    redirectUris: [
      "https://finlens.pior.ca/api/auth/oauth2/callback/auth-pior",
      "http://localhost:3001/api/auth/oauth2/callback/auth-pior",
    ],
  },
] as const;

export const trustedClientIds = new Set(oauthClients.map((client) => client.clientId));
