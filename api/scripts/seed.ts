import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

process.env.AUTH_ALLOW_SEED_SIGNUP = "true";

const { auth } = await import("../src/auth.js");
const { db } = await import("../src/db/index.js");
const { account, oauthClient, user } = await import("../src/db/schema.js");
const { oauthClients } = await import("../src/oauth-clients.js");

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const seedUsers = [
  {
    email: required("SEED_USER_1_EMAIL"),
    name: process.env.SEED_USER_1_NAME ?? "User One",
    password: required("SEED_USER_1_PASSWORD"),
  },
  {
    email: required("SEED_USER_2_EMAIL"),
    name: process.env.SEED_USER_2_NAME ?? "User Two",
    password: required("SEED_USER_2_PASSWORD"),
  },
];

for (const seedUser of seedUsers) {
  const existing = await db.query.user.findFirst({ where: eq(user.email, seedUser.email) });
  if (existing) {
    console.log(`user exists: ${seedUser.email}`);
    continue;
  }

  await auth.api.signUpEmail({
    body: {
      email: seedUser.email,
      name: seedUser.name,
      password: seedUser.password,
    },
  });

  console.log(`created user: ${seedUser.email}`);
}

for (const client of oauthClients) {
  const existing = await db.query.oauthClient.findFirst({ where: eq(oauthClient.clientId, client.clientId) });
  const values = {
    id: existing?.id ?? nanoid(),
    clientId: client.clientId,
    clientSecret: client.clientSecret,
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

const userCount = await db.select().from(user);
if (userCount.length !== 2) {
  throw new Error(`expected exactly two users after seed, found ${userCount.length}`);
}

const credentialAccounts = await db.select().from(account).where(and(eq(account.providerId, "credential")));
if (credentialAccounts.length !== 2) {
  throw new Error(`expected exactly two credential accounts after seed, found ${credentialAccounts.length}`);
}

console.log("seed complete");
process.exit(0);
