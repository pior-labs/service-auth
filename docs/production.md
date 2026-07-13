# Production workflows

Production uses a persistent checkout at `/opt/docker/service-auth` on the OptiPlex server. Both workflows run on the dedicated Auth self-hosted runner and update that checkout from `origin/main` before doing any work.

The shared PostgreSQL cluster, Auth database, restricted login role, and connection secret are owned by `pior-labs/platform-deploy`. This repository owns the Auth schema migration and seed data.

## Platform prerequisite

Run the `platform-deploy` workflow before the first Auth bootstrap. It must create:

```text
pior_data
/opt/docker/pior-labs/secrets/service-auth/database-url
```

The generated connection string targets database `auth` with the restricted role `auth_app`. It remains on the server and is mounted into the API container as a Compose secret.

## Required repository secret

### `AUTH_ENV`

The production application environment. It must include, at minimum:

```dotenv
API_PORT=3000
NODE_ENV=production
BETTER_AUTH_SECRET=<long-random-secret>
BETTER_AUTH_URL=https://auth.ts.szarans.ca
WEB_ORIGIN=https://auth.ts.szarans.ca
VITE_AUTH_BASE_URL=
FINLENS_CLIENT_SECRET=<shared-finlens-client-secret>
SEED_USER_1_EMAIL=<email>
SEED_USER_1_NAME=<name>
SEED_USER_1_PASSWORD=<password>
SEED_USER_2_EMAIL=<email>
SEED_USER_2_NAME=<name>
SEED_USER_2_PASSWORD=<password>
```

Do not store `DATABASE_URL`, a database password, or `POSTGRES_ADMIN_URL` in GitHub. The workflows remove legacy database entries from the rendered `.env` before deployment.

Leaving `VITE_AUTH_BASE_URL` blank makes the SPA use whichever Auth origin served it. The canonical OAuth issuer is `https://auth.ts.szarans.ca/api/auth`.

The seeded FinLens client accepts these production callback URLs:

```text
https://finance.ts.szarans.ca/api/auth/oauth2/callback/auth-pior
https://finance.szarans.ca/api/auth/oauth2/callback/auth-pior
```

The exact `FINLENS_CLIENT_SECRET` value must also be configured in the Finance production environment.

## Optional repository variables

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_DATABASE_URL_FILE` | `/opt/docker/pior-labs/secrets/service-auth/database-url` | Host path to the platform-generated Auth connection secret |
| `DATA_NETWORK` | `pior_data` | External Docker network shared with PostgreSQL |

The workflow writes these values and the production Compose override into `/opt/docker/service-auth/.env` so subsequent server-side Compose commands use the same configuration.

## Compose model

`docker-compose.yml` remains usable with a direct `DATABASE_URL` for local development. Production adds `docker-compose.production.yml`, which:

- clears any direct `DATABASE_URL`
- mounts the platform-generated URL as `/run/secrets/auth_database_url`
- sets `DATABASE_URL_FILE` inside the API container
- attaches the API to `pior_data`

The API accepts either `DATABASE_URL` or `DATABASE_URL_FILE`; direct values remain useful locally, while production uses the mounted file.

## Bootstrap Auth Production

Run this workflow once before the first deployment, and again when seed users or trusted OAuth client configuration must be reconciled.

The workflow:

1. requires the dispatch confirmation `bootstrap-auth`
2. pulls `origin/main` into `/opt/docker/service-auth`
3. writes the non-database application environment from `AUTH_ENV`
4. validates `pior_data` and `pior_edge`
5. validates that the platform-generated database secret can be mounted
6. builds the API image
7. applies the checked-in migration
8. seeds the two users and trusted OAuth clients

Database and role provisioning no longer occurs here. The migration is idempotent for the current schema, and the seed expects exactly two credential users.

## Deploy Auth Production

Run this workflow after bootstrap and after merging production-ready changes.

The workflow:

1. pulls `origin/main` into `/opt/docker/service-auth`
2. writes the non-database application environment from `AUTH_ENV`
3. validates the external networks and database secret mount
4. builds the API and web images
5. applies database migrations
6. recreates the Auth services
7. waits for `http://127.0.0.1:3000/health`
8. verifies `/health` and `/sign-in` through the containerized platform Caddy listener on `127.0.0.1:8088`

Deployment remains manual during the platform migration. After repeated successful deployments and the final Caddy cutover, a follow-up change can add a `push` trigger for `main`.

## Runner requirements

The runner executing these workflows must:

- be available to the `service-auth` repository
- have the labels `self-hosted`, `linux`, and `service-auth`
- authenticate the existing checkout's Git remote as the runner service account
- have write access to `/opt/docker/service-auth`
- be able to run Docker without `sudo`
- have `curl` installed

The runner user does not need the database connection string in GitHub. Docker mounts the server-side secret into the API and one-off migration containers.
