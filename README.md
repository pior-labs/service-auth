# auth.optiplex.pior.ca

Private household SSO provider for two users. This is a standalone service using OAuth 2.1 / OIDC.

## Stack

- API: Hono, TypeScript, Better Auth, `@better-auth/oauth-provider`
- DB: Drizzle schema on Postgres, using its own logical database named `auth`
- Web: Vite, React, TypeScript, Tailwind v4, shadcn-style UI primitives
- Package manager: pnpm

## Layout

- `api/`: Hono entrypoint, Better Auth config, Drizzle schema/migration, seed/reset scripts
- `web/`: single login page SPA
- `docker-compose.yml`: API container joined to the shared external Docker network

## Better Auth OAuth Provider

This uses the current Better Auth OAuth 2.1 Provider plugin from `@better-auth/oauth-provider`, not the deprecated OIDC Provider plugin.

The provider is configured with:

- `loginPage: "/sign-in"`, served by the SPA fallback
- scopes: `openid`, `profile`, `email`, `offline_access`
- trusted clients cached by ID: `finlens` (the only registered client today)
- no consent prompt for those trusted clients via seeded `skipConsent: true`
- generous central sessions and refresh tokens, controlled by env

ID tokens include Better Auth's stable `sub` plus explicit `email` and `name` custom claims. The UserInfo endpoint also returns `email` and `name`.

## Setup

1. Create the logical Postgres database named `auth` in the shared Postgres server.
2. Copy `.env.example` to `.env` and fill real secrets, emails, and passwords.
3. Install dependencies with `pnpm install` from this directory.
4. Apply the checked-in migration with `pnpm db:migrate`.
5. Seed users and clients with `pnpm db:seed`.
6. Build the web app with `pnpm --filter @auth/web build` and serve `web/dist` from Caddy.
7. Start the API with `docker compose up -d --build api`.

## OpenID Connect endpoints

Clients discover the provider through the OIDC discovery document, which is served under the Better Auth base path (not the domain root):

```text
<issuer>/.well-known/openid-configuration
```

where `<issuer>` is `<BETTER_AUTH_URL>/api/auth`. The document advertises these endpoints, all rooted at the issuer:

- `authorization_endpoint`: `/oauth2/authorize`
- `token_endpoint`: `/oauth2/token`
- `userinfo_endpoint`: `/oauth2/userinfo`
- `jwks_uri`: `/jwks` (ID tokens are signed with EdDSA; clients verify against this key set)
- `end_session_endpoint`: `/oauth2/end-session`

In production the issuer is `https://auth.optiplex.pior.ca/api/auth`. Caddy must route `/api/auth/*` and `/.well-known/*` to the auth API and serve the built web app for `/sign-in`.

## Local verification (localhost)

The intended local setup mirrors production's single front door: run both processes with `pnpm dev`. The Vite dev server on `http://localhost:5173` serves the `/sign-in` SPA and proxies `/api/*` to the API on `http://localhost:3000`, so `http://localhost:5173` is the local issuer origin.

1. Ensure Postgres is running and the `DATABASE_URL` database exists.
2. `pnpm db:migrate` then `pnpm db:seed`.
3. `pnpm dev` (starts API on `:3000` and web on `:5173`).
4. Point the client app (e.g. FinLens running on `http://localhost:3001`) at the discovery URL `http://localhost:5173/api/auth/.well-known/openid-configuration`.

The full authorization-code + PKCE flow (`authorize` -> `/sign-in` -> `token` -> `userinfo`, plus `refresh_token`) has been verified end to end against a local client on `http://localhost:3001`.

Baseline service checks:

- `pnpm typecheck`
- `pnpm build`
- `GET /health`, which returns `{ "ok": true }` once the API process starts.

## Adding an OAuth client

Every app that uses this SSO provider must be registered as a trusted OAuth client. To add one (using a placeholder app name `myapp`):

1. **Register the client secret env var.**
   - Add `MYAPP_CLIENT_SECRET=...` to `.env` (and a placeholder line to `.env.example`). Generate with `openssl rand -base64 32`.
   - Expose it in `api/src/env.ts`:
     ```ts
     myappClientSecret: requiredEnv("MYAPP_CLIENT_SECRET", "change-me-myapp"),
     ```

2. **Add the client to `api/src/oauth-clients.ts`.** Give it a stable `clientId`, its production `uri`, and the *exact* allowed callback URLs. For a Better Auth client app the callback path is `/api/auth/oauth2/callback/<provider-id>`; include both production and localhost entries so the same client works in local testing:
   ```ts
   {
     clientId: "myapp",
     clientSecret: env.myappClientSecret,
     name: "MyApp",
     uri: "https://myapp.pior.ca",
     redirectUris: [
       "https://myapp.pior.ca/api/auth/oauth2/callback/auth-pior",
       "http://localhost:3001/api/auth/oauth2/callback/auth-pior",
     ],
   },
   ```
   `trustedClientIds` is derived from this array, so no other code change is needed.

3. **Re-seed.** Run `pnpm db:seed`. The client is upserted with `authorization_code` + `refresh_token` grants, `client_secret_post` auth, PKCE required, and consent skipped. The seed **hashes the client secret** (SHA-256, base64url) before storing it, because the provider verifies incoming secrets against the hashed form; storing plaintext would make every token exchange fail with `invalid_client`.

4. **Configure the client app** with the issuer/discovery URL (see above), the registered `clientId` and its plaintext secret, the exact callback URL, and scopes `openid profile email offline_access`.

To rotate a secret, change the env value and re-run `pnpm db:seed` (the upsert re-hashes and overwrites). To retire a client, remove it from `oauth-clients.ts` and delete its row: `DELETE FROM "oauthClient" WHERE "clientId" = 'myapp';` (removing it from the array alone does not delete the stored row).

## Seeding

The seed script creates exactly two users and upserts the trusted OAuth clients defined in `api/src/oauth-clients.ts`.

Required user env:

- `SEED_USER_1_EMAIL`, `SEED_USER_1_NAME`, `SEED_USER_1_PASSWORD`
- `SEED_USER_2_EMAIL`, `SEED_USER_2_NAME`, `SEED_USER_2_PASSWORD`

Required OAuth client env (one per registered client):

- `FINLENS_CLIENT_SECRET`

Seed command:

```bash
pnpm db:seed
```

## Reset Password

There is no public forgot-password or email reset flow. Run the server-side script instead:

```bash
pnpm reset-password -- user@example.com 'new-password-here'
```

If arguments are omitted, the script prompts for the email and password. It hashes with the same password hasher configured for Better Auth and updates the credential account row.

## Login Flow

The only UI is the SPA login form. When Better Auth redirects an authorize request to `/sign-in`, submitting the form calls `authClient.signIn.email(...)`; then it calls `authClient.oauth2.continue({})` so the OAuth Provider plugin can complete the pending authorize flow and redirect back to the client app.

No signup UI, password reset UI, email sending, social login, MFA, admin UI, orgs, or client-app integration code is included.

## `prompt=login`

The API intercepts `/api/auth/oauth2/authorize?prompt=login`, clears the central session cookie, and redirects back to the same authorize request with a marker. That forces the OAuth Provider plugin to send the browser to `/sign-in` even if a central session existed.
