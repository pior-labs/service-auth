-- Drop the Better Auth 1.6 "type" and "public" columns from "oauthClient"
-- (workspace ADR 0003). 1.7 uses "applicationType" and
-- "tokenEndpointAuthMethod", backfilled by 0001.
--
-- Deploy migrates before it restarts the API, so this ships only after a
-- release that no longer references these columns is running. Safe to re-run.
ALTER TABLE "oauthClient" DROP COLUMN IF EXISTS "type";
ALTER TABLE "oauthClient" DROP COLUMN IF EXISTS "public";
