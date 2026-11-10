# Production workflows

Production uses CI-built API and web images, selected by successful main CI run and exact optional attempt. Both manual workflows share the `auth-production` lock on the dedicated Auth runner. They stage exact release configuration beneath `/opt/docker/service-auth/releases/`; neither fetches a moving main branch nor builds on the production server.

The shared PostgreSQL cluster, Auth database, restricted login role, and connection secret are owned by `pior-labs/platform-deploy`. This repository owns the Auth schema migration and seed data.

Both jobs target the GitHub `PRODUCTION` environment. Production secrets and variables may be configured there; repository-level values also remain available.

## Platform prerequisite

Run the `platform-deploy` workflow before the first Auth bootstrap. It must create:

```text
pior_data
/opt/docker/pior-labs/secrets/service-auth/database-url
```

The generated connection string targets database `auth` with the restricted role `auth_app`. It remains on the server and is mounted into the API container as a Compose secret.

## Required production secrets

### `AUTH_ENV`

The production application environment. It must include, at minimum:

```dotenv
API_PORT=3000
NODE_ENV=production
BETTER_AUTH_SECRET=<long-random-secret>
BETTER_AUTH_URL=https://auth.szarans.ca
WEB_ORIGIN=https://auth.szarans.ca
VITE_AUTH_BASE_URL=
FINLENS_CLIENT_SECRET=<shared-finlens-client-secret>
COOKBOOK_CLIENT_SECRET=<shared-cookbook-client-secret>
SEED_USER_1_EMAIL=<email>
SEED_USER_1_NAME=<name>
SEED_USER_1_PASSWORD=<password>
SEED_USER_2_EMAIL=<email>
SEED_USER_2_NAME=<name>
SEED_USER_2_PASSWORD=<password>
```

Do not store `DATABASE_URL`, a database password, or `POSTGRES_ADMIN_URL` in GitHub. The workflows remove legacy database entries from the rendered `.env` before deployment.

Leaving `VITE_AUTH_BASE_URL` blank makes the SPA use whichever Auth origin served it. The canonical OAuth issuer is `https://auth.szarans.ca/api/auth`.

The seeded FinLens client accepts this production callback URL:

```text
https://finance.szarans.ca/api/auth/oauth2/callback/auth-pior
```

The exact `FINLENS_CLIENT_SECRET` value must also be configured in the Finance production environment.

The seeded Cookbook client accepts this production callback URL:

```text
https://cookbook.szarans.ca/api/auth/oauth2/callback/auth-pior
```

The exact `COOKBOOK_CLIENT_SECRET` value must also be configured in the Cookbook production environment.

### `TASKS_CLIENT_SECRET`

Set this as an individual GitHub Actions secret in the `PRODUCTION` environment,
separate from the existing multiline `AUTH_ENV`. Use a generated 32-byte value
encoded as 64 lowercase hex characters (`openssl rand -hex 32`), and supply the
same value as the Tasks application's `CENTRAL_AUTH_CLIENT_SECRET`.

Both Bootstrap and Deploy read this secret explicitly, validate it before
changing `.env`, remove any stale Tasks assignment from the rendered `AUTH_ENV`,
and append the separate value. The remaining `AUTH_ENV` settings stay intact.
The runtime file is private (mode 0600). No existing secret needs to be read back
or replaced to add or rotate this client credential.

Upload only the raw value, not `TASKS_CLIENT_SECRET=...`, from a private file or
stdin. For example, when a mode-0600 file contains only the raw value:

```sh
gh secret set TASKS_CLIENT_SECRET --repo pior-labs/service-auth \
  --env PRODUCTION < /private/path/tasks-client-secret
```

Do not print the value, place it in command arguments, or commit the private
file. The workflows require this individual secret; they do not fall back to an
embedded Tasks value in `AUTH_ENV`. Existing clients remain in `AUTH_ENV` for
now. Secret upload alone does not reseed clients or restart hosted Auth.

Run `pnpm test` to exercise the shared production environment writer's actual shell using synthetic values. The tests do not connect to GitHub or production.

## Optional production variables

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_DATABASE_URL_FILE` | `/opt/docker/pior-labs/secrets/service-auth/database-url` | Host path to the platform-generated Auth connection secret |
| `DATA_NETWORK` | `pior_data` | External Docker network shared with PostgreSQL |

The writer stages these values in the selected release's private `.env`. Active host commands use `$DEPLOY_DIR/current/compose.json`, which contains the resolved configuration.

## Compose model

`docker-compose.yml` remains usable with a direct `DATABASE_URL` for local development. Production adds `docker-compose.production.yml`, which:

- clears any direct `DATABASE_URL`
- mounts the platform-generated URL as `/run/secrets/auth_database_url`
- sets `DATABASE_URL_FILE` inside the API container
- attaches the API to `pior_data`

The API accepts either `DATABASE_URL` or `DATABASE_URL_FILE`; direct values remain useful locally, while production uses the mounted file.

## Canonical hostname and routing

Auth has one production application identity: `auth.szarans.ca`. That hostname is used for the Better Auth base URL, OAuth/OIDC issuer, browser origin, client discovery, and documentation.

Routing is selected below the application layer:

- Tailscale-connected clients use platform split DNS and resolve `auth.szarans.ca` directly to the OptiPlex Tailscale address.
- Other clients resolve the same hostname through public DNS.
- Containers on `pior_edge` resolve `auth.szarans.ca` to the platform Caddy container through Docker DNS.

Applications must not use a separate Tailscale-specific hostname for OAuth or OIDC identity.

## Bootstrap Auth Production

Run this workflow once before the first deployment, and again when seed users or trusted OAuth client configuration must be reconciled.

The workflow:

1. requires the dispatch confirmation `bootstrap-auth`
2. resolves a successful main CI run/attempt and checks out its exact configuration
3. writes the non-database environment from `AUTH_ENV` plus separate `TASKS_CLIENT_SECRET`
4. validates `pior_data` and `pior_edge`
5. validates that the platform-generated database secret can be mounted
6. pulls the verified API image
7. applies the checked-in migration
8. seeds the two users and trusted OAuth clients

Database and role provisioning no longer occurs here. The migration is idempotent for the current schema, and the seed expects exactly two credential users.

## Deploy Auth Production

Run this workflow after bootstrap and after merging production-ready changes.

The workflow:

1. resolves a successful main CI run/attempt and checks out its exact configuration
2. writes the non-database environment from `AUTH_ENV` plus separate `TASKS_CLIENT_SECRET`
3. validates the external networks and database secret mount
4. pulls the verified API and web images
5. applies database migrations
6. recreates the Auth services
7. waits for the API health check inside the container
8. verifies `/health` and `/sign-in` through production Caddy at `https://auth.szarans.ca`
9. requires HTTP 200 from the exact public `/api/auth/.well-known/openid-configuration` endpoint and validates its JSON, canonical issuer, endpoint URLs, and OIDC capabilities

Both images install dependencies from `pnpm-lock.yaml` with `--frozen-lockfile`.
Dependency upgrades must update the lockfile and reconcile any Better Auth schema
changes before deployment. Installing `latest` without the lockfile previously
deployed Better Auth 1.7.7 against the 1.6.20 schema, causing discovery requests to
return HTTP 500 with `SCHEMA_MISMATCH` while `/health` continued to succeed.

Deployment remains manual through `workflow_dispatch`.

### Applying the restart policy change

Both long-running services (`api` and `web`) use `restart: unless-stopped`.
Docker restarts exited containers unless they were explicitly stopped. This
does not restart a container that stays running but becomes unhealthy during a
network outage; health checks report health without triggering a restart.
The migration, seed, and secret-validation jobs use `docker compose run --rm`,
which overrides the service restart policy so these one-off jobs do not restart.

Use **Deploy Auth Production** with a verified main CI run to apply configuration
changes. For manual diagnostics after a successful release:

```bash
cd "$DEPLOY_DIR/current"
export COMPOSE_FILE="$PWD/compose.json"
docker compose config --quiet
docker inspect --format '{{.Name}} {{.HostConfig.RestartPolicy.Name}}' auth-api auth-web
```

Both containers should report `unless-stopped`. `up -d` applies the changed
configuration by recreating the affected containers; `docker compose restart`
does not apply configuration changes. This does not require bootstrap or seeding.

## Runner requirements

The runner executing these workflows must:

- be available to the `service-auth` repository
- have the labels `self-hosted`, `linux`, and `service-auth`
- have Git available for Actions checkout; credentials use the workflow token
- have write access to `/opt/docker/service-auth`
- be able to run Docker without `sudo`
- have Python 3, Bash and `curl` installed

The runner user does not need the database connection string in GitHub. Docker mounts the server-side secret into the API and one-off migration containers.

## Tasks client

The `tasks` client uses `TASKS_CLIENT_SECRET` from private Auth configuration
(a separate GitHub Actions secret in production), matching Tasks' server-only
`CENTRAL_AUTH_CLIENT_SECRET`. Both exact callbacks are registered:

- `http://localhost:5173/api/auth/oauth2/callback/auth-pior`
- `https://tasks.szarans.ca/api/auth/oauth2/callback/auth-pior`

Before activating this change, set the separate `TASKS_CLIENT_SECRET` secret
in the `PRODUCTION` environment. Leave the existing `AUTH_ENV` intact. After
review and merge, run **Bootstrap Auth Production** to upsert the hashed client
secret, then **Deploy Auth Production** to reload cached registrations. Existing
seed-user configuration is still required; do not create replacement users.

## Verified release activation and recovery

CI now runs production-environment regression tests, typechecks, application
builds and API/web Docker builds. Only successful main pushes publish GHCR images
and an attempt-specific `release-<attempt>` manifest. Existing registry package
access must include this repository. PR builds never publish images.

Before first use, set a separate `COMPOSE_PROJECT_NAME` Actions secret matching
the existing production container project label. Keep `AUTH_ENV` and the separately
validated `TASKS_CLIENT_SECRET`; legacy database and client-secret entries are
still removed/replaced by the real environment writer. Platform-managed database
credentials remain a Compose secret, not an Actions database password. The runner
needs Python 3, Bash, curl, and Compose with `up --wait`. `DEPLOY_DIR` defaults to
`/opt/docker/service-auth`; it must be writable and dedicated to Auth.

After merge, wait for all main CI checks and image publication. In either manual
workflow select branch main and enter the **full CI run ID from its URL**, not
the displayed run number. An optional `ci_run_attempt` selects an exact successful
attempt. Bootstrap still requires `bootstrap-auth` and runs migration plus seed
only. It never promotes a deployed-release record or implicitly starts Auth.
Deploy runs migration, waits for API/web health, probes HTTPS health/sign-in, and
validates public OIDC discovery through the shipped verifier. After client
registration changes, bootstrap and then deploy that same verified release to
refresh Auth's in-memory registrations. Both operations are serialized together.

The legacy checkout is not the active configuration after first rollout. For
host operations, use `cd "$DEPLOY_DIR/current"` and
`export COMPOSE_FILE="$PWD/compose.json"`. Resolved configuration contains secrets;
keep it private and never upload it. `.deployments/current.json` and
`previous.json` record healthy deployments. `attempt.json` includes failures;
`bootstrap.json` records successful seeding without changing the current link.
Failure can leave changed schemas, seed data or containers; records do not imply
an automatic recovery. Inspect the attempted runtime when diagnosing it.

Application rollback selects the earlier recorded CI `run_id` and `run_attempt`
through Deploy. It uses current secrets and does not reverse migrations or seed
users/clients. Confirm schema and identity-registration compatibility first.
There is no previous recorded release when first migrating from source builds.
Keep release manifests (90-day Actions retention) and corresponding images,
especially current and previous ones. Host runtime cleanup must preserve selected
runtimes and platform-owned state.
