import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import { after, before, test } from "node:test";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/client";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { clientSecrets, createFixture, seedUsers, type Fixture } from "./fixture.js";

// The provider contract every Pior Labs application relies on: discovery,
// authorization code + PKCE through the login page, client_secret_post token
// exchange, verifiable EdDSA ID tokens, UserInfo and refresh. It drives the
// login page's own client plugin, so it follows the browser's real path.

const callback = (host: string) => `${host}/api/auth/callback/auth-pior`;
const localCallback = callback("http://localhost:5173");

let fixture: Fixture;
let discovery: Record<string, any>;

before(async () => {
  fixture = await createFixture();
  discovery = await (await fetch(`${fixture.issuer}/.well-known/openid-configuration`)).json();
});
after(async () => {
  await fixture?.close();
});

class CookieJar {
  private cookies = new Map<string, string>();
  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }
  store(response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1);
      const expired = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "";
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  fetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (this.cookies.size) headers.set("cookie", this.header());
    const response = await fetch(input, { ...init, headers, redirect: "manual" });
    this.store(response);
    return response;
  };
}

type AuthorizeOptions = {
  clientId?: string;
  redirectUri?: string;
  pkce?: boolean;
  extra?: Record<string, string>;
};

function authorizeRequest({ clientId = "tasks", redirectUri = localCallback, pkce = true, extra = {} }: AuthorizeOptions = {}) {
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email offline_access");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  if (pkce) {
    url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
  }
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return { url, verifier, state, nonce, clientId, redirectUri };
}

// A top-level browser navigation. Node's fetch always sends
// sec-fetch-mode: cors, which Better Auth answers with JSON instead of a
// redirect, so navigations go through node:http with a browser's headers.
async function navigate(url: URL | string, jar: CookieJar) {
  const target = new URL(url);
  const response = await new Promise<Response>((resolve, reject) => {
    const req = httpRequest(
      target,
      {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
          ...(jar.header() ? { cookie: jar.header() } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(res.headers)) {
            for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
              headers.append(name, item);
            }
          }
          const status = res.statusCode!;
          const body = [204, 304].includes(status) ? null : Buffer.concat(chunks);
          resolve(new Response(body, { status, headers }));
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
  jar.store(response);
  return response;
}

// Sign in on the login page and return the redirect back to the application.
async function signIn(request: ReturnType<typeof authorizeRequest>, user = seedUsers[0], jar = new CookieJar()) {
  const toLogin = await navigate(request.url, jar);
  assert.equal(toLogin.status, 302, await toLogin.clone().text());
  const login = new URL(toLogin.headers.get("location")!, fixture.origin);
  assert.equal(login.pathname, "/sign-in");

  const globals = globalThis as { window?: unknown };
  globals.window = { location: { search: login.search } };
  try {
    const client = createAuthClient({
      baseURL: fixture.origin,
      plugins: [oauthProviderClient()],
      fetchOptions: { customFetchImpl: jar.fetch },
    });
    // With the signed OAuth query attached, sign-in completes the authorization
    // and returns the redirect back to the application, which the browser
    // follows. The login page's continue call only matters when it does not.
    const signedIn = await client.signIn.email({ email: user.email, password: user.password, rememberMe: true });
    assert.equal(signedIn.error, null, JSON.stringify(signedIn.error));
    let target = (signedIn.data as { redirect?: boolean; url?: string } | null)?.url;
    if (!target) {
      const continued = await client.oauth2.continue({});
      assert.equal(continued.error, null, JSON.stringify(continued.error));
      target = (continued.data as { url?: string } | null)?.url;
    }
    assert.ok(target, "sign-in did not return to the application");
    return { redirect: new URL(target, fixture.origin), jar };
  } finally {
    delete globals.window;
  }
}

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

function exchange(request: ReturnType<typeof authorizeRequest>, code: string, overrides: Record<string, string> = {}) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: request.redirectUri,
    client_id: request.clientId,
    client_secret: clientSecrets[request.clientId as keyof typeof clientSecrets],
    code_verifier: request.verifier,
    ...overrides,
  });
}

async function codeFor(request = authorizeRequest(), user = seedUsers[0]) {
  const { redirect, jar } = await signIn(request, user);
  assert.equal(`${redirect.origin}${redirect.pathname}`, request.redirectUri);
  assert.equal(redirect.searchParams.get("state"), request.state);
  assert.equal(redirect.searchParams.get("iss"), fixture.issuer);
  const code = redirect.searchParams.get("code");
  assert.ok(code);
  return { request, code, jar };
}

async function verifyIdToken(idToken: string, clientId: string, nonce: string) {
  const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
  const { payload, protectedHeader } = await jwtVerify(idToken, jwks, {
    issuer: discovery.issuer,
    audience: clientId,
    algorithms: discovery.id_token_signing_alg_values_supported,
  });
  assert.equal(payload.nonce, nonce);
  return { payload, protectedHeader };
}

async function userIdFor(email: string) {
  const { rows } = await fixture.db.query('select id from "user" where email = $1', [email]);
  return rows[0].id as string;
}

test("discovery publishes the issuer, endpoints and EdDSA keys the applications verify against", async () => {
  assert.equal(discovery.issuer, fixture.issuer);
  assert.equal(discovery.jwks_uri, `${fixture.issuer}/jwks`);
  assert.equal(discovery.authorization_endpoint, `${fixture.issuer}/oauth2/authorize`);
  assert.equal(discovery.token_endpoint, `${fixture.issuer}/oauth2/token`);
  assert.equal(discovery.userinfo_endpoint, `${fixture.issuer}/oauth2/userinfo`);
  assert.equal(discovery.end_session_endpoint, `${fixture.issuer}/oauth2/end-session`);
  assert.deepEqual(discovery.id_token_signing_alg_values_supported, ["EdDSA"]);
  assert.equal(discovery.authorization_response_iss_parameter_supported, true);
  assert.ok(discovery.code_challenge_methods_supported.includes("S256"));
  assert.ok(discovery.token_endpoint_auth_methods_supported.includes("client_secret_post"));
  const keys = await (await fetch(discovery.jwks_uri)).json();
  assert.ok(keys.keys.length > 0);
  assert.ok(keys.keys.every((key: { crv?: string }) => key.crv === "Ed25519"));
});

test("every client signs in through the login page and gets a verifiable ID token, UserInfo and refresh", async () => {
  const hosts = {
    tasks: "https://tasks.szarans.ca",
    finlens: "https://finance.szarans.ca",
    cookbook: "https://cookbook.szarans.ca",
    assistant: "https://chat.szarans.ca",
  };
  for (const [clientId, host] of Object.entries(hosts)) {
    for (const redirectUri of [callback(host), localCallback]) {
      const { request, code } = await codeFor(authorizeRequest({ clientId, redirectUri }));
      const tokens = await exchange(request, code);
      assert.equal(tokens.status, 200, `${clientId} ${redirectUri}: ${JSON.stringify(tokens.body)}`);
      assert.equal(tokens.body.token_type.toLowerCase(), "bearer");
      assert.ok(tokens.body.access_token && tokens.body.refresh_token && tokens.body.id_token);

      const { payload, protectedHeader } = await verifyIdToken(tokens.body.id_token, clientId, request.nonce);
      assert.equal(protectedHeader.alg, "EdDSA");
      assert.equal(payload.sub, await userIdFor(seedUsers[0].email));
      // Applications read the profile from the verified ID token when it has
      // an email, so email and name must stay in it.
      assert.equal(payload.email, seedUsers[0].email);
      assert.equal(payload.name, seedUsers[0].name);

      const userinfo = await fetch(discovery.userinfo_endpoint, {
        headers: { authorization: `Bearer ${tokens.body.access_token}` },
      });
      assert.equal(userinfo.status, 200);
      const profile = await userinfo.json();
      assert.equal(profile.sub, payload.sub);
      assert.equal(profile.email, seedUsers[0].email);
      assert.equal(profile.name, seedUsers[0].name);

      const refreshed = await tokenRequest({
        grant_type: "refresh_token",
        refresh_token: tokens.body.refresh_token,
        client_id: clientId,
        client_secret: clientSecrets[clientId as keyof typeof clientSecrets],
      });
      assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
      assert.ok(refreshed.body.access_token);
      assert.notEqual(refreshed.body.access_token, tokens.body.access_token);
    }
  }
});

test("the two household users get distinct, stable subjects", async () => {
  const subjects = [];
  for (const user of [seedUsers[0], seedUsers[1], seedUsers[0]]) {
    const { request, code } = await codeFor(authorizeRequest(), user);
    const tokens = await exchange(request, code);
    assert.equal(tokens.status, 200);
    subjects.push(decodeJwt(tokens.body.id_token).sub);
  }
  assert.notEqual(subjects[0], subjects[1]);
  assert.equal(subjects[0], subjects[2]);
});

test("an existing provider session skips the login page", async () => {
  const first = await codeFor();
  const again = authorizeRequest();
  const response = await navigate(again.url, first.jar);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location")!, fixture.origin);
  assert.equal(`${location.origin}${location.pathname}`, again.redirectUri);
  assert.ok(location.searchParams.get("code"));
});

test("prompt=login ends the provider session and requires signing in again", async () => {
  const first = await codeFor();
  const forced = authorizeRequest({ extra: { prompt: "login" } });
  const cleared = await navigate(forced.url, first.jar);
  assert.equal(cleared.status, 302);
  const retry = new URL(cleared.headers.get("location")!, fixture.origin);
  assert.equal(retry.searchParams.get("fresh_login"), "1");
  assert.equal(retry.searchParams.get("prompt"), null);
  const toLogin = await navigate(retry, first.jar);
  assert.equal(toLogin.status, 302);
  assert.equal(new URL(toLogin.headers.get("location")!, fixture.origin).pathname, "/sign-in");
});

test("unregistered and Better Auth 1.6 callback URLs are refused", async () => {
  for (const redirectUri of [
    "http://localhost:5173/api/auth/oauth2/callback/auth-pior",
    "https://tasks.szarans.ca/api/auth/oauth2/callback/auth-pior",
    "https://evil.example/api/auth/callback/auth-pior",
    // Another client's callback must not be accepted for this client.
    callback("https://finance.szarans.ca"),
  ]) {
    const request = authorizeRequest({ redirectUri });
    const response = await navigate(request.url, new CookieJar());
    const location = response.headers.get("location");
    assert.ok(!location || !location.startsWith(redirectUri), `${redirectUri} was accepted`);
    if (location) assert.ok(!new URL(location, fixture.origin).pathname.startsWith("/sign-in"), redirectUri);
  }
});

test("an unknown client is refused", async () => {
  const response = await navigate(authorizeRequest({ clientId: "unknown" }).url, new CookieJar());
  const location = response.headers.get("location");
  assert.ok(!location || !new URL(location, fixture.origin).pathname.startsWith("/sign-in"));
});

test("the token endpoint rejects a wrong secret, verifier or redirect URI, and code replay", async () => {
  const cases: Record<string, Record<string, string>> = {
    "wrong secret": { client_secret: "wrong" },
    "missing secret": { client_secret: "" },
    "wrong verifier": { code_verifier: randomBytes(32).toString("base64url") },
    "different redirect": { redirect_uri: callback("https://tasks.szarans.ca") },
    "other client": { client_id: "finlens", client_secret: clientSecrets.finlens },
  };
  for (const [name, overrides] of Object.entries(cases)) {
    const { request, code } = await codeFor();
    const rejected = await exchange(request, code, overrides);
    assert.ok(rejected.status >= 400 && rejected.status < 500, `${name}: ${rejected.status}`);
    assert.ok(!rejected.body.access_token, name);
  }
  const { request, code } = await codeFor();
  assert.equal((await exchange(request, code)).status, 200);
  const replay = await exchange(request, code);
  assert.ok(replay.status >= 400 && replay.status < 500, `replay: ${replay.status}`);
});

test("PKCE is required", async () => {
  const request = authorizeRequest({ pkce: false });
  const response = await navigate(request.url, new CookieJar());
  const location = response.headers.get("location");
  if (location) {
    const target = new URL(location, fixture.origin);
    assert.notEqual(target.pathname, "/sign-in");
    assert.equal(target.searchParams.get("code"), null);
  } else {
    assert.ok(response.status >= 400);
  }
});

test("UserInfo rejects missing and unknown access tokens", async () => {
  for (const authorization of [undefined, "Bearer not-a-token"]) {
    const response = await fetch(discovery.userinfo_endpoint, {
      headers: authorization ? { authorization } : {},
    });
    assert.ok(response.status >= 400 && response.status < 500, `${authorization}: ${response.status}`);
  }
});

test("a wrong password does not sign in or continue the OAuth flow", async () => {
  await assert.rejects(signIn(authorizeRequest(), { ...seedUsers[0], password: "wrong-password-0123456789" }));
});

test("seed stores hashed client secrets and only Better Auth 1.7 callbacks", async () => {
  const { rows } = await fixture.db.query(
    'select "clientId", "clientSecret", "redirectUris" from "oauthClient" order by "clientId"',
  );
  assert.deepEqual(rows.map((row) => row.clientId), ["assistant", "cookbook", "finlens", "tasks"]);
  for (const row of rows) {
    const secret = clientSecrets[row.clientId as keyof typeof clientSecrets];
    assert.equal(row.clientSecret, createHash("sha256").update(secret).digest("base64url"));
    assert.ok(row.redirectUris.every((uri: string) => uri.endsWith("/api/auth/callback/auth-pior")));
  }
});
