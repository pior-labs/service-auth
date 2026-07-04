import { env } from "./env.js";

export const oauthClients = [
  {
    clientId: "finlens",
    clientSecret: env.finlensClientSecret,
    name: "FinLens",
    uri: "https://finance.optiplex.pior.ca",
    redirectUris: [
      "https://finance.optiplex.pior.ca/api/auth/oauth2/callback/auth-pior",
      "http://localhost:3001/api/auth/oauth2/callback/auth-pior",
    ],
  },
] as const;

export const trustedClientIds = new Set(oauthClients.map((client) => client.clientId));
