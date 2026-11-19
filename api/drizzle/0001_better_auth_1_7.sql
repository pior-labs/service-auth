-- Better Auth 1.7 OAuth provider and JWT schema (workspace ADR 0003, step 5).
--
-- Bootstrap production applies every migration on every release, so each
-- statement must be safe to re-run. Changes are additive: the 1.6 "type" and
-- "public" columns on "oauthClient" stay, so the 1.6 release can still run
-- against this schema. 0002 drops them.

-- Signing key metadata.
ALTER TABLE "jwks" ADD COLUMN IF NOT EXISTS "alg" text;
ALTER TABLE "jwks" ADD COLUMN IF NOT EXISTS "crv" text;

-- Clients.
ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "clientDiscoveryId" text;
ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "clientCredentialsScopes" text[] DEFAULT '{}';
ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "backchannelLogoutUri" text;
ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "backchannelLogoutSessionRequired" boolean;
ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "applicationType" text;
ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "jwks" text;
ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "jwksUri" text;
ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "dpopBoundAccessTokens" boolean DEFAULT false;
ALTER TABLE "oauthClient" ALTER COLUMN "disabled" SET DEFAULT false;

-- Backfill per the 1.7 upgrade guide. Every Pior Labs client is a confidential
-- "web" client using client_secret_post; none uses client_credentials.
-- Migrations rerun on every release; 0002 drops "type", so only backfill
-- while it exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'oauthClient' AND column_name = 'type'
  ) THEN
    UPDATE "oauthClient" SET "applicationType" = "type"
    WHERE "applicationType" IS NULL AND "type" IN ('web', 'native');
  END IF;
END $$;
UPDATE "oauthClient" SET "clientCredentialsScopes" = '{}' WHERE "clientCredentialsScopes" IS NULL;
UPDATE "oauthClient" SET "dpopBoundAccessTokens" = false WHERE "dpopBoundAccessTokens" IS NULL;
UPDATE "oauthClient" SET "disabled" = false WHERE "disabled" IS NULL;

-- Refresh tokens.
ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "authorizationCodeId" text;
ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "resources" text[];
ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "requestedUserInfoClaims" text[];
ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "rotatedAt" timestamp with time zone;
ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "rotationReplayResponse" text;
ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "rotationReplayExpiresAt" timestamp with time zone;
ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "confirmation" jsonb;
-- 1.7 looks refresh tokens up by their stored hash and declares it unique.
CREATE UNIQUE INDEX IF NOT EXISTS "oauthRefreshToken_token_unique" ON "oauthRefreshToken" ("token");
CREATE INDEX IF NOT EXISTS "oauth_refresh_token_authorization_code_idx"
ON "oauthRefreshToken" ("authorizationCodeId");

-- Access tokens.
ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "authorizationCodeId" text;
ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "resources" text[];
ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "requestedUserInfoClaims" text[];
ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "revoked" timestamp with time zone;
ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "confirmation" jsonb;
CREATE INDEX IF NOT EXISTS "oauth_access_token_authorization_code_idx"
ON "oauthAccessToken" ("authorizationCodeId");

-- Consents.
ALTER TABLE "oauthConsent" ADD COLUMN IF NOT EXISTS "resources" text[];
ALTER TABLE "oauthConsent" ADD COLUMN IF NOT EXISTS "requestedUserInfoClaims" text[];

-- Resource servers (RFC 8707). Unused by Pior Labs today; required by 1.7.
CREATE TABLE IF NOT EXISTS "oauthResource" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "accessTokenTtl" integer,
  "refreshTokenTtl" integer,
  "signingAlgorithm" text,
  "signingKeyId" text,
  "allowedScopes" text[],
  "customClaims" jsonb,
  "dpopBoundAccessTokensRequired" boolean DEFAULT false,
  "disabled" boolean DEFAULT false,
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone DEFAULT now(),
  "policyVersion" integer DEFAULT 1,
  "metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "oauthClientResource" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL REFERENCES "oauthClient"("clientId") ON DELETE cascade,
  "resourceId" text NOT NULL REFERENCES "oauthResource"("identifier") ON DELETE cascade,
  "metadata" jsonb,
  "createdAt" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_client_resource_client_resource_idx"
ON "oauthClientResource" ("clientId", "resourceId");
CREATE INDEX IF NOT EXISTS "oauth_client_resource_resource_idx"
ON "oauthClientResource" ("resourceId");

-- Replay protection for client assertion JWTs; "id" is the assertion's jti.
CREATE TABLE IF NOT EXISTS "oauthClientAssertion" (
  "id" text PRIMARY KEY NOT NULL,
  "expiresAt" timestamp with time zone NOT NULL
);
