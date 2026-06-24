# auth.pior.ca

Private household SSO provider for two users. This is a standalone service; FinLens, HouseBot, and ApplyBot talk to it only over OAuth 2.1 / OIDC.

## Stack

- API: Hono, TypeScript, Better Auth, `@better-auth/oauth-provider`
- DB: Drizzle schema on Postgres, using its own logical database named `auth`
- Web: Vite, React, TypeScript, Tailwind v4, shadcn-style UI primitives
- Package manager: pnpm

## Layout

- `api/`: Hono entrypoint, Better Auth config, Drizzle schema/migration, seed/reset scripts
- `web/`: single login page SPA
- `docker-compose.yml`: API container joined to the shared external Docker network
- `Caddyfile.snippet`: Caddy routing for API/OIDC endpoints and static SPA assets

## Better Auth OAuth Provider

This uses the current Better Auth OAuth 2.1 Provider plugin from `@better-auth/oauth-provider`, not the deprecated OIDC Provider plugin.

The provider is configured with:

- `loginPage: "/sign-in"`, served by the SPA fallback
- scopes: `openid`, `profile`, `email`, `offline_access`
- trusted clients cached by ID: `finlens`, `housebot`, `applybot`
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

## Seeding

The seed script creates exactly two users and upserts the three trusted OAuth clients.

Required user env:

- `SEED_USER_1_EMAIL`, `SEED_USER_1_NAME`, `SEED_USER_1_PASSWORD`
- `SEED_USER_2_EMAIL`, `SEED_USER_2_NAME`, `SEED_USER_2_PASSWORD`

Required OAuth client env:

- `FINLENS_CLIENT_SECRET`
- `HOUSEBOT_CLIENT_SECRET`
- `APPLYBOT_CLIENT_SECRET`

Seed command:

```bash
pnpm db:seed
```

Client IDs and placeholder redirect URIs:

- `finlens`: `https://finlens.pior.ca/callback`
- `housebot`: `https://housebot.pior.ca/callback`
- `applybot`: `https://applybot.pior.ca/callback`

All three are confidential web clients with PKCE required, `authorization_code` and `refresh_token` grants, and consent skipped.

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

## Caddy

Use `Caddyfile.snippet` as the basis for `auth.pior.ca`. It proxies `/api/auth/*`, `/.well-known/*`, and `/health` to the API container and serves the SPA from `/srv/auth/web/dist` with an `index.html` fallback.

## Private Threat Model

This service is intended to be reachable only on the LAN and through Tailscale. The network boundary is the primary security layer. Better Auth's built-in security primitives are left at sane defaults, but this intentionally avoids public-internet hardening such as CAPTCHA, MFA, account lockout flows, and aggressive rate limiting.

If this is ever exposed publicly, revisit session lifetimes, rate limiting, abuse protection, audit logging, password policy, and MFA before doing so.
