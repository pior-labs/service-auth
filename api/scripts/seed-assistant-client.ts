import { oauthClients } from "../src/oauth-clients.js";
import { seedOAuthClient } from "./seed-oauth-client.js";

const client = oauthClients.find((value) => value.clientId === "assistant");
if (!client) throw new Error("Set ASSISTANT_CLIENT_SECRET before registering Assistant");
await seedOAuthClient(client);
console.log("Assistant client registered; household users are unchanged.");
process.exit(0);
