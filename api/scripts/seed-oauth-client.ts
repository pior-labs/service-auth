import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../src/db/index.js";
import { oauthClient } from "../src/db/schema.js";
import type { oauthClients } from "../src/oauth-clients.js";
// Better Auth's OAuth provider stores client secrets in "hashed" mode by
// default (the mode used whenever the jwt() plugin is enabled). It verifies an
// incoming secret by SHA-256 hashing it and comparing to the stored value, so
// the seed must store the hash, not the plaintext, or every token exchange
// fails with "invalid client_secret".
const hashClientSecret = (secret: string) => createHash("sha256").update(secret).digest("base64url");

export async function seedOAuthClient(client: (typeof oauthClients)[number]) {
  const existing = await db.query.oauthClient.findFirst({ where: eq(oauthClient.clientId, client.clientId) });
  const values = {
    id: existing?.id ?? nanoid(),
    clientId: client.clientId,
    clientSecret: hashClientSecret(client.clientSecret),
    disabled: false,
    skipConsent: true,
    enableEndSession: true,
    scopes: ["openid", "profile", "email", "offline_access"],
    name: client.name,
    uri: client.uri,
    redirectUris: [...client.redirectUris],
    tokenEndpointAuthMethod: "client_secret_post",
    grantTypes: ["authorization_code", "refresh_token"],
    responseTypes: ["code"],
    public: false,
    type: "web",
    requirePKCE: true,
    metadata: { trusted: true },
    updatedAt: new Date(),
  };

  await db.insert(oauthClient).values(values).onConflictDoUpdate({
    target: oauthClient.clientId,
    set: values,
  });

  console.log(`upserted trusted client: ${client.clientId}`);
}

