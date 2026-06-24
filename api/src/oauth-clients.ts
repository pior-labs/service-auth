import { env } from "./env.js";

export const oauthClients = [
  {
    clientId: "finlens",
    clientSecret: env.finlensClientSecret,
    name: "FinLens",
    uri: "https://finlens.pior.ca",
    redirectUris: ["https://finlens.pior.ca/callback"],
  },
  {
    clientId: "housebot",
    clientSecret: env.housebotClientSecret,
    name: "HouseBot",
    uri: "https://housebot.pior.ca",
    redirectUris: ["https://housebot.pior.ca/callback"],
  },
  {
    clientId: "applybot",
    clientSecret: env.applybotClientSecret,
    name: "ApplyBot",
    uri: "https://applybot.pior.ca",
    redirectUris: ["https://applybot.pior.ca/callback"],
  },
] as const;

export const trustedClientIds = new Set(oauthClients.map((client) => client.clientId));
