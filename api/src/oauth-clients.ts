import { env } from "./env.js";

export const oauthClients = [
  {
    clientId: "finlens",
    clientSecret: env.finlensClientSecret,
    name: "FinLens",
    uri: "https://finance.ts.szarans.ca",
    // The Tailscale hostname is the canonical self-host origin. The plain
    // hostname remains registered for LAN access, and localhost supports local
    // development against the same OAuth client.
    redirectUris: [
      "https://finance.ts.szarans.ca/api/auth/oauth2/callback/auth-pior",
      "https://finance.szarans.ca/api/auth/oauth2/callback/auth-pior",
      "http://localhost:5174/api/auth/oauth2/callback/auth-pior",
    ],
  },
] as const;

export const trustedClientIds = new Set(oauthClients.map((client) => client.clientId));
