# Deployment Guide - service-auth (auth.pior.ca)

This is the runbook for deploying the central OAuth 2.1 / OIDC provider to the
home server. Follow it top to bottom for a first deploy; the "Redeploying" and
"Troubleshooting" sections at the end cover day-two operations.

## What you are deploying

- **auth-api** - the Node/Hono OIDC provider container. Runs on the shared
  `household_private` Docker network, exposes port `3000` internally (no host
  port), and answers a `/health` check.
- **web bundle** - a static SPA (the login screen and consent UI). It is *not* a
  running container; it is built into a `dist/` folder that Caddy serves
  directly from `/srv/auth/web/dist`.
- **Postgres** - a logical database named `auth` on the shared Postgres instance
  that already lives on `household_private`.
- **Caddy** - terminates TLS for `auth.pior.ca`, serves the static bundle, and
  reverse-proxies the API routes to `auth-api:3000`.

Single-origin architecture: everything is served under `https://auth.pior.ca`.
The browser only ever talks to that one origin; Caddy decides what is static and
what is proxied to the API.

## Prerequisites

- Docker with the Compose plugin on the server.
- The external Docker network already exists and is shared with Caddy + Postgres:
  ```bash
  docker network ls | grep household_private
  ```
  If it is missing: `docker network create household_private`.
- The shared Postgres container is reachable on that network as host `postgres`.
- Caddy runs on the server, imports snippets from its Caddyfile, and can read a
  host path for static files (we use `/srv/auth/web/dist`).
- **DNS**: `auth.pior.ca` resolves to the server (A/AAAA record), and your
  router forwards ports 80 + 443 to the Caddy container. Caddy provisions the
  Let's Encrypt certificate automatically on first request.

## 1. Get the code onto the server

```bash
git clone https://github.com/pior-labs/service-auth.git
cd service-auth
git checkout main
pnpm install            # needed for the migrate + seed scripts below
```

`pnpm install` is required even though the API runs in Docker, because the
schema migration and the seed run as `tsx` scripts from this checkout (they are
not baked into the runtime image).

## 2. Create the Postgres database + role

Connect to the shared Postgres as a superuser and create the logical database
and an owner role:

```sql
CREATE ROLE auth LOGIN PASSWORD '<pick-a-strong-password>';
CREATE DATABASE auth OWNER auth;
```

Keep the password - it goes into `DATABASE_URL` next.

## 3. Configure `.env`

```bash
cp .env.example .env
```

Fill in real values (the file is gitignored). The ones that matter:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://auth:<password>@postgres:5432/auth` | host is `postgres` (the container name on the shared network) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | also encrypts the private keys in the `jwks` table - rotating it invalidates existing signing keys |
| `BETTER_AUTH_URL` | `https://auth.pior.ca` | public origin; baked into the `iss` claim of every token |
| `WEB_ORIGIN` | `https://auth.pior.ca` | |
| `FINLENS_CLIENT_SECRET` | `openssl rand -base64 32` | the **raw** secret; the DB stores its hash. This exact value must also go into FinLens (step 10) |
| `SEED_USER_1_*` / `SEED_USER_2_*` | real emails/names/passwords | seeds exactly two accounts |
| `SHARED_DOCKER_NETWORK` | `household_private` | only change if your network has a different name |

## 4. Apply the schema migration

```bash
pnpm db:migrate
```

This runs `api/drizzle/0000_initial_auth_oauth_provider.sql`, which creates all
tables **including `jwks`** (the table that holds the EdDSA signing keys used to
sign ID tokens - without it, token exchange returns HTTP 500).

Fallback if you would rather not install dev deps on the server, apply the SQL
directly:
```bash
psql "$DATABASE_URL" -f api/drizzle/0000_initial_auth_oauth_provider.sql
```

## 5. Seed the users + the FinLens client

```bash
pnpm db:seed
```

This is idempotent (upserts). It:
- creates the two seed users (skips any that already exist), and
- registers the `finlens` OAuth client, storing its secret **hashed**
  (SHA-256 -> base64url). This is why you must seed via the script and never
  hand-insert a plaintext secret: the provider only ever compares hashes.

## 6. Build and run the API container

```bash
docker compose up -d --build
```

Verify it is healthy:
```bash
docker compose ps                       # STATUS should show "healthy"
docker compose logs -f api              # should end with the API listening on 3000
```

## 7. Build and publish the static web bundle

The web image's final stage is a `scratch` image whose only content is the
built `dist/`. Export it straight onto the host path Caddy serves:

```bash
docker build -f web/Dockerfile --target dist \
  --output type=local,dest=/srv/auth/web/dist .
```

`VITE_AUTH_BASE_URL` is left empty on purpose - single-origin means the SPA
calls its own origin's `/api`, so no base URL override is needed.

Confirm the files landed:
```bash
ls /srv/auth/web/dist   # index.html + assets/
```

## 8. Wire up Caddy

Ensure the `auth.pior.ca` block from `Caddyfile.snippet` is imported by your
main Caddyfile (or paste its contents in). It proxies `/api/auth/*`,
`/.well-known/*`, and `/health` to `auth-api:3000`, and serves everything else
from `/srv/auth/web/dist`.

Two things must be true for it to work:
- Caddy is on the `household_private` network (so it can resolve `auth-api`).
- The `/srv/auth/web/dist` host path is mounted into the Caddy container at the
  same path referenced in the snippet.

Reload:
```bash
docker exec <caddy-container> caddy reload --config /etc/caddy/Caddyfile
```

## 9. Verify the deploy

```bash
curl https://auth.pior.ca/health
curl https://auth.pior.ca/api/auth/.well-known/openid-configuration
```

- The discovery document should list `issuer: https://auth.pior.ca/api/auth`,
  plus the `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, and
  `jwks_uri`.
- Fetch the `jwks_uri` and confirm it returns at least one key (proves the
  `jwks` table is populated and the signing key exists).
- Open `https://auth.pior.ca` in a browser - the login page should render.

## 10. Point FinLens at production

On the FinLens prod host, set these (they mirror what worked locally, swapped to
the public HTTPS origin):

```
CENTRAL_AUTH_ISSUER=https://auth.pior.ca/api/auth
CENTRAL_AUTH_DISCOVERY_URL=https://auth.pior.ca/api/auth/.well-known/openid-configuration
CENTRAL_AUTH_CLIENT_ID=finlens
CENTRAL_AUTH_CLIENT_SECRET=<the raw FINLENS_CLIENT_SECRET from step 3>
BETTER_AUTH_URL=https://finance.optiplex.pior.ca
```

- The redirect URI `https://finance.optiplex.pior.ca/api/auth/oauth2/callback/auth-pior`
  is already registered on the client, so no change is needed on the provider.
- Make sure FinLens's reverse proxy forwards `X-Forwarded-Proto: https` so
  secure session cookies are set correctly.
- `CENTRAL_AUTH_CLIENT_SECRET` must be the **raw** value, byte-for-byte the same
  as `FINLENS_CLIENT_SECRET` on the provider - the provider hashes it at compare
  time.

Then run the FinLens login flow end to end and confirm "Continue with pior.ca"
lands you back authenticated.

## Redeploying (day two)

- **Code change to the API:** `git pull` then `docker compose up -d --build`.
- **Code change to the web UI:** rebuild the bundle (step 7) and reload Caddy.
- **New DB migration:** run `pnpm db:migrate` before bringing the new API up.
- **Client config change (redirect URIs, scopes, secret):** edit
  `api/src/oauth-clients.ts` / `.env`, re-run `pnpm db:seed`, then **restart the
  API container** (`docker compose restart api`) - the provider caches trusted
  clients in memory, so changes are not picked up until it restarts.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `invalid_client` on token exchange | secret mismatch, or a plaintext secret was inserted | re-seed via `pnpm db:seed`; confirm FinLens uses the same raw secret |
| HTTP 500 on token exchange, logs mention `jwks` | migration not applied / `jwks` table missing | run `pnpm db:migrate` |
| Login rejected with `iss` / issuer error | `BETTER_AUTH_URL` and `CENTRAL_AUTH_ISSUER` disagree | issuer on FinLens must be `<BETTER_AUTH_URL>/api/auth` exactly |
| `redirect_uri` mismatch | FinLens origin differs from the registered URI | must match scheme + host exactly, no trailing slash |
| Client change not taking effect after re-seed | in-memory trusted-client cache | `docker compose restart api` |
| Caddy 502 on `/api/auth/*` | Caddy cannot resolve `auth-api` | put Caddy on `household_private`; check `docker compose ps` |
