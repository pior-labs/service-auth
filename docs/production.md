# Production workflows

Production uses a persistent checkout at `/opt/docker/service-auth` on the OptiPlex server. Both workflows run on a self-hosted Linux runner and update that checkout from `origin/main` before doing any work.

## Required repository secrets

### `AUTH_ENV`

The complete production `.env` file. It must include, at minimum:

```dotenv
API_PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://auth:<url-encoded-password>@postgres:5432/auth
BETTER_AUTH_SECRET=<long-random-secret>
BETTER_AUTH_URL=https://auth.ts.szarans.ca
WEB_ORIGIN=https://auth.ts.szarans.ca
VITE_AUTH_BASE_URL=
SHARED_DOCKER_NETWORK=household_private
FINLENS_CLIENT_SECRET=<shared-finlens-client-secret>
SEED_USER_1_EMAIL=<email>
SEED_USER_1_NAME=<name>
SEED_USER_1_PASSWORD=<password>
SEED_USER_2_EMAIL=<email>
SEED_USER_2_NAME=<name>
SEED_USER_2_PASSWORD=<password>
```

The database password in `DATABASE_URL` must be URL encoded when it contains reserved URL characters.

Leaving `VITE_AUTH_BASE_URL` blank makes the SPA use whichever Auth origin served it. The canonical OAuth issuer remains `https://auth.ts.szarans.ca/api/auth`.

The seeded FinLens client accepts these production callback URLs:

```text
https://finance.ts.szarans.ca/api/auth/oauth2/callback/auth-pior
https://finance.szarans.ca/api/auth/oauth2/callback/auth-pior
```

The exact `FINLENS_CLIENT_SECRET` value must also be configured in the FinLens production environment.

### `POSTGRES_ADMIN_URL`

An administrator connection URL for the shared Postgres instance. The bootstrap workflow uses it only to create or update the Auth database role and logical database.

Example shape:

```text
postgresql://postgres:<url-encoded-admin-password>@postgres:5432/postgres
```

## Bootstrap Auth Production

Run this workflow once before the first deployment, and again only when the database role password, seed users, or trusted OAuth client configuration must be reconciled.

The workflow:

1. requires the dispatch confirmation `bootstrap-auth`
2. pulls `origin/main` into `/opt/docker/service-auth`
3. writes `.env` from `AUTH_ENV`
4. validates `household_private` and `pior_edge`
5. creates the Auth Postgres role and database when missing
6. updates the Auth role password and database ownership
7. builds the API image
8. applies the checked-in migration
9. seeds the two users and trusted OAuth clients

The database and migration operations are idempotent for the current schema. The seed expects exactly two credential users.

## Deploy Auth Production

Run this workflow after bootstrap and after merging production-ready changes.

The workflow:

1. pulls `origin/main` into `/opt/docker/service-auth`
2. writes `.env` from `AUTH_ENV`
3. validates the database URL and required external networks
4. builds the API and web images
5. applies database migrations
6. recreates the Auth services
7. waits for `http://127.0.0.1:3000/health`
8. verifies `/health` and `/sign-in` through the containerized platform Caddy listener on `127.0.0.1:8088`

Deployment is manual during the platform migration. Once the first production deployment and final Caddy cutover are stable, the deploy workflow can add a `push` trigger for `main`.

## Runner requirements

The runner executing these workflows must:

- be available to the `service-auth` repository
- have the labels `self-hosted` and `linux`
- authenticate the existing checkout's Git remote as the runner service account
- have write access to `/opt/docker/service-auth`
- be able to run Docker without `sudo`
- have `curl` and `python3` installed
