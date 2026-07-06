import { env } from "./env.js";

export const oauthClients = [
  {
    clientId: "finlens",
    clientSecret: env.finlensClientSecret,
    name: "FinLens",
    uri: "https://finance.tail.optiplex.pior.ca",
    // The Tailscale hostname is the primary self-host origin (reachable both at
    // home and away over the tailnet). The plain LAN hostname is kept as a
    // second registered callback in case FinLens is ever run under it; the
    // localhost entry is for local development.
    redirectUris: [
      "https://finance.tail.optiplex.pior.ca/api/auth/oauth2/callback/auth-pior",
      "https://finance.optiplex.pior.ca/api/auth/oauth2/callback/auth-pior",
      "http://localhost:5174/api/auth/oauth2/callback/auth-pior",
    ],
  },
] as const;

export const trustedClientIds = new Set(oauthClients.map((client) => client.clientId));
