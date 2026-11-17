import { env } from "./env.js";

// Better Auth 1.7 moved the client callback from /api/auth/oauth2/callback/:id
// to /api/auth/callback/:id. Each client accepts both while the apps upgrade
// one at a time (workspace ADR 0003); the old paths go once all four run 1.7.

export const oauthClients = [
  {
    clientId: "tasks",
    clientSecret: env.tasksClientSecret,
    name: "Tasks",
    uri: "https://tasks.szarans.ca",
    redirectUris: [
      "https://tasks.szarans.ca/api/auth/oauth2/callback/auth-pior",
      "https://tasks.szarans.ca/api/auth/callback/auth-pior",
      "http://localhost:5173/api/auth/oauth2/callback/auth-pior",
      "http://localhost:5173/api/auth/callback/auth-pior",
    ],
  },
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
      "https://finance.szarans.ca/api/auth/callback/auth-pior",
      "http://localhost:5173/api/auth/oauth2/callback/auth-pior",
      "http://localhost:5173/api/auth/callback/auth-pior",
    ],
  },
  {
    clientId: "cookbook",
    clientSecret: env.cookbookClientSecret,
    name: "Cookbook",
    uri: "https://cookbook.szarans.ca",
    redirectUris: [
      "https://cookbook.szarans.ca/api/auth/oauth2/callback/auth-pior",
      "https://cookbook.szarans.ca/api/auth/callback/auth-pior",
      "http://localhost:5173/api/auth/oauth2/callback/auth-pior",
      "http://localhost:5173/api/auth/callback/auth-pior",
    ],
  },
  {
    clientId: "assistant",
    clientSecret: env.assistantClientSecret,
    name: "Szarans Assistant",
    uri: "https://chat.szarans.ca",
    redirectUris: [
      "https://chat.szarans.ca/api/auth/oauth2/callback/auth-pior",
      "https://chat.szarans.ca/api/auth/callback/auth-pior",
      "http://localhost:5173/api/auth/oauth2/callback/auth-pior",
      "http://localhost:5173/api/auth/callback/auth-pior",
    ],
  },
] as const;

export const trustedClientIds = new Set(oauthClients.map((client) => client.clientId));
