import { env } from "./env.js";

export const oauthClients = [
  {
    clientId: "finlens",
    clientSecret: env.finlensClientSecret,
    name: "FinLens",
    uri: "https://finance.szarans.ca",
    // Production uses one canonical hostname regardless of whether the client
    // reaches Finance through Tailscale or the public path. Localhost supports
    // development against the same OAuth client.
    redirectUris: [
      "https://finance.szarans.ca/api/auth/oauth2/callback/auth-pior",
      "http://localhost:5173/api/auth/oauth2/callback/auth-pior",
    ],
  },
  {
    clientId: "cookbook",
    clientSecret: env.cookbookClientSecret,
    name: "Cookbook",
    uri: "https://cookbook.szarans.ca",
    redirectUris: [
      "https://cookbook.szarans.ca/api/auth/oauth2/callback/auth-pior",
      "http://localhost:5173/api/auth/oauth2/callback/auth-pior",
    ],
  },
  // Optional until the new application is provisioned. Never seed a placeholder secret.
  ...(env.assistantClientSecret ? [{
    clientId: "assistant",
    clientSecret: env.assistantClientSecret,
    name: "Szarans Assistant",
    uri: "https://chat.szarans.ca",
    redirectUris: [
      "https://chat.szarans.ca/api/auth/oauth2/callback/auth-pior",
      "http://localhost:5173/api/auth/oauth2/callback/auth-pior",
    ],
  }] : []),
] as const;

export const trustedClientIds = new Set(oauthClients.map((client) => client.clientId));
